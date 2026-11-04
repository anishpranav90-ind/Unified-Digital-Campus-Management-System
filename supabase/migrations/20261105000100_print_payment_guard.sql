alter table public.print_requests
  add column if not exists payment_reference text;

alter table public.print_requests
  alter column payment_status set default 'unpaid';

alter table public.print_requests
  drop constraint if exists print_requests_payment_method_check;

update public.print_requests
set payment_method = 'none'
where payment_method not in ('none', 'cash', 'upi');

alter table public.print_requests
  add constraint print_requests_payment_method_check
  check (payment_method in ('none', 'cash', 'upi'));

-- Existing jobs not yet handed to a printer must be verified before entering
-- the queue. Jobs already processing are grandfathered so staff can complete
-- work that was dispatched before this guard was installed.
update public.print_requests
set payment_status = 'unpaid',
    payment_method = 'cash',
    payment_reference = null
where status in ('submitted', 'queued')
  and payment_status <> 'paid';

create or replace function public.guard_print_payment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_setting('request.jwt.claim.role', true) = 'service_role' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if public.app_role() <> 'student' then
      raise exception 'Only students may submit print requests.';
    end if;
    if new.payment_method not in ('cash', 'upi') then
      raise exception 'Select cash or UPI for the print request.';
    end if;
    if new.file_path is not null
      and split_part(new.file_path, '/', 1) <> auth.uid()::text then
      raise exception 'Print documents must be staged in the submitting student folder.';
    end if;
    new.payment_status := 'unpaid';
    new.payment_reference := null;
    new.status := 'submitted';
    return new;
  end if;

  if new.payment_method is distinct from old.payment_method then
    raise exception 'The payment method cannot be changed after submission.';
  end if;

  if new.payment_status is distinct from old.payment_status then
    if old.payment_status <> 'unpaid' or new.payment_status <> 'paid' then
      raise exception 'Print payment status can only transition from unpaid to verified.';
    end if;
    if not public.is_print_staff() then
      raise exception 'Only print desk staff may verify payment.';
    end if;
    if new.status <> 'queued' or old.status not in ('submitted', 'queued') then
      raise exception 'Payment can only be verified for a pending print request.';
    end if;
    if new.payment_method = 'upi'
      and nullif(btrim(new.payment_reference), '') is null then
      raise exception 'A UPI transaction reference is required.';
    end if;
    if new.payment_method = 'cash' and new.payment_reference is not null then
      raise exception 'Cash verification must not include a UPI reference.';
    end if;
  elsif new.payment_reference is distinct from old.payment_reference then
    raise exception 'The payment reference can only be saved during verification.';
  end if;

  if new.status is distinct from old.status
    and new.status in ('queued', 'processing', 'ready', 'completed')
    and new.payment_status <> 'paid' then
    if not (
      old.status = 'processing'
      and old.payment_status = 'not_required'
      and new.status in ('ready', 'completed')
    ) then
      raise exception 'Verify payment before moving this request into the print queue.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists zz_print_payment_guard on public.print_requests;
create trigger zz_print_payment_guard
  before insert or update on public.print_requests
  for each row execute function public.guard_print_payment();

drop policy if exists "Print owners and staff read documents" on storage.objects;
create policy "Print owners and verified print staff read documents"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'print-documents'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or (
        public.is_print_staff()
        and exists (
          select 1
          from public.print_requests
          where file_path = name
            and payment_status = 'paid'
        )
      )
    )
  );

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
  my_created timestamptz;
  position integer;
  avg_minutes integer := 4;
begin
  select
    count(*) filter (where status in ('submitted', 'queued')),
    count(*) filter (where status = 'processing')
  into pending_count, processing_count
  from public.print_requests
  where status in ('submitted', 'queued', 'processing')
    and payment_status in ('paid', 'not_required');

  select min(created_at) into my_created
  from public.print_requests
  where student_id = auth.uid()
    and status in ('submitted', 'queued', 'processing')
    and payment_status in ('paid', 'not_required');

  select coalesce(max(avg_processing_minutes), 4) into avg_minutes
  from public.print_queue_settings;

  if my_created is null then
    return query select pending_count, processing_count, null::integer, 0;
    return;
  end if;

  select count(*) + 1 into position
  from public.print_requests
  where status in ('submitted', 'queued', 'processing')
    and payment_status in ('paid', 'not_required')
    and created_at <= my_created;

  return query
    select pending_count, processing_count, position, greatest(position - 1, 0) * avg_minutes;
end;
$$;
