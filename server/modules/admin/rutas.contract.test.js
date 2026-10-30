const { test } = require('node:test');
const assert = require('node:assert/strict');

process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'sin-clave';

const { crearRouterAdmin, matrizDeRutas, IDENTIDAD_PROPIA } = require('../../middleware/routerAdmin');
const { CATALOGO } = require('./permisos');
require('./index'); // compone el router admin real (sin red ni credenciales)

// Contrato del API admin: la superficie completa de /api/admin con el permiso y
// la política de objetivo de cada ruta. Es la documentación ejecutable del
// modelo de autorización — añadir o mover una ruta obliga a tocar esta tabla,
// que es exactamente la revisión que antes no ocurría.
const CONTRATO = [
  { metodo: 'get', path: '/me', permiso: null, politica: {} },
  { metodo: 'get', path: '/stats', permiso: 'dashboard.read', politica: {} },

  { metodo: 'get', path: '/members', permiso: 'member.read', politica: {} },
  { metodo: 'post', path: '/members', permiso: 'member.create', politica: {} },
  { metodo: 'get', path: '/members/:userId', permiso: 'member.read', politica: {} },
  { metodo: 'patch', path: '/members/:userId', permiso: 'member.update', politica: {} },
  { metodo: 'post', path: '/members/:userId/firma-foto', permiso: 'member.update', politica: {} },
  // El estado exige member.update; bloquear, archivar y deshacerlos exigen además
  // member.archive dentro del handler: lo decide la máquina de estados
  // (members/estado.js), no la ruta.
  { metodo: 'post', path: '/members/:userId/estado', permiso: 'member.update', politica: {} },
  { metodo: 'put', path: '/members/:userId/etiquetas', permiso: 'member.update', politica: {} },
  // Los socios no se borran: la ruta existe para responder 409 y ofrecer archivar.
  { metodo: 'delete', path: '/members/:userId', permiso: 'member.archive', politica: {} },
  { metodo: 'get', path: '/consent-documents', permiso: 'member.read', politica: {} },
  // Capturar una aceptación es del expediente del socio; publicar o corregir una
  // versión del documento es configurar el negocio, y eso lo decide gerencia.
  { metodo: 'post', path: '/members/:userId/consentimientos', permiso: 'member.consent', politica: {} },
  // Importar el padrón es de gerencia: crea socios en masa (member.import).
  { metodo: 'post', path: '/members/importar', permiso: 'member.import', politica: {} },
  // La línea de tiempo la ve quien ve la ficha; los importes, solo quien además
  // tiene payment.read, y eso lo decide el handler, no la ruta.
  { metodo: 'get', path: '/members/:userId/historial', permiso: 'member.read', politica: {} },

  // Check-in: registrar y buscar son de recepción; forzar y anular, de gerencia.
  { metodo: 'post', path: '/checkin', permiso: 'checkin.perform', politica: {} },
  { metodo: 'get', path: '/checkin/buscar', permiso: 'checkin.perform', politica: {} },
  { metodo: 'get', path: '/checkin/hoy', permiso: 'checkin.read', politica: {} },
  { metodo: 'post', path: '/checkin/:id/anular', permiso: 'checkin.override', politica: {} },
  { metodo: 'get', path: '/consent-documents/historial', permiso: 'settings.update', politica: {} },
  { metodo: 'post', path: '/consent-documents', permiso: 'settings.update', politica: {} },
  { metodo: 'patch', path: '/consent-documents/:id', permiso: 'settings.update', politica: {} },
  { metodo: 'post', path: '/members/:userId/membership', permiso: 'membership.collect', politica: {} },
  { metodo: 'patch', path: '/memberships/:userId', permiso: 'membership.adjust', politica: {} },

  { metodo: 'get', path: '/plans', permiso: 'plan.read', politica: {} },
  { metodo: 'post', path: '/plans', permiso: 'plan.create', politica: {} },
  { metodo: 'patch', path: '/plans/:id', permiso: 'plan.update', politica: {} },

  { metodo: 'get', path: '/payments', permiso: 'payment.read', politica: {} },
  { metodo: 'get', path: '/payments/export', permiso: 'payment.export', politica: {} },
  { metodo: 'post', path: '/payments/pase-diario', permiso: 'payment.create', politica: {} },
  { metodo: 'post', path: '/payments/:id/anular', permiso: 'payment.void', politica: {} },

  { metodo: 'patch', path: '/gym-info', permiso: 'settings.update', politica: {} },
  { metodo: 'patch', path: '/occupancy', permiso: 'settings.update', politica: {} },

  // Ajustes del negocio. Se leen con settings.update y no con settings.read
  // porque la respuesta lleva RUC y correlativos de facturación, y settings.read
  // lo tienen sembrado todos los roles operativos.
  { metodo: 'get', path: '/settings', permiso: 'settings.update', politica: {} },
  { metodo: 'patch', path: '/settings/:seccion', permiso: 'settings.update', politica: {} },
  { metodo: 'patch', path: '/settings/numeracion/:tipo', permiso: 'settings.update', politica: {} },
  { metodo: 'post', path: '/settings/metodos', permiso: 'settings.update', politica: {} },
  { metodo: 'patch', path: '/settings/metodos/:clave', permiso: 'settings.update', politica: {} },
  { metodo: 'get', path: '/settings/auditoria', permiso: 'audit.read', politica: {} },

  // La sucursal es de la misma familia que los ajustes: quien configura el
  // negocio configura dónde opera.
  { metodo: 'get', path: '/sucursal', permiso: 'settings.update', politica: {} },
  { metodo: 'patch', path: '/sucursal', permiso: 'settings.update', politica: {} },

  { metodo: 'get', path: '/roles', permiso: 'user.read', politica: {} },
  { metodo: 'get', path: '/users', permiso: 'user.read', politica: {} },
  { metodo: 'post', path: '/users', permiso: 'user.manage', politica: {} },
  {
    metodo: 'put',
    path: '/users/:id/roles',
    permiso: 'user.manage',
    politica: {
      objetivo: 'cualquiera',
      prohibirPropietario: true,
      prohibirSiMismo: 'No puedes cambiar tus propios roles',
    },
  },
  {
    metodo: 'post',
    path: '/users/:id/desactivar',
    permiso: 'user.manage',
    politica: {
      objetivo: 'staff',
      prohibirPropietario: true,
      prohibirSiMismo: 'No puedes desactivar tu propia cuenta',
    },
  },
  { metodo: 'post', path: '/users/:id/activar', permiso: 'user.manage', politica: { objetivo: 'staff' } },
  {
    metodo: 'get',
    path: '/users/:id/sessions',
    permiso: 'session.manage',
    politica: { objetivo: 'staff', prohibirPropietario: true },
  },
  {
    metodo: 'post',
    path: '/users/:id/cerrar-sesiones',
    permiso: 'session.manage',
    politica: { objetivo: 'staff', prohibirPropietario: true },
  },
];

