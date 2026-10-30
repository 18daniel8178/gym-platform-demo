-- FORJA GYM — Migración 2026-08: Organización y ajustes (Fase 1 · Bloque 2)
-- Ejecutar en Supabase: Dashboard > SQL Editor > New query > pegar y Run.
--
-- REGLA DE ESTE ARCHIVO: el SQL Editor ejecuta sentencia por sentencia, cada una
-- con su propio commit y sin garantía de reutilizar la conexión. Por eso NO hay
-- BEGIN/COMMIT, ni tablas temporales, ni SET de sesión: cada sentencia es válida
-- y repetible por sí sola. Lo verifica server/db/pruebas/ (una conexión por
-- sentencia, dos pasadas) y el job "Migraciones SQL" del CI.
--
-- Saca de código lo que el documento maestro (§13.5) exige configurar: moneda,
-- impuestos, horarios, métodos de pago, numeración y políticas.

-- ── Ajustes por sección ──────────────────────────────────────────────────────
-- Una fila por sección: el grano coincide con el del PATCH del panel, con el del
-- diff auditado y con el de la invalidación de caché.
create table if not exists app_settings (
  seccion text primary key,
  valor jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

alter table app_settings enable row level security;

-- ── Métodos de pago ──────────────────────────────────────────────────────────
-- Tabla, no lista en el código: el documento pide activarlos y añadir otros sin
-- desplegar. Nunca se borran — un método con historial se DESACTIVA.
create table if not exists payment_methods (
  clave text primary key,
  nombre text not null,
  activo boolean not null default true,
  orden smallint not null default 100,
  created_at timestamptz not null default now()
);

alter table payment_methods enable row level security;

-- ── Numeración de documentos ─────────────────────────────────────────────────
-- Contador en fila, no secuencia: una secuencia quema números en cada reintento
-- y la spec exige numeración sin huecos. La sucursal está en la clave desde el
-- día uno para que multisucursal no obligue a renumerar lo ya emitido.
create table if not exists document_series (
  sucursal text not null default 'principal',
  tipo text not null check (tipo in ('recibo', 'factura')),
  prefijo text not null default '',
  proximo bigint not null default 1 check (proximo >= 1),
  relleno smallint not null default 4 check (relleno between 0 and 12),
  primary key (sucursal, tipo)
);

alter table document_series enable row level security;

-- ── Auditoría: índice para el filtro por tipo de ajuste ──────────────────────
create index if not exists idx_audit_entidad
  on admin_audit_log (entidad, entidad_id, created_at desc);

-- ── Auditoría inmutable de verdad ────────────────────────────────────────────
-- El service role ignora RLS, así que sin esto la inmutabilidad dependía de que
-- ningún endpoint hiciera update/delete. Ahora la impone la base.
create or replace function public.audit_log_inmutable()
returns trigger
language plpgsql
as $$
begin
  raise exception 'La bitácora de auditoría es de solo lectura (intento de %)', tg_op
    using errcode = 'insufficient_privilege';
end;
$$;

drop trigger if exists admin_audit_log_inmutable on admin_audit_log;

create trigger admin_audit_log_inmutable
  before update or delete on admin_audit_log
  for each row execute function public.audit_log_inmutable();

-- ── Seed de ajustes ──────────────────────────────────────────────────────────
-- `do nothing`, NUNCA `do update`: al revés que el seed de roles del RBAC, estos
-- son datos del DUEÑO. Reejecutar la migración no puede pisarle el RUC, las
-- tasas ni el correlativo que ya configuró.
insert into app_settings (seccion, valor) values
  ('negocio', '{
     "nombre_comercial": "FORJA GYM",
     "razon_social": "",
     "ruc": "",
     "dv": "",
     "telefono": "",
     "correo": "",
     "direccion": "",
     "logo_url": null
   }'::jsonb),
  -- Moneda principal PAB con visualización B/. (documento §13.5). El soporte de
  -- USD queda como interruptor: sin montos guardados en USD no hay nada que
  -- convertir todavía.
  ('moneda', '{
     "codigo": "PAB",
     "simbolo": "B/.",
     "decimales": 2,
     "locale": "es-PA",
     "usd_habilitado": false
   }'::jsonb),
  -- ITBMS: regla de negocio = 7% productos, membresías exentas.
  -- "servicios" queda en 0 como SUPUESTO, pendiente de confirmar con contabilidad
  -- antes de emitir documentos fiscales reales.
  ('impuestos', '{
     "membresias": 0,
     "productos": 7,
     "servicios": 0
   }'::jsonb),
  -- Horario por día en clave numérica ISO (1 = lunes): emparejar por el nombre
  -- del día con acentos es un fallo silencioso esperando a ocurrir. El GET
  -- público sigue proyectando el nombre para no cambiar el sitio.
  ('horario', '{
     "dias": [],
     "cierres": []
   }'::jsonb),
  -- Políticas decididas por el dueño; las consumen los bloques 5, 6 y 7.
  ('politicas', '{
     "pase_diario_entradas_dia": 1,
     "stock_negativo": false,
     "umbral_caja": 5.00,
     "checkin_ventana_minutos": 120,
     "cierre_ciego": true
   }'::jsonb)
on conflict (seccion) do nothing;

-- ── Seed de métodos de pago ──────────────────────────────────────────────────
-- Los cuatro que hoy vivían en la constante METODOS del server.
insert into payment_methods (clave, nombre, orden) values
  ('efectivo', 'Efectivo', 10),
  ('tarjeta', 'Tarjeta', 20),
  ('yappy', 'Yappy', 30),
  ('transferencia', 'Transferencia', 40)
on conflict (clave) do nothing;

-- Absorbe cualquier método que ya exista en pagos y no esté en la lista (datos
-- previos a esta migración): entra DESACTIVADO para no ofrecerse en cobros
-- nuevos, pero permite que la FK de más abajo no rompa el historial.
insert into payment_methods (clave, nombre, activo, orden)
select distinct p.metodo, initcap(p.metodo), false, 900
  from payments p
 where p.metodo is not null
   and not exists (select 1 from payment_methods m where m.clave = p.metodo)
on conflict (clave) do nothing;

-- ── payments.metodo: de CHECK fijo a FK contra la tabla ──────────────────────
-- El CHECK hacía imposible el requisito "métodos configurables sin desplegar".
alter table payments drop constraint if exists payments_metodo_check;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'payments_metodo_fkey'
  ) then
    alter table payments
      add constraint payments_metodo_fkey
      foreign key (metodo) references payment_methods (clave)
      on update cascade on delete restrict;
  end if;
