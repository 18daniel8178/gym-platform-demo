const { test } = require('node:test');
const assert = require('node:assert/strict');
const { evaluarCheckin, MOTIVOS } = require('./decision');

// La decisión de dejar entrar a alguien. Es pura: el estado del socio, su
// membresía, el horario y su última entrada llegan como argumento, así que cada
// motivo de rechazo se prueba sin base de datos.
//
// El orden de evaluación es FIJO: un caso que incumple varias reglas a la vez
// tiene que dar siempre el mismo código, o el reporte del día no significa nada.

// Martes 10:00 en Panamá, con el gimnasio abierto de 5 a 22 todos los días.
const AHORA = '2026-10-13T10:00:00-05:00';
const HOY = '2026-10-13';
const HORARIO = { dias: [1, 2, 3, 4, 5, 6, 7].map((dow) => ({ dow, abre: '05:00', cierra: '22:00' })) };

const caso = (extra = {}) => evaluarCheckin({
  socio: { estado_miembro: 'activo' },
  membresia: { fecha_fin: '2026-10-31' },
  ultimaEntrada: null,
  horario: HORARIO,
  ahora: AHORA,
  ventanaMinutos: 120,
  ...extra,
});

test('socio activo, membresía vigente y dentro del horario: entra', () => {
  const r = caso();
  assert.equal(r.decision, 'permitir');
  assert.equal(r.motivo, 'permitido');
  assert.equal(r.mensaje, MOTIVOS.permitido);
});

test('el día en que vence la membresía todavía entra', () => {
  assert.equal(caso({ membresia: { fecha_fin: HOY } }).decision, 'permitir');
});

test('un socio bloqueado no entra, aunque su membresía esté al día', () => {
  const r = caso({ socio: { estado_miembro: 'bloqueado' } });
  assert.equal(r.decision, 'rechazar');
  assert.equal(r.motivo, 'socio_bloqueado');
});

test('un socio archivado no entra', () => {
  assert.equal(caso({ socio: { estado_miembro: 'archivado' } }).motivo, 'socio_archivado');
});

test('un socio inactivo con membresía vigente SÍ entra: inactivo es una etiqueta del personal, no un bloqueo', () => {
  assert.equal(caso({ socio: { estado_miembro: 'inactivo' } }).decision, 'permitir');
});

test('sin membresía, no entra', () => {
  assert.equal(caso({ membresia: null }).motivo, 'sin_membresia');
});

test('con la membresía vencida, no entra', () => {
  const r = caso({ membresia: { fecha_fin: '2026-10-12' } });
  assert.equal(r.decision, 'rechazar');
  assert.equal(r.motivo, 'membresia_vencida');
  assert.match(r.mensaje, /renovar/i);
});

test('con la membresía congelada, no entra', () => {
  // El congelamiento llega con el Bloque 4; la regla ya está lista para cuando
  // la membresía traiga ese estado.
  assert.equal(caso({ membresia: { fecha_fin: '2026-10-31', estado: 'congelada' } }).motivo, 'membresia_congelada');
});

test('sin entradas disponibles en el plan, no entra', () => {
  // Igual que el congelamiento: el cupo por plan llega con el Bloque 4.
  assert.equal(caso({ membresia: { fecha_fin: '2026-10-31', entradas_restantes: 0 } }).motivo, 'sin_entradas');
  assert.equal(caso({ membresia: { fecha_fin: '2026-10-31', entradas_restantes: 3 } }).decision, 'permitir');
});

test('fuera del horario del gimnasio, no entra, y el mensaje dice cuál es el horario', () => {
  const r = caso({ ahora: '2026-10-13T23:30:00-05:00' });
  assert.equal(r.decision, 'rechazar');
  assert.equal(r.motivo, 'fuera_de_horario');
  assert.match(r.mensaje, /05:00/);
  assert.match(r.mensaje, /22:00/);
});

test('un día cerrado tampoco deja entrar, con su motivo', () => {
  const cerrado = { dias: HORARIO.dias.map((d) => (d.dow === 2 ? { ...d, cerrado: true } : d)) };
  const r = caso({ horario: cerrado });
  assert.equal(r.motivo, 'fuera_de_horario');
  assert.match(r.mensaje, /no abre/i);
});

test('si ya registró su entrada hace poco, no se registra otra', () => {
  const r = caso({ ultimaEntrada: { ocurrido_en: '2026-10-13T09:30:00-05:00' } });
  assert.equal(r.decision, 'ya_dentro');
  assert.equal(r.motivo, 'ya_registrado');
});

test('pasada la ventana, el intento se evalúa como uno nuevo', () => {
  const r = caso({ ultimaEntrada: { ocurrido_en: '2026-10-13T07:30:00-05:00' } });
  assert.equal(r.decision, 'permitir');
});

test('con la ventana en cero, el anti doble-entrada queda apagado', () => {
  const r = caso({ ultimaEntrada: { ocurrido_en: '2026-10-13T09:59:00-05:00' }, ventanaMinutos: 0 });
  assert.equal(r.decision, 'permitir');
});

test('ante varias causas a la vez, siempre gana la misma y en el mismo orden', () => {
  const todo = {
    socio: { estado_miembro: 'bloqueado' },
    membresia: { fecha_fin: '2026-01-01', estado: 'congelada' },
    ahora: '2026-10-13T23:30:00-05:00',
  };
  assert.equal(caso(todo).motivo, 'socio_bloqueado');
  // Sin el bloqueo, manda el estado de la membresía antes que el horario.
  assert.equal(caso({ ...todo, socio: { estado_miembro: 'activo' } }).motivo, 'membresia_congelada');
  assert.equal(caso({ ...todo, socio: { estado_miembro: 'activo' }, membresia: { fecha_fin: '2026-01-01' } }).motivo, 'membresia_vencida');
});

test('todo motivo que la decisión puede devolver tiene su mensaje en español', () => {
  for (const [codigo, mensaje] of Object.entries(MOTIVOS)) {
    assert.match(codigo, /^[a-z][a-z0-9_]{2,40}$/, codigo); // el CHECK de la base
    assert.ok(typeof mensaje === 'string' && mensaje.length > 5, codigo);
  }
});
