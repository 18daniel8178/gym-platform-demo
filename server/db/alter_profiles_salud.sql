-- Migración: agrega salud y experiencia al formulario de ingreso
-- Ejecutar en Supabase: Dashboard > SQL Editor (solo si ya creaste la tabla profiles antes)

alter table profiles
  add column if not exists entrenado_antes boolean not null default false,
  add column if not exists condiciones_medicas text;
