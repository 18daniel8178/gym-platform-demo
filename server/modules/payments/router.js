const { Router } = require('express');
const { supabase } = require('../../infrastructure/supabase');
const { requireAuth } = require('../../middleware/requireAuth');
const { getGateway } = require('./gateway');
const { registrarPago } = require('./service');
const { errorDeMetodoDeCobro } = require('../settings/service');
const { activateMembership } = require('../memberships/service');

const router = Router();

// Procesa el pago vía el puerto PaymentGateway y, si es aprobado, registra el
// pago en el historial y activa la membresía.
router.post('/payments/checkout', requireAuth, async (req, res) => {
  const planId = Number(req.body?.plan_id);
  const metodo = req.body?.metodo;
  if (!planId) return res.status(400).json({ error: 'plan_id es requerido' });
  const eMetodo = await errorDeMetodoDeCobro(metodo);
  if (eMetodo) return res.status(eMetodo.estado).json({ error: eMetodo.mensaje });

  // Solo planes activos: un id viejo (cacheado) de un plan archivado no es comprable.
  const { data: plan, error: planError } = await supabase
    .from('membership_plans')
    .select('*')
    .eq('id', planId)
    .eq('activo', true)
    .maybeSingle();
  if (planError) return res.status(500).json({ error: 'No se pudo validar el plan' });
  if (!plan) return res.status(404).json({ error: 'El plan no está disponible' });

  const result = await getGateway().charge({ userId: req.user.id, plan, metodo });
  if (!result.ok) return res.status(402).json({ error: result.error });

  // Registrar el pago ANTES de activar: si la activación fallara, el cobro queda
  // registrado para reconciliar. Un fallo aquí es visible, nunca silencioso.
  const { error: payError } = await registrarPago({
    userId: req.user.id,
    planId: plan.id,
    monto: plan.precio,
    metodo,
    origen: 'checkout_simulado',
    referencia: result.reference,
  });
  if (payError) {
    console.error('checkout: no se pudo registrar el pago', payError.message);
    return res.status(500).json({ error: 'El pago fue aprobado pero no se pudo registrar' });
  }

  const { error } = await activateMembership(req.user.id, plan, { actor: req.user });
  if (error) return res.status(500).json({ error: 'El pago fue aprobado pero no se pudo activar la membresía' });

  res.set('Cache-Control', 'private, no-store');
  res.json({ ok: true, reference: result.reference });
});

module.exports = router;
