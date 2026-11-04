alter table public.print_requests
  add column if not exists print_location text not null default 'sjit-girls-xerox-1'
    check (print_location in (
      'sjit-girls-xerox-1',
      'sjit-boys-xerox-2',
      'sjce-girls-xerox-1',
      'sjce-boys-xerox-1'
    ));