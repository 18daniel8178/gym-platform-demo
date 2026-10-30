-- Pruebas de la migración de miembros contra un Postgres real (ver
-- verificar-migracion.sh). Cada bloque falla ruidosamente con `raise exception`
-- si la migración no se comporta como el server espera. Se ejecuta DESPUÉS de
-- aplicar las migraciones dos veces (la segunda comprueba idempotencia).
--
-- Los socios a001–a004 los siembra fixture_supabase.sql ANTES de la migración:
-- son los que ya existían en producción el día que se aplica.

\set ON_ERROR_STOP on

-- 1. La clasificación inicial: estado por historial, origen por bitácora.
do $$
declare
  s record;
begin
  for s in
    select * from (values
      ('00000000-0000-0000-0000-00000000a001'::uuid, 'activo', 'web'),
      ('00000000-0000-0000-0000-00000000a002'::uuid, 'activo', 'web'),
      ('00000000-0000-0000-0000-00000000a003'::uuid, 'prospecto', 'mostrador'),
      ('00000000-0000-0000-0000-00000000a004'::uuid, 'prospecto', 'web')
    ) as esperado (user_id, estado, origen)
  loop
    if not exists (
      select 1 from profiles p
       where p.user_id = s.user_id and p.estado_miembro = s.estado and p.origen = s.origen
    ) then
      raise exception 'el socio % debía quedar %/% y quedó %', s.user_id, s.estado, s.origen,
        (select estado_miembro || '/' || origen from profiles where user_id = s.user_id);
    end if;
  end loop;
end
$$;

-- 2. Reejecutar la clasificación NO pisa lo que el personal cambió después.
--    Tres sentencias: el cambio del personal, el DO EXACTO de la migración y la
--    comprobación. (Copiarlo es a propósito: si alguien le quita la guarda de
--    "la columna ya existe", este caso lo delata.)
update profiles set estado_miembro = 'inactivo', origen = 'referido'
 where user_id = '00000000-0000-0000-0000-00000000a001';

do $$
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'profiles' and column_name = 'estado_miembro'
  ) then
    alter table public.profiles add column estado_miembro text not null default 'prospecto';
    alter table public.profiles add column origen text not null default 'web';

    update public.profiles p
       set estado_miembro = 'activo'
     where exists (select 1 from public.memberships m where m.user_id = p.user_id)
        or exists (select 1 from public.payments pg where pg.user_id = p.user_id);

    update public.profiles p
       set origen = 'mostrador'
     where exists (
       select 1 from public.admin_audit_log a
        where a.accion = 'client.create'
          and a.entidad = 'profiles'
          and a.entidad_id = p.user_id::text
     );
  end if;
end
$$;

do $$
begin
  if (select estado_miembro || '/' || origen from profiles where user_id = '00000000-0000-0000-0000-00000000a001') <> 'inactivo/referido' then
    raise exception 'reejecutar la migración reclasificó a un socio que el personal ya había cambiado';
  end if;
  update profiles set estado_miembro = 'activo', origen = 'web' where user_id = '00000000-0000-0000-0000-00000000a001';
end
$$;

-- 3. Normalización: la misma regla que replica miembros.normalizacion.js.
do $$
declare
  c record;
begin
  for c in
    select * from (values
      ('8-123-456', '8123456'),
      ('8 123 456', '8123456'),
      ('8.123.456', '8123456'),
      (' pe-12 345 ', 'PE12345'),
      (E'8-123-456\t', '8123456'),
      ('---', null),
      ('', null),
      (null, null)
    ) as caso (entrada, esperado)
  loop
    if public.normalizar_documento(c.entrada) is distinct from c.esperado then
      raise exception 'normalizar_documento(%) dio % y debía dar %',
        quote_nullable(c.entrada), quote_nullable(public.normalizar_documento(c.entrada)), quote_nullable(c.esperado);
    end if;
  end loop;

  for c in
    select * from (values
      (' Ana@Mail.com ', 'ana@mail.com'),
      ('ana @mail.com', 'ana@mail.com'),
      (E'ANA@MAIL.COM\n', 'ana@mail.com'),
      ('', null),
      (null, null)
    ) as caso (entrada, esperado)
  loop
    if public.normalizar_email(c.entrada) is distinct from c.esperado then
      raise exception 'normalizar_email(%) dio % y debía dar %',
        quote_nullable(c.entrada), quote_nullable(public.normalizar_email(c.entrada)), quote_nullable(c.esperado);
    end if;
  end loop;
