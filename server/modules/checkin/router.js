const { Router } = require('express');
const { requireAuth } = require('../../middleware/requireAuth');
const { tokenDeCarnet } = require('./carnet');

// Credencial del socio. El token lo firma el servidor, así que el socio no puede
// calcularlo —ni fabricar el de otro—: solo pedir el suyo.

const router = Router();

router.get('/carnet', requireAuth, (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  return res.json({ token: tokenDeCarnet(req.user.id) });
});

module.exports = router;
