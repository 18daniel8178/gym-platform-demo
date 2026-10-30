import { usePermisos } from '../adminUi.js'

// Botón de una acción que modifica datos. Lleva SIEMPRE su permiso y se filtra
// solo: quien no lo tiene no ve el botón, en vez de verlo y chocar con un 403
// del servidor. Declararlo sin permiso rompe en desarrollo y no pinta nada en
// producción — falla cerrado, nunca abierto.
//
// Ocultar la acción es UX; la seguridad sigue siendo del servidor, que revalida
// el permiso en cada request.
export default function BotonAccion({ permiso, variante = 'ghost', children, ...props }) {
  const puede = usePermisos()

  if (!permiso) {
    if (import.meta.env.DEV) throw new Error('BotonAccion sin permiso declarado')
    return null
  }
  if (!puede(permiso)) return null

  return (
    <button type="button" className={`btn btn-${variante}`} {...props}>
      {children}
    </button>
  )
}
