-- Pruebas de la migración de check-in contra un Postgres real (ver
-- verificar-migracion.sh). Cada bloque falla ruidosamente con `raise exception`
-- si la migración no se comporta como el server espera. Se ejecuta DESPUÉS de
-- aplicar las migraciones dos veces (la segunda comprueba idempotencia).
--
-- El socio a001 lo siembra fixture_supabase.sql.

\set ON_ERROR_STOP on

-- Actores propios de estas pruebas: quien anula, y un socio cuyo ÚNICO historial
-- serán sus entradas (a001 ya tiene membresía y no probaría nada).
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000ff', 'gerente.pruebas@forja.test'),
  ('00000000-0000-0000-0000-00000000c001', 'socio.solo.checkins@forja.test')
on conflict (id) do nothing;

insert into profiles (
  user_id, nombre_completo, fecha_nacimiento, documento, telefono,
  emergencia1_nombre, emergencia1_telefono, emergencia2_nombre, emergencia2_telefono
) values ('00000000-0000-0000-0000-00000000c001', 'Carlos Solo Entradas', '1990-01-05', '8-555-555', '60000005', 'E1', '61', 'E2', '62')
on conflict (user_id) do nothing;

-- 1. Una entrada registrada no se borra NUNCA.
do $$
declare
  v_id bigint;
begin
  insert into public.checkins (user_id, resultado, motivo, metodo)
  values ('00000000-0000-0000-0000-00000000a001', 'permitido', 'permitido', 'qr')
  returning id into v_id;

  begin
    delete from public.checkins where id = v_id;
    raise exception 'se pudo BORRAR un check-in';
  exception when insufficient_privilege then null;
  end;

  -- Y tampoco se edita lo que pasó.
  begin
    update public.checkins set resultado = 'rechazado' where id = v_id;
    raise exception 'se pudo cambiar el resultado de un check-in';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.checkins set ocurrido_en = now() - interval '1 day' where id = v_id;
    raise exception 'se pudo mover la hora de un check-in';
  exception when insufficient_privilege then null;
  end;
end $$;

-- 2. Anular sí se puede, una sola vez, y conserva el registro original.
-- Ojo con PL/pgSQL: capturar una excepción revierte TODO el bloque donde ocurre,
-- así que cada intento que debe fallar va en su propio bloque interno; si no, el
-- insert de arriba se iría con él y la prueba comprobaría sobre una fila que ya
-- no existe.
do $$
declare
  v_id bigint;
  v_resultado text;
begin
  insert into public.checkins (user_id, resultado, motivo, metodo)
  values ('00000000-0000-0000-0000-00000000a001', 'permitido', 'permitido', 'manual')
  returning id into v_id;

  begin
    update public.checkins
       set anulado_en = now(), motivo_anulacion = 'Escaneó dos veces'
     where id = v_id;
    raise exception 'se aceptó una anulación sin actor';
  exception when check_violation then null;
  end;

  -- Con actor y motivo, la anulación entra.
  update public.checkins
     set anulado_en = now(),
         anulado_por = '00000000-0000-0000-0000-0000000000ff',
         motivo_anulacion = 'Escaneó dos veces'
   where id = v_id;

  select resultado into v_resultado from public.checkins where id = v_id;
  if v_resultado is distinct from 'permitido' then
    raise exception 'la anulación cambió el registro original (resultado = %)', v_resultado;
  end if;

  -- Y no se vuelve a tocar.
  begin
    update public.checkins set motivo_anulacion = 'otro motivo' where id = v_id;
    raise exception 'se pudo editar un check-in ya anulado';
  exception when insufficient_privilege then null;
  end;
end $$;

-- 3. Forzar una entrada exige decir por qué, y solo aplica a lo permitido.
do $$
begin
  begin
    insert into public.checkins (user_id, resultado, motivo, metodo, forzado)
    values ('00000000-0000-0000-0000-00000000a001', 'permitido', 'membresia_vencida', 'qr', true);
    raise exception 'se aceptó forzar una entrada sin motivo';
  exception when check_violation then null;
  end;

  begin
    insert into public.checkins (user_id, resultado, motivo, metodo, forzado, motivo_forzado)
    values ('00000000-0000-0000-0000-00000000a001', 'rechazado', 'membresia_vencida', 'qr', true, 'lo autorizó el gerente');
    raise exception 'se aceptó un rechazo marcado como forzado';
  exception when check_violation then null;
  end;

  -- Forzado de verdad: entra, conservando el motivo del rechazo original.
  insert into public.checkins (user_id, resultado, motivo, metodo, forzado, motivo_forzado)
  values ('00000000-0000-0000-0000-00000000a001', 'permitido', 'membresia_vencida', 'qr', true, 'Paga mañana, lo autorizo');
end $$;

-- 4. El código de motivo tiene forma de código, no de frase para el usuario.
do $$
begin
  begin
    insert into public.checkins (user_id, resultado, motivo, metodo)
    values ('00000000-0000-0000-0000-00000000a001', 'rechazado', 'Membresía vencida', 'qr');
    raise exception 'se aceptó un motivo que no es un código';
  exception when check_violation then null;
  end;
end $$;

-- 5. Un socio cuyo único historial son sus entradas tampoco se borra.
do $$
begin
  insert into public.checkins (user_id, resultado, motivo, metodo)
  values ('00000000-0000-0000-0000-00000000c001', 'permitido', 'permitido', 'qr');

  begin
    delete from auth.users where id = '00000000-0000-0000-0000-00000000c001';
    raise exception 'se pudo borrar a un socio que tiene entradas registradas';
  exception when restrict_violation then null;
  end;
end $$;

-- 6. El aforo pasó a corrección manual con su fecha, y el número viejo ya no está.
do $$
declare
  v_ajuste int;
  v_fecha date;
begin
  select ajuste, ajuste_fecha into v_ajuste, v_fecha from public.occupancy where id = 1;
  if v_fecha is null then
    raise exception 'la corrección de aforo quedó sin fecha: el conteo de mañana arrastraría la de hoy';
  end if;
  if v_ajuste is null then
    raise exception 'la corrección de aforo quedó nula';
  end if;
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'occupancy' and column_name = 'current_count'
  ) then
    raise exception 'current_count sigue ahí: alguien lo va a actualizar creyendo que mueve el aforo';
  end if;
end $$;

select ' todas las pruebas de check-in pasaron' as resultado;
