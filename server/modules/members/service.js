const { supabase } = require('../../infrastructure/supabase');
const { logAdminAction } = require('../admin/audit');

// Acceso a datos del expediente del socio. Lo que necesita varias tablas o una
// transacción vive en funciones SQL (migración 2026_09_miembros.sql); aquí solo
// se las llama y se leen o escriben filas sueltas.

// En recepción el socio firma el formulario de ingreso delante del personal, que
// lo registra: el medio es 'mostrador' y quién lo capturó queda en registrado_por.
const EVIDENCIA_MOSTRADOR = 'Firma del formulario de ingreso en recepción';

// Coincidencias por documento o correo normalizados, archivados incluidos.
async function buscarCoincidencias({ documento = null, email = null, excluir = null }) {
  const { data, error } = await supabase.rpc('miembros_coincidentes', {
    p_documento: documento,
    p_email: email,
    p_excluir: excluir,
  });
  return { data: data || [], error };
}

async function etiquetasEnUso() {
  const { data, error } = await supabase.rpc('etiquetas_en_uso');
  return { data: data || [], error };
}

// Perfil y consentimientos en una sola transacción. La cuenta ya existe en Auth.
//   alta: { estado, origen, consentimientos, exigirObligatorios }
async function crearMiembro({ userId, perfil, alta, registradoPor }) {
  const conConsentimientos = alta.consentimientos.length > 0;
  return supabase.rpc('alta_miembro', {
    p_user_id: userId,
    p_perfil: perfil,
    p_origen: alta.origen,
    p_estado: alta.estado,
    p_consentimientos: alta.consentimientos,
    p_medio: conConsentimientos ? 'mostrador' : null,
    p_evidencia: conConsentimientos ? EVIDENCIA_MOSTRADOR : null,
    p_registrado_por: registradoPor,
    p_exigir_obligatorios: alta.exigirObligatorios,
  });
}

async function leerEstado(userId) {
  return supabase
    .from('profiles')
    .select('user_id, estado_miembro, estado_motivo, etiquetas')
    .eq('user_id', userId)
    .maybeSingle();
}

// Aplica una transición YA validada. Compare-and-swap sobre el estado leído: si
// otro la cambió entre la lectura y la escritura, no se pisa (cambiado = false).
async function aplicarEstado({ userId, de, a, motivo }) {
  const { data, error } = await supabase
    .from('profiles')
    .update({ estado_miembro: a, estado_motivo: motivo, estado_cambiado_en: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('estado_miembro', de)
    .select('user_id');
  return { cambiado: Boolean(data && data.length), error };
}

// Un prospecto que contrata su primera membresía pasa a activo. Es un EVENTO,
// no una derivación: si después la membresía vence, el socio sigue activo. Un
// fallo aquí se registra y no tumba el cobro, que ya está hecho.
async function promoverProspecto(userId, actor) {
  const { cambiado, error } = await aplicarEstado({ userId, de: 'prospecto', a: 'activo', motivo: null });
  if (error) {
    console.error('promoverProspecto: no se pudo pasar a activo', userId, error.message);
    return;
  }
  if (!cambiado) return;
  await logAdminAction(actor, {
    accion: 'member.estado',
    entidad: 'profiles',
    entidadId: userId,
    detalle: {
      antes: { estado_miembro: 'prospecto' },
      despues: { estado_miembro: 'activo' },
      nota: 'Contrató su primera membresía',
    },
  });
}

async function guardarEtiquetas(userId, etiquetas) {
  return supabase.from('profiles').update({ etiquetas }).eq('user_id', userId);
}

module.exports = {
  buscarCoincidencias,
  etiquetasEnUso,
  crearMiembro,
  leerEstado,
  aplicarEstado,
  promoverProspecto,
  guardarEtiquetas,
};
