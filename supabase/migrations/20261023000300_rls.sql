-- =============================================================================
-- UniSync — Row Level Security
-- Every app table is protected. Frontend checks are convenience only.
-- =============================================================================

alter table public.departments enable row level security;
alter table public.profiles enable row level security;
alter table public.announcements enable row level security;
alter table public.announcement_reads enable row level security;
alter table public.subjects enable row level security;
alter table public.classrooms enable row level security;
alter table public.timetable_entries enable row level security;
alter table public.exam_schedules enable row level security;
alter table public.timetable_correction_requests enable row level security;
alter table public.print_queue_settings enable row level security;
alter table public.print_requests enable row level security;
alter table public.mentor_groups enable row level security;
alter table public.mentor_group_members enable row level security;
alter table public.group_messages enable row level security;
alter table public.message_attachments enable row level security;
alter table public.opportunities enable row level security;
alter table public.opportunity_bookmarks enable row level security;
alter table public.maintenance_requests enable row level security;
alter table public.maintenance_request_history enable row level security;
alter table public.maintenance_comments enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_logs enable row level security;

-- ---------------------------------------------------------------------------
-- Departments: readable for registration; writable by administrators.
-- ---------------------------------------------------------------------------
drop policy if exists "Departments are publicly readable" on public.departments;
create policy "Departments are publicly readable"
  on public.departments for select
  to anon, authenticated
  using (true);

drop policy if exists "Admins manage departments" on public.departments;
create policy "Admins manage departments"
  on public.departments for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------
drop policy if exists "Authenticated users can view profiles" on public.profiles;
create policy "Authenticated users can view profiles"
  on public.profiles for select
  to authenticated
  using (true);

drop policy if exists "Users insert their own student profile" on public.profiles;
create policy "Users insert their own student profile"
  on public.profiles for insert
  to authenticated
  with check (id = auth.uid() and role = 'student');

drop policy if exists "Users update their own profile" on public.profiles;
create policy "Users update their own profile"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists "Admins update any profile" on public.profiles;
create policy "Admins update any profile"
  on public.profiles for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Admins delete profiles" on public.profiles;
create policy "Admins delete profiles"
  on public.profiles for delete
  to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Announcements
-- ---------------------------------------------------------------------------
drop policy if exists "Audience can read announcements" on public.announcements;
create policy "Audience can read announcements"
  on public.announcements for select
  to authenticated
  using (
    public.is_admin()
    or audience = 'all'
    or (audience = 'students' and (public.app_role() = 'student' or public.is_faculty()))
    or (audience = 'faculty' and public.is_faculty())
    or (audience = 'admins' and public.is_admin())
  );

drop policy if exists "Faculty publish announcements" on public.announcements;
create policy "Faculty publish announcements"
  on public.announcements for insert
  to authenticated
  with check (public.is_faculty() and author_id = auth.uid());

drop policy if exists "Authors or admins edit announcements" on public.announcements;
create policy "Authors or admins edit announcements"
  on public.announcements for update
  to authenticated
  using (author_id = auth.uid() or public.is_admin())
  with check (author_id = auth.uid() or public.is_admin());

drop policy if exists "Admins delete announcements" on public.announcements;
create policy "Admins delete announcements"
  on public.announcements for delete
  to authenticated
  using (public.is_admin());

drop policy if exists "Users read their own announcement receipts" on public.announcement_reads;
create policy "Users read their own announcement receipts"
  on public.announcement_reads for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "Users mark announcements read" on public.announcement_reads;
create policy "Users mark announcements read"
  on public.announcement_reads for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Users remove their own read receipt" on public.announcement_reads;
create policy "Users remove their own read receipt"
  on public.announcement_reads for delete
  to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Timetable reference data
-- ---------------------------------------------------------------------------
drop policy if exists "Authenticated users read subjects" on public.subjects;
create policy "Authenticated users read subjects"
  on public.subjects for select
  to authenticated
  using (true);

drop policy if exists "Admins manage subjects" on public.subjects;
create policy "Admins manage subjects"
  on public.subjects for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Authenticated users read classrooms" on public.classrooms;
