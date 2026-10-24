-- =============================================================================
-- UniSync — core schema
-- Run in the Supabase SQL Editor or with `supabase db push`.
-- PostgreSQL 15+ (Supabase).
-- =============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Reference data
-- ---------------------------------------------------------------------------
create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  email text not null unique,
  role text not null default 'student' check (role in ('student', 'faculty', 'admin')),
  department_id uuid references public.departments (id) on delete set null,
  roll_number text,
  phone text,
  avatar_url text,
  interests text[] not null default '{}',
  semester smallint check (semester between 1 and 8),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_role_idx on public.profiles (role);
create index if not exists profiles_department_idx on public.profiles (department_id);

-- ---------------------------------------------------------------------------
-- Announcements
-- ---------------------------------------------------------------------------
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 3 and 140),
  body text not null check (char_length(body) between 5 and 8000),
  category text not null default 'general'
    check (category in ('general', 'academic', 'exam', 'event', 'urgent')),
  audience text not null default 'all'
    check (audience in ('all', 'students', 'faculty', 'admins')),
  author_id uuid not null references public.profiles (id) on delete cascade,
  attachment_path text,
  attachment_name text,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists announcements_audience_idx
  on public.announcements (audience, published_at desc);

create table if not exists public.announcement_reads (
  announcement_id uuid not null references public.announcements (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (announcement_id, user_id)
);

-- ---------------------------------------------------------------------------
-- Timetable
-- ---------------------------------------------------------------------------
create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  department_id uuid references public.departments (id) on delete set null,
  semester smallint not null check (semester between 1 and 8),
  color text not null default '#2563eb',
  created_at timestamptz not null default now()
);

create table if not exists public.classrooms (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  building text not null,
  capacity integer not null default 60 check (capacity > 0),
  created_at timestamptz not null default now()
);

create table if not exists public.timetable_entries (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects (id) on delete cascade,
  faculty_id uuid not null references public.profiles (id) on delete restrict,
  classroom_id uuid not null references public.classrooms (id) on delete restrict,
  day_of_week smallint not null check (day_of_week between 1 and 6),
  start_time time not null,
  end_time time not null,
  semester smallint not null check (semester between 1 and 8),
  section text not null default 'A',
  academic_year text not null default '2026-27',
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint timetable_time_order check (end_time > start_time)
);

create index if not exists timetable_day_idx on public.timetable_entries (day_of_week, start_time);
create index if not exists timetable_classroom_idx
  on public.timetable_entries (classroom_id, day_of_week, academic_year);
create index if not exists timetable_faculty_idx
  on public.timetable_entries (faculty_id, day_of_week, academic_year);

create table if not exists public.exam_schedules (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects (id) on delete cascade,
  exam_date date not null,
  start_time time not null,
  end_time time not null,
  room text not null,
  exam_type text not null default 'midterm'
    check (exam_type in ('midterm', 'end_semester', 'practical', 'viva')),
  semester smallint not null check (semester between 1 and 8),
  created_at timestamptz not null default now(),
  constraint exam_time_order check (end_time > start_time)
);

create index if not exists exams_date_idx on public.exam_schedules (exam_date);

create table if not exists public.timetable_correction_requests (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.timetable_entries (id) on delete cascade,
  requested_by uuid not null references public.profiles (id) on delete cascade,
  reason text not null check (char_length(reason) between 10 and 1000),
  status text not null default 'pending' check (status in ('pending', 'resolved')),
  admin_note text,
  created_at timestamptz not null default now()
);

create index if not exists corrections_status_idx
  on public.timetable_correction_requests (status, created_at desc);

-- ---------------------------------------------------------------------------
-- PrintPulse
-- ---------------------------------------------------------------------------
create sequence if not exists public.print_request_seq start with 1100;

create table if not exists public.print_queue_settings (
  id uuid primary key default gen_random_uuid(),
  bw_single numeric(10, 2) not null default 2 check (bw_single >= 0),
  bw_double numeric(10, 2) not null default 3 check (bw_double >= 0),
  color_single numeric(10, 2) not null default 5 check (color_single >= 0),
  color_double numeric(10, 2) not null default 8 check (color_double >= 0),
  avg_processing_minutes integer not null default 4 check (avg_processing_minutes between 1 and 60),
  max_pages_per_job integer not null default 100 check (max_pages_per_job between 1 and 500),
  printer_mode text not null default 'simulated' check (printer_mode in ('simulated', 'cups')),
  updated_at timestamptz not null default now()
);

