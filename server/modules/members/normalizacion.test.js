const { test } = require('node:test');
const assert = require('node:assert/strict');
const { normalizarDocumento, normalizarEmail } = require('./normalizacion');

// Los MISMOS casos que la sección 3 de server/db/pruebas/casos_miembros.sql:
// la búsqueda del listado y la importación comparan en JS contra lo que la base
// normalizó en SQL, así que las dos reglas no pueden discrepar.
const DOCUMENTOS = [
  ['8-123-456', '8123456'],
  ['8 123 456', '8123456'],
  ['8.123.456', '8123456'],
  [' pe-12 345 ', 'PE12345'],
  ['8-123-456\t', '8123456'],
  ['---', null],
  ['', null],
  [null, null],
];

const EMAILS = [
  [' Ana@Mail.com ', 'ana@mail.com'],
  ['ana @mail.com', 'ana@mail.com'],
  ['ANA@MAIL.COM\n', 'ana@mail.com'],
  ['', null],
  [null, null],
];

test('documento: se queda con letras y dígitos ASCII en mayúsculas (igual que SQL)', () => {
  for (const [entrada, esperado] of DOCUMENTOS) {
    assert.equal(normalizarDocumento(entrada), esperado, JSON.stringify(entrada));
  }
});

test('correo: sin espacios y en minúsculas (igual que SQL)', () => {
  for (const [entrada, esperado] of EMAILS) {
    assert.equal(normalizarEmail(entrada), esperado, JSON.stringify(entrada));
  }
});

test('un número vale por su texto (como el cast de SQL); undefined, como vacío', () => {
  assert.equal(normalizarDocumento(8123456), '8123456');
  assert.equal(normalizarDocumento(undefined), null);
  assert.equal(normalizarEmail(undefined), null);
});
