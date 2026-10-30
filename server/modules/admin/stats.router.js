const { crearRouterAdmin } = require('../../middleware/routerAdmin');
const { calcularStats } = require('./stats.service');

const router = crearRouterAdmin();

// KPIs agregados del dashboard. Solo lectura.
router.get('/stats', 'dashboard.read', async (_req, res) => {
  try {
    const stats = await calcularStats();
    res.json(stats);
  } catch (e) {
    console.error('stats: fallo al calcular', e.message);
    res.status(500).json({ error: 'No se pudieron calcular los indicadores' });
  }
});

module.exports = router;
