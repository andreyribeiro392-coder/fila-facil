begin;

-- Correção rápida: cria serviços padrão para barbearias aprovadas que ainda não têm nenhum serviço ativo.
-- Isso faz o campo "Escolha o serviço / tipo de corte" aparecer para o cliente.

insert into public.services(shop_id, name, price, duration_minutes, is_active)
select b.id, s.name, s.price, s.duration_minutes, true
from public.barbershops b
cross join (values
  ('Corte masculino', 30.00::numeric, 30),
  ('Barba', 20.00::numeric, 20),
  ('Corte + barba', 45.00::numeric, 50),
  ('Sobrancelha', 10.00::numeric, 10)
) as s(name, price, duration_minutes)
where b.verification_status = 'approved'
  and not exists (
    select 1 from public.services existing
    where existing.shop_id = b.id and existing.is_active = true
  );

commit;

select 'SERVICOS PADRAO CRIADOS' as resultado;
