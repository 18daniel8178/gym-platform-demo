-- FORJA GYM - Formulario de ingreso (perfiles de socio)
-- Ejecutar en Supabase: Dashboard > SQL Editor > New query > pegar y Run

create table if not exists profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  nombre_completo text not null,
  fecha_nacimiento date not null,
  documento text not null,
  telefono text not null,
  emergencia1_nombre text not null,
  emergencia1_telefono text not null,
  emergencia2_nombre text not null,
  emergencia2_telefono text not null,
  entrenado_antes boolean not null default false,
  condiciones_medicas text, -- vacío = ninguna
  -- El ingreso se completa en el gym: firma del formulario y foto del socio
  firma_foto_pendiente boolean not null default true,
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

-- Cada usuario solo puede ver y crear su propia fila
create policy "perfil propio select" on profiles for select using (auth.uid() = user_id);
create policy "perfil propio insert" on profiles for insert with check (auth.uid() = user_id);

-- Endurecimiento: el insert del cliente solo
-- puede nombrar las columnas del formulario de ingreso; firma_foto_pendiente y
-- created_at toman siempre sus valores por defecto. Nota Postgres: un grant de
-- tabla no se recorta con revoke por columna — por eso revoke total + lista blanca.
revoke insert on profiles from authenticated, anon;
grant insert (
  user_id, nombre_completo, fecha_nacimiento, documento, telefono,
  emergencia1_nombre, emergencia1_telefono, emergencia2_nombre, emergencia2_telefono,
  entrenado_antes, condiciones_medicas
) on profiles to authenticated;
