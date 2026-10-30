-- FORJA GYM — Migración 2026-08: RBAC (Fase 1 · Bloque 1 del Documento Maestro)
-- Ejecutar en Supabase: Dashboard > SQL Editor > New query > pegar y Run.
-- Idempotente: puede ejecutarse más de una vez sin efectos adicionales.
--
-- Roles y permisos `recurso.accion` en BD, consultados por el server en cada
-- request (revocación inmediata). El PROPIETARIO no usa estas tablas: su
-- bootstrap es app_metadata.role='admin' (equivale a todos los permisos) para
-- una transición sin riesgo de lockout (ver design del change).

create table if not exists roles (
  id bigint generated always as identity primary key,
  clave text not null unique,          -- 'gerente', 'recepcion', ...
  nombre text not null,
  descripcion text not null default ''
);

create table if not exists role_permissions (
  role_id bigint not null references roles (id) on delete cascade,
  permiso text not null,               -- formato recurso.accion, p. ej. member.read
  primary key (role_id, permiso)
);

create table if not exists user_roles (
  user_id uuid not null references auth.users (id) on delete cascade,
  role_id bigint not null references roles (id) on delete cascade,
  asignado_por uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (user_id, role_id)
);

-- Solo el server (service role) lee/escribe estas tablas.
alter table roles enable row level security;
alter table role_permissions enable row level security;
alter table user_roles enable row level security;

create index if not exists idx_user_roles_user on user_roles (user_id);

-- ── Seed de roles del documento (§6) con sus permisos de Fase 1 ─────────────
-- Los permisos de bloques futuros (checkin.*, pos.*, cash.*, invoice.*) se
-- siembran ya para no re-migrar roles en cada bloque.
insert into roles (clave, nombre, descripcion) values
  ('gerente',      'Gerente',      'Operación, equipo, reportes y aprobaciones'),
  ('recepcion',    'Recepción',    'Miembros, ventas, pagos y check-in'),
  ('cajero',       'Cajero/Cafetería', 'POS, pedidos y caja asignada'),
  ('inventario',   'Inventario',   'Productos, movimientos y existencias'),
  ('contabilidad', 'Contabilidad', 'Facturas, pagos, cierres y exportaciones')
on conflict (clave) do nothing;

-- Permisos por rol. UNA sola sentencia autocontenida, a propósito: el SQL
-- Editor de Supabase ejecuta el script sentencia por sentencia y cada una con
-- su propio commit, así que la migración no puede apoyarse en una tabla
-- temporal, en un BEGIN/COMMIT que abarque varias, ni en ningún otro estado
-- de sesión. Cada sentencia de este archivo es válida y repetible por sí sola.
--
-- Es RECONCILIADORA: converge la base al repositorio (quita lo que sobra y
-- añade lo que falta) en vez de solo insertar, que dejaba divergir una
-- instalación existente cuando aquí cambiaban los permisos de un rol.
-- Los roles que no aparezcan en la lista no se tocan.
with seed (clave, permiso) as (
  values
    -- Gerente: lo operativo y el equipo; sin gestionar la definición de roles.
    ('gerente', 'dashboard.read'),
    ('gerente', 'report.read'),
    ('gerente', 'audit.read'),
    ('gerente', 'member.read'),
    ('gerente', 'member.create'),
    ('gerente', 'member.update'),
    ('gerente', 'member.archive'),
    ('gerente', 'member.import'),
    ('gerente', 'member.consent'),
    ('gerente', 'plan.read'),
    ('gerente', 'plan.create'),
    ('gerente', 'plan.update'),
    ('gerente', 'membership.read'),
    ('gerente', 'membership.collect'),
    ('gerente', 'membership.adjust'),
    ('gerente', 'payment.read'),
    ('gerente', 'payment.create'),
    ('gerente', 'payment.refund'),
    ('gerente', 'payment.void'),
    ('gerente', 'payment.export'),
    ('gerente', 'invoice.read'),
    ('gerente', 'checkin.perform'),
    ('gerente', 'checkin.override'),
    ('gerente', 'checkin.read'),
    ('gerente', 'pos.sell'),
    ('gerente', 'pos.return'),
    ('gerente', 'product.read'),
    ('gerente', 'product.manage'),
    ('gerente', 'inventory.adjust'),
    ('gerente', 'cash.open'),
    ('gerente', 'cash.close'),
    ('gerente', 'cash.movement'),
    ('gerente', 'cash.review'),
    ('gerente', 'settings.read'),
    ('gerente', 'settings.update'),
    ('gerente', 'user.read'),
    ('gerente', 'user.manage'),
    ('gerente', 'session.manage'),

    -- Recepción: registrar y cobrar; sin reembolsos, reportes ni configuración.
    ('recepcion', 'dashboard.read'),
    ('recepcion', 'member.read'),
    ('recepcion', 'member.create'),
    ('recepcion', 'member.update'),
    ('recepcion', 'member.consent'),
    ('recepcion', 'plan.read'),
    ('recepcion', 'membership.read'),
    ('recepcion', 'membership.collect'),
    ('recepcion', 'payment.read'),
    ('recepcion', 'payment.create'),
    ('recepcion', 'checkin.perform'),
    ('recepcion', 'checkin.read'),
    ('recepcion', 'pos.sell'),
    ('recepcion', 'product.read'),
    ('recepcion', 'cash.open'),
    ('recepcion', 'cash.close'),
    ('recepcion', 'cash.movement'),
    ('recepcion', 'settings.read'),

    -- Cajero/Cafetería: POS y su caja; sin editar planes ni reembolsar.
    ('cajero', 'pos.sell'),
    ('cajero', 'product.read'),
    ('cajero', 'payment.create'),
    ('cajero', 'cash.open'),
    ('cajero', 'cash.close'),
    ('cajero', 'cash.movement'),
    ('cajero', 'settings.read'),

    -- Inventario: productos y existencias; sin datos sensibles de miembros.
    ('inventario', 'product.read'),
    ('inventario', 'product.manage'),
    ('inventario', 'inventory.adjust'),
    ('inventario', 'settings.read'),

    -- Contabilidad: dinero y exportaciones; sin operación de miembros.
    ('contabilidad', 'dashboard.read'),
    ('contabilidad', 'report.read'),
    ('contabilidad', 'audit.read'),
    ('contabilidad', 'invoice.read'),
    ('contabilidad', 'payment.read'),
    ('contabilidad', 'payment.refund'),
    ('contabilidad', 'payment.void'),
    ('contabilidad', 'payment.export'),
    ('contabilidad', 'cash.review'),
    ('contabilidad', 'settings.read')
),
sobrantes as (
  delete from role_permissions rp
   using roles r
   where rp.role_id = r.id
     and exists (select 1 from seed s where s.clave = r.clave)
     and not exists (
       select 1 from seed s where s.clave = r.clave and s.permiso = rp.permiso
     )
  returning 1
)
insert into role_permissions (role_id, permiso)
select r.id, s.permiso
  from seed s
  join roles r on r.clave = s.clave
