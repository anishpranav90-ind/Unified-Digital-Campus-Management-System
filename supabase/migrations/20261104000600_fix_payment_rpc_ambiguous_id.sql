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
      where print_requests.id = p_entity_id and payment_option = p_method
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
