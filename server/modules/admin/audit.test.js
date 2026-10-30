const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { entidadesVisiblesPara, PERMISO_POR_ENTIDAD } = require('./audit');
const { CATALOGO } = require('./permisos');

// La bitácora dejó de estar clavada en entidad='settings' para que los cambios
// de cuentas, roles y cobros se puedan leer. El riesgo de abrirla es convertirla
// en la puerta de atrás a lo que un rol no puede ver por la puerta principal:
// `contabilidad` tiene audit.read y NO tiene member.read ni user.read ("sin
// operación de miembros", dice el seed), pero el diff de un cambio de perfil
// lleva documento y contactos del socio, y el de un alta de personal su correo.

test('contabilidad ve la configuración y el dinero, no a las personas', () => {
  const contabilidad = new Set(['audit.read', 'payment.read', 'report.read', 'settings.read']);
  const visibles = entidadesVisiblesPara(contabilidad).sort();
  assert.deepEqual(visibles, ['branch', 'consent_documents', 'gym_info', 'occupancy', 'payments', 'settings']);
  for (const prohibida of ['profiles', 'memberships', 'auth.users', 'user_roles', 'member_consents']) {
    assert.ok(!visibles.includes(prohibida), `${prohibida} no debería ser visible para contabilidad`);
  }
});

test('quien puede ver socios y cuentas los ve también en la bitácora', () => {
  const gerente = new Set(['audit.read', 'member.read', 'user.read', 'plan.read', 'payment.read', 'checkin.read']);
  assert.deepEqual(entidadesVisiblesPara(gerente).sort(), Object.keys(PERMISO_POR_ENTIDAD).sort());
});

test('sin permisos no se ve ninguna entidad', () => {
  assert.deepEqual(entidadesVisiblesPara(new Set()), []);
  assert.deepEqual(entidadesVisiblesPara(undefined), []);
});

test('los permisos que exige el mapa existen en el catálogo', () => {
  for (const permiso of new Set(Object.values(PERMISO_POR_ENTIDAD))) {
    assert.ok(CATALOGO.includes(permiso), `${permiso} ya no está en el catálogo de permisos`);
  }
});

// La lista es BLANCA: una entidad que el código audita y que nadie declaró aquí
// no la vería nadie, ni siquiera el propietario, y el fallo sería mudo. Esto lo
// convierte en un test rojo el día que alguien audite algo nuevo.
test('toda entidad que el código audita está declarada', () => {
  const raiz = path.resolve(__dirname, '../..');
  const auditadas = new Set();
  const recorrer = (dir) => {
    for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
      const ruta = path.join(dir, entrada.name);
      if (entrada.isDirectory() && entrada.name !== 'node_modules') recorrer(ruta);
      else if (/\.(js|sql)$/.test(entrada.name)) {
        const texto = fs.readFileSync(ruta, 'utf8');
        for (const m of texto.matchAll(/entidad:\s*'([\w.]+)'/g)) auditadas.add(m[1]);
      }
    }
  };
  recorrer(raiz);
  // El insert de user_roles lo hace una función SQL, no JS: se declara aquí.
  auditadas.add('user_roles');

  const sinDeclarar = [...auditadas].filter((e) => !(e in PERMISO_POR_ENTIDAD));
  assert.deepEqual(sinDeclarar, [], `entidades auditadas sin permiso declarado: ${sinDeclarar.join(', ')}`);
});
