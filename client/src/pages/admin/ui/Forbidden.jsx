// Estado "sin permiso" estándar del panel (páginas y secciones que reciben 403).
export default function Forbidden({ detalle }) {
  return (
    <div className="admin-card">
      <h2>Sin permiso</h2>
      <p className="admin-muted">
        {detalle || 'Tu cuenta no tiene acceso a esta sección. Si crees que es un error, contacta al administrador.'}
      </p>
    </div>
  )
}
