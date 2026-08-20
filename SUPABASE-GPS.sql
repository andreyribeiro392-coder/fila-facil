-- Execute uma vez no SQL Editor do Supabase.
alter table public.barbershops
  add column if not exists latitude double precision,
  add column if not exists longitude double precision;

create index if not exists barbershops_open_location_idx
  on public.barbershops (is_open, latitude, longitude);
