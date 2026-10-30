const { crearRouterAdmin } = require('../../middleware/routerAdmin');
const { supabase } = require('../../infrastructure/supabase');
const { logAdminAction } = require('./audit');
const {
  listarUsuarios, cerrarSesiones, sesionesDe, normalizarRolesIds, reemplazarRoles,
} = require('./users.service');

const router = crearRouterAdmin();

const BAN_DESACTIVADO = '87600h'; // ~10 años: desactivar es indefinido y reversible

// GET /users — cuentas del personal con roles, estado y último acceso.
router.get('/users', 'user.read', async (_req, res) => {
  const { rows, error } = await listarUsuarios();
  if (error) return res.status(500).json({ error: 'No se pudieron obtener los usuarios' });
  res.json({ rows });
});

// GET /roles — catálogo de roles con sus permisos (matriz de la página Roles).
router.get('/roles', 'user.read', async (_req, res) => {
  const { data: roles, error } = await supabase
    .from('roles')
    .select('id, clave, nombre, descripcion, permisos:role_permissions(permiso)')
    .order('clave');
  if (error) return res.status(500).json({ error: 'No se pudieron obtener los roles' });
  res.json({
    rows: (roles || []).map((r) => ({
      id: r.id,
      clave: r.clave,
      nombre: r.nombre,
      descripcion: r.descripcion,
      permisos: (r.permisos || []).map((p) => p.permiso).sort(),
    })),
  });
});

// Valida las credenciales del alta. La existencia de los roles la valida la
// función SQL al asignarlos: una sola fuente de verdad, sin ventana entre
// comprobar y usar.
function validarAlta(body = {}) {
  const { email, password } = body;
  if (typeof email !== 'string' || !email.includes('@')) return { error: 'Email inválido' };
  if (typeof password !== 'string' || password.length < 8) {
    return { error: 'La contraseña debe tener al menos 8 caracteres' };
  }
  const { ids, error } = normalizarRolesIds(body.roles);
  if (error) return { error };
  if (ids.length === 0) return { error: 'Asigna al menos un rol' };
  return { ids };
}

// Compensación del alta: Auth no participa de la transacción de Postgres, así
// que si los roles no se pueden asignar hay que borrar la cuenta recién creada.
async function revertirAlta(userId, email) {
  const { error } = await supabase.auth.admin.deleteUser(userId);
  if (!error) return null;
  console.error('[admin] POST /users: cuenta huérfana', userId, email, error.message);
  return 'no se pudo revertir la cuenta, requiere limpieza manual';
}

// POST /users — crear cuenta del personal con roles asignados.
router.post('/users', 'user.manage', async (req, res) => {
  const { ids, error: vError } = validarAlta(req.body);
  if (vError) return res.status(400).json({ error: vError });
  const { email, password } = req.body;

  const { data: creado, error: eAuth } = await supabase.auth.admin.createUser({ email, password, email_confirm: true });
  if (eAuth) {
    const msg = /already/i.test(eAuth.message || '') ? 'Ya existe una cuenta con ese email' : 'No se pudo crear la cuenta';
    return res.status(400).json({ error: msg });
  }

  const userId = creado.user.id;
  const { error: eRoles, invalido } = await reemplazarRoles({ userId, ids, actor: req.user });
  if (eRoles) {
    const aviso = await revertirAlta(userId, email);
    const mensaje = [eRoles, aviso].filter(Boolean).join('; ');
    return res.status(invalido && !aviso ? 400 : 500).json({ error: mensaje });
  }

  await logAdminAction(req.user, {
    accion: 'user.create',
    entidad: 'auth.users',
    entidadId: userId,
    detalle: { despues: { email, roles: ids } },
  });
  res.status(201).json({ id: userId, email });
});