on conflict do nothing;

-- ── Funciones del panel (solo service role) ──────────────────────────────────
-- Todas van con `search_path = ''` y nombres calificados: en una función
-- `security definer` un search_path heredado permitiría suplantar tablas.

-- Personal del gimnasio: el propietario (bootstrap en app_metadata) más las
-- cuentas con algún rol. La lista sale de user_roles, NO de recorrer auth.users
-- (que contiene a todos los socios y crece sin límite).
create or replace function public.staff_users()
returns table (
  id uuid,
  email text,
  propietario boolean,
  desactivado boolean,
  ultimo_acceso timestamptz,
  creado timestamptz,
  roles jsonb
)
language sql
security definer
set search_path = ''
as $$
  select
    u.id,
    u.email::text,
    coalesce(u.raw_app_meta_data ->> 'role', '') = 'admin',
    coalesce(u.banned_until > now(), false),
    u.last_sign_in_at,
    u.created_at,
    coalesce(
      (select jsonb_agg(jsonb_build_object('id', r.id, 'clave', r.clave, 'nombre', r.nombre) order by r.clave)
         from public.user_roles ur
         join public.roles r on r.id = ur.role_id
        where ur.user_id = u.id),
      '[]'::jsonb
    )
  from auth.users u
  where coalesce(u.raw_app_meta_data ->> 'role', '') = 'admin'
     or exists (select 1 from public.user_roles ur where ur.user_id = u.id)
  order by (coalesce(u.raw_app_meta_data ->> 'role', '') = 'admin') desc, u.email;
$$;

-- Permisos vigentes de un usuario, en una sola consulta: se piden en CADA
-- request del panel, así que no puede costar dos viajes a la base.
create or replace function public.staff_permissions(p_user_id uuid)
returns table (permiso text)
language sql
security definer
set search_path = ''
as $$
  select distinct rp.permiso
    from public.user_roles ur
    join public.role_permissions rp on rp.role_id = ur.role_id
   where ur.user_id = p_user_id;
$$;

-- Estado del usuario objetivo de una acción de Equipo, en una sola consulta:
-- si existe, si es el propietario, si pertenece al personal y si está
-- desactivado. Los guards del router se apoyan en esto en vez de encadenar
-- llamadas a GoTrue y a user_roles por separado.
create or replace function public.staff_target(p_user_id uuid)
returns table (propietario boolean, es_staff boolean, desactivado boolean)
language sql
security definer
set search_path = ''
as $$
  select
    coalesce(u.raw_app_meta_data ->> 'role', '') = 'admin',
    exists (select 1 from public.user_roles ur where ur.user_id = u.id),
    coalesce(u.banned_until > now(), false)
  from auth.users u
  where u.id = p_user_id;
