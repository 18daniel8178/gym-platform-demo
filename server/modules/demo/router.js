const { Router } = require('express');
const { supabase } = require('../../infrastructure/supabase');
const { CUENTAS_DEMO, cuentaDemo } = require('./cuentas');

// Rutas de la demo local. Se montan SOLO en modo demo
// (modoDemo.js): en producción no existen. Ninguna acepta una cuenta que no esté
// en la lista fija de cuentas de demo.

const router = Router();

// GET /api/demo/cuentas — las cuentas para los botones "Entrar como…".
router.get('/cuentas', (_req, res) => {
  res.json(CUENTAS_DEMO.map(({ clave, etiqueta, nombre }) => ({ clave, etiqueta, nombre })));
});

// POST /api/demo/entrar — entrada de un clic SIN contraseña. Pide a Auth un
// enlace mágico para la cuenta de demo y devuelve su token; el cliente lo canjea
// con verifyOtp y queda con una sesión normal. La cuenta se valida contra la
// lista ANTES de hablar con Auth: una ajena no genera ningún acceso.
router.post('/entrar', async (req, res) => {
  const cuenta = cuentaDemo((req.body || {}).cuenta);
  if (!cuenta) return res.status(400).json({ error: 'Esa cuenta no es de la demo' });

  const { data, error } = await supabase.auth.admin.generateLink({ type: 'magiclink', email: cuenta.email });
  if (error) {
    console.error('demo: no se pudo generar el acceso', cuenta.clave, error.message);
    return res.status(500).json({ error: 'No se pudo abrir la sesión de demo. ¿Están sembrados los datos? (npm run demo:reset)' });
  }
  res.set('Cache-Control', 'private, no-store');
  return res.json({ token_hash: data.properties.hashed_token, tipo: data.properties.verification_type });
});

module.exports = router;
