alter table public.print_requests
  add column if not exists urgent_fallback_at timestamptz,
  add column if not exists requested_priority text,
  add column if not exists priority_price_multiplier numeric(3, 2) not null default 1;

alter table public.print_requests disable trigger z_guard_print_payment_state;

update public.print_requests
set requested_priority = priority
where requested_priority is null;

alter table public.print_requests enable trigger z_guard_print_payment_state;

alter table public.print_requests
  alter column requested_priority set default 'normal',
  alter column requested_priority set not null;

alter table public.print_requests
  drop constraint if exists print_requests_requested_priority_check;

alter table public.print_requests
  add constraint print_requests_requested_priority_check
    check (requested_priority in ('normal', 'urgent'));

alter table public.print_requests
  drop constraint if exists print_requests_priority_price_multiplier_check;

alter table public.print_requests
  add constraint print_requests_priority_price_multiplier_check
    check (priority_price_multiplier in (1, 1.5));

create index if not exists print_requests_urgent_weekly_idx
  on public.print_requests (student_id, created_at)
  where requested_priority = 'urgent';

create index if not exists print_requests_active_urgent_idx
  on public.print_requests (status, priority)
  where status in ('submitted', 'queued', 'processing');

create or replace function public.guard_print_urgent_limits()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  urgent_request boolean := tg_op = 'INSERT';
  weekly_urgent_count integer;
  active_urgent_count integer;
begin
  if tg_op = 'UPDATE' then
    new.requested_priority := old.requested_priority;
    new.priority_price_multiplier := old.priority_price_multiplier;
    urgent_request := old.requested_priority <> 'urgent' and new.priority = 'urgent';
  else
    new.requested_priority := new.priority;
    new.priority_price_multiplier := case when new.priority = 'urgent' then 1.5 else 1 end;
  end if;

  if new.priority = 'urgent' and urgent_request then
    perform pg_advisory_xact_lock(hashtext('printpulse_urgent_quota'), hashtext(new.student_id::text));
    select count(*) into weekly_urgent_count
    from public.print_requests
    where student_id = new.student_id
      and requested_priority = 'urgent'
      and created_at >= date_trunc('week', now());

    if weekly_urgent_count >= 2 then
      raise exception 'You have used both urgent print requests for this week. Choose the normal queue to continue.';
    end if;
  end if;

  if new.priority = 'urgent'
     and (
       new.status = 'payment_pending'
       or (
         new.status in ('submitted', 'queued', 'processing')
         and new.payment_status in ('paid', 'not_required')
         and new.file_path is not null
       )
     ) then
    perform pg_advisory_xact_lock(hashtext('printpulse_urgent_lane'), 1);
    select count(*) into active_urgent_count
    from public.print_requests
    where id is distinct from new.id
      and priority = 'urgent'
      and (
        status = 'payment_pending'
        or (
          status in ('submitted', 'queued', 'processing')
          and payment_status in ('paid', 'not_required')
          and file_path is not null
        )
      );

    if active_urgent_count >= 3 then
      new.priority := 'normal';
      new.priority_price_multiplier := 1;
      new.urgent_fallback_at := now();
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists zz_guard_print_urgent_limits on public.print_requests;
create trigger zz_guard_print_urgent_limits
  before insert or update on public.print_requests
  for each row execute function public.guard_print_urgent_limits();

create or replace function public.apply_urgent_print_surcharge()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.estimated_cost := round(new.estimated_cost * new.priority_price_multiplier, 2);
  return new;
end;
$$;

drop trigger if exists zzz_print_urgent_surcharge on public.print_requests;
create trigger zzz_print_urgent_surcharge
  before insert on public.print_requests
  for each row execute function public.apply_urgent_print_surcharge();

create or replace function public.get_print_queue_info()
returns table (
  pending integer,
  processing integer,
  my_position integer,
  estimated_wait_minutes integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  pending_count integer := 0;
  processing_count integer := 0;
  my_position integer;
  avg_minutes integer := 4;
begin
  select
    count(*) filter (where status in ('submitted', 'queued')),
    count(*) filter (where status = 'processing')
  into pending_count, processing_count
  from public.print_requests
  where payment_status in ('paid', 'not_required')
    and file_path is not null
    and status in ('submitted', 'queued', 'processing');

  with ordered_jobs as (
    select
      student_id,
      row_number() over (
        order by
          case when priority = 'urgent' then 0 else 1 end,
          case when priority = 'normal' then urgent_fallback_at end desc nulls last,
          created_at asc,
          id asc
      ) as position
    from public.print_requests
    where payment_status in ('paid', 'not_required')
      and file_path is not null
      and status in ('submitted', 'queued', 'processing')
  )
  select min(position)::integer into my_position
  from ordered_jobs
  where student_id = auth.uid();

  select coalesce(max(avg_processing_minutes), 4) into avg_minutes
  from public.print_queue_settings;

  return query
    select pending_count, processing_count, my_position,
      greatest(coalesce(my_position, 1) - 1, 0) * avg_minutes;
end;
$$;

revoke all on function public.guard_print_urgent_limits() from public;
revoke all on function public.apply_urgent_print_surcharge() from public;
revoke all on function public.get_print_queue_info() from public;
grant execute on function public.get_print_queue_info() to authenticated;
