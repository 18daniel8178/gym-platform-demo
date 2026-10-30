const { test } = require('node:test');
const assert = require('node:assert/strict');
const { esPropietario, requireStaff, requirePermission } = require('./requirePermission');

// req con permisos ya cacheados (evita tocar Supabase en los tests)
const reqCon = (permisos, user = {}) => ({ user, permisos: new Set(permisos) });
const resFalso = () => {
  const res = { code: null, body: null };
  res.status = (c) => { res.code = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
};

test('esPropietario: solo app_metadata.role === "admin"', () => {
  assert.equal(esPropietario({ app_metadata: { role: 'admin' } }), true);
  assert.equal(esPropietario({ app_metadata: { role: 'user' } }), false);
  assert.equal(esPropietario({ app_metadata: {} }), false);
  assert.equal(esPropietario({}), false);
  assert.equal(esPropietario(null), false);
});

test('requireStaff: el propietario pasa sin consultar permisos', async () => {
  let paso = false;
  await requireStaff({ user: { app_metadata: { role: 'admin' } } }, resFalso(), () => { paso = true; });
  assert.equal(paso, true);
});

test('requireStaff: staff con al menos un permiso pasa', async () => {
  let paso = false;
  await requireStaff(reqCon(['member.read']), resFalso(), () => { paso = true; });
  assert.equal(paso, true);
});

test('requireStaff: sin roles → 403', async () => {
  const res = resFalso();
  let paso = false;
  await requireStaff(reqCon([]), res, () => { paso = true; });
  assert.equal(paso, false);
  assert.equal(res.code, 403);
  assert.match(res.body.error, /personal del gimnasio/);
});

test('requirePermission: pasa con el permiso exacto', async () => {
  let paso = false;
  await requirePermission('member.read')(reqCon(['member.read', 'plan.read']), resFalso(), () => { paso = true; });
  assert.equal(paso, true);
});

test('requirePermission: 403 sin el permiso (otros permisos no valen)', async () => {
  const res = resFalso();
  let paso = false;
  await requirePermission('user.manage')(reqCon(['member.read']), res, () => { paso = true; });
  assert.equal(paso, false);
  assert.equal(res.code, 403);
});

test('requirePermission: el propietario pasa cualquier permiso del catálogo', async () => {
  let paso = false;
  const req = { user: { app_metadata: { role: 'admin' } } };
  await requirePermission('payment.refund')(req, resFalso(), () => { paso = true; });
  assert.equal(paso, true);
});

test('requirePermission: fallo al cargar permisos → 500, nunca acceso', async () => {
  const res = resFalso();
  let paso = false;
  // Sin cache y con user.id → cargarPermisos consulta el cliente dummy y falla.
  await requirePermission('member.read')({ user: { id: 'u1' } }, res, () => { paso = true; });
  assert.equal(paso, false);
  assert.equal(res.code, 500);
});
