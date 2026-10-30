const { test } = require('node:test');
const assert = require('node:assert/strict');
const { desfaseDe, inicioDelDia, finDelDia } = require('./zona');

test('el desfase sale de la zona, no de una constante', () => {
  assert.equal(desfaseDe('America/Panama', '2026-09-01'), '-05:00');
  assert.equal(desfaseDe('America/Mexico_City', '2026-09-01'), '-06:00');
  assert.equal(desfaseDe('UTC', '2026-09-01'), '+00:00');
});

// Nueva York cambia de -04:00 a -05:00 el primer domingo de noviembre: por eso
// el desfase se calcula PARA ESE DÍA y no una vez al arrancar.
test('el horario de verano se respeta día a día', () => {
  assert.equal(desfaseDe('America/New_York', '2026-08-01'), '-04:00');
  assert.equal(desfaseDe('America/New_York', '2026-12-01'), '-05:00');
});

// Sin zona o con una inválida se usa el desfase de Panamá, NUNCA el de la
// máquina: el CI corre en UTC y Vercel también, así que delegar en Intl con
// timeZone undefined haría que el día del negocio dependiera del servidor.
test('una zona inválida o ausente no hereda la del servidor', () => {
  assert.equal(desfaseDe('Marte/Olympus', '2026-09-01'), '-05:00');
  assert.equal(desfaseDe(undefined, '2026-09-01'), '-05:00');
  assert.equal(desfaseDe('', '2026-09-01'), '-05:00');
  assert.equal(desfaseDe(null, '2026-09-01'), '-05:00');
});

test('los límites del día son los de la sucursal', () => {
  assert.equal(inicioDelDia('2026-09-01', 'America/Panama'), '2026-09-01T00:00:00-05:00');
  assert.equal(finDelDia('2026-09-01', 'America/Panama'), '2026-09-01T23:59:59-05:00');
  assert.equal(inicioDelDia('2026-09-01', 'America/Mexico_City'), '2026-09-01T00:00:00-06:00');
});

// Lo que motivó el cambio: con el -05:00 clavado, un cambio guardado a las 23:30
// en una sucursal UTC-6 se pintaba con fecha D pero el filtro de D no lo cogía.
test('un cambio de las 23:30 en UTC-6 cae dentro de su propio día', () => {
  const guardado = new Date('2026-09-02T05:30:00Z'); // 23:30 del día 1 en UTC-6
  const desde = new Date(inicioDelDia('2026-09-01', 'America/Mexico_City'));
  const hasta = new Date(finDelDia('2026-09-01', 'America/Mexico_City'));
  assert.ok(guardado >= desde && guardado <= hasta, 'el filtro del día 1 debía incluirlo');

  const conPanamaClavado = new Date('2026-09-01T23:59:59-05:00');
  assert.ok(guardado > conPanamaClavado, 'con -05:00 fijo se quedaba fuera, que era el fallo');
});