end;
$$;

-- ── Numeración inicial ───────────────────────────────────────────────────────
insert into document_series (sucursal, tipo, prefijo, proximo, relleno) values
  ('principal', 'recibo', 'REC-', 1, 4),
  ('principal', 'factura', 'FAC-', 1, 4)
on conflict (sucursal, tipo) do nothing;

-- Número siguiente de forma atómica: un solo UPDATE ... RETURNING, así que dos
-- emisiones concurrentes nunca reciben el mismo número (la fila queda bloqueada
-- hasta el commit de cada una).
create or replace function public.siguiente_documento(p_sucursal text, p_tipo text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  serie record;
begin
  update public.document_series
     set proximo = proximo + 1
   where sucursal = p_sucursal and tipo = p_tipo
  returning prefijo, proximo - 1 as numero, relleno into serie;

  if not found then
    raise exception 'No hay serie de documentos para % / %', p_sucursal, p_tipo
      using errcode = 'no_data_found';
  end if;

  -- greatest() no es cosmético: lpad TRUNCA por la derecha cuando el texto ya
  -- supera `length`, así que con el relleno 4 sembrado aquí el recibo 10000
  -- saldría como 'REC-1000' y chocaría con el 1000 ya emitido. Con esto el
  -- relleno solo rellena: 1 -> 'REC-0001', 10000 -> 'REC-10000'.
  return serie.prefijo || lpad(serie.numero::text,
                               greatest(serie.relleno, length(serie.numero::text)), '0');
end;
$$;

revoke all on function public.siguiente_documento(text, text) from public, anon, authenticated;
grant execute on function public.siguiente_documento(text, text) to service_role;

-- ── Horarios: de gym_info a la sección `horario` ─────────────────────────────
-- Traslado con guarda de completitud: si los 7 días no emparejan por nombre, se
-- deja la sección vacía y el server cae al horario por defecto en vez de guardar
-- un horario a medias. gym_info.horarios NO se borra: permite revertir el código
-- sin perder el dato.
update app_settings s
   set valor = jsonb_set(s.valor, '{dias}', (
         select jsonb_agg(jsonb_build_object(
                  'dow', d.dow,
                  'abre', h.value ->> 'abre',
                  'cierra', h.value ->> 'cierra',
                  'cerrado', false
                ) order by d.dow)
           from gym_info g
           cross join lateral jsonb_array_elements(g.horarios) h
           join (values
                   ('Lunes', 1), ('Martes', 2), ('Miércoles', 3), ('Jueves', 4),
                   ('Viernes', 5), ('Sábado', 6), ('Domingo', 7)
                ) as d(nombre, dow) on d.nombre = h.value ->> 'dia'
          where g.id = 1
       )),
       updated_at = now()
 where s.seccion = 'horario'
   and s.valor -> 'dias' = '[]'::jsonb
   and (select count(*) from gym_info g
          cross join lateral jsonb_array_elements(g.horarios) h
          join (values
                  ('Lunes', 1), ('Martes', 2), ('Miércoles', 3), ('Jueves', 4),
                  ('Viernes', 5), ('Sábado', 6), ('Domingo', 7)
               ) as d(nombre, dow) on d.nombre = h.value ->> 'dia'
         where g.id = 1) = 7;

-- ── Verificación ─────────────────────────────────────────────────────────────
-- (a) Secciones sembradas
select seccion, jsonb_pretty(valor) from app_settings order by seccion;
-- (b) Métodos de pago (los inactivos son métodos heredados de datos previos)
select clave, nombre, activo, orden from payment_methods order by orden, clave;
-- (c) Series de numeración
select sucursal, tipo, prefijo, proximo, relleno from document_series order by tipo;
-- (d) payments ya no tiene el CHECK fijo y sí la FK
select conname, contype from pg_constraint
 where conrelid = 'payments'::regclass and conname like 'payments_metodo%';
-- (e) Horario trasladado (7 días con su dow numérico)
select jsonb_array_length(valor -> 'dias') as dias_configurados
  from app_settings where seccion = 'horario';
