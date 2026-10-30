const { test } = require('node:test');
const assert = require('node:assert/strict');
const { estaAbierto, paraSitioPublico, fechaPanama, diaSemanaPanama } = require('./horario');

// El gimnasio abre en hora de Panamá y el servidor corre en UTC: si estas
// pruebas pasan es porque la zona se aplica de verdad, no por casualidad.
// Un lunes a las 10:00 de Panamá son las 15:00 UTC.
const LUNES_10AM = new Date('2026-08-24T15:00:00Z');
const LUNES_11PM = new Date('2026-08-25T04:00:00Z'); // lunes 23:00 en Panamá
const DOMINGO_10AM = new Date('2026-08-23T15:00:00Z');

const HORARIO = {
  dias: [
    { dow: 1, abre: '05:00', cierra: '22:00', cerrado: false },
    { dow: 7, cerrado: true },
  ],
  cierres: [{ fecha: '2026-08-24', motivo: 'Feriado' }],
};

const sinCierres = { ...HORARIO, cierres: [] };

test('la fecha y el día se calculan en hora de Panamá, no en UTC', () => {
  // 04:00 UTC del martes es todavía lunes por la noche en Panamá (UTC-5).
  assert.equal(fechaPanama(LUNES_11PM), '2026-08-24');
  assert.equal(diaSemanaPanama(LUNES_11PM), 1);
});

test('dentro del horario, abierto', () => {
  assert.deepEqual(estaAbierto(LUNES_10AM, sinCierres), { abierto: true, motivo: null });
});

test('fuera del horario, cerrado con el motivo', () => {
  const r = estaAbierto(LUNES_11PM, sinCierres);
  assert.equal(r.abierto, false);
  assert.match(r.motivo, /Fuera del horario \(05:00 a 22:00\)/);
});

test('un día marcado cerrado no abre', () => {
  const r = estaAbierto(DOMINGO_10AM, sinCierres);
  assert.equal(r.abierto, false);
  assert.match(r.motivo, /no abre ese día/);
});

test('un cierre excepcional manda sobre el horario del día', () => {
  const r = estaAbierto(LUNES_10AM, HORARIO);
  assert.equal(r.abierto, false);
  assert.equal(r.motivo, 'Feriado', 'el socio debe ver el motivo del cierre');
});

test('sin horario configurado se cae al de por defecto, nunca a "cerrado siempre"', () => {
  assert.equal(estaAbierto(LUNES_10AM, { dias: [], cierres: [] }).abierto, true);
  assert.equal(estaAbierto(LUNES_10AM, null).abierto, true);
});

test('el sitio público recibe los días con nombre y los cerrados marcados', () => {
  const filas = paraSitioPublico(HORARIO);
  const lunes = filas.find((f) => f.dia === 'Lunes');
  const domingo = filas.find((f) => f.dia === 'Domingo');
  assert.deepEqual(lunes, { dia: 'Lunes', abre: '05:00', cierra: '22:00', cerrado: false });
  assert.deepEqual(domingo, { dia: 'Domingo', abre: null, cierra: null, cerrado: true });
});

test('el sitio público nunca se queda sin horarios', () => {
  assert.equal(paraSitioPublico({ dias: [] }).length, 7);
  assert.equal(paraSitioPublico(null).length, 7);
});
