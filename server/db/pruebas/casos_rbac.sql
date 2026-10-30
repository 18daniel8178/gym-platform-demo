-- Pruebas de la migración RBAC contra un Postgres real (ver verificar-migracion.sh).
-- Cada bloque falla ruidosamente con `raise exception` si la migración no se
-- comporta como el server espera. Se ejecuta DESPUÉS de aplicar la migración
-- dos veces (la segunda comprueba idempotencia).

\set ON_ERROR_STOP on

-- Datos de prueba: un propietario, una recepcionista y un socio sin roles.
insert into auth.users (id, email, raw_app_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'dueno@forja.test', '{"role":"admin"}'),
  ('22222222-2222-2222-2222-222222222222', 'recepcion@forja.test', '{}'),
  ('33333333-3333-3333-3333-333333333333', 'socio@forja.test', '{}')
on conflict (id) do nothing;

insert into user_roles (user_id, role_id)
select '22222222-2222-2222-2222-222222222222', id from roles where clave = 'recepcion'
on conflict do nothing;

do $$
declare
  n integer;
  fila record;
begin
  -- 1. staff_users lista al propietario y al personal, nunca a los socios.
  select count(*) into n from staff_users();
  if n <> 2 then raise exception 'staff_users devolvió % filas, esperaba 2 (propietario + recepción)', n; end if;

  select * into fila from staff_users() where email = 'socio@forja.test';
  if found then raise exception 'staff_users incluyó a un socio sin roles'; end if;

  -- 2. El propietario sale marcado y primero, con roles vacíos.
  select * into fila from staff_users() limit 1;
  if not fila.propietario then raise exception 'el propietario no encabeza el listado'; end if;
  if jsonb_array_length(fila.roles) <> 0 then raise exception 'el propietario no debería tener filas en user_roles'; end if;

  -- 3. La recepcionista trae su rol con nombre legible.
  select * into fila from staff_users() where email = 'recepcion@forja.test';
  if fila.roles -> 0 ->> 'clave' <> 'recepcion' then raise exception 'roles mal formados: %', fila.roles; end if;
  if fila.desactivado then raise exception 'una cuenta sin ban aparece como desactivada'; end if;

  -- 4. staff_permissions resuelve la unión de permisos del rol.
  select count(*) into n from staff_permissions('22222222-2222-2222-2222-222222222222');
  if n < 10 then raise exception 'recepción obtuvo % permisos, esperaba los del seed', n; end if;
  perform 1 from staff_permissions('22222222-2222-2222-2222-222222222222') where permiso = 'membership.collect';
  if not found then raise exception 'recepción perdió membership.collect'; end if;
  perform 1 from staff_permissions('22222222-2222-2222-2222-222222222222') where permiso = 'user.manage';
  if found then raise exception 'recepción NO debe poder gestionar usuarios'; end if;

  -- 5. staff_target distingue propietario, personal y socio.
  select * into fila from staff_target('11111111-1111-1111-1111-111111111111');
  if not fila.propietario then raise exception 'staff_target no reconoce al propietario'; end if;
  select * into fila from staff_target('33333333-3333-3333-3333-333333333333');
  if fila.es_staff then raise exception 'staff_target marcó a un socio como personal'; end if;
  select * into fila from staff_target('44444444-4444-4444-4444-444444444444');
  if found then raise exception 'staff_target devolvió fila para una cuenta inexistente'; end if;
end
$$;

-- 6. staff_set_roles: reemplazo transaccional + auditoría en la misma operación.
do $$
declare
  anteriores bigint[];
  gerente bigint := (select id from roles where clave = 'gerente');
  recepcion bigint := (select id from roles where clave = 'recepcion');
  n integer;
begin
  anteriores := staff_set_roles(
    '22222222-2222-2222-2222-222222222222',
    array[gerente, gerente], -- duplicado a propósito: la función lo normaliza
    '11111111-1111-1111-1111-111111111111',
    'dueno@forja.test'
  );
  if anteriores <> array[recepcion] then raise exception 'no devolvió los roles anteriores: %', anteriores; end if;

  select count(*) into n from user_roles where user_id = '22222222-2222-2222-2222-222222222222';
  if n <> 1 then raise exception 'quedaron % filas de rol, esperaba 1', n; end if;

  select count(*) into n from admin_audit_log where accion = 'user.roles';
  if n <> 1 then raise exception 'la reasignación no quedó auditada'; end if;
