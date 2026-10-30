const { crearRouterAdmin } = require('../../middleware/routerAdmin');
const { logAdminAction } = require('../admin/audit');
const servicio = require('./service');

const router = crearRouterAdmin();

// Misma puerta que el resto de la configuración del negocio (§13.5 del
// documento): quien puede tocar los ajustes puede tocar la sucursal.
const PERMISO = 'settings.update';

// GET /sucursal — la sucursal principal, para la pestaña de Ajustes.
router.get('/sucursal', PERMISO, async (_req, res) => {
  const { sucursal, error } = await servicio.leerSucursal();
  if (error) return res.status(500).json({ error: 'No se pudo cargar la sucursal' });
  res.json({ sucursal });
});

// PATCH /sucursal — nombre, dirección, teléfono y zona horaria.
router.patch('/sucursal', PERMISO, async (req, res) => {
  const { antes, despues, error, invalido } = await servicio.guardarSucursal({ cambios: req.body || {} });
  if (error) return res.status(invalido ? 400 : 500).json({ error });

  await logAdminAction(req.user, {
    accion: 'branch.update',
    entidad: 'branch',
    entidadId: despues.codigo,
    detalle: { antes, despues },
  });
  res.json({ sucursal: despues });
});

module.exports = router;
