const { test } = require('node:test');
const assert = require('node:assert/strict');
const { generarGimnasio } = require('./gimnasio');
const { normalizarDocumento } = require('../../modules/members/normalizacion');
const { ESTADOS_MIEMBRO } = require('../../modules/members/estado');
const { sumarDias } = require('../../modules/memberships/service');

const HOY = '2026-09-22';
const gimnasio = generarGimnasio(2026, { hoy: HOY, cantidad: 150 });

test('la misma semilla y el mismo día dan el mismo gimnasio', () => {
  assert.deepEqual(generarGimnasio(2026, { hoy: HOY, cantidad: 150 }), gimnasio);
});

test('hay 150 socios y aparecen los cinco estados', () => {
  assert.equal(gimnasio.socios.length, 150);
  const estados = new Set(gimnasio.socios.map((s) => s.estado));
  for (const e of ESTADOS_MIEMBRO) assert.ok(estados.has(e), `falta el estado ${e}`);
  const activos = gimnasio.socios.filter((s) => s.estado === 'activo').length;
  assert.ok(activos > 90 && activos < 130, `${activos} activos`);
});

test('cédulas y correos únicos: la demo no dispara avisos de duplicado sin querer', () => {
  const docs = gimnasio.socios.map((s) => normalizarDocumento(s.perfil.documento));
  assert.equal(new Set(docs).size, docs.length);
  const correos = [...gimnasio.socios, gimnasio.socioDemo].map((s) => s.email);
  assert.equal(new Set(correos).size, correos.length);
});

test('bloqueado, archivado e inactivo traen motivo; activo y prospecto no', () => {
  for (const s of gimnasio.socios) {
    const conMotivo = ['bloqueado', 'archivado', 'inactivo'].includes(s.estado);
    assert.equal(Boolean(s.motivo), conMotivo, `${s.clave} ${s.estado} motivo=${s.motivo}`);
    if (conMotivo) assert.ok(s.estadoCambiadoEn <= `${HOY}T23:59`, s.estadoCambiadoEn);
  }
});

test('firma/foto pendiente sobre todo en altas web recientes', () => {
  const recientesWeb = gimnasio.socios.filter((s) => s.origen === 'web' && s.alta >= sumarDias(HOY, -30));
  assert.ok(recientesWeb.every((s) => s.firmaFotoPendiente));
  const pendientes = gimnasio.socios.filter((s) => s.firmaFotoPendiente).length;
  assert.ok(pendientes < 40, `${pendientes} pendientes`);
});

test('los importados no traen consentimientos: no aceptaron nada ante nadie', () => {
  for (const s of gimnasio.socios.filter((x) => x.origen === 'importacion')) assert.equal(s.consiente, false);
});

test('las notas y etiquetas son la excepción, con fechas dentro del expediente', () => {
  for (const s of gimnasio.socios) {
    assert.ok(s.etiquetas.length <= 2 && new Set(s.etiquetas).size === s.etiquetas.length);
    for (const n of s.notas) assert.ok(n.fecha.slice(0, 10) >= s.alta && n.fecha.slice(0, 10) <= HOY, n.fecha);
  }
});

test('visitantes del pase diario: sin cuenta, dentro de la ventana y en efectivo o Yappy', () => {
  assert.ok(gimnasio.visitantes.length > 30, `${gimnasio.visitantes.length} pases`);
  for (const v of gimnasio.visitantes) {
    assert.ok(v.nombre_cliente && ['efectivo', 'yappy'].includes(v.metodo));
    assert.ok(v.fecha.slice(0, 10) <= HOY);
  }
});

test('el socio de la demo tiene membresía vigente, pagos y sus consentimientos', () => {
  const s = gimnasio.socioDemo;
  assert.equal(s.estado, 'activo');
  assert.equal(s.perfil.nombre_completo, 'Mateo Solís Rivera');
  assert.ok(s.membresia.fecha_fin > sumarDias(HOY, 7));
  assert.ok(s.pagos.length >= 3);
  assert.equal(s.consiente, true);
});
