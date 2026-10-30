const { test } = require('node:test');
const assert = require('node:assert/strict');
const catalogos = require('./catalogos');
const { normalizarEtiquetas } = require('../modules/members/etiquetas');

test('ningún catálogo tiene entradas repetidas ni vacías', () => {
  for (const [nombre, lista] of Object.entries(catalogos)) {
    assert.ok(lista.length > 0, `${nombre} está vacío`);
    assert.equal(new Set(lista).size, lista.length, `${nombre} repite entradas`);
    assert.ok(lista.every((x) => typeof x === 'string' && x.trim() === x && x), `${nombre} tiene entradas mal formadas`);
  }
});

test('hay variedad suficiente para ~150 socios sin repetir nombres a cada paso', () => {
  const combinaciones = (catalogos.NOMBRES_F.length + catalogos.NOMBRES_M.length) * catalogos.APELLIDOS.length ** 2;
  assert.ok(combinaciones > 50000, `solo ${combinaciones} nombres completos distintos`);
});

test('las etiquetas pasan la misma validación que el panel aplica', () => {
  const r = normalizarEtiquetas([...catalogos.ETIQUETAS]);
  assert.equal(r.ok, true, r.error);
  assert.deepEqual(r.etiquetas, [...catalogos.ETIQUETAS]); // ya vienen normalizadas
});

test('los motivos caben en el tope de 300 caracteres del estado', () => {
  for (const m of [...catalogos.MOTIVOS_BLOQUEO, ...catalogos.MOTIVOS_ARCHIVO, ...catalogos.MOTIVOS_INACTIVO]) {
    assert.ok(m.length <= 300, m);
  }
});

test('los catálogos no se pueden alterar en caliente', () => {
  for (const lista of Object.values(catalogos)) assert.ok(Object.isFrozen(lista));
});
