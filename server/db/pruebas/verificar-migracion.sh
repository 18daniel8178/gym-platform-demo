#!/usr/bin/env bash
# Valida las migraciones SQL contra un Postgres real ANTES de tocar producción.
#
#   Local:  bash server/db/pruebas/verificar-migracion.sh   (levanta un contenedor)
#   CI:     DATABASE_URL=postgres://... bash server/db/pruebas/verificar-migracion.sh
#
# Qué comprueba:
#   1. Que cada migración aplica sobre un Postgres limpio EJECUTÁNDOLA COMO EL
#      SQL EDITOR DE SUPABASE: una sentencia por conexión, cada una con su propio
#      commit. Correrlas con `psql -f` no vale como prueba —mantiene sesión y
#      transacción— y por eso se coló una migración con una tabla temporal que en
#      el editor moría nada más crearse.
#   2. Que son idempotentes: se aplican DOS veces, en orden.
#   3. Que se comportan como el server espera (los archivos de casos).
set -euo pipefail

AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DB="$AQUI/.."
CONTENEDOR="forja-migracion-test"
SENTENCIAS="$AQUI/.sentencias"
export MSYS_NO_PATHCONV=1 # Git Bash no debe reescribir las rutas DENTRO del contenedor
# ...pero las del host sí hay que traducirlas para el docker de Windows
ruta_host() { if command -v cygpath >/dev/null 2>&1; then cygpath -w "$1"; else echo "$1"; fi; }

# Lista EXPLÍCITA y en orden de aplicación, compartida con la demo local: vive en
# server/db/migraciones.txt (no un `ls`: el orden importa y una migración nueva
# debe añadirse a conciencia, no colarse sola). Se ignoran comentarios, líneas
# vacías y un posible \r de un editor de Windows.
mapfile -t MIGRACIONES < <(tr -d '\r' < "$DB/migraciones.txt" | grep -v -E '^[[:space:]]*(#|$)')
[ "${#MIGRACIONES[@]}" -gt 0 ] || { echo "server/db/migraciones.txt no lista ninguna migración"; exit 1; }
CASOS=(
  "casos_rbac.sql"
  "casos_ajustes.sql"
  "casos_sucursal.sql"
  "casos_miembros.sql"
  "casos_checkin.sql"
)

limpiar_sentencias() { rm -rf "$SENTENCIAS"; }

# Parte una migración en sentencias sueltas y las deja en $SENTENCIAS/NNN.sql.
partir() {
  node "$(ruta_host "$AQUI/dividir-sentencias.js")" "$(ruta_host "$1")" "$(ruta_host "$SENTENCIAS")"
}

# ── Modo CI: hay un Postgres accesible por DATABASE_URL ──────────────────────
if [ -n "${DATABASE_URL:-}" ]; then
  trap limpiar_sentencias EXIT
  correr() { psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f "$1" > /dev/null; }

  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f "$AQUI/fixture_supabase.sql"
  for pasada in 1 2; do
    for m in "${MIGRACIONES[@]}"; do
      total=$(partir "$DB/$m")
      echo "→ $m, pasada $pasada ($total sentencias, una conexión por sentencia)"
      for s in "$SENTENCIAS"/*.sql; do correr "$s"; done
    done
  done
  for c in "${CASOS[@]}"; do
    echo "→ $c"
    psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f "$AQUI/$c"
  done
  exit 0
fi

# ── Modo local: contenedor desechable ────────────────────────────────────────
command -v docker >/dev/null || { echo "Falta docker (o exporta DATABASE_URL)"; exit 1; }

limpiar() { docker rm -f "$CONTENEDOR" >/dev/null 2>&1 || true; limpiar_sentencias; }
trap limpiar EXIT
docker rm -f "$CONTENEDOR" >/dev/null 2>&1 || true

docker run -d --name "$CONTENEDOR" -e POSTGRES_PASSWORD=postgres postgres:16-alpine >/dev/null
for _ in $(seq 1 30); do
  docker exec "$CONTENEDOR" pg_isready -U postgres >/dev/null 2>&1 && break
  sleep 1
done

correr() { # correr <archivo-host> [--callado]
  docker cp "$(ruta_host "$1")" "$CONTENEDOR:/tmp/actual.sql"
  if [ "${2:-}" = "--callado" ]; then
    docker exec "$CONTENEDOR" psql -U postgres -v ON_ERROR_STOP=1 -q -f /tmp/actual.sql > /dev/null
  else
    docker exec "$CONTENEDOR" psql -U postgres -v ON_ERROR_STOP=1 -q -f /tmp/actual.sql
  fi
}

correr "$AQUI/fixture_supabase.sql" --callado
for pasada in 1 2; do
  for m in "${MIGRACIONES[@]}"; do
    total=$(partir "$DB/$m")
    echo "→ $m, pasada $pasada ($total sentencias, una conexión por sentencia)"
    for s in "$SENTENCIAS"/*.sql; do correr "$s" --callado; done
  done
done
for c in "${CASOS[@]}"; do
  echo "→ $c"
  correr "$AQUI/$c"
done
