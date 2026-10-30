-- FORJA GYM — Migración 2026-08: endurecimiento RLS
-- Ejecutar en Supabase: Dashboard > SQL Editor > New query > pegar y Run.
-- Idempotente: puede ejecutarse más de una vez sin efectos adicionales.
--
-- Cierra dos huecos vigentes:
--   1) memberships: tras D13 la activación ocurre SOLO en el server (service role),
--      pero las políticas de escritura del cliente seguían vigentes y permitían a
--      cualquier socio autenticado auto-activarse la membresía vía PostgREST.
--   2) profiles: el insert del cliente podía fijar firma_foto_pendiente=false
--      (saltarse el control presencial de firma/foto) o falsear created_at.

begin;

-- 1) memberships: queda solo el SELECT de fila propia; escribe únicamente el server.
drop policy if exists "membresia propia insert" on memberships;
drop policy if exists "membresia propia update" on memberships;

-- 2) profiles: lista blanca de columnas para el insert del cliente.
--    Nota Postgres: un grant a nivel de tabla NO se recorta con un revoke por
--    columna (los privilegios de columna son aditivos). Por eso: revoke total
--    + grant únicamente de las columnas que envía el formulario de Join.
revoke insert on profiles from authenticated, anon;
grant insert (
  user_id,
  nombre_completo,
  fecha_nacimiento,
  documento,
  telefono,
  emergencia1_nombre,
  emergencia1_telefono,
  emergencia2_nombre,
  emergencia2_telefono,
  entrenado_antes,
  condiciones_medicas
) on profiles to authenticated;

commit;

-- ── Verificación ─────────────────────────────────────────────────────────────
-- (a) memberships: debe devolver UNA sola fila → "membresia propia" | SELECT
select policyname, cmd from pg_policies where tablename = 'memberships';

-- (b) profiles: authenticated debe tener INSERT solo en las 11 columnas del
--     formulario (ni firma_foto_pendiente ni created_at); anon, ninguna.
select grantee, column_name
  from information_schema.column_privileges
 where table_schema = 'public' and table_name = 'profiles'
   and privilege_type = 'INSERT' and grantee in ('authenticated', 'anon')
 order by grantee, column_name;

-- ── Rollback (solo si un flujo legacy no detectado fallara) ──────────────────
-- create policy "membresia propia insert" on memberships
--   for insert with check (auth.uid() = user_id);
-- create policy "membresia propia update" on memberships
--   for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- grant insert on profiles to authenticated, anon;
