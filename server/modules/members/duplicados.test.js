const { test } = require('node:test');
const assert = require('node:assert/strict');
const { evaluarDuplicados } = require('./duplicados');

const ana = {
  user_id: 'u-ana',
  nombre_completo: 'Ana Pérez',
  estado_miembro: 'archivado',
  por_documento: true,
  por_email: false,
};

test('sin coincidencias, el alta sigue', () => {
  assert.deepEqual(evaluarDuplicados([]), { accion: 'seguir', confirmados: [] });
  assert.deepEqual(evaluarDuplicados(null), { accion: 'seguir', confirmados: [] });
});

test('un documento repetido detiene el alta y pide confirmación (A01)', () => {
  const r = evaluarDuplicados([ana]);
  assert.equal(r.accion, 'rechazar');
  assert.equal(r.status, 409);
  assert.equal(r.body.requiere_confirmacion, true);
  assert.deepEqual(r.body.coincidencias, [ana]);
  assert.match(r.body.error, /documento/i);
});

test('confirmado explícitamente, sigue y deja constancia de con quién coincidía', () => {
  assert.deepEqual(evaluarDuplicados([ana], { confirmado: true }), { accion: 'seguir', confirmados: ['u-ana'] });
});

test('la confirmación tiene que ser un true de verdad, no un texto', () => {
  assert.equal(evaluarDuplicados([ana], { confirmado: 'true' }).accion, 'rechazar');
  assert.equal(evaluarDuplicados([ana], { confirmado: 1 }).accion, 'rechazar');
});

test('un correo repetido no se puede forzar: la cuenta exige correo único', () => {
  const beto = { ...ana, user_id: 'u-beto', por_documento: false, por_email: true };
  const r = evaluarDuplicados([ana, beto], { confirmado: true });
  assert.equal(r.accion, 'rechazar');
  assert.equal(r.status, 409);
  assert.equal(r.body.requiere_confirmacion, false);
  assert.match(r.body.error, /correo/i);
  assert.equal(r.body.coincidencias.length, 2);
});

test('al cliente solo viaja la proyección mínima de cada coincidencia', () => {
  const r = evaluarDuplicados([{ ...ana, documento: '8-123-456', telefono: '6000' }]);
  assert.deepEqual(Object.keys(r.body.coincidencias[0]).sort(), [
    'estado_miembro',
    'nombre_completo',
    'por_documento',
    'por_email',
    'user_id',
  ]);
});
