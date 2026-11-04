-- Guarded payment lifecycle for PrintPulse and e-Cafe.

alter table public.print_requests
  drop constraint if exists print_requests_status_check;

alter table public.print_requests
  add constraint print_requests_status_check
  check (status in (
    'payment_pending', 'submitted', 'queued', 'processing', 'ready',
    'completed', 'cancelled', 'failed'
  ));

alter table public.print_requests
  add column if not exists payment_option text not null default 'cash'
    check (payment_option in ('upi', 'razorpay', 'cash')),
  add column if not exists upload_after_payment boolean not null default false,
  add column if not exists paper_size text not null default 'a4'
    check (paper_size in ('a4', 'a3', 'letter'));

update public.print_requests
set status = 'payment_pending'
where payment_status = 'unpaid'
  and status in ('submitted', 'queued', 'processing', 'ready');

create table if not exists public.ecafe_menu_items (
  id text primary key,
  name text not null,
  category text not null check (category in ('veg', 'non_veg')),
  description text not null default '',
  price_paise integer not null check (price_paise > 0),
  available boolean not null default true,
  sort_order integer not null default 0
);

insert into public.ecafe_menu_items (id, name, category, description, price_paise, sort_order)
values
  ('veg-meals', 'Veg Meals', 'veg', 'Rice, seasonal vegetables, dal and sides.', 9000, 1),
  ('paneer-roll', 'Paneer Roll', 'veg', 'Spiced paneer and vegetables in a soft roll.', 6500, 2),
  ('masala-dosa', 'Masala Dosa', 'veg', 'Crisp dosa with potato masala and chutneys.', 7000, 3),
  ('lemon-rice', 'Lemon Rice', 'veg', 'South Indian lemon rice with peanuts.', 5500, 4),
  ('chicken-meals', 'Chicken Meals', 'non_veg', 'Rice, chicken curry and seasonal sides.', 13000, 5),
  ('egg-roll', 'Egg Roll', 'non_veg', 'Egg, vegetables and house sauce in a roll.', 7500, 6),
  ('chicken-biryani', 'Chicken Biryani', 'non_veg', 'Chicken dum biryani with raita.', 15000, 7),
  ('egg-fried-rice', 'Egg Fried Rice', 'non_veg', 'Wok-fried rice with egg and vegetables.', 9500, 8)
on conflict (id) do update set
  name = excluded.name,
  category = excluded.category,
  description = excluded.description,
  price_paise = excluded.price_paise,
  sort_order = excluded.sort_order;

