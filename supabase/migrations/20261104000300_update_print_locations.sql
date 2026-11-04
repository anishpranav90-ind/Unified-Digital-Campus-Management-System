alter table public.print_requests
  add column if not exists print_location text not null default 'sjit-girls-xerox-1';

alter table public.print_requests
  drop constraint if exists print_requests_print_location_check;

update public.print_requests
set print_location = 'sjit-boys-xerox-1'
where print_location = 'sjit-boys-xerox-2';

alter table public.print_requests
  alter column print_location set default 'sjit-girls-xerox-1';

alter table public.print_requests
  add constraint print_requests_print_location_check
  check (print_location in (
    'sjit-girls-xerox-1',
    'sjit-boys-xerox-1',
    'sjce-boys-xerox-1',
    'sjce-girls-xerox-1',
    'sjit-periwinkle-xerox'
  ));

update public.print_requests
set print_location = case request_number
  when 'PP-1132' then 'sjit-girls-xerox-1'
  when 'PP-1131' then 'sjit-boys-xerox-1'
  when 'PP-1125' then 'sjce-boys-xerox-1'
  when 'PP-1127' then 'sjce-girls-xerox-1'
  when 'PP-1126' then 'sjit-periwinkle-xerox'
end
where request_number in ('PP-1132', 'PP-1131', 'PP-1125', 'PP-1127', 'PP-1126');