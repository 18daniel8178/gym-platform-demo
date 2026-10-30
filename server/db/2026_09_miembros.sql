-- FORJA GYM — Migración 2026-09: el expediente ampliado del miembro (Fase 1 · Bloque 3)
-- Ejecutar en Supabase: Dashboard > SQL Editor > New query > pegar y Run.
--
-- REGLA DE ESTE ARCHIVO: el SQL Editor ejecuta sentencia por sentencia, cada una
-- con su propio commit y sin garantía de reutilizar la conexión. Por eso NO hay
-- BEGIN/COMMIT, ni tablas temporales, ni SET de sesión: cada sentencia es válida
-- y repetible por sí sola. Lo verifica server/db/pruebas/ (una conexión por
-- sentencia, dos pasadas) y el job "Migraciones SQL" del CI.
--
-- QUÉ TRAE. El documento maestro (§13.7) pide un expediente único del miembro:
-- estado propio (independiente de la membresía), etiquetas, origen del alta,
-- consentimientos versionados, notas y aviso de duplicados. Y una regla que la
-- base todavía no cumplía: un miembro con historial no se borra, se archiva.

-- ── Datos opcionales para la importación ─────────────────────────────────────
-- Regla de negocio: el CSV exige nombre, documento, teléfono y
-- correo; el nacimiento y los contactos de emergencia pueden venir vacíos y la
-- ficha los marca pendientes. El formulario web y el alta presencial los siguen
-- exigiendo: la regla vive en la validación de cada flujo, no en la columna.
alter table profiles alter column fecha_nacimiento drop not null;
alter table profiles alter column emergencia1_nombre drop not null;
alter table profiles alter column emergencia1_telefono drop not null;
alter table profiles alter column emergencia2_nombre drop not null;
alter table profiles alter column emergencia2_telefono drop not null;

