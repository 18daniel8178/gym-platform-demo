const { supabase } = require('../../infrastructure/supabase');

const OCULTO = '[oculto]';

// Nunca deja pasar condiciones_medicas (dato de salud) en claro al diff auditado.
function redactar(detalle) {
  if (!detalle || typeof detalle !== 'object') return detalle;
  const clon = JSON.parse(JSON.stringify(detalle));
  for (const lado of ['antes', 'despues']) {
    if (clon[lado] && typeof clon[lado] === 'object' && 'condiciones_medicas' in clon[lado]) {
      clon[lado].condiciones_medicas = OCULTO;
    }
  }
  return clon;
}

// Registra una mutación administrativa en la bitácora append-only.
// Un fallo al auditar se loguea pero NO bloquea la operación de negocio.
async function logAdminAction(actor, { accion, entidad, entidadId = null, detalle = null }) {
  const { error } = await supabase.from('admin_audit_log').insert({
    actor_id: actor.id,
    actor_email: actor.email,
    accion,
    entidad,
    entidad_id: entidadId != null ? String(entidadId) : null,
    detalle: redactar(detalle),
  });
  if (error) console.error('audit: no se pudo registrar la acción', accion, error.message);
  return { error };
}

// Qué permiso hace falta para VER en la bitácora los cambios de cada entidad.
//
// Es lista BLANCA a propósito. Con lista negra, cada entidad nueva que se audite
// en los bloques siguientes (ventas, cajas, inventario, facturas) nacería
// visible para cualquiera con audit.read sin que nadie lo hubiera decidido; así
// nace invisible hasta que alguien elija quién puede verla. El test reconcilia
// este mapa con las entidades que el código audita de verdad.
//
// El riesgo que cierra no es teórico: `contabilidad` tiene audit.read y NO tiene
// member.read ni user.read —el seed lo dice: "sin operación de miembros"—, y el
// diff de un cambio de perfil lleva documento y contactos de emergencia del
// socio, mientras el de un alta de personal lleva su correo.
const PERMISO_POR_ENTIDAD = Object.freeze({
  settings: 'audit.read',
  branch: 'audit.read',
  gym_info: 'audit.read',
  occupancy: 'audit.read',
  // Publicar o corregir un documento de consentimiento es configurar el negocio
  // —qué se firma al inscribirse—, y no lleva datos de ningún socio. Quién
  // aceptó qué, en cambio, es del expediente de una persona.
  consent_documents: 'audit.read',
  // Forzar o anular una entrada es del día a día de la puerta: lo lee quien
  // puede leer el historial de entradas.
  checkins: 'checkin.read',
  member_consents: 'member.read',
  'auth.users': 'user.read',
  user_roles: 'user.read',
  profiles: 'member.read',
  memberships: 'member.read',
  membership_plans: 'plan.read',
  payments: 'payment.read',
});

// Entidades que ESTE lector puede ver, dado su juego de permisos. Lista vacía =
// no ve ninguna, que es lo correcto: quien no puede ver nada, no ve nada.
function entidadesVisiblesPara(permisos) {
  return Object.entries(PERMISO_POR_ENTIDAD)
    .filter(([, permiso]) => permisos?.has(permiso))
    .map(([entidad]) => entidad);
}

module.exports = { logAdminAction, entidadesVisiblesPara, PERMISO_POR_ENTIDAD };