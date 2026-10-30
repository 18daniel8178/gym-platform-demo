const { supabase } = require('../infrastructure/supabase');
const { CATALOGO, validarPermiso } = require('../modules/admin/permisos');

// RBAC del backoffice (Fase 1 · Bloque 1). El PROPIETARIO se identifica por
// app_metadata.role === 'admin' (bootstrap sin riesgo de lockout) y equivale a
// todos los permisos. El resto del staff obtiene permisos `recurso.accion` de
// sus roles en BD, cargados por request (revocación inmediata, como getUser).

function esPropietario(user) {
  return user?.app_metadata?.role === 'admin';
}

// Carga el set de permisos del usuario. Una sola consulta (la función SQL
// resuelve el join user_roles x role_permissions) porque esto corre en CADA
// request del panel. Se cachea en req.permisos para no repetirla dentro del
// mismo request.
async function cargarPermisos(userId) {
  const { data, error } = await supabase.rpc('staff_permissions', { p_user_id: userId });
  if (error) throw new Error(`staff_permissions: ${error.message}`);
  return new Set((data || []).map((p) => p.permiso));
}

// El propietario obtiene el catálogo completo SIN consultar la base: el panel
// sigue accesible aunque el RBAC no esté instalado o la base falle. Esa es la
// garantía anti-lockout, ahora expresada como datos en vez de como un atajo
// dentro de cada guard —donde había que acordarse de repetirla.
async function resolverPermisos(user) {
  if (esPropietario(user)) return new Set(CATALOGO);
  return cargarPermisos(user.id);
}

async function permisosDe(req) {
  if (!req.permisos) req.permisos = await resolverPermisos(req.user);
  return req.permisos;
}

// Gate del chokepoint /api/admin: cualquiera con al menos un permiso, sea del
// personal o el propietario (que los tiene todos por resolverPermisos).
async function requireStaff(req, res, next) {
  try {
    const permisos = await permisosDe(req);
    if (permisos.size > 0) return next();
    return res.status(403).json({ error: 'Requiere una cuenta del personal del gimnasio' });
  } catch (e) {
    console.error('requireStaff:', e.message);
    return res.status(500).json({ error: 'No se pudieron verificar los permisos' });
  }
}

// Guard por endpoint. El permiso se valida contra el catálogo al construir el
// router: una errata revienta al arrancar, no deja el endpoint inalcanzable.
function requirePermission(permiso) {
  validarPermiso(permiso);
  const guard = async (req, res, next) => {
    try {
      const permisos = await permisosDe(req);
      if (permisos.has(permiso)) return next();
      return res.status(403).json({ error: 'No tienes permiso para esta acción' });
    } catch (e) {
      console.error('requirePermission:', permiso, e.message);
      return res.status(500).json({ error: 'No se pudieron verificar los permisos' });
    }
  };
  guard.permisoDeclarado = permiso; // marca que lee la auditoría de arranque
  return guard;
}

module.exports = {
  requirePermission,
  requireStaff,
  permisosDe,
  esPropietario,
  cargarPermisos,
};
