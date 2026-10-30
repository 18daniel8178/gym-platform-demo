-- FORJA GYM - RLS de memberships
-- OBSOLETO COMO INSTALADOR (change endurecer-rls-memberships, 2026-08).
--
-- Este archivo creaba las políticas de escritura del cliente sobre memberships
-- para el pago simulado original. Desde D13 la activación de membresías ocurre
-- únicamente en el server (service role) y esas políticas fueron ELIMINADAS:
-- con ellas vigentes, cualquier socio autenticado podía auto-activarse la
-- membresía vía PostgREST sin pagar.
--
-- En una instalación antigua que aún las tenga, ejecutar:
drop policy if exists "membresia propia insert" on memberships;
drop policy if exists "membresia propia update" on memberships;

-- El select de fila propia ("membresia propia") definido en schema.sql se conserva.
-- Instalaciones nuevas: usar schema.sql (ya nace endurecido) + seed.sql.
