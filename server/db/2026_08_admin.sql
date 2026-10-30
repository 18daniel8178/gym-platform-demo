-- FORJA GYM — Migración 2026-08: cimientos del backoffice admin (Fase 0b)
-- Ejecutar en Supabase: Dashboard > SQL Editor > New query > pegar y Run.
-- Idempotente: puede ejecutarse más de una vez sin efectos adicionales.
--
-- IMPORTANTE: aplicar ESTA migración ANTES de desplegar el código de la Fase 0b
-- (el checkout pasa a filtrar membership_plans.activo = true).

begin;

-- ── Historial de pagos ───────────────────────────────────────────────────────
-- No existía: el upsert de memberships sobrescribe y no deja rastro. Necesaria
-- para el KPI de ingresos y como raíl de la pasarela real futura.
--   monto: SNAPSHOT del precio al cobrar (los cambios de precio no corrompen el histórico).
--   user_id NULLABLE + nombre_cliente: pase diario a visitantes sin cuenta.
--   FKs on delete set null: borrar un usuario NUNCA destruye la contabilidad.
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
-- El socio lee sus propios pagos; NADIE escribe con la clave pública (solo el server).
drop policy if exists "pagos propios select" on payments;
create policy "pagos propios select" on payments for select using (auth.uid() = user_id);

-- ── Bitácora de auditoría (append-only) ──────────────────────────────────────
-- RLS habilitado SIN políticas: invisible para authenticated/anon; solo service role.
create table if not exists admin_audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid not null,
  actor_email text not null,
  accion text not null,          -- 'plan.update','payment.create','membership.activate', ...
  entidad text not null,
  entidad_id text,
  detalle jsonb,                 -- diff; condiciones_medicas SIEMPRE '[oculto]'
  created_at timestamptz not null default now()
);
alter table admin_audit_log enable row level security;

-- ── Soft-delete de planes ────────────────────────────────────────────────────
alter table membership_plans add column if not exists activo boolean not null default true;

-- ── Índices ──────────────────────────────────────────────────────────────────
create index if not exists idx_payments_user on payments (user_id);
create index if not exists idx_payments_created on payments (created_at desc);
create index if not exists idx_memberships_fecha_fin on memberships (fecha_fin);
create index if not exists idx_profiles_created on profiles (created_at);
create index if not exists idx_audit_created on admin_audit_log (created_at desc);

commit;

-- ── Verificación ─────────────────────────────────────────────────────────────
-- (a) Tablas nuevas presentes.
select table_name from information_schema.tables
 where table_schema = 'public' and table_name in ('payments','admin_audit_log')
 order by table_name;
-- (b) Columna activo en membership_plans.
select column_name, data_type, column_default from information_schema.columns
 where table_schema = 'public' and table_name = 'membership_plans' and column_name = 'activo';
-- (c) payments: solo política de SELECT; admin_audit_log: ninguna política.
select tablename, policyname, cmd from pg_policies
 where tablename in ('payments','admin_audit_log') order by tablename;
