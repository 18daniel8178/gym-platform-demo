const { test } = require('node:test');
const assert = require('node:assert/strict');
const { calcularAforo, correccionPara } = require('./aforo');

// El aforo deja de ser un número tecleado: sale de las entradas permitidas del
// día más una corrección manual, que es lo que el personal hace hoy cuando ve
// salir gente. La corrección vale para SU día; mañana el conteo arranca limpio.

const HOY = '2026-10-06';

test('sin entradas ni corrección, el gimnasio está vacío', () => {
  assert.equal(calcularAforo({ entradas: 0, ajuste: 0, ajusteFecha: null, hoy: HOY }), 0);
});

test('cuenta las entradas del día', () => {
  assert.equal(calcularAforo({ entradas: 14, ajuste: 0, ajusteFecha: HOY, hoy: HOY }), 14);
});

test('la corrección de hoy suma o resta', () => {
  assert.equal(calcularAforo({ entradas: 14, ajuste: -6, ajusteFecha: HOY, hoy: HOY }), 8);
  assert.equal(calcularAforo({ entradas: 14, ajuste: 3, ajusteFecha: HOY, hoy: HOY }), 17);
});

test('la corrección de ayer no arrastra al día de hoy', () => {
  assert.equal(calcularAforo({ entradas: 5, ajuste: -20, ajusteFecha: '2026-10-05', hoy: HOY }), 5);
});

test('el aforo nunca baja de cero', () => {
  assert.equal(calcularAforo({ entradas: 2, ajuste: -10, ajusteFecha: HOY, hoy: HOY }), 0);
});

test('cuando el personal dice cuánta gente hay, se guarda la diferencia', () => {
  const entradas = 14;
  const correccion = correccionPara({ objetivo: 9, entradas });
  assert.equal(correccion, -5);
  // Y al volver a calcular, da exactamente lo que el personal dijo.
  assert.equal(calcularAforo({ entradas, ajuste: correccion, ajusteFecha: HOY, hoy: HOY }), 9);
});
