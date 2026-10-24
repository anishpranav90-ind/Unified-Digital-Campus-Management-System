-- =============================================================================
-- UniSync — helpers, integrity triggers and privileged functions
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Role helpers (SECURITY DEFINER so RLS policies do not recurse on profiles)
-- ---------------------------------------------------------------------------
create or replace function public.app_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select role from public.profiles where id = auth.uid()), 'anon');
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.is_faculty()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('faculty', 'admin')
  );
$$;

create or replace function public.is_print_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_faculty();
$$;

create or replace function public.is_group_member(target_group uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.mentor_group_members
    where group_id = target_group and user_id = auth.uid()
  );
$$;

create or replace function public.is_group_mentor(target_group uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.mentor_groups
    where id = target_group and mentor_id = auth.uid()
  );
$$;

create or replace function public.can_access_maintenance(target_request uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.maintenance_requests request
    where request.id = target_request
      and (
        request.student_id = auth.uid()
        or public.is_admin()
        or request.assigned_to = auth.uid()
        or (public.app_role() = 'faculty' and request.status = 'submitted')
      )
  );
$$;

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists timetable_set_updated_at on public.timetable_entries;
create trigger timetable_set_updated_at
  before update on public.timetable_entries
  for each row execute function public.set_updated_at();

drop trigger if exists print_settings_set_updated_at on public.print_queue_settings;
create trigger print_settings_set_updated_at
  before update on public.print_queue_settings
  for each row execute function public.set_updated_at();

drop trigger if exists print_requests_set_updated_at on public.print_requests;
create trigger print_requests_set_updated_at
  before update on public.print_requests
  for each row execute function public.set_updated_at();

drop trigger if exists opportunities_set_updated_at on public.opportunities;
create trigger opportunities_set_updated_at
  before update on public.opportunities
  for each row execute function public.set_updated_at();

drop trigger if exists messages_set_updated_at on public.group_messages;
create trigger messages_set_updated_at
  before update on public.group_messages
  for each row execute function public.set_updated_at();

drop trigger if exists maintenance_set_updated_at on public.maintenance_requests;
create trigger maintenance_set_updated_at
  before update on public.maintenance_requests
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Profile creation for new auth users. Role is ALWAYS student; role elevation
-- only happens through the audited set_user_role() function.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  dept uuid;
  sem smallint;
begin
  begin
    dept := nullif(new.raw_user_meta_data->>'department_id', '')::uuid;
  exception when others then
    dept := null;
  end;

  begin
    sem := nullif(new.raw_user_meta_data->>'semester', '')::smallint;
    if sem is not null and sem not between 1 and 8 then
      sem := null;
    end if;
  exception when others then
    sem := null;
  end;

  insert into public.profiles (id, full_name, email, department_id, roll_number, semester)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), split_part(coalesce(new.email, 'student'), '@', 1)),
    coalesce(new.email, new.id::text),
    dept,
    nullif(new.raw_user_meta_data->>'roll_number', ''),
    sem
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Role self-assignment guard. Keeps "students cannot become admins" true even
-- if someone calls the REST API directly.
-- ---------------------------------------------------------------------------
create or replace function public.guard_profile_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Database/service-role maintenance (seeding, migrations) is trusted and
  -- bypasses UI guards. PostgREST exposes the JWT role as a claim; direct SQL
  -- editor sessions run as a superuser role.
  if current_user in ('postgres', 'service_role', 'supabase_admin')
     or coalesce(
       current_setting('request.jwt.claim.role', true),
       nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'
     ) = 'service_role' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if auth.uid() = new.id and new.role <> 'student' then
      raise exception 'New accounts cannot self-assign a privileged role.';
    end if;
    return new;
  end if;

  if new.role is distinct from old.role then
    if auth.uid() = old.id then
      raise exception 'You cannot change your own role.';
    end if;
    if not public.is_admin() then
      raise exception 'Only administrators can change roles.';
    end if;
  end if;

  if new.email is distinct from old.email and not public.is_admin() then
    raise exception 'Email changes must go through account settings.';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_guard_write on public.profiles;
create trigger profiles_guard_write
  before insert or update on public.profiles
  for each row execute function public.guard_profile_write();

