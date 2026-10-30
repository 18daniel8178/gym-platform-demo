const { crearRouterAdmin } = require('../../middleware/routerAdmin');
const { supabase } = require('../../infrastructure/supabase');
const { logAdminAction } = require('../admin/audit');
const { registrarPago, anularPagoInterno } = require('../payments/service');
const { errorDeMetodoDeCobro } = require('../settings/service');
const { activateMembership, setFechas, getMembership, derivarEstado } = require('./service');

const router = crearRouterAdmin();

// POST /members/:userId/membership — cobro en recepción a un socio.
// Registra el pago (origen recepción, monto snapshot) y activa/renueva la
// membresía con la regla de renovación (conserva días). Cada paso queda auditado.
router.post('/members/:userId/membership', 'membership.collect', async (req, res) => {
  const userId = req.params.userId;
  const planId = Number(req.body?.plan_id);
  const metodo = req.body?.metodo;
  if (!planId) return res.status(400).json({ error: 'plan_id es requerido' });
  const eMetodo = await errorDeMetodoDeCobro(metodo);
  if (eMetodo) return res.status(eMetodo.estado).json({ error: eMetodo.mensaje });

  const { data: plan, error: planError } = await supabase
    .from('membership_plans')
    .select('*')
    .eq('id', planId)
    .eq('activo', true)
    .maybeSingle();
  if (planError) return res.status(500).json({ error: 'No se pudo validar el plan' });
  if (!plan) return res.status(404).json({ error: 'El plan no está disponible' });

  const { data: pago, error: payError, duplicado } = await registrarPago({
    userId,
    planId: plan.id,
    monto: plan.precio,
    metodo,
    origen: 'recepcion',
    registradoPor: req.user.id,
  });
  if (payError) return res.status(500).json({ error: 'No se pudo registrar el pago' });
  // Cobro idéntico muy reciente: ya se procesó, no re-activar (evita doble extensión).
  if (duplicado) return res.json({ ok: true, duplicado: true });

  const { error, fecha_inicio, fecha_fin } = await activateMembership(userId, plan, { actor: req.user });
  if (error) {
    // Compensación: anula el pago recién creado para no dejarlo huérfano ni inflar el KPI.
    await anularPagoInterno(pago.id, 'Activación de membresía falló');
    return res.status(500).json({ error: 'No se pudo activar la membresía; el cobro fue revertido, intenta de nuevo' });
  }

  await logAdminAction(req.user, {
    accion: 'membership.activate',
    entidad: 'memberships',
    entidadId: userId,
    detalle: { despues: { plan: plan.nombre, monto: plan.precio, metodo, fecha_inicio, fecha_fin, origen: 'recepcion' } },
  });
  res.json({ ok: true, fecha_inicio, fecha_fin });
});

// PATCH /memberships/:userId — corrige fechas sin generar pago (compensación).
router.patch('/memberships/:userId', 'membership.adjust', async (req, res) => {
  const userId = req.params.userId;
  const { data: actual } = await getMembership(userId);
  if (!actual) return res.status(404).json({ error: 'El socio no tiene membresía' });

  const fecha_inicio = req.body?.fecha_inicio ?? actual.fecha_inicio;
  const fecha_fin = req.body?.fecha_fin ?? actual.fecha_fin;
  const ISO = /^\d{4}-\d{2}-\d{2}$/;
  if (!ISO.test(fecha_inicio) || !ISO.test(fecha_fin)) return res.status(400).json({ error: 'Fechas inválidas (YYYY-MM-DD)' });
  if (fecha_fin < fecha_inicio) return res.status(400).json({ error: 'La fecha de fin no puede ser anterior a la de inicio' });

  const { data, error } = await setFechas(userId, fecha_inicio, fecha_fin);
  if (error) return res.status(500).json({ error: 'No se pudieron actualizar las fechas' });

  await logAdminAction(req.user, {
    accion: 'membership.fechas',
    entidad: 'memberships',
    entidadId: userId,
    detalle: { antes: { fecha_inicio: actual.fecha_inicio, fecha_fin: actual.fecha_fin }, despues: { fecha_inicio, fecha_fin } },
  });
  res.json({ ...data, estado: derivarEstado(data) });
});

module.exports = router;
