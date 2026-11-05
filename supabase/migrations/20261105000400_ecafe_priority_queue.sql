-- Tokenized e-Cafe queue. Orders enter the kitchen only after a payment
-- transaction has been verified by the existing guarded settlement flow.

alter table public.ecafe_menu_items
  add column if not exists is_express boolean not null default false;

insert into public.ecafe_menu_items (id, name, category, description, price_paise, available, sort_order, is_express)
values
  ('bottled-water', 'Bottled Water', 'veg', 'Chilled bottled drinking water.', 2000, true, 9, true),
  ('packaged-snack', 'Packaged Snack', 'veg', 'Ready-to-serve packaged snack.', 3000, true, 10, true)
on conflict (id) do nothing;

alter table public.ecafe_orders
  drop constraint if exists ecafe_orders_status_check;

alter table public.ecafe_orders
  add column if not exists service_date date,
  add column if not exists token_number integer,
  add column if not exists is_express boolean not null default false,
  add column if not exists payment_method text,
  add column if not exists pickup_token text,
  add column if not exists preparing_at timestamptz,
  add column if not exists ready_at timestamptz,
  add column if not exists completed_at timestamptz,
  add constraint ecafe_orders_status_check
    check (status in (
      'DRAFT', 'PAYMENT_PENDING', 'VERIFIED_AND_QUEUED',
      'QUEUED', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED'
    )),
  add constraint ecafe_orders_token_pair_check
    check ((service_date is null) = (token_number is null)),
  add constraint ecafe_orders_token_positive_check
    check (token_number is null or token_number > 0),
  add constraint ecafe_orders_payment_method_check
    check (payment_method is null or payment_method in ('upi', 'razorpay', 'cash'));

create unique index if not exists ecafe_orders_daily_token_unique
  on public.ecafe_orders(service_date, token_number)
  where token_number is not null;

create index if not exists ecafe_orders_queue_order_idx
  on public.ecafe_orders(service_date, is_express, token_number)
  where status in ('QUEUED', 'PREPARING', 'READY');

create table if not exists public.ecafe_daily_tokens (
  service_date date primary key,
  last_token integer not null check (last_token > 0)
);
alter table public.ecafe_daily_tokens enable row level security;
revoke all on public.ecafe_daily_tokens from public, anon, authenticated;

create or replace function public.create_ecafe_order(p_items jsonb)
returns table (id uuid, order_number text, amount_paise integer, items jsonb)
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_items jsonb;
  total integer;
  express_order boolean;
  new_id uuid;
  new_number text;
begin
  if auth.uid() is null then raise exception 'Sign in to place an order.'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) < 1
     or jsonb_array_length(p_items) > 30 then
    raise exception 'Select between 1 and 30 menu items.';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_items) as input(item_id text, quantity integer)
    left join public.ecafe_menu_items menu on menu.id = input.item_id
    where menu.id is null or not menu.available or input.quantity not between 1 and 10
  ) then
    raise exception 'A selected menu item is unavailable or has an invalid quantity.';
  end if;

  select
    jsonb_agg(jsonb_build_object(
      'id', menu.id, 'name', menu.name, 'category', menu.category,
      'quantity', input.quantity, 'unit_price_paise', menu.price_paise
    ) order by menu.sort_order),
    sum(menu.price_paise * input.quantity)::integer,
    bool_and(menu.is_express)
  into normalized_items, total, express_order
  from jsonb_to_recordset(p_items) as input(item_id text, quantity integer)
  join public.ecafe_menu_items menu on menu.id = input.item_id and menu.available;

  if total is null or total <= 0 then raise exception 'The order total is invalid.'; end if;

  new_id := gen_random_uuid();
  new_number := 'EC-' || lpad(nextval('public.ecafe_order_seq')::text, 5, '0');
  insert into public.ecafe_orders(id, order_number, user_id, items, amount_paise, status, is_express)
  values (new_id, new_number, auth.uid(), normalized_items, total, 'PAYMENT_PENDING', express_order);

  return query select new_id, new_number, total, normalized_items;
end;
$$;

