const { crearRouterAdmin } = require('../../middleware/routerAdmin');
const { permisosDe } = require('../../middleware/requirePermission');
const { lineaDeTiempo } = require('./historial');
const { fuentesDelExpediente } = require('./historial.service');

// Línea de tiempo del expediente (§13.7). Va aparte de la ficha porque es la
// consulta más pesada —cinco tablas— y la ficha se abre muchas veces al día.

const router = crearRouterAdmin();

// GET /members/:userId/historial — los eventos del socio, del más reciente al
// más viejo. Los importes solo viajan a quien puede ver el dinero (payment.read)
// y el correo de quien hizo cada cosa, a quien puede ver cuentas del personal
// (user.read), como en la bitácora y en los consentimientos.
router.get('/members/:userId/historial', 'member.read', async (req, res) => {
  const { fuentes, error } = await fuentesDelExpediente(req.params.userId);
  if (error) return res.status(500).json({ error: 'No se pudo leer el historial del socio' });
  if (!fuentes.perfil) return res.status(404).json({ error: 'El socio no existe' });

  const permisos = await permisosDe(req);
  return res.json(lineaDeTiempo(fuentes, {
    importes: permisos.has('payment.read'),
    actores: permisos.has('user.read'),
  }));
});

module.exports = router;
