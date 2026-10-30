const { supabase } = require('../../infrastructure/supabase');
const { leerTodo } = require('../settings/service');
const { hoyPanama } = require('../memberships/service');

// Datos del check-in: lo que la decisión necesita saber y el registro de lo que
// se decidió. La decisión en sí es pura y vive en decision.js.

const VENTANA_POR_DEFECTO = 120;

// Proyección mínima del socio para la pantalla de recepción: lo justo para
// identificarlo y decidir. Sin documento completo, sin teléfono, sin importes.
const CAMPOS_SOCIO = 'user_id, nombre_completo, estado_miembro, estado_motivo, etiquetas, firma_foto_pendiente';

const documentoParcial = (documento) => (documento ? `…${String(documento).slice(-4)}` : null);

// Última entrada PERMITIDA y no anulada: es la que decide si ya está dentro.
async function ultimaEntradaDe(userId) {
  const { data } = await supabase
    .from('checkins')
    .select('id, ocurrido_en')
    .eq('user_id', userId)
    .eq('resultado', 'permitido')
    .is('anulado_en', null)
    .order('ocurrido_en', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data || null;
}

async function datosParaDecidir(userId) {
  const [{ data: socio, error }, membresia, ultimaEntrada, ajustes] = await Promise.all([
    supabase.from('profiles').select(CAMPOS_SOCIO).eq('user_id', userId).maybeSingle(),
    supabase.from('memberships').select('fecha_fin, plan:membership_plans(nombre)').eq('user_id', userId).maybeSingle(),
    ultimaEntradaDe(userId),
    leerTodo(),
  ]);
  const ajustesLeidos = ajustes?.ajustes || {};
  if (error) return { error };
  if (!socio) return { noExiste: true };

  const ventana = Number(ajustesLeidos.politicas?.checkin_ventana_minutos);
  return {
    datos: {
      socio,
      membresia: membresia?.data || null,
      ultimaEntrada,
      horario: ajustesLeidos.horario,
      ventanaMinutos: Number.isFinite(ventana) ? ventana : VENTANA_POR_DEFECTO,
    },
  };
}

// Una fila por intento, permitido o rechazado. Forzar conserva el motivo del
// rechazo original: eso es lo que después hay que poder auditar.
async function registrarIntento({ userId, resultado, motivo, metodo, actor, forzado = false, motivoForzado = null }) {
  const { data, error } = await supabase
    .from('checkins')
    .insert({
      user_id: userId,
      resultado,
      motivo,
      metodo,
      forzado,
      motivo_forzado: motivoForzado,
      atendido_por: actor?.id || null,
    })
    .select('id, ocurrido_en, resultado, motivo, forzado')
    .single();
  return { checkin: data, error };
}

// Búsqueda manual: la alternativa cuando el QR no se puede leer. Devuelve lo
// mínimo para identificar a la persona que está enfrente.
async function buscarSocios(texto) {
  const q = String(texto || '').trim();
  if (q.length < 2) return { socios: [] };

  const patron = `%${q}%`;
  const { data, error } = await supabase
    .from('profiles')
    .select('user_id, nombre_completo, documento, estado_miembro')
    .or(`nombre_completo.ilike.${patron},documento.ilike.${patron},telefono.ilike.${patron}`)
    .neq('estado_miembro', 'archivado')
    .order('nombre_completo')
    .limit(8);
  if (error) return { error };

  return {
    socios: (data || []).map((s) => ({
      user_id: s.user_id,
      nombre_completo: s.nombre_completo,
      documento_parcial: documentoParcial(s.documento),
      estado_miembro: s.estado_miembro,
    })),
  };
}

// Las entradas del día, para el historial de la pantalla y la conciliación del
// aforo. Incluye los rechazos: son parte de lo que pasó en la puerta.
async function entradasDelDia(desde) {
  const { data, error } = await supabase
    .from('checkins')
    .select('id, ocurrido_en, resultado, motivo, metodo, forzado, motivo_forzado, anulado_en, motivo_anulacion, user_id')
    .gte('ocurrido_en', desde)
    .order('ocurrido_en', { ascending: false })
    .limit(200);
  if (error) return { error };

  const ids = [...new Set((data || []).map((c) => c.user_id))];
  const { data: socios } = ids.length
    ? await supabase.from('profiles').select('user_id, nombre_completo').in('user_id', ids)
    : { data: [] };
  const nombre = Object.fromEntries((socios || []).map((s) => [s.user_id, s.nombre_completo]));
  return { entradas: (data || []).map((c) => ({ ...c, nombre: nombre[c.user_id] || 'Socio' })) };
}

async function anularEntrada({ id, actor, motivo }) {
  const { data, error } = await supabase
    .from('checkins')
    .update({ anulado_en: new Date().toISOString(), anulado_por: actor.id, motivo_anulacion: motivo })
    .eq('id', id)
    .select('id, user_id, resultado, motivo')
    .maybeSingle();
  return { checkin: data, error };
}

module.exports = { datosParaDecidir, registrarIntento, buscarSocios, entradasDelDia, anularEntrada, hoyPanama };
