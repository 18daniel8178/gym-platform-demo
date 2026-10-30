const { test } = require('node:test');
const assert = require('node:assert/strict');
const { lineaDeTiempo, TOPE_EVENTOS } = require('./historial');

// La línea de tiempo del expediente (§13.7) junta lo que pasó en varias tablas:
// la bitácora (alta, estado, correcciones, membresías), los pagos, los
// consentimientos y las notas. El orden es del evento más reciente al más viejo,
// que es como se lee un expediente en recepción.

const PERFIL = { created_at: '2026-01-10T15:00:00Z', origen: 'mostrador' };
const fuentes = (extra = {}) => ({ auditoria: [], pagos: [], consentimientos: [], notas: [], perfil: PERFIL, ...extra });
const ACTOR = 'recepcion@forja.test';
const audit = (accion, created_at, detalle) => ({ accion, created_at, detalle, actor_email: ACTOR });
const tipos = (eventos) => eventos.map((e) => e.tipo);

test('mezcla las fuentes y ordena del evento más reciente al más viejo', () => {
  const { eventos } = lineaDeTiempo(fuentes({
    auditoria: [audit('client.create', '2026-01-10T15:00:00Z', { despues: { origen: 'mostrador' } })],
    pagos: [{ id: 1, created_at: '2026-03-01T14:00:00Z', monto: 45, metodo: 'efectivo', origen: 'recepcion', estado: 'aprobado' }],
    notas: [{ created_at: '2026-02-01T10:00:00Z', texto: 'Pidió rutina de fuerza', autor_email: 'gerente@forja.test' }],
  }), { importes: true });

  assert.deepEqual(tipos(eventos), ['pago', 'nota', 'alta']);
  assert.deepEqual(eventos.map((e) => e.fecha), ['2026-03-01T14:00:00Z', '2026-02-01T10:00:00Z', '2026-01-10T15:00:00Z']);
});

test('el alta trae el actor que la registró', () => {
  const { eventos } = lineaDeTiempo(fuentes({
    auditoria: [audit('client.create', '2026-01-10T15:00:00Z', { despues: { origen: 'mostrador' } })],
  }), { importes: true, actores: true });
  assert.equal(eventos[0].titulo, 'Alta del socio');
  assert.equal(eventos[0].actor, ACTOR);
});

test('un expediente sin bitácora muestra igual su alta, sacada del perfil', () => {
  const { eventos } = lineaDeTiempo(fuentes({ perfil: { created_at: '2026-05-02T12:00:00Z', origen: 'importacion' } }), { importes: true });
  assert.deepEqual(tipos(eventos), ['alta']);
  assert.equal(eventos[0].actor, null);
  assert.match(eventos[0].detalle, /importación/i);
});

test('con permiso financiero el pago muestra su monto; sin permiso, no', () => {
  const pagos = [{ id: 1, created_at: '2026-03-01T14:00:00Z', monto: 45, metodo: 'yappy', origen: 'recepcion', estado: 'aprobado' }];
  const con = lineaDeTiempo(fuentes({ pagos }), { importes: true }).eventos[0];
  const sin = lineaDeTiempo(fuentes({ pagos }), { importes: false }).eventos[0];

  assert.equal(con.monto, 45);
  assert.equal(sin.monto, null);
  // Sin importes conserva fecha y tipo de evento: lo que se oculta es el dinero.
  assert.equal(sin.tipo, 'pago');
  assert.equal(sin.fecha, con.fecha);
  assert.equal(sin.titulo, con.titulo);
  assert.doesNotMatch(JSON.stringify(sin), /45/);
});

test('la activación de membresía también esconde su monto sin permiso financiero', () => {
  const auditoria = [audit('membership.activate', '2026-03-01T14:05:00Z', {
    despues: { plan: '1 Mes', monto: 45, metodo: 'efectivo', fecha_inicio: '2026-03-01', fecha_fin: '2026-03-31' },
  })];
  const con = lineaDeTiempo(fuentes({ auditoria }), { importes: true }).eventos[0];
  const sin = lineaDeTiempo(fuentes({ auditoria }), { importes: false }).eventos[0];

  assert.equal(con.monto, 45);
  assert.match(con.titulo, /1 Mes/);
  assert.equal(sin.monto, null);
  assert.doesNotMatch(JSON.stringify(sin), /45/);
  assert.match(sin.detalle, /2026-03-01/); // las fechas de la membresía sí se ven
});

test('un pago anulado se ve como anulado, con su motivo', () => {
  const { eventos } = lineaDeTiempo(fuentes({
    pagos: [{ id: 9, created_at: '2026-03-01T14:00:00Z', monto: 45, metodo: 'efectivo', origen: 'recepcion', estado: 'anulado', motivo_anulacion: 'Cobro doble' }],
  }), { importes: true });
  assert.match(eventos[0].titulo, /anulado/i);
  assert.match(eventos[0].detalle, /Cobro doble/);
});