-- ---------------------------------------------------------------------------
-- Timetable conflicts: prevent classroom double-booking and faculty overlap
-- for the same academic year and weekday.
-- ---------------------------------------------------------------------------
create or replace function public.prevent_timetable_conflict()
returns trigger
language plpgsql
as $$
begin
  if new.end_time <= new.start_time then
    raise exception 'The end time must be after the start time.';
  end if;

  if exists (
    select 1 from public.timetable_entries entry
    where entry.id <> coalesce(new.id, gen_random_uuid())
      and entry.classroom_id = new.classroom_id
      and entry.day_of_week = new.day_of_week
      and entry.academic_year = new.academic_year
      and entry.start_time < new.end_time
      and entry.end_time > new.start_time
  ) then
    raise exception 'That classroom is already booked during this time slot.';
  end if;

  if exists (
    select 1 from public.timetable_entries entry
    where entry.id <> coalesce(new.id, gen_random_uuid())
      and entry.faculty_id = new.faculty_id
      and entry.day_of_week = new.day_of_week
      and entry.academic_year = new.academic_year
      and entry.start_time < new.end_time
      and entry.end_time > new.start_time
  ) then
    raise exception 'This faculty member already teaches another class during this time slot.';
  end if;

  return new;
end;
$$;

drop trigger if exists timetable_conflict_guard on public.timetable_entries;
create trigger timetable_conflict_guard
  before insert or update on public.timetable_entries
  for each row execute function public.prevent_timetable_conflict();

-- ---------------------------------------------------------------------------
-- Print pricing is authoritative in the database. A student cannot submit a
-- lower cost, and cannot update anything except cancelling an unprinted job.
-- ---------------------------------------------------------------------------
create or replace function public.price_print_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  settings public.print_queue_settings;
begin
  select * into settings from public.print_queue_settings order by updated_at limit 1;

  if tg_op = 'INSERT' then
    if settings.id is not null then
      if settings.max_pages_per_job is not null and new.pages > settings.max_pages_per_job then
        raise exception 'This queue accepts up to % pages per job.', settings.max_pages_per_job;
      end if;
      new.estimated_cost := round(
        (case
          when new.color_mode = 'color' and new.sides = 'double' then settings.color_double
          when new.color_mode = 'color' then settings.color_single
          when new.sides = 'double' then settings.bw_double
          else settings.bw_single
        end) * new.pages * new.copies,
        2
      );
      new.print_mode := settings.printer_mode;
    end if;
    -- Students always enter the queue as Submitted. Service-role seeding may
    -- insert historical jobs in their final demonstration states.
    if current_setting('request.jwt.claim.role', true) <> 'service_role' then
      new.status := 'submitted';
    end if;
    return new;
  end if;

  if auth.uid() = old.student_id and public.app_role() = 'student' then
    if new.status <> 'cancelled' or old.status not in ('submitted', 'queued') then
      raise exception 'Students may only cancel a job that has not started printing.';
    end if;
    if new.document_name is distinct from old.document_name
      or new.pages is distinct from old.pages
      or new.copies is distinct from old.copies
      or new.estimated_cost is distinct from old.estimated_cost
      or new.student_id is distinct from old.student_id
      or new.file_path is distinct from old.file_path then
      raise exception 'Students cannot modify print job details.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists print_request_pricing on public.print_requests;
create trigger print_request_pricing
  before insert or update on public.print_requests
  for each row execute function public.price_print_request();

-- ---------------------------------------------------------------------------
-- Queue snapshot for the current student. Aggregates only — never document
-- data — so it is safe to expose through RPC.
-- ---------------------------------------------------------------------------
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
  where status in ('submitted', 'queued', 'processing');

  select min(created_at) into my_created
  from public.print_requests
  where student_id = auth.uid()
    and status in ('submitted', 'queued', 'processing');

  select coalesce(max(avg_processing_minutes), 4) into avg_minutes
  from public.print_queue_settings;

  if my_created is null then
    return query select pending_count, processing_count, null::integer, 0;
    return;
  end if;

  select count(*) + 1 into position
  from public.print_requests
  where status in ('submitted', 'queued', 'processing')
    and created_at <= my_created;

  return query
    select pending_count, processing_count, position, greatest(position - 1, 0) * avg_minutes;
