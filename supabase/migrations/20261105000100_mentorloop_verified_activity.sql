create table if not exists public.mentor_group_activity_records (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.mentor_groups(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  category text not null check (category in ('tech', 'research', 'culturals', 'sports')),
  activity_type text not null check (
    activity_type in ('google_form_submission', 'hackathon_registration', 'paper_publication', 'other')
  ),
  title text not null check (char_length(title) between 1 and 200),
  source text not null check (char_length(source) between 1 and 120),
  source_record_id text not null check (char_length(source_record_id) between 1 and 160),
  occurred_at timestamptz not null,
  proof_url text check (proof_url is null or proof_url ~* '^https://'),
  imported_by uuid not null references public.profiles(id) on delete restrict,
  imported_at timestamptz not null default now(),
  verified_at timestamptz not null default now(),
  constraint mentor_group_activity_source_record_unique
    unique (group_id, student_id, source, source_record_id)
);

create index if not exists mentor_group_activity_group_occurred_idx
  on public.mentor_group_activity_records(group_id, occurred_at desc);
create index if not exists mentor_group_activity_student_idx
  on public.mentor_group_activity_records(group_id, student_id, occurred_at desc);

alter table public.mentor_group_activity_records enable row level security;

drop policy if exists "Students read their group activity and mentors read group activity"
  on public.mentor_group_activity_records;
create policy "Students read their group activity and mentors read group activity"
  on public.mentor_group_activity_records for select to authenticated
  using (
    public.is_admin()
    or public.is_group_mentor(group_id)
    or (student_id = auth.uid() and public.is_group_member(group_id))
  );

drop policy if exists "Group mentors import verified student activity"
  on public.mentor_group_activity_records;
create policy "Group mentors import verified student activity"
  on public.mentor_group_activity_records for insert to authenticated
  with check (
    imported_by = auth.uid()
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
