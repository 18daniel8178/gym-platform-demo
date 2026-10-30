// Único cliente HTTP del API admin (/api/admin/*). Las páginas admin no importan
// supabaseClient: toda operación pasa por el server con verificación de rol.
const BASE = '/api/admin'

async function req(path, token, options = {}) {
  let res
  try {
    res = await fetch(BASE + path, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(options.headers || {}),
      },
    })
  } catch {
    // Red caída: devuelve un error manejable para que cada página muestre su
    // estado de error en lugar de colgarse en "cargando".
    return { ok: false, status: 0, error: 'Sin conexión con el servidor' }
  }
  const body = await res.json().catch(() => null)
  if (!res.ok) {
    const error = body?.error || 'No se pudo completar la operación'
    // `data` conserva el cuerpo del error: un 409 de duplicado trae ahí las
    // coincidencias que el formulario tiene que mostrar.
    return { ok: false, status: res.status, error, data: body }
  }
  return { ok: true, data: body }
}

// Identidad + permisos reales del usuario (fuente del menú del panel).
// Evita el falso negativo cuando el claim aún no está en el JWT de la sesión.
export const getMe = (token) => req('/me', token)

// Equipo: usuarios del sistema y catálogo de roles
export const getUsuarios = (token) => req('/users', token)
export const getRoles = (token) => req('/roles', token)
export const crearUsuario = (token, datos) => req('/users', token, { method: 'POST', body: JSON.stringify(datos) })
export const setRolesUsuario = (token, userId, roles) =>
  req(`/users/${userId}/roles`, token, { method: 'PUT', body: JSON.stringify({ roles }) })
export const activarUsuario = (token, userId) => req(`/users/${userId}/activar`, token, { method: 'POST' })
export const desactivarUsuario = (token, userId) => req(`/users/${userId}/desactivar`, token, { method: 'POST' })
export const getSesiones = (token, userId) => req(`/users/${userId}/sessions`, token)
export const cerrarSesionesUsuario = (token, userId) =>
  req(`/users/${userId}/cerrar-sesiones`, token, { method: 'POST' })

// KPIs del dashboard
export const getStats = (token) => req('/stats', token)

// Planes
export const getPlans = (token) => req('/plans', token)
export const createPlan = (token, plan) => req('/plans', token, { method: 'POST', body: JSON.stringify(plan) })
export const updatePlan = (token, id, cambios) =>
  req(`/plans/${id}`, token, { method: 'PATCH', body: JSON.stringify(cambios) })

// Ajustes del negocio (secciones, numeración, métodos de pago y su bitácora)
export const getAjustes = (token) => req('/settings', token)
export const guardarSeccion = (token, seccion, cambios) =>
  req(`/settings/${seccion}`, token, { method: 'PATCH', body: JSON.stringify(cambios) })
export const guardarNumeracion = (token, tipo, cambios) =>
  req(`/settings/numeracion/${tipo}`, token, { method: 'PATCH', body: JSON.stringify(cambios) })
export const crearMetodoPago = (token, nombre) =>
  req('/settings/metodos', token, { method: 'POST', body: JSON.stringify({ nombre }) })
export const cambiarMetodoPago = (token, clave, activo) =>
  req(`/settings/metodos/${clave}`, token, { method: 'PATCH', body: JSON.stringify({ activo }) })
// La sucursal donde ocurre la operación: se edita junto a los ajustes pero es
// una entidad propia, no una sección de app_settings.
export const getSucursal = (token) => req('/sucursal', token)
export const guardarSucursal = (token, cambios) =>
  req('/sucursal', token, { method: 'PATCH', body: JSON.stringify(cambios) })

export const getActividadAjustes = (token, filtros = {}) => {
  const params = new URLSearchParams(
    Object.entries(filtros).filter(([, v]) => v !== '' && v != null)
  ).toString()
  return req(`/settings/auditoria?${params}`, token)
}

// Información pública del gym (frase y descripción; los horarios viven en ajustes)
export const updateGymInfo = (token, cambios) =>
  req('/gym-info', token, { method: 'PATCH', body: JSON.stringify(cambios) })
export const updateOccupancy = (token, cambios) =>
  req('/occupancy', token, { method: 'PATCH', body: JSON.stringify(cambios) })

// Cola de firma/foto
export const completarFirmaFoto = (token, userId) =>
  req(`/members/${userId}/firma-foto`, token, { method: 'POST' })