test('el cambio de estado dice de qué a qué y por qué', () => {
  const { eventos } = lineaDeTiempo(fuentes({
    auditoria: [audit('member.estado', '2026-06-01T16:00:00Z', {
      antes: { estado_miembro: 'activo', estado_motivo: null },
      despues: { estado_miembro: 'bloqueado', estado_motivo: 'Pago pendiente' },
    })],
  }), { importes: true });
  assert.match(eventos[0].titulo, /activo/);
  assert.match(eventos[0].titulo, /bloqueado/);
  assert.equal(eventos[0].detalle, 'Pago pendiente');
});

test('una corrección de datos dice qué campos cambiaron, no sus valores', () => {
  const { eventos } = lineaDeTiempo(fuentes({
    auditoria: [audit('client.update', '2026-06-02T16:00:00Z', {
      antes: { telefono: '6000-1111', condiciones_medicas: '[oculto]' },
      despues: { telefono: '6999-9999', condiciones_medicas: '[oculto]' },
    })],
  }), { importes: true });
  assert.equal(eventos[0].titulo, 'Corrección de datos');
  assert.match(eventos[0].detalle, /teléfono/i);
  assert.doesNotMatch(eventos[0].detalle, /6999/);
});

test('el consentimiento dice qué documento y qué versión aceptó', () => {
  const { eventos } = lineaDeTiempo(fuentes({
    consentimientos: [{
      aceptado_en: '2026-01-10T15:01:00Z', medio: 'mostrador',
      documento: { codigo: 'reglamento', version: 2, titulo: 'Reglamento interno del gimnasio' },
    }],
  }), { importes: true });
  assert.match(eventos[0].titulo, /Reglamento interno/);
  assert.match(eventos[0].detalle, /[Vv]ersión 2/);
});

test('la nota muestra su texto y quién la escribió', () => {
  const { eventos } = lineaDeTiempo(fuentes({
    notas: [{ created_at: '2026-02-01T10:00:00Z', texto: 'Lesión de rodilla: evitar sentadilla profunda', autor_email: 'gerente@forja.test' }],
  }), { importes: true, actores: true });
  assert.equal(eventos[0].tipo, 'nota');
  assert.equal(eventos[0].detalle, 'Lesión de rodilla: evitar sentadilla profunda');
  assert.equal(eventos[0].actor, 'gerente@forja.test');
});

test('una acción que todavía no tiene texto propio se muestra igual, sin inventar', () => {
  const { eventos } = lineaDeTiempo(fuentes({
    auditoria: [audit('checkin.perform', '2026-07-01T11:00:00Z', { despues: {} })],
  }), { importes: true });
  assert.equal(eventos[0].tipo, 'otro');
  assert.equal(eventos[0].titulo, 'checkin.perform');
});

test('un expediente larguísimo se corta en el tope y lo avisa', () => {
  const pagos = Array.from({ length: TOPE_EVENTOS + 10 }, (_, i) => ({
    id: i, created_at: `2026-03-${String((i % 28) + 1).padStart(2, '0')}T14:00:00Z`, monto: 45, metodo: 'efectivo', origen: 'recepcion', estado: 'aprobado',
  }));
  const { eventos, truncado } = lineaDeTiempo(fuentes({ pagos }), { importes: true });
  assert.equal(eventos.length, TOPE_EVENTOS);
  assert.equal(truncado, true);
  assert.equal(lineaDeTiempo(fuentes({ pagos: pagos.slice(0, 3) }), { importes: true }).truncado, false);
});

// Quién hizo cada cosa es un correo del personal. El repo ya lo trata como dato
// reservado: la lista de pagos no dice quién cobró y la bitácora exige
// audit.read. La línea de tiempo sigue la misma regla que los consentimientos.
test('sin permiso para ver cuentas del personal, los eventos no dicen quién los hizo', () => {
  const entrada = fuentes({
    auditoria: [audit('client.create', '2026-01-10T15:00:00Z', { despues: { origen: 'mostrador' } })],
    notas: [{ created_at: '2026-02-01T10:00:00Z', texto: 'Pidió rutina', autor_email: 'gerente@forja.test' }],
  });
  const con = lineaDeTiempo(entrada, { importes: true, actores: true }).eventos;
  const sin = lineaDeTiempo(entrada, { importes: true, actores: false }).eventos;

  assert.deepEqual(con.map((e) => e.actor), ['gerente@forja.test', ACTOR]);
  assert.deepEqual(sin.map((e) => e.actor), [null, null]);
  // Lo demás del evento se conserva: lo que se oculta es la identidad.
  assert.deepEqual(sin.map((e) => e.titulo), con.map((e) => e.titulo));
  assert.doesNotMatch(JSON.stringify(sin), /forja\.test/);
});