create policy "Authenticated users read classrooms"
  on public.classrooms for select
  to authenticated
  using (true);

drop policy if exists "Admins manage classrooms" on public.classrooms;
create policy "Admins manage classrooms"
  on public.classrooms for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Published timetable is readable" on public.timetable_entries;
create policy "Published timetable is readable"
  on public.timetable_entries for select
  to authenticated
  using (published = true or public.is_admin());

drop policy if exists "Admins manage timetable" on public.timetable_entries;
create policy "Admins manage timetable"
  on public.timetable_entries for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Authenticated users read exams" on public.exam_schedules;
create policy "Authenticated users read exams"
  on public.exam_schedules for select
  to authenticated
  using (true);

drop policy if exists "Admins manage exams" on public.exam_schedules;
create policy "Admins manage exams"
  on public.exam_schedules for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Faculty read own correction requests" on public.timetable_correction_requests;
create policy "Faculty read own correction requests"
  on public.timetable_correction_requests for select
  to authenticated
  using (requested_by = auth.uid() or public.is_admin());

drop policy if exists "Faculty submit correction requests" on public.timetable_correction_requests;
create policy "Faculty submit correction requests"
  on public.timetable_correction_requests for insert
  to authenticated
  with check (requested_by = auth.uid() and public.app_role() = 'faculty');

drop policy if exists "Admins resolve correction requests" on public.timetable_correction_requests;
create policy "Admins resolve correction requests"
  on public.timetable_correction_requests for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- PrintPulse
-- ---------------------------------------------------------------------------
drop policy if exists "Authenticated users read print settings" on public.print_queue_settings;
create policy "Authenticated users read print settings"
  on public.print_queue_settings for select
  to authenticated
  using (true);

drop policy if exists "Admins manage print settings" on public.print_queue_settings;
create policy "Admins manage print settings"
  on public.print_queue_settings for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Students read own print requests" on public.print_requests;
create policy "Students read own print requests"
  on public.print_requests for select
  to authenticated
  using (student_id = auth.uid() or public.is_print_staff());

drop policy if exists "Students submit their own print requests" on public.print_requests;
create policy "Students submit their own print requests"
  on public.print_requests for insert
  to authenticated
  with check (student_id = auth.uid() and public.app_role() = 'student');

drop policy if exists "Students cancel and staff update print requests" on public.print_requests;
create policy "Students cancel and staff update print requests"
  on public.print_requests for update
  to authenticated
  using (student_id = auth.uid() or public.is_print_staff())
  with check (student_id = auth.uid() or public.is_print_staff());

drop policy if exists "Admins delete print requests" on public.print_requests;
create policy "Admins delete print requests"
  on public.print_requests for delete
  to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- MentorLoop
-- ---------------------------------------------------------------------------
drop policy if exists "Members read their groups" on public.mentor_groups;
create policy "Members read their groups"
  on public.mentor_groups for select
  to authenticated
  using (public.is_group_member(id) or mentor_id = auth.uid() or public.is_admin());

drop policy if exists "Faculty create mentor groups" on public.mentor_groups;
create policy "Faculty create mentor groups"
  on public.mentor_groups for insert
  to authenticated
  with check (public.is_faculty() and (mentor_id = auth.uid() or public.is_admin()));

drop policy if exists "Mentors update their groups" on public.mentor_groups;
create policy "Mentors update their groups"
  on public.mentor_groups for update
  to authenticated
  using (mentor_id = auth.uid() or public.is_admin())
  with check (mentor_id = auth.uid() or public.is_admin());

drop policy if exists "Admins delete groups" on public.mentor_groups;
create policy "Admins delete groups"
  on public.mentor_groups for delete
  to authenticated
  using (public.is_admin());

drop policy if exists "Members read group membership" on public.mentor_group_members;
create policy "Members read group membership"
  on public.mentor_group_members for select
  to authenticated
  using (public.is_group_member(group_id) or public.is_admin());

