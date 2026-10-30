import { useOutletContext } from 'react-router-dom'

// GET /api/admin/me devuelve los permisos vigentes de cualquiera —el
// propietario incluido, sin comodines—, así que basta con buscar el permiso.
export const tienePermiso = (me, permiso) => Boolean(me?.permisos?.includes(permiso))

// Permisos del usuario dentro del panel: `const puede = usePermisos()` y luego
// `puede('payment.export')`. Ocultar una acción es UX; el server revalida igual.
export function usePermisos() {
  const { me } = useOutletContext()
  return (permiso) => tienePermiso(me, permiso)
}

// Helpers de presentación compartidos por las páginas admin.
// El formato de moneda vive en lib/money.js, compartido con el sitio público:
// una sola utilidad, como pide la spec (antes el panel decía "USD 45.00" y el
// sitio "$45.00").
//
// Dentro de un componente se usa `useMoney()`, que ya trae la moneda
// CONFIGURADA en Ajustes; `money` a secas formatea con la moneda por defecto y
// solo sirve fuera de un componente o para previsualizar otra moneda.
export { money } from '../../lib/money.js'
export { useMoney } from '../../lib/infoPublica.js'

// Iniciales y color determinista por nombre (avatar tipo people-table).
export const iniciales = (nombre) => {
  const p = (nombre || '').trim().split(/\s+/)
  return ((p[0]?.[0] || '') + (p[1]?.[0] || '')).toUpperCase() || '?'
}
export const colorAvatar = (str = '') => {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 360
  return `hsl(${h} 48% 52%)`
}

// Aforo: mismo criterio que la Home pública (occupancyLabel en Home.jsx)
export const aforoPct = (c, m) => (m > 0 ? Math.min(100, Math.round((Number(c) / Number(m)) * 100)) : 0)

export function aforoNivel(pct) {
  if (pct < 50) return 'ok'
  if (pct <= 80) return 'mid'
  return 'full'
}

export function aforoLabel(pct) {
  if (pct < 50) return 'Poco lleno'
  if (pct <= 80) return 'Moderado'
  return 'Muy lleno'
}
