create table if not exists public.institutional_email_domains (
  domain text primary key check (domain = lower(domain) and domain ~ '^[a-z0-9.-]+$')
);

insert into public.institutional_email_domains(domain)
values ('college.edu.in')
on conflict (domain) do nothing;

alter table public.institutional_email_domains enable row level security;
revoke all on public.institutional_email_domains from public, anon, authenticated;

create or replace function public.is_institutional_email(p_email text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    exists (
      select 1
      from public.institutional_email_domains allowed
      where lower(split_part(coalesce(p_email, ''), '@', 2)) = allowed.domain
        and split_part(coalesce(p_email, ''), '@', 1) <> ''
        and cardinality(string_to_array(coalesce(p_email, ''), '@')) = 2
    ),
    false
  );
$$;
revoke all on function public.is_institutional_email(text) from public, anon, authenticated;
grant execute on function public.is_institutional_email(text) to authenticated;

create or replace function public.enforce_auth_institutional_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_institutional_email(new.email) then
    raise exception using errcode = '23514', message = 'Use an approved institutional email address.';
  end if;
  return new;
end;
$$;

drop trigger if exists auth_users_institutional_email on auth.users;
create trigger auth_users_institutional_email
before insert or update of email on auth.users
for each row execute function public.enforce_auth_institutional_email();

create or replace function public.enforce_profile_institutional_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_institutional_email(new.email) then
    raise exception using errcode = '23514', message = 'Use an approved institutional email address.';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_institutional_email on public.profiles;
create trigger profiles_institutional_email
before insert or update of email on public.profiles
for each row execute function public.enforce_profile_institutional_email();

alter table public.mentor_group_activity_records
  alter column imported_by drop not null,
  alter column verified_at drop not null,
  alter column verified_at drop default,
  add column if not exists submitted_by uuid references public.profiles(id) on delete set null,
  add column if not exists verified_by uuid references public.profiles(id) on delete set null,
  add column if not exists verification_status text not null default 'verified'
    check (verification_status in ('pending', 'verified', 'rejected'));

update public.mentor_group_activity_records
set verified_by = imported_by
where verification_status = 'verified' and verified_by is null;

alter table public.mentor_group_activity_records
  alter column verification_status set default 'pending';

create or replace function public.guard_mentor_group_activity_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.proof_url is not null and (
    char_length(new.proof_url) > 2000
    or new.proof_url !~* '^https://[a-z0-9.-]+\.[a-z0-9-]{2,}(:[0-9]{1,5})?([/?#]|$)'
    or new.proof_url ~* '^https://([^/]+\.)?(localhost|local|internal)(:[0-9]+)?([/?#]|$)'
    or new.proof_url ~* '^https://[0-9.]+(:[0-9]+)?([/?#]|$)'
  ) then
    raise exception 'Proof links must use HTTPS and a public DNS hostname.';
  end if;

  if tg_op = 'INSERT' then
    if new.imported_by is not null then
      if new.imported_by is distinct from auth.uid()
         or new.submitted_by is not null
         or public.app_role() not in ('faculty', 'admin')
         or not (public.is_admin() or public.is_group_mentor(new.group_id)) then
        raise exception 'Only this group mentor may import verified activity records.';
      end if;
      new.verification_status := 'verified';
      new.verified_by := auth.uid();
      new.verified_at := coalesce(new.verified_at, now());
    else
      if auth.uid() is null
         or public.app_role() <> 'student'
         or new.student_id is distinct from auth.uid()
         or new.submitted_by is distinct from auth.uid()
         or new.verification_status <> 'pending'
         or new.verified_by is not null
         or new.verified_at is not null
         or not exists (
           select 1
           from public.mentor_group_members member
           where member.group_id = new.group_id
             and member.user_id = auth.uid()
             and member.member_role = 'student'
         ) then
        raise exception 'Students may submit activity only for themselves in their own mentor group.';
      end if;
    end if;
    return new;
  end if;

  if new.id is distinct from old.id
     or new.group_id is distinct from old.group_id
     or new.student_id is distinct from old.student_id
     or new.source is distinct from old.source
     or new.source_record_id is distinct from old.source_record_id
     or new.imported_by is distinct from old.imported_by
     or new.submitted_by is distinct from old.submitted_by
     or new.imported_at is distinct from old.imported_at then
    raise exception 'Activity ownership and source fields cannot be changed.';
  end if;

  if old.verification_status = 'pending'
     and old.student_id = auth.uid()
     and old.submitted_by = auth.uid()
     and public.app_role() = 'student' then
    if new.verification_status <> 'pending'
       or new.verified_by is distinct from old.verified_by
       or new.verified_at is distinct from old.verified_at then
      raise exception 'Students can edit only their own unreviewed activity proof.';
    end if;
    return new;
  end if;

  if old.verification_status = 'pending'
     and public.app_role() in ('faculty', 'admin')
     and (public.is_admin() or public.is_group_mentor(old.group_id)) then
    if new.verification_status not in ('verified', 'rejected')
       or new.category is distinct from old.category
       or new.activity_type is distinct from old.activity_type
       or new.title is distinct from old.title
       or new.source is distinct from old.source
       or new.occurred_at is distinct from old.occurred_at
       or new.proof_url is distinct from old.proof_url
       or new.verified_by is distinct from auth.uid()
       or new.verified_at is null then
      raise exception 'Mentors may only verify or reject pending activity proofs.';
    end if;
    return new;
  end if;

  raise exception 'Not authorized to modify this activity record.';
