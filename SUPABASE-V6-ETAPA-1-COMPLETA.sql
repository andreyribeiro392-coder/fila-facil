begin;

-- FILA FÁCIL V6 - ETAPA 1 COMPLETA
-- Rode este arquivo no Supabase SQL Editor depois da v5/v6 estar publicada.
-- Ele ativa: serviços padrão, sair da fila, avaliações, auditoria, status extras e aprovação automática mais segura.

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

create table if not exists public.app_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_account_id uuid references public.app_accounts(id) on delete set null,
  shop_id uuid references public.barbershops(id) on delete cascade,
  report_type text not null,
  message text not null,
  status text not null default 'open',
  created_at timestamptz not null default now()
);

create or replace function public.ff_seed_default_services(p_shop_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.services(shop_id, name, price, duration_minutes, is_active)
  select p_shop_id, s.name, s.price, s.duration_minutes, true
  from (values
    ('Corte masculino', 30.00::numeric, 30),
    ('Barba', 20.00::numeric, 20),
    ('Corte + barba', 45.00::numeric, 50),
    ('Sobrancelha', 10.00::numeric, 10)
  ) as s(name, price, duration_minutes)
  where p_shop_id is not null
    and not exists (select 1 from public.services existing where existing.shop_id = p_shop_id and existing.is_active = true);
$$;

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
  v_changed integer := 0;
begin
  if v_account_id is null then return jsonb_build_object('ok', false, 'error', 'Sessão inválida.'); end if;
  select * into v_shop from public.barbershops where slug = p_shop_slug and verification_status = 'approved';
  if not found then return jsonb_build_object('ok', false, 'error', 'Barbearia não encontrada.'); end if;
  update public.queue_entries
  set status = 'cancelled', finished_at = now()
  where shop_id = v_shop.id and client_account_id = v_account_id and status in ('waiting','called')
  returning 1 into v_changed;
  insert into public.shop_audit_logs(shop_id, account_id, action, payload) values(v_shop.id, v_account_id, 'client_leave_queue', '{}'::jsonb);
  return jsonb_build_object('ok', true, 'changed', coalesce(v_changed, 0));
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
  if not found then return jsonb_build_object('ok', false, 'error', 'Barbearia não encontrada.'); end if;
  if p_rating not between 1 and 5 then return jsonb_build_object('ok', false, 'error', 'Nota inválida.'); end if;
  if not exists(select 1 from public.queue_entries q where q.shop_id = v_shop.id and q.client_account_id = v_account_id and q.status = 'finished') then
    return jsonb_build_object('ok', false, 'error', 'Avaliação liberada após atendimento finalizado.');
  end if;
  insert into public.shop_reviews(shop_id, client_account_id, rating, comment)
  values(v_shop.id, v_account_id, p_rating, nullif(left(trim(coalesce(p_comment,'')), 400),''))
  on conflict(shop_id, client_account_id) do update set rating = excluded.rating, comment = excluded.comment, created_at = now();
  perform public.ff_recalculate_shop_rating(v_shop.id);
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.ff_report_shop(p_token text, p_shop_slug text, p_report_type text, p_message text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account_id uuid := public.ff_account_id(p_token);
  v_shop public.barbershops;
begin
  if v_account_id is null then return jsonb_build_object('ok', false, 'error', 'Entre com sua conta.'); end if;
  select * into v_shop from public.barbershops where slug = p_shop_slug;
  if not found then return jsonb_build_object('ok', false, 'error', 'Barbearia não encontrada.'); end if;
  if char_length(trim(coalesce(p_message,''))) < 10 then return jsonb_build_object('ok', false, 'error', 'Explique melhor a denúncia.'); end if;
  insert into public.app_reports(reporter_account_id, shop_id, report_type, message)
  values(v_account_id, v_shop.id, coalesce(nullif(p_report_type,''),'shop'), left(trim(p_message), 800));
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.ff_public_shop(p_slug text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shop public.barbershops;
begin
  select * into v_shop from public.barbershops where slug = p_slug and verification_status = 'approved' and suspended_at is null;
  if not found then return jsonb_build_object('ok', false, 'error', 'Barbearia não encontrada ou ainda não aprovada.'); end if;
  perform public.ff_seed_default_services(v_shop.id);
  return jsonb_build_object(
    'ok', true,
    'shop', jsonb_build_object(
      'id', v_shop.id, 'name', v_shop.name, 'slug', v_shop.slug, 'address', v_shop.address,
      'logo_url', v_shop.logo_url, 'is_open', v_shop.is_open, 'latitude', v_shop.latitude, 'longitude', v_shop.longitude,
      'average_rating', coalesce(v_shop.average_rating,0), 'ratings_count', coalesce(v_shop.ratings_count,0), 'description', v_shop.description
    ),
    'services', coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'price',s.price,'duration_minutes',s.duration_minutes) order by s.name) from public.services s where s.shop_id=v_shop.id and s.is_active), '[]'::jsonb),
    'barbers', coalesce((select jsonb_agg(jsonb_build_object('id',b.id,'name',b.name) order by b.name) from public.barbers b where b.shop_id=v_shop.id and b.is_active), '[]'::jsonb),
    'queue', coalesce((select jsonb_agg(jsonb_build_object('id',q.id,'customer_name',q.customer_name,'status',q.status,'joined_at',q.joined_at,'service_id',q.service_id,'barber_id',q.barber_id) order by q.joined_at) from public.queue_entries q where q.shop_id=v_shop.id and q.status in ('waiting','called','in_service')), '[]'::jsonb),
    'reviews', coalesce((select jsonb_agg(jsonb_build_object('rating',r.rating,'comment',r.comment,'created_at',r.created_at) order by r.created_at desc) from public.shop_reviews r where r.shop_id=v_shop.id limit 20), '[]'::jsonb)
  );
end;
$$;

create or replace function public.ff_auto_approve_pending_barbershops()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shop record;
begin
  for v_shop in
    update public.barbershops
    set verification_status = 'approved', verification_reviewed_at = now(), verification_notes = coalesce(verification_notes, 'Aprovada automaticamente após 1 minuto.')
    where verification_status = 'pending'
      and verification_submitted_at <= now() - interval '1 minute'
      and ownership_confirmed = true
      and latitude is not null
      and longitude is not null
      and char_length(trim(coalesce(name, ''))) >= 4
      and char_length(trim(coalesce(address, ''))) >= 12
    returning id
  loop
    perform public.ff_seed_default_services(v_shop.id);
  end loop;
end;
$$;

-- Corrige barbearias já aprovadas sem serviço.
select public.ff_seed_default_services(id) from public.barbershops where verification_status = 'approved';

grant execute on function public.ff_seed_default_services(uuid) to anon, authenticated;
grant execute on function public.ff_leave_queue(text,text) to anon, authenticated;
grant execute on function public.ff_review_shop(text,text,integer,text) to anon, authenticated;
grant execute on function public.ff_report_shop(text,text,text,text) to anon, authenticated;
grant execute on function public.ff_auto_approve_pending_barbershops() to anon, authenticated;

commit;

select 'FILA FACIL V6 ETAPA 1 COMPLETA PRONTA' as resultado;
