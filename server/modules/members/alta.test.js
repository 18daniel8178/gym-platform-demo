const { test } = require('node:test');
const assert = require('node:assert/strict');
const { leerDatosAlta } = require('./alta');

const VIGENTES = [
  { codigo: 'reglamento', version: 2, titulo: 'Reglamento interno', obligatorio: true },
  { codigo: 'datos_personales', version: 1, titulo: 'Tratamiento de datos personales', obligatorio: true },
  { codigo: 'fotos', version: 1, titulo: 'Uso de fotos en redes', obligatorio: false },
];
const AMBOS = ['reglamento', 'datos_personales'];

test('alta de quien contrata hoy: activo, mostrador y los consentimientos aceptados', () => {
  const r = leerDatosAlta({ estado_inicial: 'activo', consentimientos: AMBOS }, VIGENTES);
  assert.deepEqual(r, { ok: true, datos: { estado: 'activo', origen: 'mostrador', consentimientos: AMBOS } });
});

test('quien solo deja sus datos nace prospecto', () => {
  const r = leerDatosAlta({ estado_inicial: 'prospecto', consentimientos: AMBOS }, VIGENTES);
  assert.equal(r.datos.estado, 'prospecto');
});

test('el estado inicial se decide, no se supone', () => {
  const r = leerDatosAlta({ consentimientos: AMBOS }, VIGENTES);
  assert.equal(r.ok, false);
  assert.match(r.error, /contrata/i);
});

test('un alta no nace bloqueada, inactiva ni archivada', () => {
  for (const estado of ['bloqueado', 'inactivo', 'archivado', 'cualquiera']) {
    assert.equal(leerDatosAlta({ estado_inicial: estado, consentimientos: AMBOS }, VIGENTES).ok, false, estado);
  }
});

test('el origen del alta presencial es mostrador o referido, nunca web', () => {
  const referido = leerDatosAlta({ estado_inicial: 'activo', origen: 'referido', consentimientos: AMBOS }, VIGENTES);
  assert.equal(referido.datos.origen, 'referido');
  assert.equal(leerDatosAlta({ estado_inicial: 'activo', origen: 'web', consentimientos: AMBOS }, VIGENTES).ok, false);
  assert.equal(leerDatosAlta({ estado_inicial: 'activo', origen: 'importacion', consentimientos: AMBOS }, VIGENTES).ok, false);
});

test('falta un consentimiento obligatorio: se nombra cuál', () => {
  const r = leerDatosAlta({ estado_inicial: 'activo', consentimientos: ['reglamento'] }, VIGENTES);
  assert.equal(r.ok, false);
  assert.match(r.error, /Tratamiento de datos personales/);
});

test('los opcionales se pueden aceptar o no', () => {
  const r = leerDatosAlta({ estado_inicial: 'activo', consentimientos: [...AMBOS, 'fotos'] }, VIGENTES);
  assert.deepEqual(r.datos.consentimientos, [...AMBOS, 'fotos']);
});

test('un documento que no existe se rechaza', () => {
  const r = leerDatosAlta({ estado_inicial: 'activo', consentimientos: [...AMBOS, 'inventado'] }, VIGENTES);
  assert.equal(r.ok, false);
  assert.match(r.error, /inventado/);
});

test('los consentimientos son una lista de códigos, sin repetidos', () => {
  assert.equal(leerDatosAlta({ estado_inicial: 'activo', consentimientos: 'reglamento' }, VIGENTES).ok, false);
  assert.equal(leerDatosAlta({ estado_inicial: 'activo' }, VIGENTES).ok, false);
  const r = leerDatosAlta({ estado_inicial: 'activo', consentimientos: [...AMBOS, 'reglamento'] }, VIGENTES);
  assert.deepEqual(r.datos.consentimientos, AMBOS);
});