create table if not exists public.ecafe_queue_board (
  service_date date not null,
  token_number integer not null,
  is_express boolean not null default false,
  status text not null check (status in ('QUEUED', 'PREPARING', 'READY')),
  updated_at timestamptz not null default now(),
  primary key (service_date, token_number)
);
alter table public.ecafe_queue_board enable row level security;
drop policy if exists "Authenticated users read cafe token board" on public.ecafe_queue_board;
create policy "Authenticated users read cafe token board"
  on public.ecafe_queue_board for select to authenticated using (true);
grant select on public.ecafe_queue_board to authenticated;

create or replace function public.sync_ecafe_queue_board()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') and old.service_date is not null and old.token_number is not null then
    delete from public.ecafe_queue_board
    where service_date = old.service_date and token_number = old.token_number;
  end if;

  if tg_op <> 'DELETE'
     and new.service_date is not null
     and new.token_number is not null
     and new.status in ('QUEUED', 'PREPARING', 'READY') then
    insert into public.ecafe_queue_board(service_date, token_number, is_express, status, updated_at)
    values (new.service_date, new.token_number, new.is_express, new.status, now())
    on conflict (service_date, token_number) do update
      set is_express = excluded.is_express,
          status = excluded.status,
          updated_at = excluded.updated_at;
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists ecafe_queue_board_sync on public.ecafe_orders;
create trigger ecafe_queue_board_sync
after insert or update or delete on public.ecafe_orders
for each row execute function public.sync_ecafe_queue_board();

with legacy_orders as (
  select
    order_row.id,
    (order_row.created_at at time zone 'Asia/Kolkata')::date as order_date,
    row_number() over (
      partition by (order_row.created_at at time zone 'Asia/Kolkata')::date
      order by order_row.created_at, order_row.id
    )::integer as daily_token,
    payment.method
  from public.ecafe_orders order_row
  left join lateral (
    select payment.method
    from public.payment_transactions payment
    where payment.ecafe_order_id = order_row.id and payment.status = 'verified'
    order by payment.verified_at desc nulls last
    limit 1
  ) payment on true
  where order_row.status = 'VERIFIED_AND_QUEUED'
)
update public.ecafe_orders order_row
set status = 'QUEUED',
    service_date = legacy_orders.order_date,
    token_number = legacy_orders.daily_token,
    payment_method = legacy_orders.method,
    updated_at = now()
from legacy_orders
where order_row.id = legacy_orders.id;

insert into public.ecafe_daily_tokens(service_date, last_token)
select service_date, max(token_number)
from public.ecafe_orders
where service_date is not null and token_number is not null
group by service_date
on conflict (service_date) do update
set last_token = greatest(public.ecafe_daily_tokens.last_token, excluded.last_token);

insert into public.ecafe_queue_board(service_date, token_number, is_express, status, updated_at)
select service_date, token_number, is_express, status, updated_at
from public.ecafe_orders
where service_date is not null
  and token_number is not null
  and status in ('QUEUED', 'PREPARING', 'READY')
on conflict (service_date, token_number) do update
set is_express = excluded.is_express,
    status = excluded.status,
    updated_at = excluded.updated_at;

-- Existing settlement verifies payment_transactions after writing the
-- transitional status. This trigger assigns the token inside that same
-- transaction, so an order is never visible in the kitchen before payment.
create or replace function public.enqueue_verified_ecafe_payment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  order_row public.ecafe_orders;
  token_date date := (now() at time zone 'Asia/Kolkata')::date;
  next_token integer;
begin
  if new.module <> 'ecafe' or new.status <> 'verified' or old.status = 'verified' then
    return new;
  end if;

  select * into order_row
  from public.ecafe_orders
  where id = new.ecafe_order_id
    and status = 'VERIFIED_AND_QUEUED'
    and amount_paise = new.amount_paise
    and user_id = new.user_id
  for update;
  if not found then
    raise exception 'Verified cafe payment does not match a pending order.';
  end if;

  insert into public.ecafe_daily_tokens(service_date, last_token)
  values (token_date, 1)
  on conflict (service_date) do update
    set last_token = public.ecafe_daily_tokens.last_token + 1
  returning last_token into next_token;

  update public.ecafe_orders
  set status = 'QUEUED',
      service_date = token_date,
      token_number = next_token,
      payment_method = new.method,
      pickup_token = null,
      updated_at = now()
  where id = order_row.id;
  return new;