end;
$$;

-- ---------------------------------------------------------------------------
-- Audited role management. Only administrators, never self, never the last
-- administrator. The app calls this via supabase.rpc('set_user_role', ...).
-- ---------------------------------------------------------------------------
create or replace function public.set_user_role(target_user uuid, new_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  previous_role text;
  admin_count integer;
begin
  if not public.is_admin() then
    raise exception 'Administrator access required.';
  end if;

  if target_user = auth.uid() then
    raise exception 'You cannot change your own role.';
  end if;

  if new_role not in ('student', 'faculty', 'admin') then
    raise exception 'Invalid role.';
  end if;

  select role into previous_role from public.profiles where id = target_user;
  if previous_role is null then
    raise exception 'User not found.';
  end if;

  if previous_role = 'admin' and new_role <> 'admin' then
    select count(*) into admin_count from public.profiles where role = 'admin';
    if admin_count <= 1 then
      raise exception 'At least one administrator is required.';
    end if;
  end if;

  update public.profiles set role = new_role where id = target_user;

  insert into public.audit_logs (actor_id, action, entity, entity_id, details)
  values (
    auth.uid(),
    'user.role_changed',
    'profiles',
    target_user,
    jsonb_build_object('from', previous_role, 'to', new_role)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Notification fan-out. New messages, print jobs, announcements and complaint
-- updates legitimately notify other users; notifications RLS only allows self
-- inserts, so trusted fan-out goes through this guarded function instead of
-- exposing a service-role key to the app server.
--
-- Rules: faculty/admin may notify anyone. Everyone else may notify
-- administrators/faculty, themselves, or somebody who shares a MentorLoop group.
-- ---------------------------------------------------------------------------
create or replace function public.notify_users(
  target_ids uuid[],
  p_title text,
  p_body text,
  p_link text,
  p_type text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  forbidden integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;

  if p_type not in ('announcement', 'timetable', 'print', 'message', 'opportunity', 'maintenance', 'system') then
    raise exception 'Invalid notification type.';
  end if;

  if not public.is_faculty() then
    select count(*)
    into forbidden
    from unnest(target_ids) as target(id)
    join public.profiles profile on profile.id = target.id
    where profile.id <> auth.uid()
      and profile.role = 'student'
      and not exists (
        select 1
        from public.mentor_group_members mine
        join public.mentor_group_members other on other.group_id = mine.group_id
        where mine.user_id = auth.uid()
          and other.user_id = profile.id
      );
  end if;

  if forbidden > 0 then
    raise exception 'You are not allowed to notify those users.';
  end if;

  insert into public.notifications (user_id, title, body, link, type)
  select target.id, p_title, p_body, p_link, p_type
  from unnest(target_ids) as target(id)
  join public.profiles profile on profile.id = target.id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Storage path helper: private maintenance photos are only readable by the
-- reporter, assigned staff, faculty or administrators of that complaint.
-- Supports <user_id>/<file> uploads and resolution/<request_id>/<file> evidence.
-- ---------------------------------------------------------------------------
create or replace function public.can_access_maintenance_photo(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  folders text[] := storage.foldername(object_name);
  request_id uuid;
begin
  if coalesce(folders[1], '') = auth.uid()::text then
    return true;
  end if;

  if coalesce(folders[1], '') = 'resolution' and folders[2] is not null then
    begin
      request_id := folders[2]::uuid;
    exception when others then
      return false;
    end;
    return exists (
      select 1 from public.maintenance_requests request
      where request.id = request_id
        and (request.student_id = auth.uid() or request.assigned_to = auth.uid() or public.is_faculty())
    );
  end if;

  return public.is_faculty();
end;
$$;

revoke all on function public.set_user_role(uuid, text) from public;
grant execute on function public.set_user_role(uuid, text) to authenticated;
grant execute on function public.get_print_queue_info() to authenticated;
grant execute on function public.notify_users(uuid[], text, text, text, text) to authenticated;
grant execute on function public.can_access_maintenance_photo(text) to authenticated;
