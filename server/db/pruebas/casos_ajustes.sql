-- Pruebas de la migración de ajustes contra un Postgres real (ver
-- verificar-migracion.sh). Cada bloque falla ruidosamente con `raise exception`
-- si la migración no se comporta como el server espera. Se ejecuta DESPUÉS de
-- aplicar las migraciones dos veces (la segunda comprueba idempotencia).

\set ON_ERROR_STOP on

-- 1. Las cinco secciones vivas, con las decisiones del dueño dentro.
--    (`numeracion` se sembró y resultó ser dato muerto: la numeración vive en
--     document_series y el catálogo nunca la declaró. La borra 2026_09_sucursal.)
do $$
declare
  n integer;
  impuestos jsonb;
  moneda jsonb;
begin
  select count(*) into n from app_settings;
  if n <> 5 then raise exception 'esperaba 5 secciones de ajustes, hay %', n; end if;

  select valor into impuestos from app_settings where seccion = 'impuestos';
  if (impuestos ->> 'productos')::numeric <> 7 then
    raise exception 'ITBMS de productos debía sembrarse en 7%%, está en %', impuestos ->> 'productos';
  end if;
  if (impuestos ->> 'membresias')::numeric <> 0 then
    raise exception 'las membresías debían quedar exentas';
  end if;

  select valor into moneda from app_settings where seccion = 'moneda';
  if moneda ->> 'simbolo' <> 'B/.' then raise exception 'la moneda debía ser B/.'; end if;
  if (moneda ->> 'usd_habilitado')::boolean then raise exception 'USD no debía nacer habilitado'; end if;
end
$$;

-- 2. El seed NO pisa lo que el dueño ya configuró (por eso es `do nothing`).
--    Se simula una segunda ejecución de esa sentencia exacta.
do $$
declare
  ruc text;
begin
  update app_settings
     set valor = jsonb_set(valor, '{ruc}', '"155712345-2-2024"')
   where seccion = 'negocio';

  insert into app_settings (seccion, valor) values
    ('negocio', '{"nombre_comercial": "FORJA GYM", "ruc": ""}'::jsonb)
  on conflict (seccion) do nothing;

  select valor ->> 'ruc' into ruc from app_settings where seccion = 'negocio';
  if ruc <> '155712345-2-2024' then
    raise exception 'reejecutar la migración borró el RUC del dueño (quedó "%")', ruc;
  end if;
end
$$;

-- 3. Métodos de pago: los cuatro de siempre, activos y ordenados.
do $$
declare
  n integer;
begin
  select count(*) into n from payment_methods where activo;
  if n < 4 then raise exception 'esperaba al menos los 4 métodos activos, hay %', n; end if;
  perform 1 from payment_methods where clave = 'efectivo' and activo;
  if not found then raise exception 'falta el método efectivo'; end if;
end
$$;

-- 4. payments: el CHECK fijo desapareció y manda la FK. Un método nuevo se puede
--    usar sin desplegar código, y uno con historial no se puede borrar.
do $$
declare
  plan_id bigint;
  n integer;
begin
  insert into membership_plans (nombre, precio) values ('Mensual', 45.00) returning id into plan_id;

  -- Antes de la migración esto era imposible: el CHECK solo admitía 4 valores.
  insert into payment_methods (clave, nombre, orden) values ('yappy_business', 'Yappy Business', 50);
  insert into payments (monto, metodo, origen, plan_id)
       values (45.00, 'yappy_business', 'recepcion', plan_id);

  -- Un método inventado sigue siendo imposible: ahora lo impide la FK.
  begin
    insert into payments (monto, metodo, origen) values (10.00, 'bitcoin', 'recepcion');
    raise exception 'aceptó un método de pago que no existe';
  exception
    when foreign_key_violation then null; -- esperado
  end;

  -- Con historial, el método no se borra: se desactiva.
  begin
    delete from payment_methods where clave = 'yappy_business';
    raise exception 'permitió borrar un método con pagos registrados';
  exception
    when foreign_key_violation then null; -- esperado
  end;

  update payment_methods set activo = false where clave = 'yappy_business';
  select count(*) into n from payments where metodo = 'yappy_business';
  if n <> 1 then raise exception 'desactivar el método alteró su historial'; end if;
