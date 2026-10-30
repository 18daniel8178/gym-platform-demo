const { test } = require('node:test');
const assert = require('node:assert/strict');
const { normalizarEtiquetas } = require('./etiquetas');

test('normaliza mayúsculas y espacios y quita las repetidas, conservando el orden', () => {
  const r = normalizarEtiquetas(['  Corporativo ', 'corporativo', 'Turno   MAÑANA']);
  assert.deepEqual(r, { ok: true, etiquetas: ['corporativo', 'turno mañana'] });
});

test('una lista vacía es válida: así se quitan todas', () => {
  assert.deepEqual(normalizarEtiquetas([]), { ok: true, etiquetas: [] });
});

test('las entradas en blanco se ignoran (la coma de más del formulario)', () => {
  assert.deepEqual(normalizarEtiquetas(['', '   ', 'vip']), { ok: true, etiquetas: ['vip'] });
});

test('tiene que ser una lista de textos', () => {
  assert.equal(normalizarEtiquetas('vip').ok, false);
  assert.equal(normalizarEtiquetas(undefined).ok, false);
  assert.equal(normalizarEtiquetas(['vip', 3]).ok, false);
});

test('una etiqueta admite hasta 30 caracteres', () => {
  assert.equal(normalizarEtiquetas(['a'.repeat(30)]).ok, true);
  const r = normalizarEtiquetas(['a'.repeat(31)]);
  assert.equal(r.ok, false);
  assert.match(r.error, /30/);
});

test('solo letras, números, espacios y guiones', () => {
  assert.equal(normalizarEtiquetas(['pre-venta 2026']).ok, true);
  const r = normalizarEtiquetas(['vip<b>']);
  assert.equal(r.ok, false);
  assert.match(r.error, /letras/);
  assert.equal(normalizarEtiquetas(['-suelta']).ok, false); // tiene que empezar por letra o número
});

test('como mucho 20 por socio, contadas después de quitar repetidas', () => {
  const veinte = Array.from({ length: 20 }, (_, i) => `e${i}`);
  assert.equal(normalizarEtiquetas(veinte).ok, true);
  assert.equal(normalizarEtiquetas([...veinte, 'E0', 'e1']).ok, true); // repetidas no cuentan

  const r = normalizarEtiquetas([...veinte, 'una más']);
  assert.equal(r.ok, false);
  assert.match(r.error, /20/);
});
