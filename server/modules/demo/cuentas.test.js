const { test } = require('node:test');
const assert = require('node:assert/strict');
const { CUENTAS_DEMO, DOMINIO_DEMO, cuentaDemo } = require('./cuentas');

test('solo las claves de la lista abren sesión', () => {
  assert.equal(cuentaDemo('propietario').email, `propietario@${DOMINIO_DEMO}`);
  for (const intruso of ['admin', 'propietario@demo.forja.test', 'cliente.prueba@example.com', '__proto__', 'toString', '', undefined, null]) {
    assert.equal(cuentaDemo(intruso), null, JSON.stringify(intruso));
  }
});

test('hay una cuenta por rol del panel y un socio', () => {
  assert.deepEqual(
    CUENTAS_DEMO.map((c) => c.clave),
    ['propietario', 'gerente', 'recepcion', 'cajero', 'contabilidad', 'socio']
  );
});

test('todos los correos usan el dominio reservado .test', () => {
  assert.match(DOMINIO_DEMO, /\.test$/);
  for (const c of CUENTAS_DEMO) assert.ok(c.email.endsWith(`@${DOMINIO_DEMO}`), c.email);
});

test('las claves no se repiten y la lista no se puede alterar', () => {
  assert.equal(new Set(CUENTAS_DEMO.map((c) => c.clave)).size, CUENTAS_DEMO.length);
  assert.ok(Object.isFrozen(CUENTAS_DEMO));
  assert.ok(Object.isFrozen(CUENTAS_DEMO[0]));
});
