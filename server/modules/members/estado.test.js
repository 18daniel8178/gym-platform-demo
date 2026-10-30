const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validarTransicion, transicionesDesde, ESTADOS_MIEMBRO } = require('./estado');

test('los cinco estados del documento, en su orden', () => {
  assert.deepEqual(ESTADOS_MIEMBRO, ['prospecto', 'activo', 'inactivo', 'bloqueado', 'archivado']);
});

test('pasar a inactivo es operación de recepción y no exige motivo', () => {
  const r = validarTransicion({ de: 'activo', a: 'inactivo' });
  assert.deepEqual(r, { ok: true, permiso: 'member.update', motivo: null });
});

test('un prospecto que contrata pasa a activo con permiso de recepción', () => {
  const r = validarTransicion({ de: 'prospecto', a: 'activo', motivo: '  Pagó el mensual  ' });
  assert.deepEqual(r, { ok: true, permiso: 'member.update', motivo: 'Pagó el mensual' });
});

test('bloquear exige motivo y el permiso de archivar', () => {
  assert.deepEqual(validarTransicion({ de: 'activo', a: 'bloqueado', motivo: ' deuda en caja ' }), {
    ok: true,
    permiso: 'member.archive',
    motivo: 'deuda en caja',
  });
  const sinMotivo = validarTransicion({ de: 'activo', a: 'bloqueado' });
  assert.equal(sinMotivo.ok, false);
  assert.match(sinMotivo.error, /motivo/i);
});

test('archivar con un motivo en blanco se rechaza', () => {
  const r = validarTransicion({ de: 'inactivo', a: 'archivado', motivo: '   ' });
  assert.equal(r.ok, false);
  assert.match(r.error, /motivo/i);
});

test('salir de bloqueado o de archivado también es sensible', () => {
  assert.equal(validarTransicion({ de: 'bloqueado', a: 'activo' }).permiso, 'member.archive');
  assert.equal(validarTransicion({ de: 'archivado', a: 'inactivo' }).permiso, 'member.archive');
});

test('nadie vuelve a ser prospecto', () => {
  for (const de of ['activo', 'inactivo', 'bloqueado', 'archivado']) {
    const r = validarTransicion({ de, a: 'prospecto' });
    assert.equal(r.ok, false, `${de} → prospecto debía rechazarse`);
  }
});

test('un archivado no se bloquea: primero se restaura', () => {
  const r = validarTransicion({ de: 'archivado', a: 'bloqueado', motivo: 'deuda' });
  assert.equal(r.ok, false);
  assert.match(r.error, /no puede pasar/i);
});

test('pedir el estado en el que ya está es un error, no un cambio vacío', () => {
  const r = validarTransicion({ de: 'activo', a: 'activo' });
  assert.equal(r.ok, false);
  assert.match(r.error, /ya está/i);
});

test('un estado inventado se rechaza', () => {
  assert.equal(validarTransicion({ de: 'activo', a: 'suspendido' }).ok, false);
  assert.equal(validarTransicion({ de: 'activo', a: undefined }).ok, false);
});

test('el motivo tiene un tope de 300 caracteres', () => {
  const r = validarTransicion({ de: 'activo', a: 'bloqueado', motivo: 'x'.repeat(301) });
  assert.equal(r.ok, false);
  assert.match(r.error, /300/);
});

test('un motivo que no es texto se rechaza', () => {
  assert.equal(validarTransicion({ de: 'activo', a: 'bloqueado', motivo: 42 }).ok, false);
});

test('las opciones de la ficha salen de la misma máquina: destino, permiso y si exige motivo', () => {
  assert.deepEqual(transicionesDesde('activo'), [
    { estado: 'inactivo', permiso: 'member.update', exigeMotivo: false },
    { estado: 'bloqueado', permiso: 'member.archive', exigeMotivo: true },
    { estado: 'archivado', permiso: 'member.archive', exigeMotivo: true },
  ]);
});

test('desde archivado solo se restaura, y restaurar es de gerencia', () => {
  assert.deepEqual(
    transicionesDesde('archivado').map((t) => `${t.estado}:${t.permiso}`),
    ['activo:member.archive', 'inactivo:member.archive']
  );
});

test('un estado desconocido no ofrece ninguna salida', () => {
  assert.deepEqual(transicionesDesde('suspendido'), []);
});