// PUT /users/:id/roles — reemplaza los roles asignados de un usuario.
router.put(
  '/users/:id/roles',
  'user.manage',
  // objetivo 'cualquiera': asignar roles es TAMBIÉN la vía para promover a
  // personal a un socio que ya tiene cuenta, así que no se exige que ya lo sea.
  {
    objetivo: 'cualquiera',
    prohibirPropietario: true,
    prohibirSiMismo: 'No puedes cambiar tus propios roles',
  },
  async (req, res) => {
    const { ids, error: eIds } = normalizarRolesIds(req.body?.roles);
    if (eIds) return res.status(400).json({ error: eIds });

    // La función SQL valida, reemplaza y audita en una sola transacción.
    const { error, invalido } = await reemplazarRoles({ userId: req.params.id, ids, actor: req.user });
    if (error) return res.status(invalido ? 400 : 500).json({ error });
    res.json({ ok: true });
  }
);

// POST /users/:id/desactivar — bloquea el acceso y corta las sesiones abiertas.
router.post(
  '/users/:id/desactivar',
  'user.manage',
  {
    objetivo: 'staff',
    prohibirPropietario: true,
    prohibirSiMismo: 'No puedes desactivar tu propia cuenta',
  },
  async (req, res) => {
    const userId = req.params.id;
    const { error } = await supabase.auth.admin.updateUserById(userId, { ban_duration: BAN_DESACTIVADO });
    if (error) return res.status(500).json({ error: 'No se pudo desactivar la cuenta' });

    const { ok } = await cerrarSesiones(userId); // best-effort: el ban ya está aplicado
    await logAdminAction(req.user, {
      accion: 'user.disable',
      entidad: 'auth.users',
      entidadId: userId,
      detalle: {
        antes: { desactivado: req.objetivo.desactivado },
        despues: { desactivado: true, ban: BAN_DESACTIVADO },
        ...(ok ? {} : { nota: 'no se pudieron cerrar las sesiones abiertas' }),
      },
    });
    res.json({ ok: true, sesiones_cerradas: ok });
  }
);

// POST /users/:id/activar — restaura el acceso. Sin rechazarPropietario: solo
// quita un bloqueo, y sirve de válvula si la cuenta quedó baneada por otra vía.
router.post(
  '/users/:id/activar',
  'user.manage',
  { objetivo: 'staff' },
  async (req, res) => {
    const userId = req.params.id;
    const { error } = await supabase.auth.admin.updateUserById(userId, { ban_duration: 'none' });
    if (error) return res.status(500).json({ error: 'No se pudo activar la cuenta' });

    await logAdminAction(req.user, {
      accion: 'user.enable',
      entidad: 'auth.users',
      entidadId: userId,
      detalle: { antes: { desactivado: req.objetivo.desactivado }, despues: { desactivado: false } },
    });
    res.json({ ok: true });
  }
);

// GET /users/:id/sessions — sesiones abiertas (metadatos, nunca tokens).
router.get(
  '/users/:id/sessions',
  'session.manage',
  { objetivo: 'staff', prohibirPropietario: true },
  async (req, res) => {
    const { rows, error } = await sesionesDe(req.params.id);
    if (error) return res.status(500).json({ error: 'No se pudieron obtener las sesiones' });
    res.json({ rows });
  }
);

// POST /users/:id/cerrar-sesiones — invalida todas las sesiones del usuario.
router.post(
  '/users/:id/cerrar-sesiones',
  'session.manage',
  { objetivo: 'staff', prohibirPropietario: true },
  async (req, res) => {
    const { ok, cerradas } = await cerrarSesiones(req.params.id);
    if (!ok) return res.status(500).json({ error: 'No se pudieron cerrar las sesiones' });
    await logAdminAction(req.user, {
      accion: 'user.logout_all',
      entidad: 'auth.users',
      entidadId: req.params.id,
      detalle: { despues: { sesiones_cerradas: cerradas } },
    });
    res.json({ ok: true, cerradas });
  }
);

module.exports = router;
