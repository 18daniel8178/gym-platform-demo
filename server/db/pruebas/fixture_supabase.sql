-- Andamiaje mínimo de Supabase para poder ejecutar las migraciones contra un
-- Postgres vacío (local o CI) y validarlas antes de tocar producción.
-- Reproduce SOLO lo que las migraciones necesitan: los roles de Supabase, el
-- esquema auth con las columnas que se usan, y la bitácora de auditoría.
-- No es una réplica de Supabase: es el contrato del que dependen las migraciones.

-- Roles de Supabase (los grants de las migraciones fallarían sin ellos)
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
end
$$;

create schema if not exists auth;

-- auth.users: solo las columnas que el código y las funciones consultan.
create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  raw_app_meta_data jsonb not null default '{}'::jsonb,
  banned_until timestamptz,
  last_sign_in_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists auth.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  user_agent text,
  ip inet
);

create table if not exists auth.refresh_tokens (
  id bigint generated always as identity primary key,
  session_id uuid references auth.sessions (id) on delete cascade,
  revoked boolean not null default false
);

-- Bitácora de auditoría (definición real de server/db/2026_08_admin.sql)
create table if not exists admin_audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid not null,
  actor_email text not null,
  accion text not null,
  entidad text not null,
  entidad_id text,
  detalle jsonb,
  created_at timestamptz not null default now()
);

-- Tablas del propio proyecto que las migraciones tocan. Se reproducen con su
-- definición REAL (incluido el check de payments.metodo, que la migración de
-- ajustes tiene que reemplazar) para que la prueba ejercite lo mismo que
-- producción, no una versión amable.
create table if not exists gym_info (
  id int primary key default 1 check (id = 1),
  nombre text not null,
  descripcion text not null,
  frase text not null,
  horarios jsonb not null
);

insert into gym_info (id, nombre, descripcion, frase, horarios) values (
  1, 'FORJA GYM', 'Gimnasio de demostración', 'Constancia que se nota',
  '[{"dia":"Lunes","abre":"06:00","cierra":"22:00"},
     {"dia":"Martes","abre":"06:00","cierra":"22:00"},
     {"dia":"Miércoles","abre":"06:00","cierra":"22:00"},
     {"dia":"Jueves","abre":"06:00","cierra":"22:00"},
     {"dia":"Viernes","abre":"06:00","cierra":"21:00"},
     {"dia":"Sábado","abre":"08:00","cierra":"17:00"},
     {"dia":"Domingo","abre":"09:00","cierra":"13:00"}]'::jsonb
) on conflict (id) do nothing;

-- El aforo tal como está en producción ANTES del check-in: un número que el
-- personal teclea. La migración 2026_10 lo convierte en corrección del día.
create table if not exists occupancy (
  id int primary key default 1 check (id = 1),
  current_count int not null default 0 check (current_count >= 0),
  max_capacity int not null check (max_capacity > 0),
  updated_at timestamptz not null default now()
);

insert into occupancy (id, current_count, max_capacity) values (1, 27, 60)
on conflict (id) do nothing;

create table if not exists membership_plans (
  id bigint generated always as identity primary key,
  nombre text not null,
  precio numeric(10,2) not null,
  activo boolean not null default true
);

create table if not exists payments (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users (id) on delete set null,
  nombre_cliente text,
  plan_id bigint references membership_plans (id) on delete set null,
  monto numeric(10,2) not null check (monto >= 0),
  metodo text check (metodo in ('tarjeta','yappy','transferencia','efectivo')),
  origen text not null check (origen in ('checkout_simulado','recepcion')),
  estado text not null default 'aprobado' check (estado in ('aprobado','anulado')),
  created_at timestamptz not null default now()
);

-- memberships: la migración de sucursal le añade branch_id, así que la prueba
-- necesita su definición real (server/db/schema.sql).
create table if not exists memberships (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  plan_id bigint not null references membership_plans (id),
  fecha_inicio date not null default current_date,
  fecha_fin date not null,
  unique (user_id)
);

