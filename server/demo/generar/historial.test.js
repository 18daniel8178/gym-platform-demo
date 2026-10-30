const { test } = require('node:test');
const assert = require('node:assert/strict');
const { crearAzar } = require('../azar');
const { historialSocio, VENTANA_DIAS } = require('./historial');
const { sumarDias } = require('../../modules/memberships/service');

const HOY = '2026-09-22';
const INICIO_VENTANA = sumarDias(HOY, -VENTANA_DIAS);

function muchos(estado, n = 300, semilla = 21) {
  const azar = crearAzar(semilla);
  return Array.from({ length: n }, () => historialSocio(azar, { estado, hoy: HOY }));
}

test('el mismo estado y la misma semilla dan el mismo historial', () => {
  assert.deepEqual(muchos('activo', 40, 5), muchos('activo', 40, 5));
});

test('un prospecto no tiene membresía ni pagos, y se dio de alta hace poco', () => {
  for (const h of muchos('prospecto', 100)) {
    assert.equal(h.membresia, null);
    assert.deepEqual(h.pagos, []);
    assert.ok(h.alta >= sumarDias(HOY, -60) && h.alta <= HOY, h.alta);
  }
});

test('los activos mezclan vigentes, por vencer esta semana y morosos recientes', () => {
  const tramos = { vigente: 0, porVencer: 0, vencida: 0 };
  for (const { membresia } of muchos('activo', 1000)) {
    if (membresia.fecha_fin > sumarDias(HOY, 7)) tramos.vigente += 1;
    else if (membresia.fecha_fin >= HOY) tramos.porVencer += 1;
    else tramos.vencida += 1;
  }
  assert.ok(tramos.vigente > 550, JSON.stringify(tramos));
  assert.ok(tramos.porVencer > 80, JSON.stringify(tramos));
  assert.ok(tramos.vencida > 120 && tramos.vencida < 300, JSON.stringify(tramos));
});

test('inactivos, bloqueados y archivados tienen la membresía vencida', () => {
  for (const estado of ['inactivo', 'bloqueado', 'archivado']) {
    for (const { membresia } of muchos(estado, 100)) {
      assert.ok(membresia.fecha_fin < HOY, `${estado}: ${membresia.fecha_fin}`);
    }
  }
});

test('ningún pago en el futuro, antes del alta ni fuera de la ventana de seis meses', () => {
  for (const estado of ['activo', 'inactivo', 'bloqueado', 'archivado']) {
    for (const h of muchos(estado, 200)) {
      for (const p of h.pagos) {
        const dia = p.fecha.slice(0, 10);
        assert.ok(dia <= HOY && dia >= INICIO_VENTANA && dia >= h.alta, `${estado}: pago ${dia}, alta ${h.alta}`);
      }
    }
  }
});

test('la membresía es coherente: empieza antes de terminar y su plan es uno real', () => {
  for (const { membresia } of muchos('activo', 300)) {
    assert.ok(membresia.fecha_inicio < membresia.fecha_fin);
    assert.ok(['mensual', 'trimestral', 'semestral', 'anual'].includes(membresia.periodo), membresia.periodo);
  }
});

test('los pagos usan métodos y orígenes reales, y casi todos están aprobados', () => {
  const pagos = muchos('activo', 400).flatMap((h) => h.pagos);
  assert.ok(pagos.length > 400);
  for (const p of pagos) {
    assert.ok(['efectivo', 'yappy', 'tarjeta', 'transferencia'].includes(p.metodo), p.metodo);
    assert.ok(['recepcion', 'checkout_simulado'].includes(p.origen), p.origen);
    assert.match(p.fecha, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00-05:00$/);
  }
  const anulados = pagos.filter((p) => p.estado === 'anulado');
  assert.ok(anulados.length > 0 && anulados.length < pagos.length * 0.05, `${anulados.length} anulados`);
  assert.ok(anulados.every((p) => p.motivo_anulacion));
});