-- ── Normalización para el aviso de duplicados ────────────────────────────────
-- Una sola definición, en SQL: la columna generada y la búsqueda de
-- coincidencias la comparten, así que no pueden discrepar. Del documento quedan
-- letras y dígitos ASCII en mayúsculas: '8-123-456', '8 123 456' y '8.123.456'
-- son el mismo. El correo pierde espacios y mayúsculas. La importación CSV
-- replica ambas reglas en JS (miembros.normalizacion.js) para comparar las filas
-- entre sí, y sus tests fijan los mismos casos que casos_miembros.sql.
create or replace function public.normalizar_documento(p_documento text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$ select nullif(upper(regexp_replace(coalesce(p_documento, ''), '[^A-Za-z0-9]', '', 'g')), '') $$;

create or replace function public.normalizar_email(p_email text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$ select nullif(lower(regexp_replace(coalesce(p_email, ''), '\s', '', 'g')), '') $$;

alter table profiles
  add column if not exists documento_normalizado text
  generated always as (public.normalizar_documento(documento)) stored;

create index if not exists idx_profiles_documento_normalizado on profiles (documento_normalizado);

-- ── Estado del miembro y origen del alta ─────────────────────────────────────
-- El estado es de la PERSONA y no se deriva de la membresía (§10): alguien activo
-- puede tener la membresía vencida, y al revés.
--
-- Las dos columnas nacen dentro de un DO para que la clasificación de los socios
-- que ya existen corra UNA vez, en la misma sentencia que crea las columnas:
-- reejecutar la migración no puede volver a clasificar a nadie ni pisar lo que el
-- personal haya cambiado después.
--   · estado: quien tiene o tuvo membresía o pagos es 'activo'; quien solo dejó
--     sus datos, 'prospecto'. Es la foto del día de la migración, no una regla
--     que se repita (desde entonces el estado solo cambia por decisión o evento).
--   · origen: las altas presenciales constan en la bitácora ('client.create'); el
--     resto llegó por el formulario web.
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

alter table profiles add column if not exists estado_motivo text;
alter table profiles add column if not exists estado_cambiado_en timestamptz;
alter table profiles add column if not exists etiquetas text[] not null default '{}';

alter table profiles drop constraint if exists profiles_estado_miembro_check;
alter table profiles add constraint profiles_estado_miembro_check
  check (estado_miembro in ('prospecto', 'activo', 'inactivo', 'bloqueado', 'archivado'));

-- Bloquear o archivar exige motivo (§13.7). Lo valida el server y, por si algún
-- día alguien escribe directo en la tabla, también la base.
alter table profiles drop constraint if exists profiles_estado_motivo_check;
alter table profiles add constraint profiles_estado_motivo_check
  check (estado_miembro not in ('bloqueado', 'archivado') or nullif(btrim(estado_motivo), '') is not null);

alter table profiles drop constraint if exists profiles_origen_check;
alter table profiles add constraint profiles_origen_check
  check (origen in ('web', 'mostrador', 'importacion', 'referido'));

alter table profiles drop constraint if exists profiles_etiquetas_check;
alter table profiles add constraint profiles_etiquetas_check check (cardinality(etiquetas) <= 20);

create index if not exists idx_profiles_estado on profiles (estado_miembro);
create index if not exists idx_profiles_etiquetas on profiles using gin (etiquetas);

-- ── Lo que el socio ve de su propia fila ─────────────────────────────────────
-- RLS deja al socio leer SU fila, pero la fila ahora lleva datos de gestión del
-- gimnasio: el motivo de un bloqueo o una etiqueta interna no son para él. Un
-- grant de tabla no se recorta con revoke por columna (igual que el insert en el
-- endurecimiento de RLS): revoke total y lista blanca de lo que es suyo.
revoke select on profiles from anon, authenticated;
grant select (
  user_id, nombre_completo, fecha_nacimiento, documento, telefono,
  emergencia1_nombre, emergencia1_telefono, emergencia2_nombre, emergencia2_telefono,
  entrenado_antes, condiciones_medicas, firma_foto_pendiente, created_at
) on profiles to authenticated;

-- ── Documentos de consentimiento, una fila por versión ───────────────────────
-- Publicar una versión nueva es insertar; la vigente es la de número más alto.
-- Regla de negocio: reglamento interno y tratamiento de datos
-- personales, los dos obligatorios en el alta presencial. El texto definitivo lo
-- carga el dueño: mientras nadie haya aceptado una versión se puede corregir,
-- después queda congelada (trigger de más abajo).
create table if not exists consent_documents (
  id bigint generated always as identity primary key,
  codigo text not null check (codigo ~ '^[a-z][a-z0-9_]{1,40}$'),
  version integer not null check (version > 0),
  titulo text not null check (char_length(btrim(titulo)) between 1 and 120),
  texto text not null default '',
  obligatorio boolean not null default true,
  publicado_en timestamptz not null default now(),
  publicado_por uuid references auth.users (id) on delete set null,
  unique (codigo, version)
);

alter table consent_documents enable row level security;

-- `do nothing`: si el dueño ya cargó el texto, reejecutar no se lo pisa.
insert into consent_documents (codigo, version, titulo) values
  ('reglamento', 1, 'Reglamento interno del gimnasio'),
  ('datos_personales', 1, 'Tratamiento de datos personales')
on conflict (codigo, version) do nothing;

-- ── Consentimientos aceptados ────────────────────────────────────────────────
-- Solo se agregan (§13.7): la prueba de qué aceptó alguien y cuándo no se corrige
-- ni se borra. `medio` y `evidencia` dicen cómo se capturó y `registrado_por`,
-- quién. Aceptar otra vez la misma versión es otra fila, no una edición.
create table if not exists member_consents (
  id bigint generated always as identity primary key,
  user_id uuid not null references profiles (user_id) on delete restrict,
  documento_id bigint not null references consent_documents (id) on delete restrict,
  aceptado_en timestamptz not null default now(),
  medio text not null check (medio in ('mostrador', 'web')),
  evidencia text not null check (char_length(btrim(evidencia)) between 1 and 300),
  registrado_por uuid references auth.users (id) on delete set null
);

create index if not exists idx_member_consents_user on member_consents (user_id, aceptado_en desc);

alter table member_consents enable row level security;

-- ── Notas del expediente ─────────────────────────────────────────────────────
-- Parte de la línea de tiempo. Como la bitácora, una nota equivocada se corrige
-- con otra nota: el expediente cuenta lo que pasó, también los errores.
create table if not exists member_notes (
  id bigint generated always as identity primary key,
  user_id uuid not null references profiles (user_id) on delete restrict,
  texto text not null check (char_length(btrim(texto)) between 1 and 2000),
  autor_id uuid references auth.users (id) on delete set null,
  autor_email text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_member_notes_user on member_notes (user_id, created_at desc);

alter table member_notes enable row level security;

-- ── Solo agregar: lo impone la base ──────────────────────────────────────────
-- El service role ignora RLS: sin trigger, la inmutabilidad dependería de que
-- ningún endpoint hiciera update/delete. Mismo razonamiento que la bitácora.
create or replace function public.solo_agregar()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'La tabla % es de solo agregar (intento de %)', tg_table_name, tg_op
    using errcode = 'insufficient_privilege';
end;
$$;

drop trigger if exists member_consents_solo_agregar on member_consents;
create trigger member_consents_solo_agregar
  before update or delete on member_consents
  for each row execute function public.solo_agregar();

drop trigger if exists member_notes_solo_agregar on member_notes;
create trigger member_notes_solo_agregar
  before update or delete on member_notes
  for each row execute function public.solo_agregar();

-- Una versión ya aceptada queda congelada: cambiarle el texto cambiaría lo que
-- esos socios aceptaron. Sin aceptaciones todavía, se puede corregir.
create or replace function public.version_aceptada_congelada()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (select 1 from public.member_consents where documento_id = old.id) then
    raise exception 'La versión % de "%" ya fue aceptada: publica una versión nueva', old.version, old.codigo
      using errcode = 'insufficient_privilege';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists consent_documents_congelada on consent_documents;
create trigger consent_documents_congelada
  before update or delete on consent_documents
  for each row execute function public.version_aceptada_congelada();

-- ── Un miembro con historial no se borra: se archiva ─────────────────────────
-- Hasta hoy, borrar la cuenta en Authentication arrastraba en cascada el perfil y
-- la membresía, y dejaba los pagos huérfanos (user_id a null). El documento lo
-- prohíbe (§13.7). Dos guardas, porque hay dos puertas:
--   · sobre auth.users, ANTES de que corran las cascadas: si solo se comprobara
--     en profiles, la cascada de memberships podría borrar la prueba del
--     historial antes de preguntar por ella;
--   · sobre profiles, para quien borre la fila directamente.
-- `security definer` porque quien borra en auth.users es el rol de GoTrue, que no
-- lee las tablas de public: sin él, la guarda fallaría para cualquier cuenta.
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
$$;

revoke all on function public.tiene_historial_de_socio(uuid) from public, anon, authenticated;

create or replace function public.cuenta_de_socio_no_se_borra()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.tiene_historial_de_socio(old.id) then
    raise exception 'La cuenta % es de un socio con historial (membresías, pagos, consentimientos o notas): archívalo en lugar de borrarlo', old.id
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
    raise exception 'El socio % tiene historial (membresías, pagos, consentimientos o notas): archívalo en lugar de borrarlo', old.user_id
      using errcode = 'restrict_violation';
  end if;
  return old;
end;
$$;

drop trigger if exists auth_users_socio_no_se_borra on auth.users;
create trigger auth_users_socio_no_se_borra
  before delete on auth.users
  for each row execute function public.cuenta_de_socio_no_se_borra();

drop trigger if exists profiles_socio_no_se_borra on profiles;
create trigger profiles_socio_no_se_borra
  before delete on profiles
  for each row execute function public.perfil_de_socio_no_se_borra();

-- ── Coincidencias para el aviso de duplicados ────────────────────────────────
-- Compara contra TODOS los miembros, archivados incluidos (§13.7). El correo no
-- se copia en profiles: vive en auth.users, que es la cuenta con la que el socio
-- entra, y una copia se desincronizaría el día que lo cambie.
create or replace function public.miembros_coincidentes(
  p_documento text,
  p_email text,
  p_excluir uuid default null
)
returns table (
  user_id uuid,
  nombre_completo text,
  estado_miembro text,
  por_documento boolean,
  por_email boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with buscado as (
    select public.normalizar_documento(p_documento) as doc,
           public.normalizar_email(p_email) as email
  )
  select p.user_id,
         p.nombre_completo,
         p.estado_miembro,
         coalesce(p.documento_normalizado = b.doc, false),
         coalesce(public.normalizar_email(u.email) = b.email, false)
    from public.profiles p
    join buscado b on true
    left join auth.users u on u.id = p.user_id
   where p.user_id is distinct from p_excluir
     and (p.documento_normalizado = b.doc or public.normalizar_email(u.email) = b.email)
   order by p.nombre_completo
   limit 10
$$;

revoke all on function public.miembros_coincidentes(text, text, uuid) from public, anon, authenticated;
grant execute on function public.miembros_coincidentes(text, text, uuid) to service_role;

-- Etiquetas en uso, para el filtro del listado (los archivados no cuentan).
create or replace function public.etiquetas_en_uso()
returns table (etiqueta text, socios bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select e.etiqueta, count(*)
    from public.profiles p
   cross join lateral unnest(p.etiquetas) as e (etiqueta)
   where p.estado_miembro <> 'archivado'
   group by e.etiqueta
   order by e.etiqueta
$$;

revoke all on function public.etiquetas_en_uso() from public, anon, authenticated;
grant execute on function public.etiquetas_en_uso() to service_role;

-- ── Alta atómica: perfil y consentimientos, o nada ───────────────────────────
-- La cuenta se crea antes en Auth (API de GoTrue, fuera de esta transacción). Si
-- esta función falla, el server borra esa cuenta recién nacida, que todavía no
-- tiene historial y por eso la guarda de borrado la deja ir. Perfil y
-- consentimientos van juntos para que nunca quede un socio a medias.
-- `p_exigir_obligatorios` es falso en la importación: un socio importado no
-- aceptó nada ante nadie, así que nace con los consentimientos pendientes.
create or replace function public.alta_miembro(
  p_user_id uuid,
  p_perfil jsonb,
  p_origen text,
  p_estado text,
  p_consentimientos text[],
  p_medio text,
  p_evidencia text,
  p_registrado_por uuid,
  p_exigir_obligatorios boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_aceptados text[] := coalesce(p_consentimientos, '{}');
  v_desconocidos text;
  v_faltan text;
begin
  select string_agg(v.codigo, ', ' order by v.codigo) into v_desconocidos
    from unnest(v_aceptados) as v (codigo)
   where not exists (select 1 from public.consent_documents d where d.codigo = v.codigo);
  if v_desconocidos is not null then
    raise exception 'Documento de consentimiento desconocido: %', v_desconocidos
      using errcode = 'check_violation';
  end if;

  -- La obligatoriedad es la de la versión VIGENTE de cada documento.
  if p_exigir_obligatorios then
    select string_agg(d.titulo, ', ' order by d.titulo) into v_faltan
      from public.consent_documents d
     where d.obligatorio
       and d.codigo <> all (v_aceptados)
       and d.version = (select max(x.version) from public.consent_documents x where x.codigo = d.codigo);
    if v_faltan is not null then
      raise exception 'Faltan consentimientos obligatorios: %', v_faltan
        using errcode = 'check_violation';
    end if;
  end if;

  insert into public.profiles (
    user_id, nombre_completo, fecha_nacimiento, documento, telefono,
    emergencia1_nombre, emergencia1_telefono, emergencia2_nombre, emergencia2_telefono,
    entrenado_antes, condiciones_medicas, origen, estado_miembro, estado_cambiado_en
  ) values (
    p_user_id,
    p_perfil ->> 'nombre_completo',
    (p_perfil ->> 'fecha_nacimiento')::date,
    p_perfil ->> 'documento',
    p_perfil ->> 'telefono',
    p_perfil ->> 'emergencia1_nombre',
    p_perfil ->> 'emergencia1_telefono',
    p_perfil ->> 'emergencia2_nombre',
    p_perfil ->> 'emergencia2_telefono',
    coalesce((p_perfil ->> 'entrenado_antes')::boolean, false),
    p_perfil ->> 'condiciones_medicas',
    p_origen,
    p_estado,
    now()
  );

  -- Cada código aceptado se registra en su versión VIGENTE (la de número mayor).
  insert into public.member_consents (user_id, documento_id, medio, evidencia, registrado_por)
  select p_user_id, d.id, p_medio, p_evidencia, p_registrado_por
    from public.consent_documents d
   where d.codigo = any (v_aceptados)
     and d.version = (select max(x.version) from public.consent_documents x where x.codigo = d.codigo);
end;
$$;

revoke all on function public.alta_miembro(uuid, jsonb, text, text, text[], text, text, uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.alta_miembro(uuid, jsonb, text, text, text[], text, text, uuid, boolean)
  to service_role;

-- ── Verificación ─────────────────────────────────────────────────────────────
-- (a) Cómo quedaron clasificados los socios que ya existían
select estado_miembro, origen, count(*) as socios from profiles group by 1, 2 order by 1, 2;
-- (b) Documentos de consentimiento vigentes
select codigo, version, titulo, obligatorio from consent_documents order by codigo, version;
-- (c) Guardas instaladas
select tgname, tgrelid::regclass as tabla
  from pg_trigger
 where tgname in (
   'auth_users_socio_no_se_borra', 'profiles_socio_no_se_borra',
   'member_consents_solo_agregar', 'member_notes_solo_agregar', 'consent_documents_congelada'
 )
 order by 1;