const ordenar = (rutas) => [...rutas].sort((a, b) => `${a.path} ${a.metodo}`.localeCompare(`${b.path} ${b.metodo}`));

test('el API admin expone exactamente las rutas del contrato', () => {
  assert.deepEqual(matrizDeRutas(), ordenar(CONTRATO));
});

test('solo /me puede prescindir de permiso', () => {
  const sinPermiso = matrizDeRutas().filter((r) => r.permiso === null);
  assert.deepEqual(sinPermiso.map((r) => `${r.metodo} ${r.path}`), ['get /me']);
});

test('todos los permisos del contrato existen en el catálogo', () => {
  const desconocidos = matrizDeRutas()
    .map((r) => r.permiso)
    .filter((p) => p && !CATALOGO.includes(p));
  assert.deepEqual(desconocidos, []);
});

test('el guard del permiso va siempre primero, aunque la ruta traiga más middlewares', () => {
  const router = crearRouterAdmin();
  const validar = (_req, _res, next) => next();
  router.post('/contrato-orden', 'plan.update', validar, (_req, res) => res.json({ ok: true }));

  const capas = router.stack.find((c) => c.route?.path === '/contrato-orden').route.stack;
  assert.equal(capas[0].handle.permisoDeclarado, 'plan.update');
  assert.equal(capas.length, 3); // guard + validar + handler
});

test('registrar una ruta sin permiso o sin handler es imposible', () => {
  const router = crearRouterAdmin();
  assert.throws(() => router.get('/sin-permiso', (_req, res) => res.json({})), /no declara permiso/);
  assert.throws(() => router.get('/sin-handler', 'plan.read'), /no tiene handler/);
});

test('un permiso inexistente revienta al declarar la ruta, no en producción', () => {
  const router = crearRouterAdmin();
  assert.throws(() => router.get('/errata', 'plan.raed', (_req, res) => res.json({})), /Permiso desconocido/);
});

test('una política de objetivo mal escrita revienta al declarar la ruta', () => {
  const router = crearRouterAdmin();
  assert.throws(
    () => router.post('/politica-mala', 'user.manage', { objetivos: 'staff' }, (_req, res) => res.json({})),
    /Política de objetivo desconocida/
  );
  assert.throws(
    () => router.post('/politica-mala2', 'user.manage', { objetivo: 'todos' }, (_req, res) => res.json({})),
    /objetivo debe ser/
  );
});

test('dos rutas con el mismo método y path no pueden convivir', () => {
  const router = crearRouterAdmin();
  router.get('/duplicada-contrato', 'plan.read', (_req, res) => res.json({}));
  assert.throws(
    () => router.get('/duplicada-contrato', 'payment.read', (_req, res) => res.json({})),
    /duplicada/
  );
});

test('IDENTIDAD_PROPIA no se puede confundir con un permiso', () => {
  assert.equal(typeof IDENTIDAD_PROPIA, 'symbol');
  assert.ok(!CATALOGO.includes(IDENTIDAD_PROPIA));
});