end
$$;

-- 5. Numeración: atómica, con prefijo y relleno, y sin repetir.
do $$
declare
  primero text;
  segundo text;
begin
  select siguiente_documento('principal', 'recibo') into primero;
  select siguiente_documento('principal', 'recibo') into segundo;
  if primero <> 'REC-0001' then raise exception 'el primer recibo salió como %', primero; end if;
  if segundo <> 'REC-0002' then raise exception 'el segundo recibo salió como %', segundo; end if;

  begin
    perform siguiente_documento('principal', 'inventado');
    raise exception 'aceptó un tipo de documento inexistente';
  exception
    when no_data_found then null; -- esperado
  end;
end
$$;

-- 5b. Pasarse del relleno NO puede repetir números: lpad trunca por la derecha,
--     así que sin greatest() el recibo 10000 salía como 'REC-1000', el mismo
--     número que ya se emitió con el correlativo 1000.
do $$
declare
  antes text;
  despues text;
begin
  update document_series set proximo = 9999 where sucursal = 'principal' and tipo = 'recibo';
  select siguiente_documento('principal', 'recibo') into antes;   -- 9999
  perform siguiente_documento('principal', 'recibo');             -- 10000
  select siguiente_documento('principal', 'recibo') into despues; -- 10001

  if antes <> 'REC-9999' then raise exception 'el recibo 9999 salió como %', antes; end if;
  if despues <> 'REC-10001' then
    raise exception 'el correlativo se truncó al pasar del relleno: salió % (se repetirían números)', despues;
  end if;
end
$$;

-- 6. La bitácora de auditoría es de solo lectura, aunque escriba el service role.
do $$
declare
  n integer;
begin
  insert into admin_audit_log (actor_id, actor_email, accion, entidad, entidad_id, detalle)
  values ('11111111-1111-1111-1111-111111111111', 'dueno@forja.test',
          'settings.update', 'settings', 'impuestos',
          '{"antes": {"productos": 7}, "despues": {"productos": 10}}'::jsonb);

  begin
    update admin_audit_log set accion = 'falsificada' where entidad = 'settings';
    raise exception 'permitió editar la bitácora';
  exception
    when insufficient_privilege then null; -- esperado
  end;

  begin
    delete from admin_audit_log where entidad = 'settings';
    raise exception 'permitió borrar de la bitácora';
  exception
    when insufficient_privilege then null; -- esperado
  end;

  select count(*) into n from admin_audit_log where entidad = 'settings';
  if n <> 1 then raise exception 'la entrada de auditoría no sobrevivió intacta'; end if;
end
$$;

-- 7. El horario viajó de gym_info a la sección `horario`, con dow numérico.
do $$
declare
  dias jsonb;
  lunes jsonb;
begin
  select valor -> 'dias' into dias from app_settings where seccion = 'horario';
  if jsonb_array_length(dias) <> 7 then
    raise exception 'esperaba 7 días trasladados, hay %', jsonb_array_length(dias);
  end if;

  select d into lunes from jsonb_array_elements(dias) d where (d ->> 'dow')::int = 1;
  if lunes ->> 'abre' <> '06:00' then
    raise exception 'el lunes no conservó su hora de apertura: %', lunes;
  end if;

  -- gym_info conserva su copia: revertir el código no pierde el dato.
  if (select jsonb_array_length(horarios) from gym_info where id = 1) <> 7 then
    raise exception 'gym_info perdió los horarios';
  end if;
end
$$;

-- 8. Solo el service role puede pedir un número de documento.
do $$
begin
  if has_function_privilege('anon', 'siguiente_documento(text, text)', 'execute')
     or has_function_privilege('authenticated', 'siguiente_documento(text, text)', 'execute') then
    raise exception 'la numeración es invocable por el cliente';
  end if;
  if not has_function_privilege('service_role', 'siguiente_documento(text, text)', 'execute') then
    raise exception 'el service role no puede numerar documentos';
  end if;
end
$$;

select 'todas las pruebas de ajustes pasaron' as resultado;
