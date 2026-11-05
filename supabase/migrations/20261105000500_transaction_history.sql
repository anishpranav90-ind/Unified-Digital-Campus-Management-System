create index if not exists ecafe_orders_user_created_idx
  on public.ecafe_orders (user_id, created_at desc);

create or replace function public.list_my_transaction_history(
  p_type text default 'all',
  p_search text default '',
  p_start_date date default null,
  p_end_date date default null,
  p_limit integer default 11,
  p_offset integer default 0
)
returns table (
  type text,
  id uuid,
  reference text,
  created_at timestamptz,
  status text,
  payment_method text,
  amount_paise integer,
  details jsonb
)
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in to view transaction history.';
  end if;
  if p_type is null or p_search is null or p_limit is null or p_offset is null
     or p_type not in ('all', 'ecafe', 'printpulse')
     or p_limit < 1 or p_limit > 51
     or p_offset < 0 or p_offset > 1000000
     or length(coalesce(p_search, '')) > 100
     or (p_start_date is not null and p_end_date is not null and p_start_date > p_end_date) then
    raise exception 'Invalid transaction history filters.';
  end if;

  return query
  with my_transactions as (
    select
      'ecafe'::text as type,
      orders.id,
      orders.order_number as reference,
      orders.created_at,
      orders.status,
      orders.payment_method,
      orders.amount_paise,
      jsonb_build_object(
        'token_number', orders.token_number,
        'items', orders.items,
        'is_express', orders.is_express
      ) as details,
      concat_ws(' ', orders.order_number, orders.items::text) as searchable
    from public.ecafe_orders orders
    where orders.user_id = auth.uid()
      and (p_type in ('all', 'ecafe'))

    union all

    select
      'printpulse'::text as type,
      requests.id,
      requests.request_number as reference,
      requests.created_at,
      requests.status,
      case
        when requests.payment_method is null or requests.payment_method = 'none'
          then requests.payment_option
        else requests.payment_method
      end as payment_method,
      round(requests.estimated_cost * 100)::integer as amount_paise,
      jsonb_build_object(
        'document_name', requests.document_name,
        'pages', requests.pages,
        'paper_size', requests.paper_size,
        'page_range', requests.page_range,
        'copies', requests.copies,
        'color_mode', requests.color_mode,
        'sides', requests.sides,
        'payment_status', requests.payment_status,
        'file_size', requests.file_size
      ) as details,
      concat_ws(' ', requests.request_number, requests.document_name) as searchable
    from public.print_requests requests
    where requests.student_id = auth.uid()
      and (p_type in ('all', 'printpulse'))
  )
  select
    transaction.type,
    transaction.id,
    transaction.reference,
    transaction.created_at,
    transaction.status,
    transaction.payment_method,
    transaction.amount_paise,
    transaction.details
  from my_transactions transaction
  where (p_search = '' or position(lower(p_search) in lower(transaction.searchable)) > 0)
    and (p_start_date is null or (transaction.created_at at time zone 'Asia/Kolkata')::date >= p_start_date)
    and (p_end_date is null or (transaction.created_at at time zone 'Asia/Kolkata')::date <= p_end_date)
  order by transaction.created_at desc, transaction.id desc
  limit p_limit
  offset p_offset;
end;
$$;

revoke all on function public.list_my_transaction_history(text, text, date, date, integer, integer)
  from public, anon;
grant execute on function public.list_my_transaction_history(text, text, date, date, integer, integer)
  to authenticated;
