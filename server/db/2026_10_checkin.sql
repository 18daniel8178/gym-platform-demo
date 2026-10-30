-- FORJA GYM — Migración 2026-10: check-in y aforo real (Fase 1 · Bloque 6)
-- Ejecutar en Supabase: Dashboard > SQL Editor > New query > pegar y Run.
--
-- REGLA DE ESTE ARCHIVO: el SQL Editor ejecuta sentencia por sentencia, cada una
-- con su propio commit y sin garantía de reutilizar la conexión. Por eso NO hay
-- BEGIN/COMMIT, ni tablas temporales, ni SET de sesión: cada sentencia es válida
-- y repetible por sí sola. Lo verifica server/db/pruebas/ (una conexión por
-- sentencia, dos pasadas) y el job "Migraciones SQL" del CI.
--
-- QUÉ TRAE. El documento maestro (prueba A03) pide registrar CADA intento de entrada
-- —permitido o rechazado— con su motivo, y que el aforo que ve el público salga
-- de esas entradas en vez de un número que alguien teclea. Dos reglas que la
-- base impone, no el código: una entrada registrada no se borra ni se edita
-- (solo se anula, conservando el original), y un socio con entradas tiene
-- historial, así que tampoco se borra.

-- ── Intentos de check-in ─────────────────────────────────────────────────────
-- Una fila por intento. `motivo` es el código del catálogo de decisiones
-- (checkin/decision.js); el mensaje legible vive en el código, no en la base:
-- cambiar una redacción no debe ser una migración.
--
-- `forzado` marca el acceso que gerencia autorizó pese al rechazo: conserva el
-- motivo original del rechazo en `motivo` y explica el porqué en
-- `motivo_forzado`, que es justo lo que hay que poder auditar después.
create table if not exists checkins (
  id bigint generated always as identity primary key,
  user_id uuid not null references profiles (user_id) on delete restrict,
  branch_id bigint not null references branches (id) on delete restrict default sucursal_por_defecto(),
  ocurrido_en timestamptz not null default now(),
  resultado text not null check (resultado in ('permitido', 'rechazado')),
  motivo text not null check (motivo ~ '^[a-z][a-z0-9_]{2,40}$'),
  metodo text not null check (metodo in ('qr', 'manual')),
  forzado boolean not null default false,
  motivo_forzado text check (motivo_forzado is null or char_length(btrim(motivo_forzado)) between 1 and 300),
  atendido_por uuid references auth.users (id) on delete set null,
  anulado_en timestamptz,
  anulado_por uuid references auth.users (id) on delete set null,
  motivo_anulacion text check (motivo_anulacion is null or char_length(btrim(motivo_anulacion)) between 1 and 300),
  created_at timestamptz not null default now(),
  -- Forzar exige decir por qué, y solo tiene sentido sobre una entrada permitida.
  constraint checkin_forzado_con_motivo check (
    (forzado = false and motivo_forzado is null)
    or (forzado = true and resultado = 'permitido' and motivo_forzado is not null)
  ),
  -- Anular exige actor y motivo, y solo se anula lo que llegó a contar.
  constraint checkin_anulacion_completa check (
    (anulado_en is null and anulado_por is null and motivo_anulacion is null)
    or (anulado_en is not null and anulado_por is not null and motivo_anulacion is not null and resultado = 'permitido')
  )
);

alter table checkins enable row level security;

-- El socio ve SUS entradas (el área de socio podrá mostrarle su historial); el
-- personal pasa siempre por el API con service role, como el resto del panel.
drop policy if exists "checkins propios" on checkins;
create policy "checkins propios" on checkins for select using (auth.uid() = user_id);

-- Historial del socio y conteo del día: los dos accesos que existen.
create index if not exists idx_checkins_socio on checkins (user_id, ocurrido_en desc);
create index if not exists idx_checkins_dia on checkins (branch_id, ocurrido_en desc);