end;
$$;

drop trigger if exists mentor_group_activity_write_guard on public.mentor_group_activity_records;
create trigger mentor_group_activity_write_guard
before insert or update on public.mentor_group_activity_records
for each row execute function public.guard_mentor_group_activity_write();

drop policy if exists "Students read their group activity and mentors read group activity"
  on public.mentor_group_activity_records;
create policy "Students read their own activity and assigned mentors read group activity"
  on public.mentor_group_activity_records for select to authenticated
  using (
    public.is_institutional_email(auth.jwt() ->> 'email')
    and (
      public.is_admin()
      or (
        public.app_role() = 'faculty'
        and public.is_group_mentor(group_id)
      )
      or (
        public.app_role() = 'student'
        and student_id = auth.uid()
        and public.is_group_member(group_id)
      )
    )
  );

drop policy if exists "Group mentors import verified student activity"
  on public.mentor_group_activity_records;
create policy "Group mentors import verified student activity"
  on public.mentor_group_activity_records for insert to authenticated
  with check (
    imported_by = auth.uid()
    and public.is_institutional_email(auth.jwt() ->> 'email')
    and submitted_by is null
    and verification_status = 'verified'
    and verified_by = auth.uid()
    and public.app_role() in ('faculty', 'admin')
    and (public.is_admin() or public.is_group_mentor(group_id))
    and exists (
      select 1
      from public.mentor_group_members member
      join public.profiles student on student.id = member.user_id
      where member.group_id = mentor_group_activity_records.group_id
        and member.user_id = mentor_group_activity_records.student_id
        and member.member_role = 'student'
        and student.role = 'student'
    )
  );

drop policy if exists "Students submit their own activity proofs"
  on public.mentor_group_activity_records;
create policy "Students submit their own activity proofs"
  on public.mentor_group_activity_records for insert to authenticated
  with check (
    student_id = auth.uid()
    and public.is_institutional_email(auth.jwt() ->> 'email')
    and submitted_by = auth.uid()
    and imported_by is null
    and verification_status = 'pending'
    and verified_by is null
    and verified_at is null
    and public.app_role() = 'student'
    and exists (
      select 1
      from public.mentor_group_members member
      where member.group_id = mentor_group_activity_records.group_id
        and member.user_id = auth.uid()
        and member.member_role = 'student'
    )
  );

drop policy if exists "Students edit their own pending activity proofs"
  on public.mentor_group_activity_records;
create policy "Students edit their own pending activity proofs"
  on public.mentor_group_activity_records for update to authenticated
  using (
    student_id = auth.uid()
    and public.is_institutional_email(auth.jwt() ->> 'email')
    and submitted_by = auth.uid()
    and verification_status = 'pending'
    and public.is_group_member(group_id)
    and public.app_role() = 'student'
  )
  with check (
    student_id = auth.uid()
    and public.is_institutional_email(auth.jwt() ->> 'email')
    and submitted_by = auth.uid()
    and verification_status = 'pending'
    and public.is_group_member(group_id)
    and public.app_role() = 'student'
  );

drop policy if exists "Group mentors verify student activity"
  on public.mentor_group_activity_records;
create policy "Group mentors verify student activity"
  on public.mentor_group_activity_records for update to authenticated
  using (
    verification_status = 'pending'
    and public.app_role() in ('faculty', 'admin')
    and public.is_institutional_email(auth.jwt() ->> 'email')
    and (public.is_admin() or public.is_group_mentor(group_id))
  )
  with check (
    verification_status in ('verified', 'rejected')
    and public.is_institutional_email(auth.jwt() ->> 'email')
    and verified_by = auth.uid()
    and public.app_role() in ('faculty', 'admin')
    and (public.is_admin() or public.is_group_mentor(group_id))
  );

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'mentor_group_activity_records'
  ) then
    alter publication supabase_realtime add table public.mentor_group_activity_records;
  end if;
end;
$$;
