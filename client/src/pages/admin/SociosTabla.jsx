import { iniciales, colorAvatar } from './adminUi.js'
import { BadgeSocio, BadgeMembresia, ListaEtiquetas } from './sociosUi.jsx'

function FilaSocio({ s, onVer }) {
  return (
    <tr className="ppl-row" onClick={() => onVer(s.user_id)}>
      <td>
        <div className="ppl-person">
          <span className="ppl-avatar" style={{ background: colorAvatar(s.nombre_completo) }}>
            {iniciales(s.nombre_completo)}
          </span>
          <div className="ppl-person-txt">
            <span className="ppl-name">{s.nombre_completo}</span>
            <span className="ppl-sub">{s.telefono || 'Sin teléfono'}</span>
            <ListaEtiquetas etiquetas={s.etiquetas} />
          </div>
        </div>
      </td>
      <td><BadgeSocio estado={s.estado_miembro} /></td>
      <td>
        <BadgeMembresia estado={s.estado} />
        {s.plan && <span className="ppl-sub socio-plan">{s.plan}</span>}
      </td>
      <td>
        {s.firma_foto_pendiente ? (
          <span className="ppl-badge ppl-badge--warn">Pendiente</span>
        ) : (
          <span className="ppl-badge ppl-badge--ok">Completado</span>
        )}
      </td>
      <td className="ppl-cell-action">
        <button
          type="button"
          className="ppl-chevron-btn"
          aria-label={`Ver ficha de ${s.nombre_completo}`}
          onClick={(e) => { e.stopPropagation(); onVer(s.user_id) }}
        >
          ›
        </button>
      </td>
    </tr>
  )
}

function SociosTabla({ rows, onVer }) {
  return (
    <div className="ppl-table-wrap">
      <table className="ppl-table">
        <thead>
          <tr>
            <th className="ppl-th">Socio</th>
            <th className="ppl-th">Estado</th>
            <th className="ppl-th">Membresía</th>
            <th className="ppl-th">Firma/foto</th>
            <th className="ppl-th" aria-label="Acciones"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => <FilaSocio key={s.user_id} s={s} onVer={onVer} />)}
        </tbody>
      </table>
    </div>
  )
}

export function Pager({ page, setPage, totalPages }) {
  return (
    <div className="admin-pager">
      <button className="btn btn-ghost btn-sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Anterior</button>
      <span className="admin-muted">Página {page + 1} de {totalPages}</span>
      <button className="btn btn-ghost btn-sm" disabled={page + 1 >= totalPages} onClick={() => setPage(page + 1)}>Siguiente</button>
    </div>
  )
}

// Sin resultados, el mensaje explica por qué: no es lo mismo "no hay archivados"
// que "tu búsqueda no encontró nada".
function Vacio({ archivados, hayFiltro }) {
  let texto = 'Aún no hay socios registrados.'
  if (hayFiltro) texto = 'No hay socios que coincidan con la búsqueda o los filtros.'
  else if (archivados) texto = 'No hay socios archivados. Un socio archivado sale de la operación pero conserva su historial.'
  return <p className="admin-muted" style={{ padding: 'var(--sp-5)' }}>{texto}</p>
}

export function SociosContenido({ data, onVer, pager, archivados, hayFiltro }) {
  const nombre = archivados ? 'archivado' : 'socio'
  return (
    <div className="ppl-card">
      <div className="ppl-meta">
        <span>Total de {data.total} {data.total === 1 ? nombre : `${nombre}s`}</span>
        {data.truncado && <span className="ppl-meta-warn">Mostrando los primeros {data.total}; afina la búsqueda</span>}
      </div>
      {data.rows.length === 0 ? (
        <Vacio archivados={archivados} hayFiltro={hayFiltro} />
      ) : (
        <SociosTabla rows={data.rows} onVer={onVer} />
      )}
      {pager}
    </div>
  )
}
