alter table public.print_requests
  add column if not exists printer_job_id integer check (printer_job_id is null or printer_job_id > 0);