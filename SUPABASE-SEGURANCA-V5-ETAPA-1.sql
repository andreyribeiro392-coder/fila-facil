-- Fila Fácil v5 - segurança, contas e verificação de propriedade.
-- ETAPA 1: cria a nova estrutura sem interromper a versão atualmente publicada.

begin;

create extension if not exists pgcrypto with schema extensions;
create extension if not exists citext with schema extensions;

create table if not exists public.app_accounts (
  id uuid primary key default gen_random_uuid(),
  supabase_user_id uuid not null unique references auth.users(id) on delete cascade,
  username extensions.citext not null unique,
  display_name text not null,
  password_hash text not null,
  role text not null check (role in ('client', 'owner', 'support')),
  failed_attempts integer not null default 0 check (failed_attempts >= 0),
  locked_until timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.app_sessions (
  token_hash text primary key,
  account_id uuid not null references public.app_accounts(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists app_sessions_account_idx on public.app_sessions(account_id);
create index if not exists app_sessions_expiry_idx on public.app_sessions(expires_at);

alter table public.barbershops
  add column if not exists account_owner_id uuid references public.app_accounts(id),
  add column if not exists verification_status text not null default 'pending',
  add column if not exists verification_method text,
  add column if not exists verification_reference text,
  add column if not exists ownership_confirmed boolean not null default false,
  add column if not exists verification_submitted_at timestamptz,
  add column if not exists verification_reviewed_at timestamptz,
  add column if not exists verification_notes text;

alter table public.queue_entries
  add column if not exists client_account_id uuid references public.app_accounts(id);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'barbershops_verification_status_check'
      and conrelid = 'public.barbershops'::regclass
  ) then
    alter table public.barbershops
      add constraint barbershops_verification_status_check
      check (verification_status in ('pending', 'approved', 'rejected'));
  end if;
end $$;

create unique index if not exists barbershops_account_owner_unique
  on public.barbershops(account_owner_id)
  where account_owner_id is not null;

create unique index if not exists queue_one_active_entry_per_client
  on public.queue_entries(shop_id, client_account_id)
  where client_account_id is not null
    and status in ('waiting', 'called', 'in_service');

create or replace function public.ff_normalize_text(p_value text)
returns text
language sql
immutable
set search_path = public
as $$
  select translate(
    lower(trim(coalesce(p_value, ''))),
    'áàâãäéèêëíìîïóòôõöúùûüçñ',
    'aaaaaeeeeiiiiooooouuuucn'
  );
$$;

create or replace function public.ff_compact_text(p_value text)
returns text
language sql
immutable
set search_path = public
as $$
  select regexp_replace(
    translate(public.ff_normalize_text(p_value), '4301$@', 'aeoisa'),
    '[^a-z0-9]',
    '',
    'g'
  );
$$;

create or replace function public.ff_is_safe_name(p_value text, p_min integer default 3, p_max integer default 60)
returns boolean
language plpgsql
immutable
set search_path = public
as $$
declare
  v_clean text := public.ff_normalize_text(p_value);
  v_compact text := public.ff_compact_text(p_value);
begin
  if char_length(trim(coalesce(p_value, ''))) not between p_min and p_max then return false; end if;
  if v_clean !~ '^[a-z0-9][a-z0-9 ''&.-]*[a-z0-9]$' then return false; end if;
  if char_length(regexp_replace(v_clean, '[^a-z]', '', 'g')) < 3 then return false; end if;
  if v_clean !~ '[aeiou]' then return false; end if;
  if v_compact ~ '(.)\1\1\1' then return false; end if;
  if v_compact ~ '(qwerty|asdf|zxcv|abcd|1234|4321|teste|testando|admin|usuario|nomedaloja)' then return false; end if;
  if v_compact ~ '(porra|caralho|merda|buceta|puta|putaria|viado|veado|fdp|foder|foda|cacete|piranha|vagabunda|vagabundo|arrombado|desgracado|desgraçado|nazista|racista|estelionato|golpe)' then return false; end if;
  return true;
end;
$$;

create or replace function public.ff_normalize_username(p_value text)
returns text
language sql
immutable
set search_path = public
as $$
  select regexp_replace(public.ff_normalize_text(p_value), '[^a-z0-9_.]', '', 'g');
$$;

create or replace function public.ff_is_strong_password(p_password text, p_username text)
returns boolean
language plpgsql
immutable
set search_path = public
as $$
declare
  v_lower text := lower(coalesce(p_password, ''));
  v_username text := public.ff_normalize_username(p_username);
begin
  if char_length(coalesce(p_password, '')) < 10 or char_length(p_password) > 72 then return false; end if;
  if p_password !~ '[A-Z]' or p_password !~ '[a-z]' or p_password !~ '[0-9]' or p_password !~ '[^A-Za-z0-9]' then return false; end if;
  if p_password ~ '\s' then return false; end if;
  if char_length(v_username) >= 4 and v_lower like '%' || v_username || '%' then return false; end if;
  if v_lower ~ '(123456|qwerty|abcdef|senha|password|admin)' then return false; end if;
  return true;
end;
$$;

create or replace function public.ff_is_valid_cnpj(p_value text)
returns boolean
language plpgsql
immutable
set search_path = public
as $$
declare
  n text := regexp_replace(coalesce(p_value, ''), '[^0-9]', '', 'g');
  i integer;
  total integer := 0;
  digit integer;
  weights1 integer[] := array[5,4,3,2,9,8,7,6,5,4,3,2];
  weights2 integer[] := array[6,5,4,3,2,9,8,7,6,5,4,3,2];
begin
  if char_length(n) <> 14 or n ~ '^([0-9])\1{13}$' then return false; end if;
  for i in 1..12 loop total := total + substr(n,i,1)::integer * weights1[i]; end loop;
  digit := case when total % 11 < 2 then 0 else 11 - total % 11 end;
  if digit <> substr(n,13,1)::integer then return false; end if;
  total := 0;
  for i in 1..13 loop total := total + substr(n,i,1)::integer * weights2[i]; end loop;
  digit := case when total % 11 < 2 then 0 else 11 - total % 11 end;
  return digit = substr(n,14,1)::integer;
end;
$$;

create or replace function public.ff_new_session(p_account_id uuid)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_token text := encode(gen_random_bytes(32), 'hex');
begin
  delete from public.app_sessions where expires_at <= now();
  insert into public.app_sessions(token_hash, account_id, expires_at)
  values (encode(digest(v_token, 'sha256'), 'hex'), p_account_id, now() + interval '30 days');
  return v_token;
end;
$$;

create or replace function public.ff_account_id(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_id uuid;
begin
  if p_token is null or char_length(p_token) <> 64 then return null; end if;
  select s.account_id into v_id
  from public.app_sessions s
  join public.app_accounts a on a.id = s.account_id
  where s.token_hash = encode(digest(p_token, 'sha256'), 'hex')
    and s.expires_at > now()
    and a.is_active;
  if v_id is not null then
    update public.app_sessions set last_seen_at = now()
    where token_hash = encode(digest(p_token, 'sha256'), 'hex');
  end if;
  return v_id;
end;
$$;

create or replace function public.ff_register_account(
  p_username text,
  p_password text,
  p_display_name text,
  p_role text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_username text := public.ff_normalize_username(p_username);
  v_account public.app_accounts;
  v_token text;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'error', 'Não foi possível iniciar a sessão segura.');
  end if;
  if p_role not in ('client', 'owner') then
    return jsonb_build_object('ok', false, 'error', 'Tipo de conta inválido.');
  end if;
  if v_username !~ '^[a-z][a-z0-9_.]{3,23}$' or not public.ff_is_safe_name(v_username, 4, 24) then
    return jsonb_build_object('ok', false, 'error', 'Escolha um nome de acesso legível, com 4 a 24 caracteres.');
  end if;
  if not public.ff_is_safe_name(p_display_name, 3, 50) then
    return jsonb_build_object('ok', false, 'error', 'O nome informado não é permitido.');
  end if;
  if not public.ff_is_strong_password(p_password, v_username) then
    return jsonb_build_object('ok', false, 'error', 'Use uma senha com 10 caracteres, maiúscula, minúscula, número e símbolo.');
  end if;
  if exists(select 1 from public.app_accounts where username = v_username) then
    return jsonb_build_object('ok', false, 'error', 'Esse nome de acesso não está disponível.');
  end if;
  if exists(select 1 from public.app_accounts where supabase_user_id = auth.uid()) then
    return jsonb_build_object('ok', false, 'error', 'Este dispositivo já iniciou um cadastro. Entre com sua conta.');
  end if;
  insert into public.app_accounts(supabase_user_id, username, display_name, password_hash, role)
  values (auth.uid(), v_username, trim(p_display_name), crypt(p_password, gen_salt('bf', 12)), p_role)
  returning * into v_account;
  v_token := public.ff_new_session(v_account.id);
  return jsonb_build_object(
    'ok', true,
    'token', v_token,
    'account', jsonb_build_object('id', v_account.id, 'username', v_account.username, 'displayName', v_account.display_name, 'role', v_account.role)
  );
exception when unique_violation then
  return jsonb_build_object('ok', false, 'error', 'Esse nome de acesso não está disponível.');
end;
$$;

create or replace function public.ff_login(p_username text, p_password text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_username text := public.ff_normalize_username(p_username);
  v_account public.app_accounts;
  v_token text;
  v_attempts integer;
begin
  select * into v_account from public.app_accounts where username = v_username for update;
  if not found then
    perform pg_sleep(0.35);
    return jsonb_build_object('ok', false, 'error', 'Nome ou senha incorretos.');
  end if;
  if not v_account.is_active then
    return jsonb_build_object('ok', false, 'error', 'Conta bloqueada. Fale com o suporte.');
  end if;
  if v_account.locked_until is not null and v_account.locked_until > now() then
    return jsonb_build_object('ok', false, 'error', 'Muitas tentativas. Aguarde 30 minutos.');
  end if;
  if v_account.password_hash <> crypt(coalesce(p_password, ''), v_account.password_hash) then
    v_attempts := v_account.failed_attempts + 1;
    update public.app_accounts
      set failed_attempts = case when v_attempts >= 5 then 0 else v_attempts end,
          locked_until = case when v_attempts >= 5 then now() + interval '30 minutes' else null end,
          updated_at = now()
      where id = v_account.id;
    perform pg_sleep(0.35);
    return jsonb_build_object('ok', false, 'error', case when v_attempts >= 5 then 'Muitas tentativas. Aguarde 30 minutos.' else 'Nome ou senha incorretos.' end);
  end if;
  update public.app_accounts set failed_attempts = 0, locked_until = null, updated_at = now() where id = v_account.id;
  v_token := public.ff_new_session(v_account.id);
  return jsonb_build_object(
    'ok', true,
    'token', v_token,
    'account', jsonb_build_object('id', v_account.id, 'username', v_account.username, 'displayName', v_account.display_name, 'role', v_account.role)
  );
end;
$$;

create or replace function public.ff_me(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_id uuid := public.ff_account_id(p_token);
  v_account public.app_accounts;
begin
  if v_id is null then return jsonb_build_object('ok', false); end if;
  select * into v_account from public.app_accounts where id = v_id;
  return jsonb_build_object('ok', true, 'account', jsonb_build_object(
    'id', v_account.id, 'username', v_account.username, 'displayName', v_account.display_name, 'role', v_account.role
  ));
end;
$$;

create or replace function public.ff_logout(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if p_token is not null then
    delete from public.app_sessions where token_hash = encode(digest(p_token, 'sha256'), 'hex');
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.ff_create_shop(
  p_token text,
  p_name text,
  p_whatsapp text,
  p_address text,
  p_latitude double precision,
  p_longitude double precision,
  p_verification_method text,
  p_verification_reference text,
  p_ownership_confirmed boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_account_id uuid := public.ff_account_id(p_token);
  v_account public.app_accounts;
  v_slug text;
  v_reference text := trim(coalesce(p_verification_reference, ''));
  v_shop_id uuid;
begin
  select * into v_account from public.app_accounts where id = v_account_id;
  if not found or v_account.role <> 'owner' then return jsonb_build_object('ok', false, 'error', 'Acesso de proprietário necessário.'); end if;
  if exists(select 1 from public.barbershops where account_owner_id = v_account.id) then return jsonb_build_object('ok', false, 'error', 'Esta conta já possui uma barbearia.'); end if;
  if not public.ff_is_safe_name(p_name, 4, 60) then return jsonb_build_object('ok', false, 'error', 'Use um nome real e legível para a barbearia.'); end if;
  if char_length(trim(coalesce(p_address, ''))) < 12 or not public.ff_is_safe_name(p_address, 12, 180) then return jsonb_build_object('ok', false, 'error', 'Informe o endereço completo e verdadeiro.'); end if;
  if regexp_replace(coalesce(p_whatsapp, ''), '[^0-9]', '', 'g') !~ '^[0-9]{10,13}$' then return jsonb_build_object('ok', false, 'error', 'Informe um WhatsApp válido com DDD.'); end if;
  if p_latitude is null or p_longitude is null or p_latitude not between -90 and 90 or p_longitude not between -180 and 180 then return jsonb_build_object('ok', false, 'error', 'Confirme o GPS estando no local da barbearia.'); end if;
  if not coalesce(p_ownership_confirmed, false) then return jsonb_build_object('ok', false, 'error', 'Confirme a declaração de propriedade.'); end if;
  if p_verification_method not in ('cnpj', 'google_business', 'social_profile', 'storefront_photo') then return jsonb_build_object('ok', false, 'error', 'Escolha uma comprovação válida.'); end if;
  if p_verification_method = 'cnpj' and not public.ff_is_valid_cnpj(v_reference) then return jsonb_build_object('ok', false, 'error', 'O CNPJ informado não é válido.'); end if;
  if p_verification_method <> 'cnpj' and (char_length(v_reference) < 12 or v_reference !~* '^https://') then return jsonb_build_object('ok', false, 'error', 'Informe um link público válido para comprovação.'); end if;
  v_slug := trim(both '-' from regexp_replace(public.ff_normalize_text(p_name), '[^a-z0-9]+', '-', 'g'));
  if exists(select 1 from public.barbershops where slug = v_slug) then v_slug := v_slug || '-' || substr(gen_random_uuid()::text, 1, 6); end if;
  insert into public.barbershops(
    owner_id, account_owner_id, name, slug, whatsapp, address, latitude, longitude, is_open,
    verification_status, verification_method, verification_reference, ownership_confirmed, verification_submitted_at
  ) values (
    v_account.supabase_user_id, v_account.id, trim(p_name), v_slug, regexp_replace(p_whatsapp, '[^0-9]', '', 'g'), trim(p_address), p_latitude, p_longitude, false,
    'pending', p_verification_method, v_reference, true, now()
  ) returning id into v_shop_id;
  return jsonb_build_object('ok', true, 'shopId', v_shop_id, 'status', 'pending');
end;
$$;

create or replace function public.ff_owner_dashboard(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_account_id uuid := public.ff_account_id(p_token);
  v_shop public.barbershops;
begin
  if v_account_id is null then return jsonb_build_object('ok', false, 'error', 'Sessão inválida.'); end if;
  select * into v_shop from public.barbershops where account_owner_id = v_account_id;
  if not found then return jsonb_build_object('ok', true, 'shop', null); end if;
  return jsonb_build_object(
    'ok', true,
    'shop', to_jsonb(v_shop) - 'verification_reference',
    'barbers', coalesce((select jsonb_agg(to_jsonb(b) order by b.name) from public.barbers b where b.shop_id = v_shop.id), '[]'::jsonb),
    'services', coalesce((select jsonb_agg(to_jsonb(s) order by s.name) from public.services s where s.shop_id = v_shop.id), '[]'::jsonb),
    'queue', coalesce((select jsonb_agg(to_jsonb(q) order by q.joined_at) from public.queue_entries q where q.shop_id = v_shop.id and q.status in ('waiting','called','in_service')), '[]'::jsonb)
  );
end;
$$;

create or replace function public.ff_list_shops()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(
    jsonb_build_object('id', b.id, 'name', b.name, 'slug', b.slug, 'address', b.address, 'logo_url', b.logo_url, 'is_open', b.is_open, 'latitude', b.latitude, 'longitude', b.longitude)
    order by b.is_open desc, b.name
  ), '[]'::jsonb)
  from public.barbershops b
  where b.verification_status = 'approved';
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
  select * into v_shop from public.barbershops where slug = p_slug and verification_status = 'approved';
  if not found then return jsonb_build_object('ok', false, 'error', 'Barbearia não encontrada ou ainda não aprovada.'); end if;
  return jsonb_build_object(
    'ok', true,
    'shop', jsonb_build_object('id', v_shop.id, 'name', v_shop.name, 'slug', v_shop.slug, 'address', v_shop.address, 'logo_url', v_shop.logo_url, 'is_open', v_shop.is_open),
    'services', coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'price',s.price,'duration_minutes',s.duration_minutes) order by s.name) from public.services s where s.shop_id=v_shop.id and s.is_active), '[]'::jsonb),
    'barbers', coalesce((select jsonb_agg(jsonb_build_object('id',b.id,'name',b.name) order by b.name) from public.barbers b where b.shop_id=v_shop.id and b.is_active), '[]'::jsonb),
    'queue', coalesce((select jsonb_agg(jsonb_build_object('id',q.id,'customer_name',q.customer_name,'status',q.status,'joined_at',q.joined_at,'service_id',q.service_id,'barber_id',q.barber_id) order by q.joined_at) from public.queue_entries q where q.shop_id=v_shop.id and q.status in ('waiting','called','in_service')), '[]'::jsonb)
  );
end;
$$;

create or replace function public.ff_join_queue(p_token text, p_shop_slug text, p_service_id uuid, p_barber_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account_id uuid := public.ff_account_id(p_token);
  v_account public.app_accounts;
  v_shop public.barbershops;
  v_entry uuid;
begin
  select * into v_account from public.app_accounts where id = v_account_id;
  if not found or v_account.role <> 'client' then return jsonb_build_object('ok', false, 'error', 'Entre com uma conta de cliente.'); end if;
  select * into v_shop from public.barbershops where slug = p_shop_slug and verification_status = 'approved';
  if not found then return jsonb_build_object('ok', false, 'error', 'Barbearia não encontrada ou não aprovada.'); end if;
  if not v_shop.is_open then return jsonb_build_object('ok', false, 'error', 'A barbearia está fechada.'); end if;
  if not exists(select 1 from public.services where id=p_service_id and shop_id=v_shop.id and is_active) then return jsonb_build_object('ok', false, 'error', 'Serviço inválido.'); end if;
  if p_barber_id is not null and not exists(select 1 from public.barbers where id=p_barber_id and shop_id=v_shop.id and is_active) then return jsonb_build_object('ok', false, 'error', 'Barbeiro inválido.'); end if;
  if exists(select 1 from public.queue_entries where shop_id=v_shop.id and client_account_id=v_account.id and status in ('waiting','called','in_service')) then return jsonb_build_object('ok', false, 'error', 'Você já está nesta fila.'); end if;
  insert into public.queue_entries(shop_id, customer_name, status, joined_at, service_id, barber_id, client_account_id)
  values(v_shop.id, v_account.display_name, 'waiting', now(), p_service_id, p_barber_id, v_account.id)
  returning id into v_entry;
  return jsonb_build_object('ok', true, 'entryId', v_entry);
end;
$$;

create or replace function public.ff_owner_action(p_token text, p_action text, p_payload jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account_id uuid := public.ff_account_id(p_token);
  v_shop public.barbershops;
  v_id uuid;
  v_name text;
  v_status text;
begin
  select * into v_shop from public.barbershops where account_owner_id = v_account_id;
  if not found then return jsonb_build_object('ok', false, 'error', 'Barbearia não encontrada.'); end if;
  if p_action = 'toggle_shop' then
    if v_shop.verification_status <> 'approved' then return jsonb_build_object('ok', false, 'error', 'A barbearia precisa ser aprovada antes de abrir a fila.'); end if;
    update public.barbershops set is_open = not is_open where id=v_shop.id;
  elsif p_action = 'update_profile' then
    v_name := trim(p_payload->>'name');
    if not public.ff_is_safe_name(v_name,4,60) then return jsonb_build_object('ok',false,'error','Nome de barbearia inválido.'); end if;
    if char_length(trim(p_payload->>'address')) < 12 then return jsonb_build_object('ok',false,'error','Informe o endereço completo.'); end if;
    update public.barbershops set name=v_name,address=trim(p_payload->>'address'),whatsapp=regexp_replace(p_payload->>'whatsapp','[^0-9]','','g'),logo_url=nullif(trim(p_payload->>'logo_url'),'') where id=v_shop.id;
  elsif p_action = 'add_barber' then
    v_name := trim(p_payload->>'name');
    if not public.ff_is_safe_name(v_name,3,50) then return jsonb_build_object('ok',false,'error','Nome de barbeiro inválido.'); end if;
    insert into public.barbers(shop_id,name,is_active) values(v_shop.id,v_name,true);
  elsif p_action = 'toggle_barber' then
    v_id := (p_payload->>'id')::uuid;
    update public.barbers set is_active=not is_active where id=v_id and shop_id=v_shop.id;
  elsif p_action = 'add_service' then
    v_name := trim(p_payload->>'name');
    if not public.ff_is_safe_name(v_name,3,70) then return jsonb_build_object('ok',false,'error','Nome de serviço inválido.'); end if;
    if (p_payload->>'price')::numeric not between 0 and 10000 or (p_payload->>'duration')::integer not between 5 and 480 then return jsonb_build_object('ok',false,'error','Preço ou duração inválidos.'); end if;
    insert into public.services(shop_id,name,price,duration_minutes,is_active) values(v_shop.id,v_name,(p_payload->>'price')::numeric,(p_payload->>'duration')::integer,true);
  elsif p_action = 'toggle_service' then
    v_id := (p_payload->>'id')::uuid;
    update public.services set is_active=not is_active where id=v_id and shop_id=v_shop.id;
  elsif p_action = 'queue_status' then
    v_id := (p_payload->>'id')::uuid;
    v_status := p_payload->>'status';
    if v_status not in ('called','in_service','finished','cancelled') then return jsonb_build_object('ok',false,'error','Status inválido.'); end if;
    update public.queue_entries set status=v_status,
      started_at=case when v_status='in_service' then now() else started_at end,
      finished_at=case when v_status in ('finished','cancelled') then now() else finished_at end
    where id=v_id and shop_id=v_shop.id;
  else
    return jsonb_build_object('ok',false,'error','Ação inválida.');
  end if;
  return jsonb_build_object('ok',true);
exception when others then
  return jsonb_build_object('ok',false,'error','Não foi possível concluir a operação. Confira os dados.');
end;
$$;

revoke all on public.app_accounts, public.app_sessions from anon, authenticated;
revoke all on function public.ff_new_session(uuid) from public, anon, authenticated;
revoke all on function public.ff_account_id(text) from public, anon, authenticated;

grant execute on function public.ff_register_account(text,text,text,text) to anon, authenticated;
grant execute on function public.ff_login(text,text) to anon, authenticated;
grant execute on function public.ff_me(text) to anon, authenticated;
grant execute on function public.ff_logout(text) to anon, authenticated;
grant execute on function public.ff_create_shop(text,text,text,text,double precision,double precision,text,text,boolean) to anon, authenticated;
grant execute on function public.ff_owner_dashboard(text) to anon, authenticated;
grant execute on function public.ff_list_shops() to anon, authenticated;
grant execute on function public.ff_public_shop(text) to anon, authenticated;
grant execute on function public.ff_join_queue(text,text,uuid,uuid) to anon, authenticated;
grant execute on function public.ff_owner_action(text,text,jsonb) to anon, authenticated;

commit;

select 'ETAPA 1 CONCLUÍDA' as resultado;
