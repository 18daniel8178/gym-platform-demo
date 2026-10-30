const { supabase } = require('../../infrastructure/supabase');

// Acceso a los datos del personal. Toda la lógica que necesita varias tablas o
// atomicidad vive en funciones SQL (ver server/db/2026_08_rbac.sql): aquí solo
// se invocan y se traduce su resultado al contrato { rows | error } del server.

// SQLSTATE que las funciones usan para señalar entrada inválida (400, no 500).
const ERRORES_DE_ENTRADA = new Set(['23514', '23503']);

const esErrorDeEntrada = (error) => ERRORES_DE_ENTRADA.has(error?.code);

// Cuentas del personal (propietario o con algún rol) con su estado y roles.
async function listarUsuarios() {
  const { data, error } = await supabase.rpc('staff_users');
  if (error) return { error };
  return { rows: data || [] };
}

// Estado del usuario sobre el que se va a actuar. `existe: false` si no hay tal
// cuenta en Auth.
async function estadoObjetivo(userId) {
  const { data, error } = await supabase.rpc('staff_target', { p_user_id: userId });
  if (error) return { error };
  const fila = (data || [])[0];
  if (!fila) return { objetivo: { existe: false } };
  return {
    objetivo: {
      existe: true,
      propietario: fila.propietario,
      esStaff: fila.es_staff,
      desactivado: fila.desactivado,
    },
  };
}

// Normaliza la lista de ids de rol del body. Devuelve { error } o { ids }.
function normalizarRolesIds(lista) {
  if (!Array.isArray(lista)) return { error: 'roles debe ser una lista de ids' };
  const ids = [...new Set(lista.map(Number))];
  if (ids.some((id) => !Number.isInteger(id) || id <= 0)) return { error: 'Hay un rol inválido en la lista' };
  return { ids };
}

// Reemplaza los roles de un usuario. La función SQL valida, reemplaza y audita
// en una sola transacción: o se aplica entera, o no cambia nada.
async function reemplazarRoles({ userId, ids, actor }) {
  const { data, error } = await supabase.rpc('staff_set_roles', {
    p_user_id: userId,
    p_role_ids: ids,
    p_actor_id: actor.id,
    p_actor_email: actor.email,
  });
  if (error) {
    if (esErrorDeEntrada(error)) return { error: error.message, invalido: true };
    console.error('[admin] staff_set_roles:', error.message);
    return { error: 'No se pudieron actualizar los roles' };
  }
  return { antes: data || [] };
}

// Sesiones abiertas de un usuario (metadatos, nunca tokens).
async function sesionesDe(userId) {
  const { data, error } = await supabase.rpc('staff_sessions', { p_user_id: userId });
  if (error) return { error };
  return { rows: data || [] };
}

// Cierra todas las sesiones de un usuario. GoTrue no tiene logout admin por
// usuario (esa ruta responde 404), así que las borra la función de la migración.
async function cerrarSesiones(userId) {
  const { data, error } = await supabase.rpc('staff_revoke_sessions', { p_user_id: userId });
  if (error) {
    console.error('[admin] staff_revoke_sessions:', error.message);
    return { ok: false, cerradas: 0 };
  }
  return { ok: true, cerradas: data ?? 0 };
}

module.exports = {
  listarUsuarios,
  estadoObjetivo,
  cerrarSesiones,
  sesionesDe,
  normalizarRolesIds,
  reemplazarRoles,
};
