-- ============================================================
-- Condexia Residents — Schema Supabase
-- Proyecto separado de condo_admin (admin side)
-- ============================================================

-- condominiums: copia mínima del condo_admin. Se popula cuando el
-- admin genera el primer invite link para un condominio.
create table if not exists condominiums (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  address     text,
  created_at  timestamptz default now()
);

-- unit_types: subclases de unidad por condominio (cuota variable)
-- Si el admin no quiere subclases → crea un tipo "General"
create table if not exists unit_types (
  id              uuid primary key default gen_random_uuid(),
  condominium_id  uuid not null references condominiums(id) on delete cascade,
  name            text not null,           -- "Tipo A", "Local", "General"
  fee             numeric(10,2) not null,  -- cuota mensual MXN
  created_at      timestamptz default now()
);

-- units: cada departamento / casa / local
create table if not exists units (
  id              uuid primary key default gen_random_uuid(),
  condominium_id  uuid not null references condominiums(id) on delete cascade,
  unit_type_id    uuid references unit_types(id),
  number          text not null,           -- "101", "A-3", "PH"
  floor           int,
  created_at      timestamptz default now()
);

-- residents: usuario ligado a una unidad
create table if not exists residents (
  id                  uuid primary key default gen_random_uuid(),
  unit_id             uuid not null references units(id),
  user_id             uuid references auth.users(id),  -- null hasta que acepte el invite
  name                text not null,
  phone               text,
  email               text,
  invite_token        text unique,          -- token del link de invitación
  invite_expires_at   timestamptz,
  status              text not null default 'invited',  -- invited | active
  created_at          timestamptz default now()
);

-- payment_records: registro de pagos de mantenimiento por periodo
create table if not exists payment_records (
  id              uuid primary key default gen_random_uuid(),
  resident_id     uuid not null references residents(id),
  unit_id         uuid not null references units(id),
  period_month    int not null check (period_month between 1 and 12),
  period_year     int not null,
  amount          numeric(10,2) not null,
  status          text not null default 'pending',
  -- pending | submitted | approved | rejected
  receipt_url     text,          -- comprobante en Supabase Storage (bucket: receipts)
  submitted_at    timestamptz,
  reviewed_at     timestamptz,
  reviewed_by     uuid,          -- user_id del admin que revisó (de condo_admin)
  admin_notes     text,          -- motivo de rechazo o aprobación
  created_at      timestamptz default now(),
  unique (resident_id, period_month, period_year)
);

-- complaints: quejas reportadas por residentes
create table if not exists complaints (
  id              uuid primary key default gen_random_uuid(),
  resident_id     uuid not null references residents(id),
  unit_id         uuid not null references units(id),
  condominium_id  uuid not null references condominiums(id),
  title           text not null,
  description     text not null,
  status          text not null default 'open',
  -- open | in_progress | resolved | closed
  created_at      timestamptz default now(),
  resolved_at     timestamptz
);

-- common_areas: zonas comunes por condominio
create table if not exists common_areas (
  id              uuid primary key default gen_random_uuid(),
  condominium_id  uuid not null references condominiums(id) on delete cascade,
  name            text not null,   -- "Alberca", "Salón", "Gimnasio"
  capacity        int,
  rules           text,
  created_at      timestamptz default now()
);

-- area_reservations: reservas de zonas comunes
create table if not exists area_reservations (
  id              uuid primary key default gen_random_uuid(),
  common_area_id  uuid not null references common_areas(id),
  resident_id     uuid not null references residents(id),
  unit_id         uuid not null references units(id),
  date            date not null,
  start_time      time not null,
  end_time        time not null,
  status          text not null default 'confirmed',  -- confirmed | cancelled
  created_at      timestamptz default now()
);

-- ============================================================
-- RLS
-- ============================================================

alter table condominiums      enable row level security;
alter table unit_types        enable row level security;
alter table units             enable row level security;
alter table residents         enable row level security;
alter table payment_records   enable row level security;
alter table complaints        enable row level security;
alter table common_areas      enable row level security;
alter table area_reservations enable row level security;

-- helpers
create or replace function my_unit_id()
  returns uuid language sql security definer stable as $$
  select unit_id from residents where user_id = auth.uid() limit 1;
$$;

create or replace function my_condominium_id()
  returns uuid language sql security definer stable as $$
  select u.condominium_id
  from residents r join units u on u.id = r.unit_id
  where r.user_id = auth.uid() limit 1;
$$;

-- políticas (drop + create para idempotencia)
drop policy if exists "resident_self" on residents;
create policy "resident_self" on residents
  for all using (user_id = auth.uid());

drop policy if exists "resident_see_own_condo_types" on unit_types;
create policy "resident_see_own_condo_types" on unit_types
  for select using (condominium_id = my_condominium_id());

drop policy if exists "resident_see_own_condo_units" on units;
create policy "resident_see_own_condo_units" on units
  for select using (condominium_id = my_condominium_id());

drop policy if exists "resident_own_payments" on payment_records;
create policy "resident_own_payments" on payment_records
  for all using (resident_id = (select id from residents where user_id = auth.uid() limit 1));

drop policy if exists "resident_own_complaints" on complaints;
create policy "resident_own_complaints" on complaints
  for all using (resident_id = (select id from residents where user_id = auth.uid() limit 1));

drop policy if exists "resident_see_common_areas" on common_areas;
create policy "resident_see_common_areas" on common_areas
  for select using (condominium_id = my_condominium_id());

drop policy if exists "resident_own_reservations" on area_reservations;
create policy "resident_own_reservations" on area_reservations
  for all using (resident_id = (select id from residents where user_id = auth.uid() limit 1));

drop policy if exists "resident_see_own_condo" on condominiums;
create policy "resident_see_own_condo" on condominiums
  for select using (id = my_condominium_id());

-- ============================================================
-- Storage buckets (ejecutar en Supabase Dashboard)
-- ============================================================
-- bucket: receipts  (comprobantes de pago)
--   RLS: solo el residente que subió puede leer; insert permitido al autenticado
