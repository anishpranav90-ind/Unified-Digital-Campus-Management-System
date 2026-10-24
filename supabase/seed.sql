-- =============================================================================
-- UniSync — reference seed data
-- Run after the migrations. The full demo dataset (users, timetable, groups,
-- print jobs, complaints…) is created by `node scripts/seed-demo.mjs`.
-- =============================================================================

insert into public.departments (id, name, code)
values
  ('44444444-4444-4444-8444-444444444401', 'Computer Science & Engineering', 'CSE'),
  ('44444444-4444-4444-8444-444444444402', 'Electronics & Communication', 'ECE'),
  ('44444444-4444-4444-8444-444444444403', 'Mechanical Engineering', 'MECH'),
  ('44444444-4444-4444-8444-444444444404', 'Business Administration', 'MBA')
on conflict (code) do nothing;

-- The table is a singleton (see 20261024000200_print_settings_singleton.sql);
-- use the canonical id so the reference seed and the demo seeder agree.
insert into public.print_queue_settings (
  id, bw_single, bw_double, color_single, color_double, avg_processing_minutes, max_pages_per_job, printer_mode
)
select 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 2, 3, 5, 8, 4, 100, 'simulated'
where not exists (select 1 from public.print_queue_settings)
on conflict (id) do nothing;