end
$$;

-- 4. La columna normalizada se mantiene sola: nace con el alta y sigue al documento.
do $$
begin
  if (select documento_normalizado from profiles where user_id = '00000000-0000-0000-0000-00000000a004') <> 'PE44444' then
    raise exception 'documento_normalizado no se calculó para los socios existentes';
  end if;

  update profiles set documento = 'pe 44.445' where user_id = '00000000-0000-0000-0000-00000000a004';
  if (select documento_normalizado from profiles where user_id = '00000000-0000-0000-0000-00000000a004') <> 'PE44445' then
    raise exception 'documento_normalizado no siguió a la corrección del documento';
  end if;
  update profiles set documento = 'PE-44-444' where user_id = '00000000-0000-0000-0000-00000000a004';
end
$$;

-- 5. Coincidencias: variantes del documento y del correo, archivados incluidos,
--    y el propio socio fuera cuando se edita.
do $$
declare
  r record;
  n integer;
begin
  select * into r from public.miembros_coincidentes('8 111 111', null);
  if r.user_id is distinct from '00000000-0000-0000-0000-00000000a001'::uuid or not r.por_documento or r.por_email then
    raise exception 'no encontró por documento normalizado (%)', r;
  end if;

  -- El correo de a004 está guardado con mayúsculas en auth.users.
  select * into r from public.miembros_coincidentes(null, ' socio.web@FORJA.test ');
  if r.user_id is distinct from '00000000-0000-0000-0000-00000000a004'::uuid or not r.por_email or r.por_documento then
    raise exception 'no encontró por correo normalizado (%)', r;
  end if;

  -- Documento de uno y correo de otro: salen los dos.
  select count(*) into n from public.miembros_coincidentes('8-222-222', 'socio.web@forja.test');
  if n <> 2 then raise exception 'esperaba 2 coincidencias (documento de uno y correo de otro), hubo %', n; end if;

  -- Un archivado también es un posible duplicado.
  update profiles set estado_miembro = 'archivado', estado_motivo = 'prueba'
   where user_id = '00000000-0000-0000-0000-00000000a003';
  select count(*) into n from public.miembros_coincidentes('8333333', null);
  if n <> 1 then raise exception 'un socio archivado no apareció como posible duplicado'; end if;
  update profiles set estado_miembro = 'prospecto', estado_motivo = null
   where user_id = '00000000-0000-0000-0000-00000000a003';

  -- Al editar a un socio, su propio documento no es un duplicado.
  select count(*) into n
    from public.miembros_coincidentes('8-111-111', null, '00000000-0000-0000-0000-00000000a001');
  if n <> 0 then raise exception 'el socio que se edita se detectó como duplicado de sí mismo'; end if;

  select count(*) into n from public.miembros_coincidentes(null, null);
  if n <> 0 then raise exception 'sin documento ni correo no puede haber coincidencias, hubo %', n; end if;
  select count(*) into n from public.miembros_coincidentes('9-999-999', 'nadie@forja.test');
  if n <> 0 then raise exception 'encontró coincidencias que no existen (%)', n; end if;
end
$$;

