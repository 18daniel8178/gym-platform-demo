const { Router } = require('express');
const { requireAuth } = require('../../middleware/requireAuth');
const { getMembership, derivarEstado, periodoEnCurso, hoyPanama } = require('./service');

const router = Router();

router.get('/membership', requireAuth, async (req, res) => {
  const { data, error } = await getMembership(req.user.id);
  if (error) return res.status(500).json({ error: 'No se pudo obtener la membresía' });
  res.set('Cache-Control', 'private, no-store');
  if (!data) return res.json(null);
  res.json({ ...data, estado: derivarEstado(data), periodo_actual: periodoEnCurso(data, data.plan?.periodo, hoyPanama()) });
});

module.exports = router;
