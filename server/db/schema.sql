-- FORJA GYM - Esquema de base de datos
-- Ejecutar en Supabase: Dashboard > SQL Editor > New query > pegar y Run

-- Información general del gym (una sola fila)
create table if not exists gym_info (
  id int primary key default 1 check (id = 1),
  nombre text not null,
  descripcion text not null,
  frase text not null,
  horarios jsonb not null -- [{"dia":"Lunes","abre":"05:00","cierra":"22:00"}, ...]
);

-- Aforo actual del gym (una sola fila, se actualiza a mano en v1)
create table if not exists occupancy (
  id int primary key default 1 check (id = 1),
  current_count int not null default 0 check (current_count >= 0),
  max_capacity int not null check (max_capacity > 0),
  updated_at timestamptz not null default now()
);

-- Productos: comida y suplementos
create table if not exists products (
  id bigint generated always as identity primary key,
  nombre text not null,
  categoria text not null check (categoria in ('comida', 'suplemento')),
  descripcion text not null,
  precio numeric(10,2) not null,
  imagen_url text
);

-- Planes de membresía
create table if not exists membership_plans (
  id bigint generated always as identity primary key,
  nombre text not null,
  precio numeric(10,2) not null,
  periodo text not null, -- 'mensual', 'trimestral', 'anual'
  beneficios jsonb not null default '[]', -- ["Acceso ilimitado", ...]
  destacado boolean not null default false,
  activo boolean not null default true -- soft-delete: el sitio público solo ve activos
);

-- Membresía de cada cliente
create table if not exists memberships (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  plan_id bigint not null references membership_plans (id),
  fecha_inicio date not null default current_date,
  fecha_fin date not null,
  unique (user_id)
);

-- Row Level Security
alter table gym_info enable row level security;
alter table occupancy enable row level security;
alter table products enable row level security;
alter table membership_plans enable row level security;
alter table memberships enable row level security;

-- Catálogos: lectura pública (el backend usa service role, pero esto permite lectura directa si hace falta)
create policy "lectura publica gym_info" on gym_info for select using (true);
create policy "lectura publica occupancy" on occupancy for select using (true);
create policy "lectura publica products" on products for select using (true);
create policy "lectura publica membership_plans" on membership_plans for select using (true);

-- Membresías: cada usuario solo puede ver la suya
create policy "membresia propia" on memberships for select using (auth.uid() = user_id);

-- Formulario de ingreso: ver profiles.sql (incluido aqui para instalaciones nuevas)

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
  condiciones_medicas text, -- vacío = ninguna
  -- El ingreso se completa en el gym: firma del formulario y foto del socio
  firma_foto_pendiente boolean not null default true,
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

-- Cada usuario solo puede ver y crear su propia fila
create policy "perfil propio select" on profiles for select using (auth.uid() = user_id);
create policy "perfil propio insert" on profiles for insert with check (auth.uid() = user_id);

-- Endurecimiento: el insert del cliente solo
-- puede nombrar las columnas del formulario de ingreso; firma_foto_pendiente y
-- created_at toman siempre sus valores por defecto. Nota Postgres: un grant de
-- tabla no se recorta con revoke por columna — por eso revoke total + lista blanca.
revoke insert on profiles from authenticated, anon;
grant insert (
  user_id, nombre_completo, fecha_nacimiento, documento, telefono,
  emergencia1_nombre, emergencia1_telefono, emergencia2_nombre, emergencia2_telefono,
  entrenado_antes, condiciones_medicas
) on profiles to authenticated;

-- memberships se escribe únicamente desde el server (service role) desde D13:
-- el cliente conserva solo el select de fila propia (política más arriba).
-- Las antiguas políticas de escritura del cliente fueron eliminadas
-- (change endurecer-rls-memberships; ver 2026_08_harden_rls.sql).

-- ── Backoffice admin ───────────────────────────────
-- Historial de pagos. monto = SNAPSHOT del precio al cobrar. user_id NULLABLE
-- + nombre_cliente para el pase diario sin cuenta. FKs on delete set null para
-- que borrar un usuario nunca destruya la contabilidad.
create table if not exists payments (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users (id) on delete set null,
  nombre_cliente text,
  plan_id bigint references membership_plans (id) on delete set null,
  monto numeric(10,2) not null check (monto >= 0),
  metodo text check (metodo in ('tarjeta','yappy','transferencia','efectivo')),
  origen text not null check (origen in ('checkout_simulado','recepcion')),
  estado text not null default 'aprobado' check (estado in ('aprobado','anulado')),
  referencia text,
  motivo_anulacion text,
  registrado_por uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
alter table payments enable row level security;
create policy "pagos propios select" on payments for select using (auth.uid() = user_id);
-- Sin políticas de escritura: solo el server (service role) inserta/actualiza.

-- Bitácora de auditoría append-only. RLS habilitado SIN políticas: invisible
-- para authenticated/anon; solo service role.
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
alter table admin_audit_log enable row level security;

-- Índices del backoffice
create index if not exists idx_payments_user on payments (user_id);
create index if not exists idx_payments_created on payments (created_at desc);
create index if not exists idx_memberships_fecha_fin on memberships (fecha_fin);
create index if not exists idx_profiles_created on profiles (created_at);
create index if not exists idx_audit_created on admin_audit_log (created_at desc);

-- Asignación del rol admin: ver server/db/admin_role.sql (no automático).