create table if not exists public.ecafe_orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  user_id uuid not null references public.profiles(id) on delete cascade,
  items jsonb not null check (jsonb_typeof(items) = 'array'),
  amount_paise integer not null check (amount_paise > 0),
  status text not null default 'PAYMENT_PENDING'
    check (status in ('DRAFT', 'PAYMENT_PENDING', 'VERIFIED_AND_QUEUED', 'COMPLETED', 'CANCELLED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create sequence if not exists public.ecafe_order_seq start with 1001;

create table if not exists public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  module text not null check (module in ('printpulse', 'ecafe')),
  print_request_id uuid references public.print_requests(id) on delete cascade,
  ecafe_order_id uuid references public.ecafe_orders(id) on delete cascade,
  amount_paise integer not null check (amount_paise > 0),
  method text not null check (method in ('upi', 'razorpay', 'cash')),
  status text not null default 'pending' check (status in ('pending', 'verified', 'failed', 'cancelled')),
  counter_token_hash text,
  razorpay_order_id text unique,
  razorpay_payment_id text unique,
  payment_reference text,
  created_at timestamptz not null default now(),
  verified_at timestamptz,
  constraint payment_transactions_one_entity check (
    (module = 'printpulse' and print_request_id is not null and ecafe_order_id is null)
    or (module = 'ecafe' and ecafe_order_id is not null and print_request_id is null)
  )
);

create index if not exists payment_transactions_owner_idx
  on public.payment_transactions(user_id, created_at desc);
create index if not exists payment_transactions_print_idx
  on public.payment_transactions(print_request_id) where print_request_id is not null;
create index if not exists payment_transactions_ecafe_idx
  on public.payment_transactions(ecafe_order_id) where ecafe_order_id is not null;
create unique index if not exists payment_transactions_one_pending_print_idx
  on public.payment_transactions(print_request_id)
  where module = 'printpulse' and status = 'pending';
create unique index if not exists payment_transactions_one_pending_ecafe_idx
  on public.payment_transactions(ecafe_order_id)
  where module = 'ecafe' and status = 'pending';

create table if not exists public.payment_transaction_secrets (
  transaction_id uuid primary key references public.payment_transactions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  counter_token text not null check (counter_token ~ '^[0-9a-f]{64}$')
);

alter table public.ecafe_menu_items enable row level security;
alter table public.ecafe_orders enable row level security;
alter table public.payment_transactions enable row level security;
alter table public.payment_transaction_secrets enable row level security;

drop policy if exists "Authenticated users read available cafe menu" on public.ecafe_menu_items;
create policy "Authenticated users read available cafe menu"
  on public.ecafe_menu_items for select to authenticated using (available or public.is_admin());

drop policy if exists "Admins manage cafe menu" on public.ecafe_menu_items;
create policy "Admins manage cafe menu"
  on public.ecafe_menu_items for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Owners and staff read cafe orders" on public.ecafe_orders;
create policy "Owners and staff read cafe orders"
  on public.ecafe_orders for select to authenticated
  using (user_id = auth.uid() or public.is_print_staff());

drop policy if exists "Owners and staff read payment transactions" on public.payment_transactions;
create policy "Owners and staff read payment transactions"
  on public.payment_transactions for select to authenticated
  using (user_id = auth.uid() or public.is_print_staff());

drop policy if exists "Owners read their payment QR secrets" on public.payment_transaction_secrets;
create policy "Owners read their payment QR secrets"
  on public.payment_transaction_secrets for select to authenticated
  using (user_id = auth.uid());

create or replace function public.ecafe_order_updated_at()
returns trigger language plpgsql set search_path = public
as $$ begin new.updated_at := now(); return new; end; $$;

drop trigger if exists ecafe_orders_set_updated_at on public.ecafe_orders;
create trigger ecafe_orders_set_updated_at before update on public.ecafe_orders
for each row execute function public.ecafe_order_updated_at();

-- Server-verified payment settlement is the only transition out of payment_pending.
create or replace function public.guard_print_payment_state()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  payment_verified boolean := false;
  file_attach_authorized boolean := coalesce(current_setting('unisync.print_file_attach', true) = 'true', false);
begin
  if tg_op = 'INSERT' then
    if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
      new.payment_status := 'unpaid';
      new.payment_method := 'none';
      new.status := 'payment_pending';
    end if;
    return new;
  end if;

  select exists (
    select 1
    from public.payment_transactions payment
    where payment.print_request_id = old.id
      and payment.status = 'verified'
      and payment.amount_paise = round(new.estimated_cost * 100)::integer
      and payment.method = new.payment_method
  ) into payment_verified;

  if new.payment_status is distinct from old.payment_status and not payment_verified
     and coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
    raise exception 'Payment status can only be changed by verified settlement.';
  end if;

  if old.payment_status = 'unpaid' and new.status not in ('payment_pending', 'cancelled')
     and not payment_verified
     and coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
    raise exception 'Payment must be verified before this job can enter the print queue.';
  end if;

  if new.status in ('submitted', 'queued', 'processing', 'ready', 'completed')
     and new.file_path is null then
    raise exception 'A PDF must be attached before this job can enter the print queue.';
  end if;

  if auth.uid() = old.student_id and public.app_role() = 'student' then
    if file_attach_authorized then
      if old.upload_after_payment is distinct from true
        or old.payment_status <> 'paid'
        or old.file_path is not null
        or new.file_path is null
        or new.file_size is null
        or new.status <> 'submitted'
        or new.payment_status is distinct from old.payment_status
        or new.estimated_cost is distinct from old.estimated_cost
        or new.student_id is distinct from old.student_id
        or new.payment_option is distinct from old.payment_option
        or new.paper_size is distinct from old.paper_size
        or new.upload_after_payment is distinct from false then
        raise exception 'Invalid post-payment PDF attachment.';
      end if;
      return new;
    end if;
    if payment_verified then
      if old.payment_status <> 'unpaid'
        or new.payment_status <> 'paid'
        or (old.file_path is null and new.status <> 'payment_pending')
        or (old.file_path is not null and new.status <> 'submitted')
        or new.payment_method not in ('upi', 'razorpay', 'cash')
        or new.document_name is distinct from old.document_name
        or new.pages is distinct from old.pages
        or new.copies is distinct from old.copies
        or new.estimated_cost is distinct from old.estimated_cost
        or new.student_id is distinct from old.student_id
        or new.file_path is distinct from old.file_path
        or new.file_size is distinct from old.file_size
        or new.payment_option is distinct from old.payment_option
        or new.paper_size is distinct from old.paper_size
        or new.upload_after_payment is distinct from old.upload_after_payment then
        raise exception 'Invalid payment settlement update.';
      end if;
      return new;
    end if;
    if new.status <> 'cancelled' or old.status not in ('payment_pending', 'submitted', 'queued') then
      raise exception 'Students may only cancel a job that has not started printing.';
    end if;
    if new.document_name is distinct from old.document_name
      or new.pages is distinct from old.pages
      or new.copies is distinct from old.copies
      or new.estimated_cost is distinct from old.estimated_cost
      or new.student_id is distinct from old.student_id
      or new.file_path is distinct from old.file_path
      or new.payment_status is distinct from old.payment_status then
      raise exception 'Students cannot modify print job details.';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.price_print_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  settings public.print_queue_settings;
begin
  select * into settings from public.print_queue_settings order by updated_at limit 1;

  if tg_op = 'INSERT' then
    if settings.id is not null then
      if settings.max_pages_per_job is not null and new.pages > settings.max_pages_per_job then
        raise exception 'This queue accepts up to % pages per job.', settings.max_pages_per_job;
      end if;
      new.estimated_cost := round(
        (case
          when new.color_mode = 'color' and new.sides = 'double' then settings.color_double
          when new.color_mode = 'color' then settings.color_single
          when new.sides = 'double' then settings.bw_double
          else settings.bw_single
        end) * new.pages * new.copies,
        2
      );
      new.print_mode := settings.printer_mode;
    end if;
    if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
      new.payment_status := 'unpaid';
      new.payment_method := 'none';
      new.status := 'payment_pending';
    end if;
    return new;
  end if;

  if auth.uid() = old.student_id and public.app_role() = 'student'
     and (new.status <> 'cancelled' or old.status not in ('payment_pending', 'submitted', 'queued')) then
    raise exception 'Students may only cancel a job that has not started printing.';
  end if;
  return new;
end;
$$;

drop trigger if exists z_guard_print_payment_state on public.print_requests;
create trigger z_guard_print_payment_state
before insert or update on public.print_requests
for each row execute function public.guard_print_payment_state();

create or replace function public.create_ecafe_order(p_items jsonb)
returns table (id uuid, order_number text, amount_paise integer, items jsonb)
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_items jsonb;
  total integer;
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
    sum(menu.price_paise * input.quantity)::integer
  into normalized_items, total
  from jsonb_to_recordset(p_items) as input(item_id text, quantity integer)
  join public.ecafe_menu_items menu on menu.id = input.item_id and menu.available;

  if total is null or total <= 0 then raise exception 'The order total is invalid.'; end if;

  new_id := gen_random_uuid();
  new_number := 'EC-' || lpad(nextval('public.ecafe_order_seq')::text, 5, '0');
  insert into public.ecafe_orders(id, order_number, user_id, items, amount_paise, status)
  values (new_id, new_number, auth.uid(), normalized_items, total, 'PAYMENT_PENDING');

  return query select new_id, new_number, total, normalized_items;
end;
$$;

create or replace function public.attach_paid_print_file(
  p_request_id uuid,
  p_file_path text,
  p_file_size bigint
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  request public.print_requests;
begin
  if auth.uid() is null or p_file_path not like auth.uid()::text || '/%'
     or p_file_size <= 0 or p_file_size > 5242880 then
    raise exception 'Invalid staged PDF.';
  end if;
  select * into request
  from public.print_requests
  where id = p_request_id and student_id = auth.uid()
  for update;
  if not found or request.payment_status <> 'paid'
     or request.status <> 'payment_pending'
     or not request.upload_after_payment
     or request.file_path is not null then
    raise exception 'This request is not awaiting a post-payment PDF upload.';
  end if;
  perform set_config('unisync.print_file_attach', 'true', true);
  update public.print_requests
  set file_path = p_file_path,
      file_size = p_file_size,
      upload_after_payment = false,
      status = 'submitted',
      updated_at = now()
  where id = p_request_id;
  return true;
end;
$$;

create or replace function public.start_payment_transaction(
  p_module text,
  p_entity_id uuid,
  p_method text,
  p_counter_token_hash text,
  p_counter_token text
)
returns table (id uuid, amount_paise integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  amount integer;
  owner uuid;
  new_id uuid := gen_random_uuid();
begin
  if auth.uid() is null then raise exception 'Sign in to start payment.'; end if;
  if p_method not in ('upi', 'razorpay', 'cash') then raise exception 'Select a valid payment method.'; end if;
  if p_counter_token is null or p_counter_token !~ '^[0-9a-f]{64}$'
     or (p_method in ('cash', 'upi') and (
       p_counter_token_hash is null or p_counter_token_hash !~ '^[0-9a-f]{64}$'
     ))
     or (p_method = 'razorpay' and p_counter_token_hash is not null) then
    raise exception 'Invalid payment authorization token.';
  end if;
  if p_module = 'printpulse' then
    select round(estimated_cost * 100)::integer, student_id
    into amount, owner
    from public.print_requests
    where print_requests.id = p_entity_id
      and status = 'payment_pending' and payment_status = 'unpaid'
    for update;
    if not found or owner <> auth.uid() then raise exception 'Pending print request not found.'; end if;
    if not exists (
      select 1 from public.print_requests
      where id = p_entity_id and payment_option = p_method
        and ((p_method = 'cash' and file_path is not null and not upload_after_payment)
          or (p_method <> 'cash' and file_path is null and upload_after_payment))
    ) then raise exception 'Payment method does not match the print request workflow.'; end if;
  elsif p_module = 'ecafe' then
    select ecafe_orders.amount_paise, user_id
    into amount, owner
    from public.ecafe_orders
    where ecafe_orders.id = p_entity_id and status = 'PAYMENT_PENDING'
    for update;
    if not found or owner <> auth.uid() then raise exception 'Pending cafe order not found.'; end if;
  else
    raise exception 'Invalid payment module.';
  end if;

  if amount is null or amount <= 0 then raise exception 'The payment amount is invalid.'; end if;

  if exists (
    select 1 from public.payment_transactions
    where status = 'pending'
      and ((p_module = 'printpulse' and print_request_id = p_entity_id)
        or (p_module = 'ecafe' and ecafe_order_id = p_entity_id))
  ) then
    raise exception 'A payment session is already pending for this order. Resume that session instead of starting another.';
  end if;

  insert into public.payment_transactions (
    id, user_id, module, print_request_id, ecafe_order_id, amount_paise, method, counter_token_hash
  ) values (
    new_id, owner, p_module,
    case when p_module = 'printpulse' then p_entity_id end,
    case when p_module = 'ecafe' then p_entity_id end,
    amount, p_method, case when p_method in ('cash', 'upi') then p_counter_token_hash end
  );
  if p_method in ('cash', 'upi') then
    insert into public.payment_transaction_secrets(transaction_id, user_id, counter_token)
    values (new_id, owner, p_counter_token);
  end if;
  return query select new_id, amount;
end;
$$;

create or replace function public.settle_payment_transaction(
  p_transaction_id uuid,
  p_source text,
  p_counter_token_hash text default null,
  p_payment_reference text default null,
  p_razorpay_order_id text default null,
  p_razorpay_payment_id text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  transaction public.payment_transactions;
  jwt_role text := coalesce(current_setting('request.jwt.claim.role', true), '');
begin
  select * into transaction from public.payment_transactions
  where payment_transactions.id = p_transaction_id for update;
  if not found or transaction.status <> 'pending' then return false; end if;

  if p_source = 'razorpay' then
    if jwt_role <> 'service_role'
       or transaction.method <> 'razorpay'
       or transaction.razorpay_order_id is null
       or transaction.razorpay_order_id <> p_razorpay_order_id
       or p_razorpay_payment_id is null then
      raise exception 'Verified Razorpay order does not match this transaction.';
    end if;
  else
    if auth.uid() is null or not public.is_print_staff() then
      raise exception 'Print or cafe counter staff must verify this payment.';
    end if;
    if p_source not in ('cash', 'upi') or transaction.method <> p_source
       or transaction.counter_token_hash is null
       or transaction.counter_token_hash <> p_counter_token_hash then
      raise exception 'Payment QR or method is invalid.';
    end if;
    if p_source = 'upi' and nullif(trim(p_payment_reference), '') is null then
      raise exception 'Enter the UPI transaction reference after confirming receipt.';
    end if;
  end if;

  if transaction.module = 'printpulse' then
    update public.payment_transactions
    set status = 'verified',
        payment_reference = nullif(trim(p_payment_reference), ''),
        razorpay_payment_id = p_razorpay_payment_id,
        verified_at = now()
    where id = transaction.id;
    update public.print_requests
    set payment_status = 'paid',
        payment_method = transaction.method,
        status = case when file_path is null then 'payment_pending' else 'submitted' end,
        updated_at = now()
    where id = transaction.print_request_id
      and payment_status = 'unpaid' and status = 'payment_pending'
      and round(estimated_cost * 100)::integer = transaction.amount_paise;
    if not found then raise exception 'Print request amount or state did not match the verified payment.'; end if;
  else
    update public.ecafe_orders
    set status = 'VERIFIED_AND_QUEUED', updated_at = now()
    where id = transaction.ecafe_order_id
      and status = 'PAYMENT_PENDING' and amount_paise = transaction.amount_paise;
    if not found then return false; end if;
    update public.payment_transactions
    set status = 'verified',
        payment_reference = nullif(trim(p_payment_reference), ''),
        razorpay_payment_id = p_razorpay_payment_id,
        verified_at = now()
    where id = transaction.id;
  end if;

  delete from public.payment_transaction_secrets where transaction_id = transaction.id;
  return true;
end;
$$;

create or replace function public.set_razorpay_order(
  p_transaction_id uuid,
  p_order_id text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or nullif(p_order_id, '') is null then
    raise exception 'Invalid Razorpay order.';
  end if;
  update public.payment_transactions
  set razorpay_order_id = p_order_id
  where id = p_transaction_id and user_id = auth.uid()
    and method = 'razorpay' and status = 'pending'
    and razorpay_order_id is null;
  return found;
end;
$$;

create or replace function public.complete_ecafe_order(p_order_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_print_staff() then raise exception 'Authorized cafe staff required.'; end if;
  update public.ecafe_orders
  set status = 'COMPLETED', updated_at = now()
  where id = p_order_id and status = 'VERIFIED_AND_QUEUED';
  return found;
end;
$$;

create or replace function public.get_print_queue_info()
returns table (
  pending integer,
  processing integer,
  my_position integer,
  estimated_wait_minutes integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  pending_count integer := 0;
  processing_count integer := 0;
  my_created timestamptz;
  position integer;
  avg_minutes integer := 4;
begin
  select
    count(*) filter (where status in ('submitted', 'queued')),
    count(*) filter (where status = 'processing')
  into pending_count, processing_count
  from public.print_requests
  where payment_status in ('paid', 'not_required')
    and file_path is not null
    and status in ('submitted', 'queued', 'processing');

  select min(created_at) into my_created
  from public.print_requests
  where student_id = auth.uid()
    and payment_status in ('paid', 'not_required')
    and file_path is not null
    and status in ('submitted', 'queued', 'processing');

  select coalesce(max(avg_processing_minutes), 4) into avg_minutes
  from public.print_queue_settings;

  if my_created is null then
    return query select pending_count, processing_count, null::integer, 0;
    return;
  end if;

  select count(*) + 1 into position
  from public.print_requests
  where payment_status in ('paid', 'not_required')
    and file_path is not null
    and status in ('submitted', 'queued', 'processing')
    and created_at <= my_created;

  return query
    select pending_count, processing_count, position, greatest(position - 1, 0) * avg_minutes;
end;
$$;

revoke all on function public.create_ecafe_order(jsonb) from public;
revoke all on function public.attach_paid_print_file(uuid, text, bigint) from public;
revoke all on function public.start_payment_transaction(text, uuid, text, text, text) from public;
revoke all on function public.settle_payment_transaction(uuid, text, text, text, text, text) from public;
revoke all on function public.set_razorpay_order(uuid, text) from public;
revoke all on function public.complete_ecafe_order(uuid) from public;
grant execute on function public.create_ecafe_order(jsonb) to authenticated;
grant execute on function public.attach_paid_print_file(uuid, text, bigint) to authenticated;
grant execute on function public.start_payment_transaction(text, uuid, text, text, text) to authenticated;
grant execute on function public.settle_payment_transaction(uuid, text, text, text, text, text) to authenticated, service_role;
grant execute on function public.set_razorpay_order(uuid, text) to authenticated;
grant execute on function public.complete_ecafe_order(uuid) to authenticated;

grant select on public.ecafe_menu_items, public.ecafe_orders, public.payment_transactions to authenticated;
grant select on public.payment_transaction_secrets to authenticated;
grant insert, update, delete on public.ecafe_menu_items to authenticated;
