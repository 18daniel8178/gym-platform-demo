-- FORJA GYM — Migración 2026-09: la sucursal como entidad (Fase 1)
-- Ejecutar en Supabase: Dashboard > SQL Editor > New query > pegar y Run.
--
-- REGLA DE ESTE ARCHIVO: el SQL Editor ejecuta sentencia por sentencia, cada una
-- con su propio commit y sin garantía de reutilizar la conexión. Por eso NO hay
-- BEGIN/COMMIT, ni tablas temporales, ni SET de sesión: cada sentencia es válida
-- y repetible por sí sola. Lo verifica server/db/pruebas/ (una conexión por
-- sentencia, dos pasadas) y el job "Migraciones SQL" del CI.
--
-- POR QUÉ AHORA Y NO DESPUÉS. El documento maestro pide la sucursal en tres
-- módulos (§13.3 selector, §13.4 alcance de permisos, §13.5 pantalla) y su §9
-- dice que toda operación pertenece a una organización y, cuando aplique, a una
-- sucursal. Lo que queda fuera de la Fase 1 es la MULTISUCURSAL, no la
-- identidad. Añadirla hoy son dos columnas sobre dos tablas con 2 pagos y 4
-- membresías; añadirla después del Bloque 7 obliga a migrar ventas, movimientos
-- de inventario, cajas y facturas con datos reales dentro.

-- ── La sucursal ──────────────────────────────────────────────────────────────
-- `codigo` es la clave estable que ya usaba document_series ('principal'); el id
-- numérico es el que referencian las tablas transaccionales.
create table if not exists branches (
  id bigint generated always as identity primary key,
  codigo text not null unique,
  nombre text not null,
  direccion text not null default '',
  telefono text not null default '',
  zona_horaria text not null default 'America/Panama',
  activa boolean not null default true,
  created_at timestamptz not null default now()
);

alter table branches enable row level security;

-- Sin políticas a propósito: solo el server (service role) la lee y la escribe.
-- El sitio público recibe la dirección por /api/gym-info, no por PostgREST.

-- Semilla de la única sucursal. `do nothing`: si el dueño ya le cambió el
-- nombre o la dirección, reejecutar la migración no se los pisa.
insert into branches (codigo, nombre, direccion)
values ('principal', 'FORJA GYM', '')
on conflict (codigo) do nothing;

-- ── Toda operación pertenece a una sucursal ──────────────────────────────────
-- La columna acaba siendo NOT NULL: una operación sin sucursal no se puede
-- conciliar con ninguna caja, así que es mejor que reviente al insertarla que
-- descubrirlo al cuadrar el mes.
--
-- Pero NOT NULL a secas rompería el código ya desplegado, que todavía no manda
-- la sucursal: entre que se aplica la migración y sale el despliegue, cada cobro
-- fallaría. Por eso la columna lleva DEFAULT resuelto por función — con una sola
-- sucursal el valor por defecto ES el correcto—, y así el orden de despliegue
-- deja de importar. Cuando llegue multisucursal el server la manda explícita y
-- el default se queda solo como red de seguridad.
create or replace function public.sucursal_por_defecto()
returns bigint
language sql
stable
security definer
set search_path = ''
as $$ select id from public.branches where codigo = 'principal' $$;

revoke all on function public.sucursal_por_defecto() from public, anon, authenticated;
grant execute on function public.sucursal_por_defecto() to service_role;

alter table payments add column if not exists branch_id bigint references branches (id) on delete restrict;
alter table memberships add column if not exists branch_id bigint references branches (id) on delete restrict;

alter table payments alter column branch_id set default public.sucursal_por_defecto();
alter table memberships alter column branch_id set default public.sucursal_por_defecto();

create index if not exists idx_payments_branch on payments (branch_id, created_at desc);

-- Los históricos se adoptan por la única sucursal que existía de hecho: hasta
-- hoy el gimnasio operó en una sola. Solo toca las filas sin sucursal, así que
-- reejecutarlo no mueve nada.
update payments
   set branch_id = (select id from branches where codigo = 'principal')
 where branch_id is null;

update memberships
   set branch_id = (select id from branches where codigo = 'principal')
 where branch_id is null;

alter table payments alter column branch_id set not null;
alter table memberships alter column branch_id set not null;

-- ── La numeración cuelga de la sucursal de verdad ────────────────────────────
-- document_series.sucursal era texto libre con default 'principal': ahora tiene
-- que existir en branches, o la numeración de una sucursal fantasma emitiría
-- documentos que no cuadran con ninguna caja.
alter table document_series
  drop constraint if exists document_series_sucursal_fkey;

alter table document_series
  add constraint document_series_sucursal_fkey
  foreign key (sucursal) references branches (codigo) on update cascade;

-- ── Limpieza: la sección `numeracion` de app_settings era un dato muerto ─────
-- Se sembró en la migración de ajustes, pero la numeración vive en
-- document_series y el catálogo de secciones nunca la declaró: ni se lee ni se
-- puede escribir (el PATCH responde 404). Se borra para que nadie la crea real.
delete from app_settings where seccion = 'numeracion';

-- ── Verificación ─────────────────────────────────────────────────────────────
-- (a) La sucursal existe y es una sola
select id, codigo, nombre, direccion, zona_horaria, activa from branches order by id;
-- (b) Ningún movimiento se quedó sin sucursal
select
  (select count(*) from payments where branch_id is null) as pagos_sin_sucursal,
  (select count(*) from memberships where branch_id is null) as membresias_sin_sucursal;
-- (c) Las secciones de ajustes vivas (ya sin 'numeracion')
select seccion from app_settings order by seccion;