-- 6. Estados, motivo y origen los valida también la base.
do $$
begin
  begin
    update profiles set estado_miembro = 'suspendido' where user_id = '00000000-0000-0000-0000-00000000a002';
    raise exception 'aceptó un estado de miembro inexistente';
  exception when check_violation then null;
  end;

  begin
    update profiles set estado_miembro = 'bloqueado', estado_motivo = '  ' where user_id = '00000000-0000-0000-0000-00000000a002';
    raise exception 'aceptó bloquear sin motivo';
  exception when check_violation then null;
  end;

  update profiles set estado_miembro = 'bloqueado', estado_motivo = 'deuda en caja'
   where user_id = '00000000-0000-0000-0000-00000000a002';
  update profiles set estado_miembro = 'activo', estado_motivo = null
   where user_id = '00000000-0000-0000-0000-00000000a002';

  begin
    update profiles set origen = 'instagram' where user_id = '00000000-0000-0000-0000-00000000a002';
    raise exception 'aceptó un origen inexistente';
  exception when check_violation then null;
  end;

  begin
    update profiles set etiquetas = (select array_agg('e' || g) from generate_series(1, 21) g)
     where user_id = '00000000-0000-0000-0000-00000000a002';
    raise exception 'aceptó más de 20 etiquetas';
  exception when check_violation then null;
  end;
end
$$;

-- 7. El socio no ve los datos de gestión de su propia fila, ni puede fijarlos.
do $$
declare
  interna text;
begin
  foreach interna in array array['estado_miembro', 'estado_motivo', 'estado_cambiado_en', 'etiquetas', 'origen', 'documento_normalizado']
  loop
    if has_column_privilege('authenticated', 'public.profiles', interna, 'select') then
      raise exception 'authenticated puede leer la columna interna %', interna;
    end if;
    if has_column_privilege('authenticated', 'public.profiles', interna, 'insert') then
      raise exception 'authenticated puede fijar la columna interna % al registrarse', interna;
    end if;
  end loop;

  if not has_column_privilege('authenticated', 'public.profiles', 'nombre_completo', 'select')
     or not has_column_privilege('authenticated', 'public.profiles', 'created_at', 'select') then
    raise exception 'el socio perdió la lectura de las columnas que el sitio le muestra';
  end if;
  if has_table_privilege('anon', 'public.profiles', 'select') then
    raise exception 'anon conserva lectura sobre profiles';
  end if;
end
$$;

-- 8. Documentos sembrados y alta atómica.
do $$
declare
  nuevo uuid := '00000000-0000-0000-0000-00000000b001';
  n integer;
begin
  select count(*) into n from consent_documents where version = 1 and obligatorio;
  if n <> 2 then raise exception 'esperaba 2 documentos obligatorios en versión 1, hay %', n; end if;

  insert into auth.users (id, email) values (nuevo, 'alta.atomica@forja.test');

  -- Sin los obligatorios no nace nada.
  begin
    perform public.alta_miembro(nuevo, '{"nombre_completo":"Eva Alta","documento":"8-555-555","telefono":"6555"}'::jsonb,
      'mostrador', 'activo', array['reglamento'], 'mostrador', 'Firma en el formulario físico', null, true);
    raise exception 'dio de alta sin el consentimiento de datos personales';
  exception when check_violation then null;
  end;

  -- Atomicidad de verdad: aquí el perfil SÍ se inserta y lo que falla es el
  -- consentimiento (medio inválido). El perfil tiene que irse con él.
  begin
    perform public.alta_miembro(nuevo, '{"nombre_completo":"Eva Alta","documento":"8-555-555","telefono":"6555"}'::jsonb,
      'mostrador', 'activo', array['reglamento', 'datos_personales'], 'telepatia', 'Firma', null, true);
    raise exception 'aceptó un medio de captura inexistente';
  exception when check_violation then null;
  end;
  if exists (select 1 from profiles where user_id = nuevo) then
    raise exception 'un alta fallida dejó el perfil a medias';
  end if;

  begin
    perform public.alta_miembro(nuevo, '{"nombre_completo":"Eva Alta","documento":"8-555-555","telefono":"6555"}'::jsonb,
      'mostrador', 'activo', array['reglamento', 'datos_personales', 'inventado'], 'mostrador', 'Firma', null, true);
    raise exception 'aceptó un documento de consentimiento que no existe';
  exception when check_violation then null;
  end;

  perform public.alta_miembro(nuevo,
    '{"nombre_completo":"Eva Alta","documento":"8-555-555","telefono":"6555","entrenado_antes":true}'::jsonb,
    'mostrador', 'activo', array['reglamento', 'datos_personales'], 'mostrador', 'Firma en el formulario físico', null, true);

  if not exists (
    select 1 from profiles
     where user_id = nuevo and estado_miembro = 'activo' and origen = 'mostrador'
       and entrenado_antes and estado_cambiado_en is not null and documento_normalizado = '8555555'
  ) then
    raise exception 'el alta no guardó el perfil con su estado, origen y documento normalizado';
  end if;

  select count(*) into n from member_consents where user_id = nuevo;
  if n <> 2 then raise exception 'el alta debía registrar 2 consentimientos, registró %', n; end if;
