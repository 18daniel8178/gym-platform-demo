// Presentación compartida del expediente del socio (listado y ficha).
//
// Dos estados distintos, con badges distintos (§13.7): el del SOCIO (la persona)
// y el de su MEMBRESÍA. Un socio activo puede tener la membresía vencida; si los
// dos se pintaran igual, recepción los confundiría.

export const ESTADO_SOCIO = {
  prospecto: { txt: 'Prospecto', cls: 'ppl-badge ppl-badge--warn' },
  activo: { txt: 'Activo', cls: 'ppl-badge ppl-badge--ok' },
  inactivo: { txt: 'Inactivo', cls: 'ppl-badge ppl-badge--muted' },
  bloqueado: { txt: 'Bloqueado', cls: 'ppl-badge ppl-badge--danger' },
  archivado: { txt: 'Archivado', cls: 'ppl-badge ppl-badge--muted' },
}

export const ESTADO_MEMBRESIA = {
  activa: { txt: 'Membresía activa', cls: 'ppl-badge ppl-badge--ok' },
  vencida: { txt: 'Membresía vencida', cls: 'ppl-badge ppl-badge--danger' },
  sin: { txt: 'Sin membresía', cls: 'ppl-badge ppl-badge--muted' },
}

export const ORIGEN = {
  web: 'Formulario web',
  mostrador: 'Mostrador',
  referido: 'Referido',
  importacion: 'Importación CSV',
}

export function BadgeSocio({ estado }) {
  const b = ESTADO_SOCIO[estado] || ESTADO_SOCIO.activo
  return <span className={b.cls}>{b.txt}</span>
}

export function BadgeMembresia({ estado }) {
  const b = ESTADO_MEMBRESIA[estado] || ESTADO_MEMBRESIA.sin
  return <span className={b.cls}>{b.txt}</span>
}

export function ListaEtiquetas({ etiquetas }) {
  if (!etiquetas?.length) return null
  return (
    <span className="socio-etiquetas">
      {etiquetas.map((e) => <span key={e} className="admin-tag admin-tag--soft">{e}</span>)}
    </span>
  )
}
