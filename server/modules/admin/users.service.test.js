const { test } = require('node:test');
const assert = require('node:assert/strict');
const { normalizarRolesIds } = require('./users.service');

test('normaliza a números y elimina duplicados', () => {
  assert.deepEqual(normalizarRolesIds(['2', 2, 3]), { ids: [2, 3] });
});

test('lista vacía es válida (deja al usuario sin roles a propósito)', () => {
  assert.deepEqual(normalizarRolesIds([]), { ids: [] });
});

test('rechaza ids no numéricos antes de tocar la base', () => {
  assert.equal(normalizarRolesIds(['abc']).error, 'Hay un rol inválido en la lista');
  assert.equal(normalizarRolesIds([null]).error, 'Hay un rol inválido en la lista');
  assert.equal(normalizarRolesIds([1.5]).error, 'Hay un rol inválido en la lista');
});

test('rechaza ids no positivos', () => {
  assert.equal(normalizarRolesIds([0]).error, 'Hay un rol inválido en la lista');
  assert.equal(normalizarRolesIds([-3]).error, 'Hay un rol inválido en la lista');
});

test('rechaza cualquier cosa que no sea lista', () => {
  assert.equal(normalizarRolesIds(undefined).error, 'roles debe ser una lista de ids');
  assert.equal(normalizarRolesIds('1,2').error, 'roles debe ser una lista de ids');
  assert.equal(normalizarRolesIds({ 0: 1 }).error, 'roles debe ser una lista de ids');
});
