-- FORJA GYM — Asignación del rol administrador
-- Ejecutar en Supabase: Dashboard > SQL Editor (service role).
--
-- El rol vive en app_metadata.role de Supabase Auth (columna raw_app_meta_data).
-- Solo se puede escribir con service role o desde el dashboard: el usuario NO
-- puede auto-asignárselo (user_metadata sí sería editable — por eso NO se usa).
--
-- La verificación es server-side en cada request (requireAdmin usa getUser):
-- asignar o retirar el rol surte efecto en el SIGUIENTE request, sin re-login.

-- ── Asignar rol admin a un usuario existente ────────────────────────────────
-- Reemplaza el email por el de la persona (debe tener cuenta ya creada).
update auth.users
   set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
 where email = 'REEMPLAZA_ESTE_EMAIL@correo.com';

-- ── Primer admin de FORJA GYM (ANTI-LOCKOUT) ─────────────────────────────────
-- Ejecuta esto UNA vez con el email del dueño/administrador inicial para no
-- quedar sin ningún admin. Descomenta y ajusta el email:
-- update auth.users
--    set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
--  where email = 'admin@example.com';

-- ── Verificar quién es admin ────────────────────────────────────────────────
-- select email, raw_app_meta_data->>'role' as role
--   from auth.users where raw_app_meta_data->>'role' = 'admin';

-- ── Retirar el rol (revisar SIEMPRE que quede al menos un admin) ─────────────
-- update auth.users
--    set raw_app_meta_data = raw_app_meta_data - 'role'
--  where email = 'persona@correo.com';