end
$$;

-- 9. La importación nace sin consentimientos, y un alta posterior acepta la versión VIGENTE.
do $$
declare
  importado uuid := '00000000-0000-0000-0000-00000000b002';
  despues uuid := '00000000-0000-0000-0000-00000000b003';
  version_aceptada integer;
begin
  insert into auth.users (id, email) values (importado, 'importado@forja.test'), (despues, 'despues@forja.test');

  perform public.alta_miembro(importado, '{"nombre_completo":"Fer Importado","documento":"8-666-666","telefono":"6666"}'::jsonb,
    'importacion', 'activo', null, null, null, null, false);
  if exists (select 1 from member_consents where user_id = importado) then
    raise exception 'la importación inventó consentimientos que nadie aceptó';
  end if;
  if (select fecha_nacimiento from profiles where user_id = importado) is not null then
    raise exception 'la fecha de nacimiento del importado debía quedar vacía';
  end if;

  insert into consent_documents (codigo, version, titulo) values ('reglamento', 2, 'Reglamento interno (rev. 2)');

  perform public.alta_miembro(despues, '{"nombre_completo":"Gabi Después","documento":"8-777-777","telefono":"6777"}'::jsonb,
    'mostrador', 'prospecto', array['reglamento', 'datos_personales'], 'mostrador', 'Firma', null, true);

  select d.version into version_aceptada
    from member_consents c join consent_documents d on d.id = c.documento_id
   where c.user_id = despues and d.codigo = 'reglamento';
  if version_aceptada <> 2 then
    raise exception 'el alta aceptó la versión % del reglamento en vez de la vigente (2)', version_aceptada;
  end if;
end
$$;

-- 10. Consentimientos y notas son de solo agregar; una versión aceptada se congela.
do $$
declare
  alguno bigint;
begin
  select id into alguno from member_consents limit 1;

  begin
    update member_consents set evidencia = 'otra' where id = alguno;
    raise exception 'permitió editar un consentimiento';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from member_consents where id = alguno;
    raise exception 'permitió borrar un consentimiento';
  exception when insufficient_privilege then null;
  end;

  insert into member_notes (user_id, texto, autor_email)
  values ('00000000-0000-0000-0000-00000000b001', 'Pidió factura a nombre de su empresa', 'recepcion@forja.test');
  begin
    update member_notes set texto = 'otra' where user_id = '00000000-0000-0000-0000-00000000b001';
    raise exception 'permitió editar una nota';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from member_notes where user_id = '00000000-0000-0000-0000-00000000b001';
    raise exception 'permitió borrar una nota';
  exception when insufficient_privilege then null;
  end;

  begin
    update consent_documents set texto = 'cambiado' where codigo = 'reglamento' and version = 2;
    raise exception 'permitió cambiar el texto de una versión ya aceptada';
  exception when insufficient_privilege then null;
  end;

  -- Una versión que nadie aceptó todavía sí se corrige.
  insert into consent_documents (codigo, version, titulo) values ('reglamento', 3, 'Borrador');
  update consent_documents set titulo = 'Reglamento interno (rev. 3)', texto = 'Texto definitivo'
   where codigo = 'reglamento' and version = 3;
  delete from consent_documents where codigo = 'reglamento' and version = 3;
