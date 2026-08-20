begin;

-- Fila Fácil 0.2 - pedidos de pagamento manual e liberação pelo celular.
-- Rode este arquivo no Supabase SQL Editor.

alter table if exists public.app_accounts
  add column if not exists payment_status text not null default 'unpaid',
  add column if not exists lifetime_access boolean not null default false,
  add column if not exists paid_until timestamptz;

create table if not exists public.payment_requests (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.app_accounts(id) on delete cascade,
  payer_name text not null,
  plan_type text not null check (plan_type in ('cliente', 'barbearia')),
  amount numeric not null check (amount in (1.00, 6.99, 19.99)),
  status text not null default 'pending' check (status in ('pending', 'approved', 'denied')),
  review_note text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by text
);

create index if not exists payment_requests_status_idx on public.payment_requests(status, created_at desc);
create index if not exists payment_requests_account_idx on public.payment_requests(account_id, created_at desc);

create or replace function public.ff_billing_status(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account_id uuid := public.ff_account_id(p_token);
  v_account public.app_accounts;
  v_pending boolean := false;
  v_paid boolean := false;
  v_plan text := 'cliente';
begin
  if v_account_id is null then
    return jsonb_build_object('ok', true, 'loggedIn', false, 'paid', true);
  end if;

  select * into v_account from public.app_accounts where id = v_account_id;
  if not found then
    return jsonb_build_object('ok', true, 'loggedIn', false, 'paid', true);
  end if;

  v_plan := case when v_account.role = 'owner' then 'barbearia' else 'cliente' end;
  v_paid := case
    when v_account.role = 'client' then coalesce(v_account.lifetime_access, false) or v_account.payment_status in ('approved', 'active')
    when v_account.role = 'owner' then coalesce(v_account.paid_until, now() - interval '1 day') > now() or v_account.payment_status = 'active'
    else true
  end;

  select exists(
    select 1 from public.payment_requests pr
    where pr.account_id = v_account.id and pr.plan_type = v_plan and pr.status = 'pending'
  ) into v_pending;

  return jsonb_build_object(
    'ok', true,
    'loggedIn', true,
    'paid', v_paid,
    'pending', v_pending,
    'planType', v_plan,
    'role', v_account.role,
    'paidUntil', v_account.paid_until,
    'lifetimeAccess', coalesce(v_account.lifetime_access, false),
    'displayName', v_account.display_name
  );
end;
$$;

create or replace function public.ff_create_payment_request(p_token text, p_plan_type text, p_payer_name text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account_id uuid := public.ff_account_id(p_token);
  v_account public.app_accounts;
  v_plan text := lower(trim(coalesce(p_plan_type, '')));
  v_name text := trim(coalesce(p_payer_name, ''));
  v_amount numeric;
  v_request public.payment_requests;
begin
  if v_account_id is null then
    return jsonb_build_object('ok', false, 'error', 'Entre com sua conta antes de avisar o pagamento.');
  end if;

  select * into v_account from public.app_accounts where id = v_account_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Conta não encontrada.');
  end if;

  if v_plan not in ('cliente', 'barbearia') then
    return jsonb_build_object('ok', false, 'error', 'Plano inválido.');
  end if;

  if v_plan = 'cliente' and v_account.role <> 'client' then
    return jsonb_build_object('ok', false, 'error', 'Entre com uma conta de cliente para liberar cliente.');
  end if;

  if v_plan = 'barbearia' and v_account.role <> 'owner' then
    return jsonb_build_object('ok', false, 'error', 'Entre com uma conta de proprietário para liberar barbearia.');
  end if;

  if char_length(v_name) < 3 or char_length(v_name) > 80 then
    return jsonb_build_object('ok', false, 'error', 'Informe o nome de quem pagou o Pix.');
  end if;

  v_amount := case when v_plan = 'cliente' then 1.00 else 6.99 end;

  update public.payment_requests
  set payer_name = v_name,
      amount = v_amount,
      status = 'pending',
      review_note = null,
      reviewed_at = null,
      reviewed_by = null,
      created_at = now()
  where account_id = v_account.id and plan_type = v_plan and status = 'pending'
  returning * into v_request;

  if not found then
    insert into public.payment_requests(account_id, payer_name, plan_type, amount)
    values(v_account.id, v_name, v_plan, v_amount)
    returning * into v_request;
  end if;

  return jsonb_build_object(
    'ok', true,
    'request', jsonb_build_object(
      'id', v_request.id,
      'payerName', v_request.payer_name,
      'planType', v_request.plan_type,
      'amount', v_request.amount,
      'status', v_request.status,
      'createdAt', v_request.created_at
    )
  );
end;
$$;

grant execute on function public.ff_billing_status(text) to anon, authenticated;
grant execute on function public.ff_create_payment_request(text,text,text) to anon, authenticated;

commit;

select 'PAGAMENTOS MANUAIS 0.2 PRONTO' as resultado;
