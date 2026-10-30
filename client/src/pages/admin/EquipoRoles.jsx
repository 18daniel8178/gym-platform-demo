// Catálogo de roles (solo lectura): los roles y sus permisos vienen definidos
// por el sistema; la personalización por rol no es parte de la Fase 1.
export default function EquipoRoles({ roles }) {
  if (roles.length === 0) {
    return (
      <div className="admin-card">
        <p className="admin-muted">
          No hay roles cargados. Ejecuta la migración de roles en la base de datos.
        </p>
      </div>
    )
  }
  return (
    <div className="ppl-card">
      <div className="ppl-meta">
        <span>{roles.length} roles del sistema · los permisos por rol son fijos en esta fase</span>
      </div>
      <div className="ppl-table-wrap">
        <table className="ppl-table">
          <thead>
            <tr>
              <th className="ppl-th">Rol</th>
              <th className="ppl-th">Descripción</th>
              <th className="ppl-th">Permisos</th>
            </tr>
          </thead>
          <tbody>
            {roles.map((r) => (
              <tr key={r.id} className="ppl-row-static">
                <td><span className="ppl-name">{r.nombre}</span></td>
                <td className="admin-muted">{r.descripcion || '—'}</td>
                <td>
                  <div className="admin-permisos">
                    {r.permisos.map((p) => (
                      <span key={p} className="admin-tag admin-tag--soft">{p}</span>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
