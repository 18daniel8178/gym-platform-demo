const { crearRouterAdmin } = require('../../middleware/routerAdmin');
const { supabase } = require('../../infrastructure/supabase');
const { logAdminAction } = require('../admin/audit');
const { registrarPago } = require('./service');
const { errorDeMetodoDeCobro, metodoConocido } = require('../settings/service');
const { sumarDias } = require('../memberships/service');
const { toCsv } = require('../../lib/csv');

const router = crearRouterAdmin();

const CAP_HIST = 5000;

// Aplica los filtros del historial (fechas en hora de Panamá, método, origen, estado).
async function construirQuery(req) {
  let q = supabase
    .from('payments')
    .select('id, user_id, nombre_cliente, monto, metodo, origen, estado, referencia, created_at')
    .order('created_at', { ascending: false })
    .limit(CAP_HIST);
  const { desde, hasta, metodo, origen, estado } = req.query;
  // Panamá es UTC-5: la medianoche local de un día es ese día a las 05:00 UTC.
  if (desde) q = q.gte('created_at', `${desde}T05:00:00Z`);
  if (hasta) q = q.lt('created_at', `${sumarDias(hasta, 1)}T05:00:00Z`);
  // Conocido, no activo: si se filtra por un método ya retirado, sus pagos
  // tienen que seguir apareciendo en el informe.
  if (metodo) {
    const { valido, error } = await metodoConocido(metodo);
    // No poder comprobarlo no es "no es conocido": sin esto el filtro se cae en
    // silencio y el informe (o el CSV) sale con TODOS los métodos.
    if (error) return { data: null, error };
    if (valido) q = q.eq('metodo', metodo);
  }
  if (origen && ['recepcion', 'checkout_simulado'].includes(origen)) q = q.eq('origen', origen);
  if (estado && ['aprobado', 'anulado'].includes(estado)) q = q.eq('estado', estado);
  return q;
}

// Resuelve el nombre del cliente por user_id (merge: no hay FK payments↔profiles).
async function resolverNombres(rows) {
  const ids = [...new Set(rows.filter((r) => r.user_id).map((r) => r.user_id))];
  if (ids.length === 0) return {};
  const { data } = await supabase.from('profiles').select('user_id, nombre_completo').in('user_id', ids);
  return Object.fromEntries((data || []).map((p) => [p.user_id, p.nombre_completo]));
}

const nombreCliente = (r, nombres) => r.nombre_cliente || nombres[r.user_id] || '—';

// Normaliza y valida el body del pase diario. Devuelve { error } o los datos del cobro.
async function leerPaseDiario(body) {
  const nombre = (body.nombre_cliente || '').trim();
  const metodo = body.metodo;
  const planId = body.plan_id ? Number(body.plan_id) : null;
  const monto = body.monto != null ? Number(body.monto) : null;
  if (!nombre) return { error: 'El nombre del cliente es requerido' };
  const eMetodo = await errorDeMetodoDeCobro(metodo);
  if (eMetodo) return { error: eMetodo.mensaje };
  return { nombre, metodo, planId, monto };
}

// Si se indica un plan, el monto es el precio snapshot de ese plan activo.
async function resolverMontoPase(planId, monto) {
  if (!planId) return { monto };
  const { data: plan } = await supabase.from('membership_plans').select('precio').eq('id', planId).eq('activo', true).maybeSingle();
  if (!plan) return { error: 'El plan no está disponible' };
  return { monto: Number(plan.precio) };
}

// POST /payments/pase-diario — venta de un pase a un visitante sin cuenta.
// Registra el pago (user_id null + nombre_cliente); no toca membresías.
router.post('/payments/pase-diario', 'payment.create', async (req, res) => {
  const { error: errBody, nombre, metodo, planId, monto: montoBody } = await leerPaseDiario(req.body || {});
  if (errBody) return res.status(400).json({ error: errBody });

  const { error: errPlan, monto } = await resolverMontoPase(planId, montoBody);
  if (errPlan) return res.status(404).json({ error: errPlan });
  if (!Number.isFinite(monto) || monto <= 0) return res.status(400).json({ error: 'El monto debe ser mayor que 0' });

  const { data, error, duplicado } = await registrarPago({
    nombreCliente: nombre,
    planId,
    monto,
    metodo,
    origen: 'recepcion',
    registradoPor: req.user.id,
  });
  if (error) return res.status(500).json({ error: 'No se pudo registrar el pago' });
  if (duplicado) return res.status(200).json({ ok: true, id: data.id, duplicado: true });

  await logAdminAction(req.user, {
    accion: 'payment.create',
    entidad: 'payments',
    entidadId: data.id,
    detalle: { despues: { nombre_cliente: nombre, monto, metodo, origen: 'recepcion', tipo: 'pase_diario' } },
  });
  res.status(201).json({ ok: true, id: data.id });
});