end
$$;

-- 11. Un socio con historial no se borra, ni por su perfil ni por su cuenta.
do $$
begin
  begin
    delete from profiles where user_id = '00000000-0000-0000-0000-00000000a001';
    raise exception 'borró el perfil de un socio con membresía';
  exception when restrict_violation then null;
  end;

  -- Borrar la cuenta en Authentication: la guarda corre ANTES de las cascadas.
  begin
    delete from auth.users where id = '00000000-0000-0000-0000-00000000a001';
    raise exception 'borró la cuenta de un socio con membresía';
  exception when restrict_violation then null;
  end;
  if not exists (select 1 from memberships where user_id = '00000000-0000-0000-0000-00000000a001') then
    raise exception 'la cascada se llevó la membresía antes de que la guarda la viera';
  end if;

  begin
    delete from auth.users where id = '00000000-0000-0000-0000-00000000a002';
    raise exception 'borró la cuenta de un socio con pagos';
  exception when restrict_violation then null;
  end;
  if not exists (select 1 from payments where user_id = '00000000-0000-0000-0000-00000000a002') then
    raise exception 'el pago del socio quedó huérfano';
  end if;

  begin
    delete from auth.users where id = '00000000-0000-0000-0000-00000000b001';
    raise exception 'borró la cuenta de un socio con consentimientos y notas';
  exception when restrict_violation then null;
  end;

  -- Sin historial sí se puede: es la compensación de un alta que falló.
  insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000c001', 'recien.creada@forja.test');
  delete from auth.users where id = '00000000-0000-0000-0000-00000000c001';

  -- Y un prospecto sin nada todavía también (su perfil cae en cascada).
  delete from auth.users where id = '00000000-0000-0000-0000-00000000a004';
  if exists (select 1 from profiles where user_id = '00000000-0000-0000-0000-00000000a004') then
    raise exception 'la cuenta de un prospecto sin historial se borró pero su perfil quedó huérfano';
  end if;
end
$$;

-- 12. Etiquetas en uso, sin contar a los archivados.
do $$
declare
  n bigint;
begin
  update profiles set etiquetas = array['corporativo', 'mañana'] where user_id = '00000000-0000-0000-0000-00000000a001';
  update profiles set etiquetas = array['corporativo'] where user_id = '00000000-0000-0000-0000-00000000a002';
  update profiles set etiquetas = array['corporativo'], estado_miembro = 'archivado', estado_motivo = 'se mudó'
   where user_id = '00000000-0000-0000-0000-00000000a003';

  select socios into n from public.etiquetas_en_uso() where etiqueta = 'corporativo';
  if n <> 2 then raise exception 'esperaba 2 socios con "corporativo" (sin el archivado), hubo %', n; end if;
  select socios into n from public.etiquetas_en_uso() where etiqueta = 'mañana';
  if n <> 1 then raise exception 'esperaba 1 socio con "mañana", hubo %', n; end if;
end
$$;

-- 13. Las funciones del server no las puede llamar un socio.
do $$
declare
  f text;
begin
  foreach f in array array[
    'public.alta_miembro(uuid, jsonb, text, text, text[], text, text, uuid, boolean)',
    'public.miembros_coincidentes(text, text, uuid)',
    'public.etiquetas_en_uso()',
    'public.tiene_historial_de_socio(uuid)'
  ]
  loop
    if has_function_privilege('authenticated', f, 'execute') or has_function_privilege('anon', f, 'execute') then
      raise exception 'un socio o un visitante puede ejecutar %', f;
    end if;
  end loop;

  if not has_function_privilege('service_role', 'public.alta_miembro(uuid, jsonb, text, text, text[], text, text, uuid, boolean)', 'execute') then
    raise exception 'el server (service_role) no puede ejecutar alta_miembro';
  end if;
end
$$;

select 'todas las pruebas de miembros pasaron' as resultado;
