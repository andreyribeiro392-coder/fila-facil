-- Fila Fácil v5 - ETAPA 2.
-- Execute SOMENTE depois que a versão 5 estiver publicada e testada.
-- Fecha as rotas anônimas antigas e coloca cadastros antigos em análise.

begin;

update public.barbershops
set verification_status = 'pending',
    ownership_confirmed = false,
    is_open = false,
    verification_notes = coalesce(verification_notes, 'Cadastro anterior à verificação v5.')
where account_owner_id is null;

revoke insert, update, delete on public.barbershops from anon, authenticated;
revoke insert, update, delete on public.barbers, public.services, public.queue_entries, public.queue_contacts from anon, authenticated;

do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'join_public_queue'
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f.signature);
  end loop;
end $$;

commit;

select 'ETAPA 2 CONCLUÍDA - ACESSOS ANTIGOS FECHADOS' as resultado;