drop policy if exists "Mentors manage membership" on public.mentor_group_members;
create policy "Mentors manage membership"
  on public.mentor_group_members for insert
  to authenticated
  with check (public.is_group_mentor(group_id) or public.is_admin());

drop policy if exists "Users update their own read receipt or mentors manage" on public.mentor_group_members;
create policy "Users update their own read receipt or mentors manage"
  on public.mentor_group_members for update
  to authenticated
  using (user_id = auth.uid() or public.is_group_mentor(group_id) or public.is_admin())
  with check (user_id = auth.uid() or public.is_group_mentor(group_id) or public.is_admin());

drop policy if exists "Mentors remove members" on public.mentor_group_members;
create policy "Mentors remove members"
  on public.mentor_group_members for delete
  to authenticated
  using (public.is_group_mentor(group_id) or public.is_admin());

drop policy if exists "Members read group messages" on public.group_messages;
create policy "Members read group messages"
  on public.group_messages for select
  to authenticated
  using (public.is_group_member(group_id) or public.is_admin());

drop policy if exists "Members send messages" on public.group_messages;
create policy "Members send messages"
  on public.group_messages for insert
  to authenticated
  with check (sender_id = auth.uid() and public.is_group_member(group_id));

drop policy if exists "Authors edit their own messages" on public.group_messages;
create policy "Authors edit their own messages"
  on public.group_messages for update
  to authenticated
  using (sender_id = auth.uid())
  with check (sender_id = auth.uid() and public.is_group_member(group_id));

drop policy if exists "Authors delete their own messages" on public.group_messages;
create policy "Authors delete their own messages"
  on public.group_messages for delete
  to authenticated
  using (sender_id = auth.uid() or public.is_admin());

drop policy if exists "Members read message attachments" on public.message_attachments;
create policy "Members read message attachments"
  on public.message_attachments for select
  to authenticated
  using (
    exists (
      select 1 from public.group_messages message
      where message.id = message_attachments.message_id
        and (public.is_group_member(message.group_id) or public.is_admin())
    )
  );

drop policy if exists "Authors attach files to their messages" on public.message_attachments;
create policy "Authors attach files to their messages"
  on public.message_attachments for insert
  to authenticated
  with check (
    exists (
      select 1 from public.group_messages message
      where message.id = message_attachments.message_id
        and message.sender_id = auth.uid()
        and public.is_group_member(message.group_id)
    )
  );

