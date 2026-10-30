const { test } = require('node:test');
const assert = require('node:assert');
const { validarPerfilParcial, validarPerfilCompleto } = require('./perfil');

test('parcial: solo pasa campos de la lista blanca (anti mass-assignment)', () => {
  const r = validarPerfilParcial({ telefono: '60000000', user_id: 'hack', created_at: '2000-01-01', role: 'admin' });
  assert.equal(r.valido, true);
  assert.deepEqual(Object.keys(r.datos), ['telefono']); // user_id/created_at/role descartados
});

test('parcial: nombre vacío es rechazado', () => {
  const r = validarPerfilParcial({ nombre_completo: '   ' });
  assert.equal(r.valido, false);
});

test('parcial: sin campos válidos falla', () => {
  const r = validarPerfilParcial({ foo: 1, bar: 2 });
  assert.equal(r.valido, false);
});

test('parcial: permite corregir nombre, documento y fecha de nacimiento', () => {
  const r = validarPerfilParcial({ nombre_completo: 'Ana Pérez', documento: '8-888-8', fecha_nacimiento: '1990-05-01' });
  assert.equal(r.valido, true);
  assert.deepEqual(r.datos, { nombre_completo: 'Ana Pérez', documento: '8-888-8', fecha_nacimiento: '1990-05-01' });
});

test('parcial: firma_foto_pendiente debe ser booleano', () => {
  assert.equal(validarPerfilParcial({ firma_foto_pendiente: 'no' }).valido, false);
  assert.equal(validarPerfilParcial({ firma_foto_pendiente: false }).valido, true);
});

test('completo: exige los campos requeridos del formulario', () => {
  const r = validarPerfilCompleto({ nombre_completo: 'Ana', telefono: '6000' });
  assert.equal(r.valido, false); // faltan documento, fecha, contactos
});

test('completo: alta válida nace sin firma_foto_pendiente (default true) y condiciones null', () => {
  const r = validarPerfilCompleto({
    nombre_completo: 'Ana Pérez',
    fecha_nacimiento: '1990-05-01',
    documento: '8-888-8',
    telefono: '60000000',
    emergencia1_nombre: 'Uno',
    emergencia1_telefono: '61111111',
    emergencia2_nombre: 'Dos',
    emergencia2_telefono: '62222222',
    firma_foto_pendiente: false, // intento de fijarlo → debe ignorarse
  });
  assert.equal(r.valido, true);
  assert.equal('firma_foto_pendiente' in r.datos, false); // el alta nace pendiente por defecto
  assert.equal(r.datos.condiciones_medicas, null);
  assert.equal(r.datos.entrenado_antes, false);
});