// Lee el pago y verifica que se pueda anular (existe y está aprobado).
async function validarPagoAnulable(id) {
  const { data: pago, error } = await supabase.from('payments').select('*').eq('id', id).maybeSingle();
  if (error) return { status: 500, error: 'No se pudo leer el pago' };
  if (!pago) return { status: 404, error: 'El pago no existe' };
  if (pago.estado !== 'aprobado') return { status: 409, error: 'Solo se pueden anular pagos aprobados' };
  return { pago };
}

// Compare-and-swap: solo pasa de aprobado→anulado. En carrera, el segundo ve 0 filas.
async function anularSiAprobado(id, motivo) {
  const { data: filas, error } = await supabase
    .from('payments')
    .update({ estado: 'anulado', motivo_anulacion: motivo })
    .eq('id', id)
    .eq('estado', 'aprobado')
    .select('id');
  if (error) return { status: 500, error: 'No se pudo anular el pago' };
  if (!filas || filas.length === 0) return { status: 409, error: 'El pago ya no estaba aprobado' };
  return {};
}

// Si el pago anulado era un cobro de membresía, la membresía sigue activa: avisar
// para que el staff ajuste las fechas a mano (no hay enlace pago↔periodo para revertir).
function avisoAnulacion(pago) {
  const afectaMembresia = pago.origen === 'recepcion' && pago.user_id && pago.plan_id;
  return afectaMembresia
    ? 'El pago se anuló, pero la membresía del socio sigue activa. Ajusta sus fechas manualmente si corresponde.'
    : null;
}

// POST /payments/:id/anular — anula un pago (aprobado → anulado). Motivo obligatorio.
router.post('/payments/:id/anular', 'payment.void', async (req, res) => {
  const id = Number(req.params.id);
  const motivo = (req.body?.motivo || '').trim();
  if (!id) return res.status(400).json({ error: 'Id inválido' });
  if (!motivo) return res.status(400).json({ error: 'El motivo de anulación es requerido' });

  const { pago, status: st0, error: e0 } = await validarPagoAnulable(id);
  if (e0) return res.status(st0).json({ error: e0 });

  const { status: st1, error: e1 } = await anularSiAprobado(id, motivo);
  if (e1) return res.status(st1).json({ error: e1 });

  await logAdminAction(req.user, {
    accion: 'payment.void',
    entidad: 'payments',
    entidadId: id,
    detalle: { antes: { estado: 'aprobado' }, despues: { estado: 'anulado', motivo } },
  });
  res.json({ ok: true, aviso: avisoAnulacion(pago) });
});

// Totales del filtro (los anulados no cuentan como ingreso).
function calcularTotales(pagos) {
  const totales = { recepcion: 0, checkout_simulado: 0, aprobados: 0, anulados: 0 };
  for (const p of pagos) {
    if (p.estado === 'anulado') { totales.anulados += 1; continue; }
    totales.aprobados += 1;
    const monto = Number(p.monto) || 0;
    if (p.origen === 'recepcion') totales.recepcion += monto;
    else if (p.origen === 'checkout_simulado') totales.checkout_simulado += monto;
  }
  return totales;
}

// Proyección de una fila del historial para la respuesta JSON.
function filaPago(r, nombres) {
  return {
    id: r.id,
    created_at: r.created_at,
    cliente: nombreCliente(r, nombres),
    monto: r.monto,
    metodo: r.metodo,
    origen: r.origen,
    estado: r.estado,
    referencia: r.referencia,
  };
}

// GET /payments — historial con filtros, totales y paginación.
router.get('/payments', 'payment.read', async (req, res) => {
  const page = Math.max(0, Number(req.query.page) || 0);
  const pageSize = Math.min(50, Math.max(1, Number(req.query.pageSize) || 20));

  const { data: todo, error } = await construirQuery(req);
  if (error) return res.status(500).json({ error: 'No se pudo obtener el historial' });
  const pagos = todo || [];
  const truncado = pagos.length >= CAP_HIST;

  const totales = calcularTotales(pagos);
  const pagina = pagos.slice(page * pageSize, page * pageSize + pageSize);
  const nombres = await resolverNombres(pagina);
  const rows = pagina.map((r) => filaPago(r, nombres));

  res.json({ total: pagos.length, page, pageSize, truncado, totales, rows });
});

// GET /payments/export — mismo filtro, descarga CSV (nunca datos de salud; anti-fórmulas).
router.get('/payments/export', 'payment.export', async (req, res) => {
  const { data: todo, error } = await construirQuery(req);
  if (error) return res.status(500).json({ error: 'No se pudo generar el reporte' });
  const nombres = await resolverNombres(todo || []);

  const headers = ['Fecha', 'Cliente', 'Monto', 'Método', 'Origen', 'Estado', 'Referencia'];
  const filas = (todo || []).map((r) => [
    r.created_at, nombreCliente(r, nombres), r.monto, r.metodo || '', r.origen, r.estado, r.referencia || '',
  ]);
  const csv = toCsv(headers, filas);

  res.set('Content-Type', 'text/csv; charset=utf-8');
  res.set('Content-Disposition', 'attachment; filename="pagos-forja.csv"');
  res.send('﻿' + csv); // BOM para que Excel respete UTF-8
});

module.exports = router;