drop policy if exists "Authors delete their attachments" on public.message_attachments;
create policy "Authors delete their attachments"
  on public.message_attachments for delete
  to authenticated
  using (
    exists (
      select 1 from public.group_messages message
      where message.id = message_attachments.message_id
        and message.sender_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Opportune
-- ---------------------------------------------------------------------------
drop policy if exists "Authenticated users read opportunities" on public.opportunities;
create policy "Authenticated users read opportunities"
  on public.opportunities for select
  to authenticated
  using (true);

drop policy if exists "Faculty publish opportunities" on public.opportunities;
create policy "Faculty publish opportunities"
  on public.opportunities for insert
  to authenticated
  with check (public.is_faculty() and posted_by = auth.uid());

drop policy if exists "Posters or admins edit opportunities" on public.opportunities;
create policy "Posters or admins edit opportunities"
  on public.opportunities for update
  to authenticated
  using (posted_by = auth.uid() or public.is_admin())
  with check (posted_by = auth.uid() or public.is_admin());

drop policy if exists "Admins delete opportunities" on public.opportunities;
create policy "Admins delete opportunities"
  on public.opportunities for delete
  to authenticated
  using (public.is_admin());

drop policy if exists "Users read their own bookmarks" on public.opportunity_bookmarks;
create policy "Users read their own bookmarks"
  on public.opportunity_bookmarks for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "Users create their own bookmarks" on public.opportunity_bookmarks;
create policy "Users create their own bookmarks"
  on public.opportunity_bookmarks for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Users delete their own bookmarks" on public.opportunity_bookmarks;
create policy "Users delete their own bookmarks"
  on public.opportunity_bookmarks for delete
  to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Fixora
-- ---------------------------------------------------------------------------
drop policy if exists "Relevant users read maintenance requests" on public.maintenance_requests;
create policy "Relevant users read maintenance requests"
  on public.maintenance_requests for select
  to authenticated
  using (
    student_id = auth.uid()
    or public.is_admin()
    or assigned_to = auth.uid()
    or (public.app_role() = 'faculty' and status = 'submitted')
  );

drop policy if exists "Students submit maintenance requests" on public.maintenance_requests;
create policy "Students submit maintenance requests"
  on public.maintenance_requests for insert
  to authenticated
  with check (student_id = auth.uid() and public.app_role() = 'student' and status = 'submitted');

drop policy if exists "Admins triage maintenance requests" on public.maintenance_requests;
create policy "Admins triage maintenance requests"
  on public.maintenance_requests for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Admins delete maintenance requests" on public.maintenance_requests;
create policy "Admins delete maintenance requests"
  on public.maintenance_requests for delete
  to authenticated
  using (public.is_admin());

drop policy if exists "Relevant users read complaint history" on public.maintenance_request_history;
create policy "Relevant users read complaint history"
  on public.maintenance_request_history for select
  to authenticated
  using (public.can_access_maintenance(request_id));

drop policy if exists "Students log the initial complaint state" on public.maintenance_request_history;
create policy "Students log the initial complaint state"
  on public.maintenance_request_history for insert
  to authenticated
  with check (
    changed_by = auth.uid()
    and (
      public.is_admin()
      or (
        status = 'submitted'
        and public.can_access_maintenance(request_id)
        and exists (
          select 1 from public.maintenance_requests request
          where request.id = request_id and request.student_id = auth.uid()
        )
      )
    )
  );

drop policy if exists "Admins update complaint history" on public.maintenance_request_history;
create policy "Admins update complaint history"
  on public.maintenance_request_history for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Relevant users read comments" on public.maintenance_comments;
create policy "Relevant users read comments"
  on public.maintenance_comments for select
  to authenticated
  using (
    public.can_access_maintenance(request_id)
    and (is_internal = false or public.is_faculty())
  );

drop policy if exists "Relevant users add comments" on public.maintenance_comments;
create policy "Relevant users add comments"
  on public.maintenance_comments for insert
  to authenticated
  with check (
    author_id = auth.uid()
    and public.can_access_maintenance(request_id)
    and (is_internal = false or public.is_faculty())
  );

drop policy if exists "Authors edit their comments" on public.maintenance_comments;
create policy "Authors edit their comments"
  on public.maintenance_comments for update
  to authenticated
  using (author_id = auth.uid())
  with check (author_id = auth.uid());

drop policy if exists "Authors delete their comments" on public.maintenance_comments;
create policy "Authors delete their comments"
  on public.maintenance_comments for delete
  to authenticated
  using (author_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------------
drop policy if exists "Users read their notifications" on public.notifications;
create policy "Users read their notifications"
  on public.notifications for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "Users and staff create notifications" on public.notifications;
create policy "Users and staff create notifications"
  on public.notifications for insert
  to authenticated
  with check (user_id = auth.uid() or public.is_faculty());

drop policy if exists "Users update their notifications" on public.notifications;
create policy "Users update their notifications"
  on public.notifications for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Users delete their notifications" on public.notifications;
create policy "Users delete their notifications"
  on public.notifications for delete
  to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Audit log — administrators read; actors may append their own entries.
-- Role elevation is written by the SECURITY DEFINER set_user_role() function.
-- ---------------------------------------------------------------------------
drop policy if exists "Admins read audit logs" on public.audit_logs;
create policy "Admins read audit logs"
  on public.audit_logs for select
  to authenticated
  using (public.is_admin());

drop policy if exists "Actors append audit logs" on public.audit_logs;
create policy "Actors append audit logs"
  on public.audit_logs for insert
  to authenticated
  with check (actor_id = auth.uid() and action <> 'user.role_changed');
