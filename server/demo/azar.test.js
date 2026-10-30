const { test } = require('node:test');
const assert = require('node:assert/strict');
const { crearAzar } = require('./azar');

const secuencia = (azar, n) => Array.from({ length: n }, () => azar.siguiente());

test('la misma semilla da exactamente la misma secuencia', () => {
  assert.deepEqual(secuencia(crearAzar(2026), 50), secuencia(crearAzar(2026), 50));
});

test('otra semilla da otra secuencia', () => {
  assert.notDeepEqual(secuencia(crearAzar(1), 20), secuencia(crearAzar(2), 20));
});

test('siguiente() vive en [0, 1)', () => {
  for (const x of secuencia(crearAzar(7), 5000)) assert.ok(x >= 0 && x < 1, String(x));
});

test('entero(min, max) incluye ambos extremos y nada fuera', () => {
  const azar = crearAzar(3);
  const vistos = new Set(Array.from({ length: 2000 }, () => azar.entero(1, 6)));
  assert.deepEqual([...vistos].sort(), [1, 2, 3, 4, 5, 6]);
});

test('elegir() recorre la lista entera y nunca devuelve undefined', () => {
  const azar = crearAzar(4);
  const lista = ['a', 'b', 'c'];
  const vistos = new Set(Array.from({ length: 300 }, () => azar.elegir(lista)));
  assert.deepEqual([...vistos].sort(), lista);
});

test('ponderado() respeta los pesos (con tolerancia)', () => {
  const azar = crearAzar(5);
  const n = 20000;
  const cuenta = { comun: 0, raro: 0 };
  for (let i = 0; i < n; i++) cuenta[azar.ponderado([['comun', 9], ['raro', 1]])] += 1;
  assert.ok(Math.abs(cuenta.raro / n - 0.1) < 0.01, `raro salió ${cuenta.raro / n}`);
});

test('probabilidad(p) acierta más o menos p de las veces', () => {
  const azar = crearAzar(6);
  const n = 20000;
  let si = 0;
  for (let i = 0; i < n; i++) if (azar.probabilidad(0.3)) si += 1;
  assert.ok(Math.abs(si / n - 0.3) < 0.015, `salió ${si / n}`);
});

test('una lista vacía o pesos en cero son un error, no un undefined silencioso', () => {
  const azar = crearAzar(8);
  assert.throws(() => azar.elegir([]), /vacía/);
  assert.throws(() => azar.ponderado([['x', 0]]), /peso/);
});

test('un peso ausente (suma NaN) también es un error', () => {
  assert.throws(() => crearAzar(9).ponderado([['x', undefined]]), /peso/);
});
