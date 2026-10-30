import Forbidden from './Forbidden.jsx'

// Qué se pinta mientras un recurso del panel no está listo. Reemplaza el bloque
// «cargando / no se pudo cargar + Reintentar» que estaba duplicado página por
// página y, sobre manera, deja de ofrecer un reintento cuando el servidor ya
// dijo que no: un 403 no se arregla insistiendo.
// `vacio`: el texto a mostrar cuando la carga fue bien pero no hay nada que
// listar. Se pasa como dato (o `false` si hay filas) para que el estado vacío
// deje de escribirse a mano en cada página, como pide el documento (§13.3).
export default function EstadoRecurso({ estado, onReintentar, alto = 240, vacio, children }) {
  if (estado === 'cargando') {
    return <div className="admin-card admin-skeleton" style={{ height: alto }} aria-hidden="true" />
  }
  if (estado === 'sin-permiso') return <Forbidden />
  if (estado === 'sesion-caida') {
    return (
      <div className="admin-card">
        <p>Tu sesión caducó. Vuelve a iniciar sesión para continuar.</p>
      </div>
    )
  }
  if (estado === 'error') {
    return (
      <div className="admin-card">
        <p>No se pudo cargar la información. Puede ser un problema de conexión.</p>
        <button className="btn btn-primary" onClick={onReintentar}>Reintentar</button>
      </div>
    )
  }
  if (vacio) {
    return (
      <div className="admin-card">
        <p className="admin-muted">{vacio}</p>
      </div>
    )
  }
  return children
}
