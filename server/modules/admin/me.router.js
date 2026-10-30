const { crearRouterAdmin, IDENTIDAD_PROPIA } = require('../../middleware/routerAdmin');
const { supabase } = require('../../infrastructure/supabase');
const { esPropietario, permisosDe } = require('../../middleware/requirePermission');

const router = crearRouterAdmin();

// Roles asignados de una cuenta del personal (claves legibles para la UI).
async function rolesDe(userId) {
  const { data } = await supabase
    .from('user_roles')
    .select('role:roles(clave)')
    .eq('user_id', userId);
  return (data || []).map((a) => a.role?.clave).filter(Boolean);
}

// Identidad, roles y permisos vigentes de quien pregunta: es lo que el panel
// usa para armar su menú y decidir qué acciones ofrece. Responde SIEMPRE la
// misma forma —el propietario dejó de ser un caso especial con el comodín '*'—
// para que ningún consumidor tenga que aprenderse dos representaciones.
// Ocultar opciones en la UI no es seguridad: cada endpoint revalida su permiso.
router.get('/me', IDENTIDAD_PROPIA, async (req, res) => {
  const permisos = await permisosDe(req);
  const roles = esPropietario(req.user) ? ['propietario'] : await rolesDe(req.user.id);
  res.json({
    id: req.user.id,
    email: req.user.email,
    roles,
    permisos: [...permisos].sort(),
  });
});

module.exports = router;