end;
$$;

drop trigger if exists payment_transactions_enqueue_ecafe on public.payment_transactions;
create trigger payment_transactions_enqueue_ecafe
after update of status on public.payment_transactions
for each row
when (new.status = 'verified' and old.status is distinct from new.status and new.module = 'ecafe')
execute function public.enqueue_verified_ecafe_payment();

create or replace function public.update_ecafe_order_status(p_order_id uuid, p_status text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  current_order public.ecafe_orders;
  new_pickup_token text;
begin
  if auth.uid() is null or not public.is_print_staff() then
    raise exception 'Authorized cafe staff required.';
  end if;
  if p_status not in ('PREPARING', 'READY') then
    raise exception 'Invalid kitchen status.';
  end if;

  select * into current_order
  from public.ecafe_orders
  where id = p_order_id
  for update;
  if not found or current_order.service_date is null or current_order.token_number is null then
    raise exception 'Queued cafe order not found.';
  end if;

  if p_status = 'PREPARING' and current_order.status = 'QUEUED' then
    update public.ecafe_orders
    set status = 'PREPARING', preparing_at = now(), updated_at = now()
    where id = p_order_id;
    return null;
  end if;

  if p_status = 'READY' and current_order.status = 'PREPARING' then
    new_pickup_token := encode(gen_random_bytes(32), 'hex');
    update public.ecafe_orders
    set status = 'READY',
        pickup_token = new_pickup_token,
        ready_at = now(),
        updated_at = now()
    where id = p_order_id;
    return new_pickup_token;
  end if;

  raise exception 'Order must be QUEUED before PREPARING and PREPARING before READY.';
end;
$$;

create or replace function public.redeem_ecafe_pickup(p_pickup_token text)
returns table (
  found boolean,
  completed boolean,
  order_status text,
  order_number text,
  token_number integer,
  queue_position integer,
  items jsonb
)
language plpgsql
security definer
set search_path = public
as $$
declare
  order_row public.ecafe_orders;
  position_in_queue integer;
begin
  if auth.uid() is null or not public.is_print_staff() then
    raise exception 'Authorized cafe counter staff required.';
  end if;
  if p_pickup_token is null or p_pickup_token !~ '^[0-9a-f]{64}$' then
    return query select false, false, 'NOT_FOUND', null::text, null::integer, null::integer, null::jsonb;
    return;
  end if;

  select * into order_row
  from public.ecafe_orders
  where pickup_token = p_pickup_token
  for update;
  if not found then
    return query select false, false, 'NOT_FOUND', null::text, null::integer, null::integer, null::jsonb;
    return;
  end if;

  if order_row.status = 'READY' then
    update public.ecafe_orders
    set status = 'COMPLETED',
        pickup_token = null,
        completed_at = now(),
        updated_at = now()
    where id = order_row.id;
    return query select true, true, 'COMPLETED', order_row.order_number,
      order_row.token_number, 0, order_row.items;
    return;
  end if;

  if order_row.status in ('QUEUED', 'PREPARING') then
    select count(*)::integer into position_in_queue
    from public.ecafe_orders queued
    where queued.service_date = order_row.service_date
      and queued.is_express = order_row.is_express
      and queued.token_number <= order_row.token_number
      and queued.status in ('QUEUED', 'PREPARING');
  else
    position_in_queue := 0;
  end if;

  return query select true, false, order_row.status, order_row.order_number,
    order_row.token_number, coalesce(position_in_queue, 0), order_row.items;
end;
$$;

revoke all on function public.update_ecafe_order_status(uuid, text) from public, anon;
revoke all on function public.redeem_ecafe_pickup(text) from public, anon;
revoke all on function public.complete_ecafe_order(uuid) from public, anon, authenticated;
grant execute on function public.update_ecafe_order_status(uuid, text) to authenticated;
grant execute on function public.redeem_ecafe_pickup(text) to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'ecafe_orders'
  ) then
    alter publication supabase_realtime add table public.ecafe_orders;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'ecafe_queue_board'
  ) then
    alter publication supabase_realtime add table public.ecafe_queue_board;
  end if;
end;
$$;