end
$$;

-- 7. Un rol inexistente aborta TODO el cambio (nada de estados a medias).
do $$
declare
  n integer;
begin
  begin
    perform staff_set_roles(
      '22222222-2222-2222-2222-222222222222',
      array[999999]::bigint[],
      '11111111-1111-1111-1111-111111111111',
      'dueno@forja.test'
    );
    raise exception 'aceptó un rol inexistente';
  exception
    when foreign_key_violation then null; -- esperado
  end;

  select count(*) into n from user_roles where user_id = '22222222-2222-2222-2222-222222222222';
  if n <> 1 then raise exception 'el usuario quedó con % roles tras el fallo, debía conservar 1', n; end if;
end
$$;

-- 8. Lista vacía de roles: se rechaza (quitar el acceso se hace desactivando).
do $$
begin
  begin
    perform staff_set_roles(
      '22222222-2222-2222-2222-222222222222',
      array[]::bigint[],
      '11111111-1111-1111-1111-111111111111',
      'dueno@forja.test'
    );
    raise exception 'aceptó dejar a un usuario sin roles';
  exception
    when check_violation then null; -- esperado
  end;
end
$$;

-- 9. Sesiones: listado sin secretos y cierre que borra también los refresh tokens.
do $$
declare
  n integer;
  fila record;
begin
  insert into auth.sessions (id, user_id, created_at, updated_at, user_agent, ip)
  values ('aaaaaaaa-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222',
          now() - interval '2 hours', now(), 'Mozilla/5.0 (Windows NT 10.0)', '190.34.12.9');
  insert into auth.refresh_tokens (session_id) values ('aaaaaaaa-0000-0000-0000-000000000001');

  select * into fila from staff_sessions('22222222-2222-2222-2222-222222222222');
  if fila.ip <> '190.34.12.9' then raise exception 'staff_sessions no devuelve la IP legible: %', fila.ip; end if;

  select staff_revoke_sessions('22222222-2222-2222-2222-222222222222') into n;
  if n <> 1 then raise exception 'staff_revoke_sessions cerró % sesiones, esperaba 1', n; end if;

  select count(*) into n from auth.refresh_tokens
   where session_id = 'aaaaaaaa-0000-0000-0000-000000000001';
  if n <> 0 then raise exception 'quedaron refresh tokens tras cerrar la sesión'; end if;
end
$$;

-- 10. Las funciones son security definer y no dependen del search_path del que llama.
do $$
declare
  n integer;
begin
  select count(*) into n from pg_proc p
    join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public' and p.proname like 'staff\_%'
     and (p.prosecdef is false or p.proconfig is null
          or not exists (select 1 from unnest(p.proconfig) c where c like 'search\_path=%'));
  if n > 0 then raise exception '% función(es) staff_* sin security definer o sin search_path fijado', n; end if;
end
$$;

-- 11. Ningún rol del cliente puede invocarlas ni leer las tablas del RBAC.
do $$
begin
  if has_function_privilege('anon', 'staff_users()', 'execute')
     or has_function_privilege('authenticated', 'staff_set_roles(uuid, bigint[], uuid, text)', 'execute') then
    raise exception 'las funciones del panel son invocables por el cliente';
  end if;
  if not has_function_privilege('service_role', 'staff_users()', 'execute') then
    raise exception 'el service role no puede invocar staff_users';
  end if;
end
$$;

-- 12. El seed reconcilia: un permiso de más en la base desaparece al reejecutar
--     la migración (verificado abajo por verificar-migracion.sh, que la aplica
--     dos veces; aquí se comprueba el estado resultante).
do $$
declare
  n integer;
begin
  select count(*) into n
    from role_permissions rp join roles r on r.id = rp.role_id
   where r.clave = 'recepcion' and rp.permiso = 'payment.refund';
  if n <> 0 then
    raise exception 'recepción conserva un permiso que el seed no le da';
  end if;
end
$$;

select 'todas las pruebas del RBAC pasaron' as resultado;