create table if not exists public.print_requests (
  id uuid primary key default gen_random_uuid(),
  request_number text not null unique
    default ('PP-' || lpad(nextval('public.print_request_seq')::text, 4, '0')),
  student_id uuid not null references public.profiles (id) on delete cascade,
  document_name text not null check (char_length(document_name) between 3 and 140),
  file_path text,
  file_size bigint check (file_size is null or file_size >= 0),
  pages integer not null check (pages between 1 and 500),
  page_range text,
  copies integer not null default 1 check (copies between 1 and 20),
  color_mode text not null default 'bw' check (color_mode in ('bw', 'color')),
  sides text not null default 'single' check (sides in ('single', 'double')),
  status text not null default 'submitted'
    check (status in ('submitted', 'queued', 'processing', 'ready', 'completed', 'cancelled', 'failed')),
  estimated_cost numeric(10, 2) not null default 0 check (estimated_cost >= 0),
  payment_status text not null default 'not_required'
    check (payment_status in ('unpaid', 'paid', 'not_required', 'refunded')),
  payment_method text not null default 'none',
  priority text not null default 'normal' check (priority in ('normal', 'urgent')),
  print_mode text not null default 'simulated' check (print_mode in ('simulated', 'cups')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists print_requests_student_idx
  on public.print_requests (student_id, created_at desc);
create index if not exists print_requests_status_idx
  on public.print_requests (status, created_at);
create index if not exists print_requests_queue_idx
  on public.print_requests (created_at) where status in ('submitted', 'queued', 'processing');

-- ---------------------------------------------------------------------------
-- MentorLoop
-- ---------------------------------------------------------------------------
create table if not exists public.mentor_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 3 and 80),
  description text not null default '' check (char_length(description) <= 1000),
  mentor_id uuid not null references public.profiles (id) on delete restrict,
  department_id uuid references public.departments (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.mentor_group_members (
  group_id uuid not null references public.mentor_groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  member_role text not null default 'student' check (member_role in ('mentor', 'student', 'assistant')),
  joined_at timestamptz not null default now(),
  last_read_at timestamptz,
  primary key (group_id, user_id)
);

create index if not exists group_members_user_idx on public.mentor_group_members (user_id);

create table if not exists public.group_messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.mentor_groups (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists group_messages_group_idx
  on public.group_messages (group_id, created_at desc);

create table if not exists public.message_attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.group_messages (id) on delete cascade,
  file_name text not null,
  file_path text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 5 * 1024 * 1024),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Opportune
-- ---------------------------------------------------------------------------
create table if not exists public.opportunities (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 4 and 140),
  organization text not null check (char_length(organization) between 2 and 120),
  category text not null check (category in (
    'hackathon', 'internship', 'workshop', 'technical_event',
    'competition', 'seminar', 'placement', 'scholarship'
  )),
  description text not null check (char_length(description) between 20 and 8000),
  eligibility text,
  location text,
  mode text check (mode in ('online', 'offline', 'hybrid')),
  deadline timestamptz not null,
  event_start timestamptz,
  event_end timestamptz,
  apply_url text not null check (apply_url ~* '^https?://'),
  tags text[] not null default '{}',
  posted_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint opportunity_event_order check (event_end is null or event_start is null or event_end >= event_start)
);

create index if not exists opportunities_deadline_idx on public.opportunities (deadline);
create index if not exists opportunities_category_idx on public.opportunities (category, deadline);

create table if not exists public.opportunity_bookmarks (
  user_id uuid not null references public.profiles (id) on delete cascade,
  opportunity_id uuid not null references public.opportunities (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, opportunity_id)
);

create index if not exists opportunity_bookmarks_user_idx
  on public.opportunity_bookmarks (user_id);

-- ---------------------------------------------------------------------------
-- Fixora
-- ---------------------------------------------------------------------------
create sequence if not exists public.maintenance_ticket_seq start with 2100;

create table if not exists public.maintenance_requests (
  id uuid primary key default gen_random_uuid(),
  ticket_number text not null unique
    default ('FX-' || nextval('public.maintenance_ticket_seq')::text),
  student_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 5 and 140),
  description text not null check (char_length(description) between 15 and 5000),
  category text not null,
  building text not null,
  room text not null,
  photo_path text,
  priority text not null default 'medium'
    check (priority in ('low', 'medium', 'high', 'urgent')),
  status text not null default 'submitted'
    check (status in ('submitted', 'under_review', 'assigned', 'in_progress', 'resolved', 'rejected')),
  assigned_to uuid references public.profiles (id) on delete set null,
  resolution_note text,
  resolution_photo_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists maintenance_student_idx
  on public.maintenance_requests (student_id, created_at desc);
create index if not exists maintenance_status_idx
  on public.maintenance_requests (status, priority, created_at desc);
create index if not exists maintenance_assignee_idx
  on public.maintenance_requests (assigned_to, status);

create table if not exists public.maintenance_request_history (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.maintenance_requests (id) on delete cascade,
  status text not null check (status in (
    'submitted', 'under_review', 'assigned', 'in_progress', 'resolved', 'rejected'
  )),
  note text,
  changed_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists maintenance_history_request_idx
  on public.maintenance_request_history (request_id, created_at);

create table if not exists public.maintenance_comments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.maintenance_requests (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  is_internal boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists maintenance_comments_request_idx
  on public.maintenance_comments (request_id, created_at);

-- ---------------------------------------------------------------------------
-- Notifications & audit
-- ---------------------------------------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  body text not null default '',
  link text,
  type text not null default 'system'
    check (type in ('announcement', 'timetable', 'print', 'message', 'opportunity', 'maintenance', 'system')),
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_idx
  on public.notifications (user_id, created_at desc);
create index if not exists notifications_unread_idx
  on public.notifications (user_id) where is_read = false;

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  entity text not null,
  entity_id uuid,
  details jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_created_idx on public.audit_logs (created_at desc);