$$;

-- Reasignación de roles: validación, reemplazo y auditoría en UNA transacción.
-- PostgREST no da transacciones; hacerlo desde el server obligaba a un
-- delete+insert con restauración manual que podía dejar la cuenta sin acceso.
create or replace function public.staff_set_roles(
  p_user_id uuid,
  p_role_ids bigint[],
  p_actor_id uuid,
  p_actor_email text
)
returns bigint[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  pedidos bigint[];
  anteriores bigint[];
begin
  select coalesce(array_agg(distinct x), '{}') into pedidos from unnest(p_role_ids) as x;
  if cardinality(pedidos) = 0 then
    raise exception 'Asigna al menos un rol' using errcode = 'check_violation';
  end if;
  if (select count(*) from public.roles where id = any(pedidos)) <> cardinality(pedidos) then
    raise exception 'Hay un rol que ya no existe' using errcode = 'foreign_key_violation';
  end if;

  select coalesce(array_agg(role_id order by role_id), '{}') into anteriores
    from public.user_roles where user_id = p_user_id;

  delete from public.user_roles where user_id = p_user_id;
  insert into public.user_roles (user_id, role_id, asignado_por)
  select p_user_id, id, p_actor_id from unnest(pedidos) as id;

  insert into public.admin_audit_log (actor_id, actor_email, accion, entidad, entidad_id, detalle)
  values (
    p_actor_id, p_actor_email, 'user.roles', 'user_roles', p_user_id::text,
    jsonb_build_object(
      'antes', jsonb_build_object('roles', to_jsonb(anteriores)),
      'despues', jsonb_build_object('roles', to_jsonb(pedidos))
    )
  );

  return anteriores;
end;
$$;

-- Sesiones abiertas de una cuenta. GoTrue no las expone en su API admin y
-- auth.sessions no es accesible vía PostgREST. Devuelve SOLO metadatos: nunca
-- tokens ni identificadores reutilizables.
create or replace function public.staff_sessions(p_user_id uuid)
returns table (
  id uuid,
  inicio timestamptz,
  ultima_actividad timestamptz,
  user_agent text,
  ip text
)
language sql
security definer
set search_path = ''
as $$
  select s.id, s.created_at, s.updated_at, s.user_agent, host(s.ip)
    from auth.sessions s
   where s.user_id = p_user_id
   order by s.updated_at desc nulls last;
$$;

-- Cierre remoto de sesiones. GoTrue NO tiene logout admin por usuario
-- (POST /auth/v1/admin/users/{id}/logout responde 404 igual que una ruta
-- inventada; su signOut exige el JWT del propio usuario), así que se borran las
-- sesiones. Devuelve cuántas cerró.
create or replace function public.staff_revoke_sessions(p_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  cerradas integer;
begin
  -- Explícito aunque la FK ya cascadea: sin refresh tokens no hay renovación.
  delete from auth.refresh_tokens
   where session_id in (select id from auth.sessions where user_id = p_user_id);
  delete from auth.sessions where user_id = p_user_id;
  get diagnostics cerradas = row_count;
  return cerradas;
end;
$$;

-- Solo el server (service role) puede invocarlas.
revoke all on function public.staff_users() from public, anon, authenticated;
revoke all on function public.staff_permissions(uuid) from public, anon, authenticated;
revoke all on function public.staff_target(uuid) from public, anon, authenticated;
revoke all on function public.staff_set_roles(uuid, bigint[], uuid, text) from public, anon, authenticated;
revoke all on function public.staff_sessions(uuid) from public, anon, authenticated;
revoke all on function public.staff_revoke_sessions(uuid) from public, anon, authenticated;
grant execute on function public.staff_users() to service_role;
grant execute on function public.staff_permissions(uuid) to service_role;
grant execute on function public.staff_target(uuid) to service_role;
grant execute on function public.staff_set_roles(uuid, bigint[], uuid, text) to service_role;
grant execute on function public.staff_sessions(uuid) to service_role;
grant execute on function public.staff_revoke_sessions(uuid) to service_role;

-- ── Verificación ─────────────────────────────────────────────────────────────
-- (a) 5 roles sembrados
select clave, nombre from roles order by clave;
-- (b) Conteo de permisos por rol (gerente el mayor)
select r.clave, count(*) as permisos from roles r
  join role_permissions rp on rp.role_id = r.id
 group by r.clave order by permisos desc;
-- (c) RLS habilitado sin políticas (invisible para el cliente)
select tablename, policyname from pg_policies
 where tablename in ('roles','role_permissions','user_roles');
-- (d) Las funciones de sesiones existen (las ejecuta solo el service role)
select proname, prosecdef, proconfig from pg_proc
 where proname like 'staff_%' order by proname;