-- auth.uid(): lo usan las políticas RLS de profiles (en Supabase lo provee Auth).
create or replace function auth.uid()
returns uuid
language sql
stable
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

-- profiles: definición REAL de producción (server/db/profiles.sql más el
-- endurecimiento de RLS), porque la migración de miembros le cambia columnas,
-- restricciones y grants. Supabase concede por defecto las tablas de public a
-- anon y authenticated; el endurecimiento recortó después el insert.
create table if not exists profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  nombre_completo text not null,
  fecha_nacimiento date not null,
  documento text not null,
  telefono text not null,
  emergencia1_nombre text not null,
  emergencia1_telefono text not null,
  emergencia2_nombre text not null,
  emergencia2_telefono text not null,
  entrenado_antes boolean not null default false,
  condiciones_medicas text,
  firma_foto_pendiente boolean not null default true,
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;
drop policy if exists "perfil propio select" on profiles;
create policy "perfil propio select" on profiles for select using (auth.uid() = user_id);
drop policy if exists "perfil propio insert" on profiles;
create policy "perfil propio insert" on profiles for insert with check (auth.uid() = user_id);

grant select, insert, update, delete on profiles to anon, authenticated;
revoke insert on profiles from authenticated, anon;
grant insert (
  user_id, nombre_completo, fecha_nacimiento, documento, telefono,
  emergencia1_nombre, emergencia1_telefono, emergencia2_nombre, emergencia2_telefono,
  entrenado_antes, condiciones_medicas
) on profiles to authenticated;

-- Socios que YA existían antes de la migración de miembros, para probar que la
-- clasificación inicial (estado y origen) sale bien y corre una sola vez:
--   a001 con membresía → activo · a002 con un pago → activo
--   a003 dado de alta en mostrador (consta en la bitácora) → prospecto, mostrador
--   a004 llegó por la web sin pagar → prospecto, web (y correo con mayúsculas)
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000a001', 'socio.con.membresia@forja.test'),
  ('00000000-0000-0000-0000-00000000a002', 'socio.con.pago@forja.test'),
  ('00000000-0000-0000-0000-00000000a003', 'socio.de.mostrador@forja.test'),
  ('00000000-0000-0000-0000-00000000a004', 'Socio.Web@Forja.test');

insert into profiles (
  user_id, nombre_completo, fecha_nacimiento, documento, telefono,
  emergencia1_nombre, emergencia1_telefono, emergencia2_nombre, emergencia2_telefono
) values
  ('00000000-0000-0000-0000-00000000a001', 'Ana Membresía', '1990-01-01', '8-111-111', '60000001', 'E1', '61', 'E2', '62'),
  ('00000000-0000-0000-0000-00000000a002', 'Beto Pago', '1990-01-02', '8-222-222', '60000002', 'E1', '61', 'E2', '62'),
  ('00000000-0000-0000-0000-00000000a003', 'Carla Mostrador', '1990-01-03', '8-333-333', '60000003', 'E1', '61', 'E2', '62'),
  ('00000000-0000-0000-0000-00000000a004', 'Dani Web', '1990-01-04', 'PE-44-444', '60000004', 'E1', '61', 'E2', '62');

with plan as (
  insert into membership_plans (nombre, precio) values ('Mensual (fixture)', 45.00) returning id
)
insert into memberships (user_id, plan_id, fecha_fin)
select '00000000-0000-0000-0000-00000000a001', id, current_date + 30 from plan;

insert into payments (user_id, monto, metodo, origen)
values ('00000000-0000-0000-0000-00000000a002', 45.00, 'efectivo', 'recepcion');

insert into admin_audit_log (actor_id, actor_email, accion, entidad, entidad_id)
values (gen_random_uuid(), 'recepcion@forja.test', 'client.create', 'profiles', '00000000-0000-0000-0000-00000000a003');
