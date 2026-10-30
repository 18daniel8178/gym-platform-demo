-- Pruebas de la migración de sucursal contra un Postgres real (ver
-- verificar-migracion.sh). Cada bloque falla ruidosamente con `raise exception`
-- si la migración no se comporta como el server espera. Se ejecuta DESPUÉS de
-- aplicar las migraciones dos veces (la segunda comprueba idempotencia).

\set ON_ERROR_STOP on

-- 1. Existe una sucursal y solo una, con su código estable.
do $$
declare
  n integer;
  s record;
begin
  select count(*) into n from branches;
  if n <> 1 then raise exception 'esperaba exactamente 1 sucursal, hay %', n; end if;

  select * into s from branches where codigo = 'principal';
  if not found then raise exception 'falta la sucursal principal'; end if;
  if not s.activa then raise exception 'la sucursal principal nació desactivada'; end if;
  if s.zona_horaria <> 'America/Panama' then
    raise exception 'la zona horaria por defecto debía ser America/Panama, es %', s.zona_horaria;
  end if;
end
$$;

-- 2. La semilla NO pisa lo que el dueño ya configuró (`do nothing`), igual que
--    en la migración de ajustes: se simula reejecutar esa sentencia exacta.
do $$
declare
  nombre_final text;
begin
  update branches set nombre = 'FORJA GYM Centro', direccion = 'Vía Principal' where codigo = 'principal';

  insert into branches (codigo, nombre, direccion)
  values ('principal', 'FORJA GYM', '')
  on conflict (codigo) do nothing;

  select nombre into nombre_final from branches where codigo = 'principal';
  if nombre_final <> 'FORJA GYM Centro' then
    raise exception 'reejecutar la migración pisó el nombre del dueño (quedó "%")', nombre_final;
  end if;

  update branches set nombre = 'FORJA GYM', direccion = '' where codigo = 'principal';
end
$$;

-- 3. Todo movimiento existente quedó adoptado por la sucursal, y uno nuevo
--    puede nacer con ella.
do $$
declare
  sucursal bigint;
  huerfanos integer;
  plan_id bigint;
begin
  select id into sucursal from branches where codigo = 'principal';

  select count(*) into huerfanos from payments where branch_id is null;
  if huerfanos <> 0 then raise exception '% pagos se quedaron sin sucursal', huerfanos; end if;
  select count(*) into huerfanos from memberships where branch_id is null;
  if huerfanos <> 0 then raise exception '% membresías se quedaron sin sucursal', huerfanos; end if;

  insert into membership_plans (nombre, precio) values ('Mensual sucursal', 45.00) returning id into plan_id;
  insert into payments (monto, metodo, origen, plan_id, branch_id)
       values (45.00, 'efectivo', 'recepcion', plan_id, sucursal);

  -- Y el código que AÚN no manda la sucursal (el desplegado hoy) tampoco deja
  -- huérfanos: el default la resuelve. Sin esto, el orden de despliegue rompía
  -- cada cobro entre la migración y el deploy.
  insert into payments (monto, metodo, origen) values (4.00, 'efectivo', 'recepcion');
  select count(*) into huerfanos from payments where branch_id is null;
  if huerfanos <> 0 then raise exception 'un insert sin sucursal dejó % huérfano(s)', huerfanos; end if;

  -- Una sucursal inventada no puede colarse en un cobro.
  begin
    insert into payments (monto, metodo, origen, branch_id) values (10.00, 'efectivo', 'recepcion', -1);
    raise exception 'aceptó un pago en una sucursal que no existe';
  exception
    when foreign_key_violation then null; -- esperado
  end;
end
$$;

-- 4. Una sucursal con movimientos no se puede borrar: se desactiva.
do $$
begin
  begin
    delete from branches where codigo = 'principal';
    raise exception 'permitió borrar una sucursal con movimientos';
  exception
    when foreign_key_violation then null; -- esperado
  end;
end
$$;

-- 5. La numeración cuelga de una sucursal real, no de texto libre.
do $$
begin
  begin
    insert into document_series (sucursal, tipo, prefijo) values ('fantasma', 'recibo', 'FAN-');
    raise exception 'aceptó numeración para una sucursal inexistente';
  exception
    when foreign_key_violation then null; -- esperado
  end;
end
$$;

-- 6. La sección muerta `numeracion` desapareció de los ajustes.
do $$
declare
  n integer;
begin
  select count(*) into n from app_settings where seccion = 'numeracion';
  if n <> 0 then raise exception 'la sección numeracion sigue sembrada y nadie la lee'; end if;

  select count(*) into n from app_settings;
  if n <> 5 then raise exception 'esperaba las 5 secciones vivas de ajustes, hay %', n; end if;
end
$$;

select 'todas las pruebas de sucursal pasaron' as resultado;
