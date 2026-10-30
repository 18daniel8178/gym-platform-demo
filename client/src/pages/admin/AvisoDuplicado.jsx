import { BadgeSocio } from './sociosUi.jsx'

// Aviso de posible duplicado (§13.7, prueba A01): muestra con quién coincide y,
// si el caso lo admite, ofrece seguir. Un correo repetido no se puede forzar
// —cada socio es una cuenta con su correo—, así que ahí solo se explica qué hacer.
function motivo(c) {
  return [c.por_documento && 'mismo documento', c.por_email && 'mismo correo'].filter(Boolean).join(' y ')
}

export default function AvisoDuplicado({ aviso, confirmar, onConfirmar, busy }) {
  return (
    <div className="socio-duplicado" role="alert">
      <p className="socio-duplicado-titulo">{aviso.error}</p>
      <ul className="admin-list">
        {aviso.coincidencias.map((c) => (
          <li key={c.user_id} className="admin-list-row">
            <span>{c.nombre_completo}</span>
            <span className="admin-row-actions">
              <span className="admin-muted">{motivo(c)}</span>
              <BadgeSocio estado={c.estado_miembro} />
            </span>
          </li>
        ))}
      </ul>
      {aviso.requiere_confirmacion ? (
        <div className="admin-actions">
          <button type="button" className="btn btn-danger btn-sm" onClick={onConfirmar} disabled={busy}>
            {confirmar}
          </button>
        </div>
      ) : (
        <p className="admin-aviso">Usa otro correo: cada socio necesita el suyo para entrar a su cuenta.</p>
      )}
    </div>
  )
}
