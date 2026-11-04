-- Durable Razorpay event receipts and payment-attempt state.
alter table public.payment_transactions
  add column if not exists razorpay_payment_status text not null default 'created'
    check (razorpay_payment_status in ('created', 'authorized', 'captured', 'failed')),
  add column if not exists razorpay_event_id text,
  add column if not exists razorpay_paid_at timestamptz,
  add column if not exists razorpay_authorized_at timestamptz,
  add column if not exists razorpay_failed_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.razorpay_payment_attempts (
  payment_id text primary key,
  transaction_id uuid not null references public.payment_transactions(id) on delete cascade,
  order_id text not null,
  amount_paise integer not null check (amount_paise > 0),
  currency text not null check (currency = 'INR'),
  status text not null check (status in ('authorized', 'captured', 'failed')),
  failure_code text,
  event_created_at timestamptz not null,
  updated_at timestamptz not null default now()
);

create index if not exists razorpay_payment_attempts_transaction_idx
  on public.razorpay_payment_attempts(transaction_id, event_created_at desc);

create table if not exists public.razorpay_webhook_events (
  event_id text primary key check (char_length(event_id) between 1 and 255),
  event_type text not null check (
    event_type in ('payment.authorized', 'payment.captured', 'payment.failed', 'order.paid')
  ),
  transaction_id uuid not null references public.payment_transactions(id) on delete cascade,
  event_created_at timestamptz not null,
  received_at timestamptz not null default now()
);

create or replace function public.stamp_razorpay_capture()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.method = 'razorpay' and new.status = 'verified' and old.status <> 'verified' then
    new.razorpay_payment_status := 'captured';
    new.razorpay_paid_at := coalesce(new.razorpay_paid_at, new.verified_at, now());
    new.updated_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists payment_transactions_stamp_razorpay_capture on public.payment_transactions;
create trigger payment_transactions_stamp_razorpay_capture
before update on public.payment_transactions
for each row execute function public.stamp_razorpay_capture();

alter table public.razorpay_payment_attempts enable row level security;
alter table public.razorpay_webhook_events enable row level security;

create or replace function public.process_razorpay_webhook_event(
  p_event_id text,
  p_event_type text,
  p_order_id text,
  p_payment_id text,
  p_amount_paise bigint,
  p_currency text,
  p_payment_status text,
  p_event_created_at timestamptz,
  p_failure_code text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  payment_transaction public.payment_transactions;
  inserted_event_id text;
  current_attempt public.razorpay_payment_attempts;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
    raise exception using errcode = '42501', message = 'Service role required.';
  end if;
  if p_event_id is null or char_length(p_event_id) not between 1 and 255
     or p_event_type not in ('payment.authorized', 'payment.captured', 'payment.failed', 'order.paid')
     or nullif(p_order_id, '') is null
     or nullif(p_payment_id, '') is null
     or p_amount_paise is null or p_amount_paise < 1
     or p_amount_paise > 2147483647
     or p_currency is null
     or p_currency <> 'INR'
     or p_event_created_at is null then
    raise exception using errcode = '22023', message = 'Invalid webhook payment fields.';
  end if;
  if (p_event_type = 'payment.authorized' and p_payment_status <> 'authorized')
     or (p_event_type = 'payment.captured' and p_payment_status <> 'captured')
     or (p_event_type = 'payment.failed' and p_payment_status <> 'failed')
     or (p_event_type = 'order.paid' and p_payment_status not in ('captured', 'paid')) then
    raise exception using errcode = '22023', message = 'Webhook event and payment status do not match.';
  end if;

  select * into payment_transaction
  from public.payment_transactions t
  where t.razorpay_order_id = p_order_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Payment transaction not found.';
  end if;
  if payment_transaction.method <> 'razorpay' then
    raise exception using errcode = '22023', message = 'Payment method does not match the webhook.';
  end if;
  if payment_transaction.amount_paise <> p_amount_paise then
    raise exception using errcode = '22023', message = 'Webhook amount does not match the payment transaction.';
  end if;
  if payment_transaction.status not in ('pending', 'verified') then
    raise exception using errcode = '22023', message = 'Payment transaction is not payable.';
  end if;

  insert into public.razorpay_webhook_events(event_id, event_type, transaction_id, event_created_at)
  values (p_event_id, p_event_type, payment_transaction.id, p_event_created_at)
  on conflict (event_id) do nothing
  returning event_id into inserted_event_id;
  if inserted_event_id is null then
    return 'duplicate';
  end if;

  select * into current_attempt
  from public.razorpay_payment_attempts
  where payment_id = p_payment_id
  for update;
  if found and (
    current_attempt.transaction_id <> payment_transaction.id
    or current_attempt.order_id <> p_order_id
    or current_attempt.amount_paise <> p_amount_paise
    or current_attempt.currency <> p_currency
  ) then
    raise exception using errcode = '22023', message = 'Payment attempt does not match the transaction.';
  end if;

  insert into public.razorpay_payment_attempts(
    payment_id, transaction_id, order_id, amount_paise, currency, status, failure_code,
    event_created_at, updated_at
  )
  values (
    p_payment_id, payment_transaction.id, p_order_id, p_amount_paise::integer, p_currency,
    case
      when payment_transaction.status = 'verified' or p_payment_status = 'paid' then 'captured'
      else p_payment_status
    end,
    case when payment_transaction.status = 'verified' then null else p_failure_code end,
    p_event_created_at, now()
  )
  on conflict (payment_id) do update
  set status = case
        when public.razorpay_payment_attempts.status = 'captured' then 'captured'
        else excluded.status
      end,
      failure_code = case
        when public.razorpay_payment_attempts.status = 'captured' then null
        else excluded.failure_code
      end,
      event_created_at = greatest(public.razorpay_payment_attempts.event_created_at, excluded.event_created_at),
      updated_at = now();

  if payment_transaction.status = 'verified' then
    if p_payment_status in ('captured', 'paid')
       and payment_transaction.razorpay_payment_id is distinct from p_payment_id then
      return 'already_paid';
    end if;
    return 'processed';
  end if;

  update public.payment_transactions
  set razorpay_payment_id = p_payment_id,
      razorpay_payment_status = case
        when razorpay_payment_status = 'captured' or p_payment_status = 'paid' then 'captured'
        else p_payment_status
      end,
      razorpay_event_id = p_event_id,
      razorpay_authorized_at = case
        when p_payment_status = 'authorized' then p_event_created_at
        else razorpay_authorized_at
      end,
      razorpay_failed_at = case
        when p_payment_status = 'failed' then p_event_created_at
        else razorpay_failed_at
      end,
      razorpay_paid_at = case
        when p_payment_status in ('captured', 'paid') then p_event_created_at
        else razorpay_paid_at
      end,
      updated_at = now()
  where id = payment_transaction.id;

  if p_payment_status in ('captured', 'paid') then
    if p_event_type not in ('payment.captured', 'order.paid') then
      raise exception using errcode = '22023', message = 'This event cannot settle a payment.';
    end if;
    if not public.settle_payment_transaction(
      payment_transaction.id,
      'razorpay',
      null,
      null,
      p_order_id,
      p_payment_id
    ) then
      raise exception using errcode = '22023', message = 'Payment settlement was rejected.';
    end if;
  end if;

  return 'processed';
end;
$$;

revoke all on function public.process_razorpay_webhook_event(
  text, text, text, text, bigint, text, text, timestamptz, text
) from public, anon, authenticated;
grant execute on function public.process_razorpay_webhook_event(
  text, text, text, text, bigint, text, text, timestamptz, text
) to service_role;
