const { supabase } = require('../../infrastructure/supabase');
const { aforoActual } = require('../checkin/aforo');
const { hoyPanama, sumarDias } = require('../memberships/service');

// Panamá es UTC-5 fijo (sin horario de verano): la medianoche local de una fecha
// YYYY-MM-DD es ese día a las 05:00 UTC. Se usa para acotar rangos por día local.
function inicioDiaPanamaUTC(fecha) {
  return `${fecha}T05:00:00Z`;
}

// Normaliza un teléfono a solo dígitos con prefijo de país (Panamá 507) para wa.me.
function telefonoWa(telefono) {
  if (!telefono) return null;
  let d = String(telefono).replace(/\D/g, '');
  if (!d) return null;
  if (d.length === 8) d = '507' + d; // número local sin prefijo
  return d;
}

// supabase-js NO lanza ante un error de consulta (timeout, error de Postgres):
// resuelve con { error }. Sin este chequeo, un fallo devolvería 0/[] como dato
// real y el dashboard mostraría KPIs falsos en vez de su estado de error.
function ok(res, contexto) {
  if (res.error) throw new Error(`${contexto}: ${res.error.message}`);
  return res;
}

// Perfiles (nombre y teléfono) indexados por user_id para combinar en memoria.
async function perfilesPorUserId(ids) {
  if (ids.length === 0) return {};
  const { data: perfiles } = ok(
    await supabase.from('profiles').select('user_id, nombre_completo, telefono').in('user_id', ids),
    'perfiles por vencer'
  );
  return Object.fromEntries((perfiles || []).map((p) => [p.user_id, p]));
}

// Membresías por vencer en los próximos 7 días (lista accionable con contacto).
// memberships y profiles no tienen FK directa entre sí (ambas referencian
// auth.users), así que no se pueden unir en PostgREST: se consultan por separado
// y se combinan por user_id. El plan sí se embebe (FK memberships → membership_plans).
async function listarPorVencer(hoy, en7dias) {
  const { data: porVencerRaw } = ok(
    await supabase
      .from('memberships')
      .select('user_id, fecha_fin, plan:membership_plans(nombre)')
      .gte('fecha_fin', hoy)
      .lte('fecha_fin', en7dias)
      .order('fecha_fin'),
    'por vencer'
  );
  const perfilesPorId = await perfilesPorUserId((porVencerRaw || []).map((m) => m.user_id));
  return (porVencerRaw || []).map((m) => {
    const perfil = perfilesPorId[m.user_id];
    return {
      user_id: m.user_id,
      fecha_fin: m.fecha_fin,
      plan: m.plan?.nombre ?? null,
      nombre: perfil?.nombre_completo ?? null,
      telefono_wa: telefonoWa(perfil?.telefono),
    };
  });
}

// Ingresos del mes en curso (aprobados). Recepción = ingreso real; el checkout
// simulado se muestra aparte para no inflar el KPI mientras rige el pago simulado.
async function calcularIngresosMes(inicioMes) {
  const { data: pagosMes } = ok(
    await supabase.from('payments').select('monto, origen, metodo').eq('estado', 'aprobado').gte('created_at', inicioMes),
    'ingresos'
  );
  const ingresos = { recepcion: 0, checkout_simulado: 0, por_metodo: {} };
  for (const p of pagosMes || []) {
    const monto = Number(p.monto) || 0;
    if (p.origen === 'recepcion') {
      ingresos.recepcion += monto;
      const m = p.metodo || 'otro';
      ingresos.por_metodo[m] = (ingresos.por_metodo[m] || 0) + monto;
    } else if (p.origen === 'checkout_simulado') {
      ingresos.checkout_simulado += monto;
    }
  }
  return ingresos;
}

// Lista accionable de pendientes de firma/foto (sin datos sensibles). Un socio
// archivado salió de la operación: no se le espera en recepción.
async function listarPendientesFirmaFoto() {
  const { data: pendientesRaw } = ok(
    await supabase
      .from('profiles')
      .select('user_id, nombre_completo, created_at')
      .eq('firma_foto_pendiente', true)
      .neq('estado_miembro', 'archivado')
      .order('created_at')
      .limit(50),
    'pendientes firma/foto (lista)'
  );
  return (pendientesRaw || []).map((p) => ({
    user_id: p.user_id,
    nombre: p.nombre_completo,
  }));
}

async function calcularStats() {
  const hoy = hoyPanama();
  const en7dias = sumarDias(hoy, 7);
  const hace30 = sumarDias(hoy, -30);
  const inicioMes = inicioDiaPanamaUTC(`${hoy.slice(0, 7)}-01`);

  // Socios activos: membresías cuya fecha_fin >= hoy (hora de Panamá)
  const { count: activos } = ok(
    await supabase.from('memberships').select('user_id', { count: 'exact', head: true }).gte('fecha_fin', hoy),
    'socios activos'
  );

  // Nuevos registros en los últimos 30 días
  const { count: nuevos30d } = ok(
    await supabase.from('profiles').select('user_id', { count: 'exact', head: true }).gte('created_at', inicioDiaPanamaUTC(hace30)),
    'nuevos registros'
  );

  const porVencer = await listarPorVencer(hoy, en7dias);
  const ingresos = await calcularIngresosMes(inicioMes);

  // Cola de pendientes de firma/foto: conteo + lista accionable
  const { count: pendientesFirmaFoto } = ok(
    await supabase
      .from('profiles')
      .select('user_id', { count: 'exact', head: true })
      .eq('firma_foto_pendiente', true)
      .neq('estado_miembro', 'archivado'),
    'pendientes firma/foto (conteo)'
  );
  const pendientesLista = await listarPendientesFirmaFoto();

  // Aforo actual: entradas del día + corrección manual (modules/checkin/aforo.js)
  const { aforo } = await aforoActual();

  return {
    socios_activos: activos ?? 0,
    nuevos_30d: nuevos30d ?? 0,
    por_vencer: porVencer,
    ingresos_mes: ingresos,
    pendientes_firma_foto: pendientesFirmaFoto ?? 0,
    pendientes_lista: pendientesLista,
    aforo: aforo ?? null,
  };
}

module.exports = { calcularStats, telefonoWa };
