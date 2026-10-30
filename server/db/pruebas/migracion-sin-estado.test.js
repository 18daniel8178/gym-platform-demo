const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// El SQL Editor de Supabase ejecuta un script sentencia por sentencia, cada una
// con su propio commit y sin garantía de reutilizar la conexión. Una migración
// que dependa de estado de sesión —una tabla temporal, un SET— funciona con
// `psql -f` y falla en el editor.
//
// Ya pasó: el seed usaba `create temporary table ... on commit drop` y en el
// editor la tabla moría justo después de crearse ("relation does not exist").
// Esta prueba fija la regla sin tocar la base; verificar-migracion.sh la
// comprueba además contra un Postgres real, una conexión por sentencia.

const MIGRACIONES = path.resolve(__dirname, '..');

// Rompen de verdad en el editor: el objeto no llega a la sentencia siguiente.
const ESTADO_DE_SESION = [
  { patron: /create\s+(global\s+|local\s+)?temp(orary)?\s+table/i, motivo: 'tabla temporal' },
  // Un `set` de sesión al margen izquierdo; el SET de un UPDATE va indentado y
  // el `set search_path` de una función es parte de su definición.
  { patron: /^set\s+(?!search_path)/im, motivo: 'SET de sesión' },
];

// BEGIN/COMMIT no rompe —cada sentencia se aplica igual— pero promete una
// atomicidad que el editor no da. Solo se exige a las migraciones escritas ya
// con esta regla: las anteriores están aplicadas en producción y no se
// reescriben (lo que no se toca, no se refactoriza de pasada).
const SIN_TRANSACCION_PROPIA = ['2026_08_rbac.sql', '2026_08_ajustes.sql', '2026_09_sucursal.sql'];
const TRANSACCION = [
  { patron: /^begin\s*;/im, motivo: 'BEGIN' },
  { patron: /^commit\s*;/im, motivo: 'COMMIT' },
];

const archivos = fs
  .readdirSync(MIGRACIONES)
  .filter((f) => f.endsWith('.sql'))
  .map((f) => ({ nombre: f, sql: fs.readFileSync(path.join(MIGRACIONES, f), 'utf8') }));

const incumple = (sql, reglas) => reglas.filter(({ patron }) => patron.test(sql)).map(({ motivo }) => motivo);

test('hay migraciones que revisar', () => {
  assert.ok(archivos.length >= 3, `esperaba los .sql de server/db, encontré ${archivos.length}`);
});

for (const { nombre, sql } of archivos) {
  test(`${nombre} no depende de estado de sesión`, () => {
    assert.deepEqual(
      incumple(sql, ESTADO_DE_SESION),
      [],
      `${nombre} usa algo que el SQL Editor no conserva entre sentencias`
    );
  });
}

for (const nombre of SIN_TRANSACCION_PROPIA) {
  test(`${nombre} no abre una transacción que el editor no puede mantener`, () => {
    const sql = archivos.find((a) => a.nombre === nombre)?.sql;
    assert.ok(sql, `no encontré ${nombre}`);
    assert.deepEqual(incumple(sql, TRANSACCION), []);
  });
}
