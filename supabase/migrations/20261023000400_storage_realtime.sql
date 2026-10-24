-- =============================================================================
-- UniSync — Supabase Storage and Realtime
-- All document, photo and attachment buckets are PRIVATE.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('print-documents', 'print-documents', false, 5242880, array['application/pdf']),
  ('maintenance-photos', 'maintenance-photos', false, 5242880,
    array['image/png', 'image/jpeg', 'image/webp']),
  ('message-attachments', 'message-attachments', false, 5242880,
    array['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'text/plain',
          'application/zip', 'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.openxmlformats-officedocument.presentationml.presentation']),
  ('announcement-attachments', 'announcement-attachments', false, 5242880,
    array['application/pdf', 'image/png', 'image/jpeg'])
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- print-documents — only the owner and print staff
-- ---------------------------------------------------------------------------
drop policy if exists "Print owners upload documents" on storage.objects;
create policy "Print owners upload documents"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'print-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Print owners and staff read documents" on storage.objects;
create policy "Print owners and staff read documents"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'print-documents'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_print_staff())
  );

drop policy if exists "Print owners replace documents" on storage.objects;
create policy "Print owners replace documents"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'print-documents' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'print-documents' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Print owners or admins delete documents" on storage.objects;
create policy "Print owners or admins delete documents"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'print-documents'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );

-- ---------------------------------------------------------------------------
-- maintenance-photos — reporter, assigned staff and administrators
-- ---------------------------------------------------------------------------
drop policy if exists "Reporters upload maintenance photos" on storage.objects;
create policy "Reporters upload maintenance photos"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'maintenance-photos'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin()
    )
  );

drop policy if exists "Relevant users read maintenance photos" on storage.objects;
create policy "Relevant users read maintenance photos"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'maintenance-photos'
    and public.can_access_maintenance_photo(name)
  );

drop policy if exists "Maintenance staff update photos" on storage.objects;
create policy "Maintenance staff update photos"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'maintenance-photos' and public.is_faculty())
  with check (bucket_id = 'maintenance-photos' and public.is_faculty());

drop policy if exists "Reporters or admins delete maintenance photos" on storage.objects;
create policy "Reporters or admins delete maintenance photos"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'maintenance-photos'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );

-- ---------------------------------------------------------------------------
-- message-attachments — group/<group_id>/<file>, members only
-- ---------------------------------------------------------------------------
drop policy if exists "Group members upload attachments" on storage.objects;
create policy "Group members upload attachments"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'message-attachments'
    and (storage.foldername(name))[1] = 'group'
    and array_length(storage.foldername(name), 1) >= 2
    and public.is_group_member(((storage.foldername(name))[2])::uuid)
  );

drop policy if exists "Group members read attachments" on storage.objects;
create policy "Group members read attachments"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'message-attachments'
    and (storage.foldername(name))[1] = 'group'
    and array_length(storage.foldername(name), 1) >= 2
    and public.is_group_member(((storage.foldername(name))[2])::uuid)
  );

drop policy if exists "Group members delete own uploads" on storage.objects;
create policy "Group members delete own uploads"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'message-attachments'
    and owner = auth.uid()
    and (storage.foldername(name))[1] = 'group'
    and public.is_group_member(((storage.foldername(name))[2])::uuid)
  );

-- ---------------------------------------------------------------------------
-- announcement-attachments — faculty publish, authenticated users read
-- ---------------------------------------------------------------------------
drop policy if exists "Faculty upload announcement attachments" on storage.objects;
create policy "Faculty upload announcement attachments"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'announcement-attachments' and public.is_faculty());

drop policy if exists "Authenticated users read announcement attachments" on storage.objects;
create policy "Authenticated users read announcement attachments"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'announcement-attachments');

drop policy if exists "Faculty manage announcement attachments" on storage.objects;
create policy "Faculty manage announcement attachments"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'announcement-attachments' and public.is_faculty());

-- ---------------------------------------------------------------------------
-- Realtime publication (idempotent)
-- ---------------------------------------------------------------------------
do $$
declare
  target text;
  tables text[] := array[
    'print_requests',
    'group_messages',
    'notifications',
    'maintenance_requests',
    'timetable_entries',
    'announcements',
    'audit_logs'
  ];
begin
  foreach target in array tables loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = target
    ) then
      execute format('alter publication supabase_realtime add table public.%I', target);
    end if;
  end loop;
end;
$$;