-- ── Una entrada registrada no se edita ni se borra ───────────────────────────
-- Solo se anula: el registro original se conserva y la anulación queda al lado.
-- Comparar la fila entera menos las columnas de anulación evita tener que
-- enumerar las demás (y olvidarse de una el día que se agregue otra columna).
create or replace function public.checkin_solo_anulacion()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Un check-in no se borra: anúlalo con su motivo y el registro original se conserva'
      using errcode = 'insufficient_privilege';
  end if;
  if old.anulado_en is not null then
    raise exception 'Ese check-in ya está anulado: no se vuelve a tocar'
      using errcode = 'insufficient_privilege';
  end if;
  if (to_jsonb(new) - 'anulado_en' - 'anulado_por' - 'motivo_anulacion')
     is distinct from (to_jsonb(old) - 'anulado_en' - 'anulado_por' - 'motivo_anulacion') then
    raise exception 'De un check-in solo se pueden completar los datos de la anulación'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

drop trigger if exists checkins_solo_anulacion on checkins;
create trigger checkins_solo_anulacion
  before update or delete on checkins
  for each row execute function public.checkin_solo_anulacion();

-- ── Un socio con entradas tiene historial ────────────────────────────────────
-- La guarda de borrado (2026_09_miembros.sql) ya protegía membresías, pagos,
-- consentimientos y notas: las entradas son historial igual que esos.
create or replace function public.tiene_historial_de_socio(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.memberships where user_id = p_user_id)
      or exists (select 1 from public.payments where user_id = p_user_id)
      or exists (select 1 from public.member_consents where user_id = p_user_id)
      or exists (select 1 from public.member_notes where user_id = p_user_id)
      or exists (select 1 from public.checkins where user_id = p_user_id)
$$;

-- Y el mensaje de las dos guardas nombra lo que ahora cuenta, para que quien lo
-- lea en el SQL Editor sepa por qué no puede borrar.
create or replace function public.cuenta_de_socio_no_se_borra()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.tiene_historial_de_socio(old.id) then
    raise exception 'La cuenta % es de un socio con historial (membresías, pagos, consentimientos, notas o entradas): archívalo en lugar de borrarlo', old.id
      using errcode = 'restrict_violation';
  end if;
  return old;
end;
$$;

create or replace function public.perfil_de_socio_no_se_borra()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.tiene_historial_de_socio(old.user_id) then
    raise exception 'El socio % tiene historial (membresías, pagos, consentimientos, notas o entradas): archívalo en lugar de borrarlo', old.user_id
      using errcode = 'restrict_violation';
  end if;
  return old;
end;
$$;

-- ── El aforo deja de ser un número tecleado ──────────────────────────────────
-- Pasa a calcularse: entradas permitidas del día (sin las anuladas) más una
-- corrección manual del personal, que es lo que hoy hacen cuando ven salir
-- gente. La corrección vale para SU día: mañana el conteo arranca limpio.
alter table occupancy add column if not exists ajuste int not null default 0;
alter table occupancy add column if not exists ajuste_fecha date;

-- El número que el gimnasio mantenía a mano pasa a ser la corrección de hoy, así
-- que la web sigue mostrando lo mismo justo después de migrar. Va dentro de un
-- EXECUTE porque en la segunda pasada la columna ya no existe y un UPDATE suelto
-- —aun dentro de un IF— se parsea igual y reventaría.
do $$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'occupancy' and column_name = 'current_count'
  ) then
    execute 'update public.occupancy
                set ajuste = current_count,
                    ajuste_fecha = (now() at time zone ''America/Panama'')::date
              where ajuste_fecha is null';
  end if;
end $$;

-- `current_count` ya no manda: lo deja de leer el código y se quita para que
-- nadie lo actualice creyendo que mueve el aforo.
alter table occupancy drop column if exists current_count;

-- ── Verificación rápida (opcional) ───────────────────────────────────────────
-- (a) Estructura del registro de entradas
select column_name, data_type from information_schema.columns
 where table_schema = 'public' and table_name = 'checkins' order by ordinal_position;

-- (b) El aforo quedó con su corrección del día
select ajuste, ajuste_fecha, max_capacity from occupancy where id = 1;

-- (c) Las dos reglas de la base siguen en pie
select tgname from pg_trigger
 where tgrelid = 'public.checkins'::regclass and not tgisinternal;
