const { test } = require('node:test');
const assert = require('node:assert/strict');

process.env.CHECKIN_SECRET = process.env.CHECKIN_SECRET || 'secreto-de-pruebas-del-carnet';
const { tokenDeCarnet, leerTokenDeCarnet } = require('./carnet');

// El carnet del socio llevaba `forja:<user_id>`: cualquiera que conozca un id
// puede dibujar ese QR. Ahora lleva una firma del servidor, así que un QR
// inventado no pasa del lector.

const ANA = '11111111-2222-3333-4444-555555555555';
const BETO = '99999999-8888-7777-6666-555555555555';

test('el token lleva el id del socio y una firma', () => {
  const token = tokenDeCarnet(ANA);
  const [prefijo, id, firma] = token.split(':');
  assert.equal(prefijo, 'forja');
  assert.equal(id, ANA);
  assert.match(firma, /^[0-9a-f]{16,}$/);
});

test('el servidor reconoce su propio token', () => {
  assert.deepEqual(leerTokenDeCarnet(tokenDeCarnet(ANA)), { ok: true, userId: ANA });
});

test('un token con el id cambiado no pasa', () => {
  const token = tokenDeCarnet(ANA).replace(ANA, BETO);
  assert.equal(leerTokenDeCarnet(token).ok, false);
});

test('un token con la firma retocada no pasa', () => {
  const token = tokenDeCarnet(ANA);
  const trucado = `${token.slice(0, -1)}${token.endsWith('0') ? '1' : '0'}`;
  assert.equal(leerTokenDeCarnet(trucado).ok, false);
});

test('lo que no es un carnet se rechaza sin reventar', () => {
  for (const basura of ['', null, undefined, 'hola', `forja:${ANA}`, `otro:${ANA}:abc`, `forja::abc`, 42]) {
    assert.equal(leerTokenDeCarnet(basura).ok, false, String(basura));
  }
});

test('cada socio tiene su firma y no cambia entre lecturas', () => {
  assert.notEqual(tokenDeCarnet(ANA), tokenDeCarnet(BETO));
  assert.equal(tokenDeCarnet(ANA), tokenDeCarnet(ANA));
});
