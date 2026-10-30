const { supabase } = require('../../infrastructure/supabase');
const { promoverProspecto } = require('../members/service');

// Regla de negocio: duración de cada periodo de membresía en días
const DIAS_POR_PERIODO = {
  diario: 1,
  mensual: 30,
  trimestral: 90,
  semestral: 180,
  anual: 365,
};

const TZ = 'America/Panama';

// Fecha de hoy (YYYY-MM-DD) en hora de Panamá. La función serverless de Vercel
// corre en UTC (Panamá es UTC-5): sin esto, un cobro de la noche caía "mañana"
// y las membresías vencían 5 horas antes del cierre real del gym.
function hoyPanama() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
}

// Suma días a una fecha YYYY-MM-DD y devuelve YYYY-MM-DD. Aritmética en UTC
// sobre la fecha-solo para evitar cualquier desfase de zona/horario.
function sumarDias(fecha, dias) {
  const d = new Date(fecha + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

// Cálculo puro de fechas de activación/renovación (testeable sin base de datos).
// Renovación anticipada CONSERVA los días restantes: si la membresía sigue
// vigente, extiende desde su fecha_fin y mantiene la fecha_inicio original;
// si está vencida o no existe, arranca hoy.
function calcularFechas(actual, periodo, hoy) {
  const dias = DIAS_POR_PERIODO[periodo] ?? 30;
  const vigente = Boolean(actual && actual.fecha_fin >= hoy);
  const fecha_inicio = vigente ? actual.fecha_inicio : hoy;
  const base = vigente ? actual.fecha_fin : hoy;
  return { fecha_inicio, fecha_fin: sumarDias(base, dias) };
}

function diasEntre(desde, hasta) {
  return Math.round((Date.parse(hasta + 'T00:00:00Z') - Date.parse(desde + 'T00:00:00Z')) / 86400000);
}

// Periodo en curso { inicio, fin } para el progreso que ve el socio. Como la
// renovación a tiempo conserva la fecha_inicio original, medir desde ella da
// más del 90 % tras unos meses: se mide el tramo de un periodo del plan que
// contiene a hoy, contado hacia atrás desde fecha_fin y sin pasar de fecha_inicio.
function periodoEnCurso({ fecha_inicio, fecha_fin }, periodo, hoy) {
  const dias = DIAS_POR_PERIODO[periodo] ?? 30;
  const tramos = Math.max(1, Math.ceil(diasEntre(hoy, fecha_fin) / dias));
  const fin = sumarDias(fecha_fin, -(tramos - 1) * dias);
  const desde = sumarDias(fin, -dias);
  return { inicio: desde > fecha_inicio ? desde : fecha_inicio, fin };
}

function derivarEstado(membership) {
  return membership.fecha_fin >= hoyPanama() ? 'activa' : 'vencida';
}

async function getMembership(userId) {
  return supabase
    .from('memberships')
    .select('*, plan:membership_plans(*)')
    .eq('user_id', userId)
    .maybeSingle();
}

// Crea o renueva la membresía del usuario aplicando la regla de renovación.
// Única puerta de escritura de memberships (checkout y cobro en recepción pasan por aquí).
// `actor` es quien la activa (el socio en el checkout, el personal en recepción):
// si el socio era prospecto, contratar lo pasa a activo y eso queda auditado a su nombre.
async function activateMembership(userId, plan, { actor }) {
  const { data: actual } = await getMembership(userId);
  const { fecha_inicio, fecha_fin } = calcularFechas(actual, plan.periodo, hoyPanama());
  const { error } = await supabase.from('memberships').upsert(
    {
      user_id: userId,
      plan_id: plan.id,
      fecha_inicio,
      fecha_fin,
    },
    { onConflict: 'user_id' }
  );
  if (!error) await promoverProspecto(userId, actor);
  return { error, fecha_inicio, fecha_fin };
}

// Ajuste excepcional de fechas sin pago (corrección/compensación por el staff).
// Única puerta de escritura de memberships junto con activateMembership.
async function setFechas(userId, fecha_inicio, fecha_fin) {
  const { data, error } = await supabase
    .from('memberships')
    .update({ fecha_inicio, fecha_fin })
    .eq('user_id', userId)
    .select('*, plan:membership_plans(nombre, periodo, precio)')
    .single();
  return { data, error };
}

module.exports = {
  DIAS_POR_PERIODO,
  hoyPanama,
  sumarDias,
  calcularFechas,
  periodoEnCurso,
  derivarEstado,
  getMembership,
  activateMembership,
  setFechas,
};
