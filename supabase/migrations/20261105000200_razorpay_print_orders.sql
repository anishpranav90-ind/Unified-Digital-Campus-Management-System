create table if not exists public.print_payment_orders (
  provider_order_id text primary key,
  print_request_id uuid not null references public.print_requests (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  amount_paise integer not null check (amount_paise > 0),
  status text not null default 'created'
    check (status in ('created', 'paid', 'failed')),
  payment_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists print_payment_orders_request_idx
  on public.print_payment_orders (print_request_id, created_at desc);

create unique index if not exists print_payment_orders_one_open_per_request_idx
  on public.print_payment_orders (print_request_id)
  where status = 'created';

alter table public.print_payment_orders enable row level security;
