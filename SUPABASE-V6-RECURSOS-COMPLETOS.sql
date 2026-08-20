begin;

-- Fila Facil v6: recursos extras opcionais para transformar o MVP em app completo.
-- Rode este arquivo no SQL Editor depois da v5 estar funcionando.

alter table if exists public.barbershops
  add column if not exists verification_notes text,
  add column if not exists verification_reviewed_at timestamptz,
  add column if not exists suspended_at timestamptz,
  add column if not exists average_rating numeric default 0,
  add column if not exists ratings_count integer default 0,
  add column if not exists opening_hours jsonb default '{}'::jsonb,
  add column if not exists description text;

create table if not exists public.shop_reviews (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.barbershops(id) on delete cascade,
  client_account_id uuid references public.app_accounts(id) on delete set null,
  rating integer not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  unique(shop_id, client_account_id)
);

create table if not exists public.shop_audit_logs (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid references public.barbershops(id) on delete cascade,
  account_id uuid references public.app_accounts(id) on delete set null,
  action text not null,
  payload jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.ff_recalculate_shop_rating(p_shop_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.barbershops b
  set average_rating = coalesce((select round(avg(r.rating)::numeric, 2) from public.shop_reviews r where r.shop_id = p_shop_id), 0),
      ratings_count = coalesce((select count(*)::int from public.shop_reviews r where r.shop_id = p_shop_id), 0)
  where b.id = p_shop_id;
$$;

create or replace function public.ff_leave_queue(p_token text, p_shop_slug text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account_id uuid := public.ff_account_id(p_token);
  v_shop public.barbershops;
begin
  if v_account_id is null then return jsonb_build_object('ok', false, 'error', 'Sessao invalida.'); end if;
  select * into v_shop from public.barbershops where slug = p_shop_slug and verification_status = 'approved';
  if not found then return jsonb_build_object('ok', false, 'error', 'Barbearia nao encontrada.'); end if;
  update public.queue_entries
  set status = 'cancelled', finished_at = now()
  where shop_id = v_shop.id and client_account_id = v_account_id and status in ('waiting','called');
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.ff_review_shop(p_token text, p_shop_slug text, p_rating integer, p_comment text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account_id uuid := public.ff_account_id(p_token);
  v_shop public.barbershops;
begin
  if v_account_id is null then return jsonb_build_object('ok', false, 'error', 'Entre com sua conta de cliente.'); end if;
  select * into v_shop from public.barbershops where slug = p_shop_slug and verification_status = 'approved';
  if not found then return jsonb_build_object('ok', false, 'error', 'Barbearia nao encontrada.'); end if;
  if p_rating not between 1 and 5 then return jsonb_build_object('ok', false, 'error', 'Nota invalida.'); end if;
  insert into public.shop_reviews(shop_id, client_account_id, rating, comment)
  values(v_shop.id, v_account_id, p_rating, nullif(trim(coalesce(p_comment,'')),''))
  on conflict(shop_id, client_account_id) do update set rating = excluded.rating, comment = excluded.comment, created_at = now();
  perform public.ff_recalculate_shop_rating(v_shop.id);
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.ff_admin_review_shop(p_token text, p_shop_id uuid, p_status text, p_notes text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account public.app_accounts;
begin
  select * into v_account from public.app_accounts where id = public.ff_account_id(p_token);
  -- Primeiro dono cadastrado ou conta com username admin pode moderar. Ajuste depois para sua regra definitiva.
  if not found or (v_account.username <> 'admin' and not exists(select 1 from public.app_accounts a where a.role='owner' and a.created_at <= v_account.created_at)) then
    return jsonb_build_object('ok', false, 'error', 'Acesso admin necessario.');
  end if;
  if p_status not in ('approved','rejected','suspended','pending') then return jsonb_build_object('ok', false, 'error', 'Status invalido.'); end if;
  update public.barbershops
  set verification_status = case when p_status='suspended' then verification_status else p_status end,
      suspended_at = case when p_status='suspended' then now() else null end,
      verification_notes = nullif(trim(coalesce(p_notes,'')),''),
      verification_reviewed_at = now()
  where id = p_shop_id;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.ff_auto_approve_pending_barbershops()
returns void
language sql
security definer
set search_path = public
as $$
  update public.barbershops
  set verification_status = 'approved', verification_reviewed_at = now(), verification_notes = coalesce(verification_notes, 'Aprovada automaticamente apos 1 minuto.')
  where verification_status = 'pending'
    and verification_submitted_at <= now() - interval '1 minute'
    and ownership_confirmed = true
    and latitude is not null
    and longitude is not null
    and char_length(trim(coalesce(name, ''))) >= 4
    and char_length(trim(coalesce(address, ''))) >= 12;
$$;

grant execute on function public.ff_leave_queue(text,text) to anon, authenticated;
grant execute on function public.ff_review_shop(text,text,integer,text) to anon, authenticated;
grant execute on function public.ff_admin_review_shop(text,uuid,text,text) to anon, authenticated;
grant execute on function public.ff_auto_approve_pending_barbershops() to anon, authenticated;

commit;

select 'FILA FACIL V6 RECURSOS COMPLETOS PRONTO' as resultado;