// Socios. `estado` filtra por la membresía y `miembro` por el estado del socio:
// son independientes (un socio activo puede tener la membresía vencida).
export const getMembers = (token, filtros = {}) => {
  const params = new URLSearchParams(
    Object.entries(filtros).filter(([, v]) => v !== '' && v != null)
  ).toString()
  return req(`/members?${params}`, token)
}
export const getMember = (token, userId) => req(`/members/${userId}`, token)
export const updateMember = (token, userId, cambios) =>
  req(`/members/${userId}`, token, { method: 'PATCH', body: JSON.stringify(cambios) })
export const createMember = (token, datos) =>
  req('/members', token, { method: 'POST', body: JSON.stringify(datos) })
// El CSV viaja tal cual, sin envolver en JSON: puede traer cientos de filas.
export const importarSocios = (token, csv) =>
  req('/members/importar', token, { method: 'POST', body: csv, headers: { 'Content-Type': 'text/csv' } })
export const cambiarEstadoSocio = (token, userId, { estado, motivo }) =>
  req(`/members/${userId}/estado`, token, { method: 'POST', body: JSON.stringify({ estado, motivo }) })
export const guardarEtiquetasSocio = (token, userId, etiquetas) =>
  req(`/members/${userId}/etiquetas`, token, { method: 'PUT', body: JSON.stringify({ etiquetas }) })
export const getHistorialSocio = (token, userId) => req(`/members/${userId}/historial`, token)
export const getDocumentosConsentimiento = (token) => req('/consent-documents', token)
// Registrar es SIEMPRE agregar: lo aceptado antes queda como se firmó.
export const registrarConsentimiento = (token, userId, codigo) =>
  req(`/members/${userId}/consentimientos`, token, { method: 'POST', body: JSON.stringify({ codigo }) })

// Documentos de consentimiento (Ajustes): todas las versiones y su publicación
export const getHistorialConsentimientos = (token) => req('/consent-documents/historial', token)
export const publicarVersionConsentimiento = (token, datos) =>
  req('/consent-documents', token, { method: 'POST', body: JSON.stringify(datos) })
export const corregirVersionConsentimiento = (token, id, datos) =>
  req(`/consent-documents/${id}`, token, { method: 'PATCH', body: JSON.stringify(datos) })

// Check-in en la puerta
export const registrarCheckin = (token, datos) =>
  req('/checkin', token, { method: 'POST', body: JSON.stringify(datos) })
export const buscarSociosCheckin = (token, q) =>
  req(`/checkin/buscar?q=${encodeURIComponent(q)}`, token)
export const getCheckinHoy = (token) => req('/checkin/hoy', token)
export const anularCheckin = (token, id, motivo) =>
  req(`/checkin/${id}/anular`, token, { method: 'POST', body: JSON.stringify({ motivo }) })

// Cobros y membresía
export const cobrarRecepcion = (token, userId, pago) =>
  req(`/members/${userId}/membership`, token, { method: 'POST', body: JSON.stringify(pago) })
export const ajustarFechas = (token, userId, fechas) =>
  req(`/memberships/${userId}`, token, { method: 'PATCH', body: JSON.stringify(fechas) })
export const paseDiario = (token, datos) =>
  req('/payments/pase-diario', token, { method: 'POST', body: JSON.stringify(datos) })
export const anularPago = (token, id, motivo) =>
  req(`/payments/${id}/anular`, token, { method: 'POST', body: JSON.stringify({ motivo }) })

// Historial de pagos
export const getPayments = (token, filtros = {}) => {
  const params = new URLSearchParams(
    Object.entries(filtros).filter(([, v]) => v !== '' && v != null)
  ).toString()
  return req(`/payments?${params}`, token)
}

// Descarga el CSV del historial (respeta los mismos filtros). Devuelve un blob.
export async function exportPayments(token, filtros = {}) {
  const params = new URLSearchParams(
    Object.entries(filtros).filter(([, v]) => v !== '' && v != null)
  ).toString()
  try {
    const res = await fetch(`/api/admin/payments/export?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return { ok: false, error: 'No se pudo generar el reporte' }
    return { ok: true, blob: await res.blob() }
  } catch {
    return { ok: false, error: 'Sin conexión con el servidor' }
  }
}

export { req }
