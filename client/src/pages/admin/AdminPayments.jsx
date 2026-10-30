import { useCallback, useState } from 'react'
import { useAuth } from '../../context/AuthContext.jsx'
import { getPayments, exportPayments } from '../../services/adminService.js'
import { useMoney, iniciales, colorAvatar, usePermisos } from './adminUi.js'
import { useFechas } from '../../lib/fechas.js'
import { useToast } from './ui/toast.jsx'
import FiltroDropdown from './FiltroDropdown.jsx'
import RangoFechas from './RangoFechas.jsx'
import EstadoRecurso from './ui/EstadoRecurso.jsx'
import useRecursoAdmin from './useRecursoAdmin.js'

const FILTROS_VACIO = { desde: '', hasta: '', metodo: '', origen: '', estado: '' }
const OPCIONES_ORIGEN = [
  { value: '', label: 'Todos' },
  { value: 'recepcion', label: 'Recepción' },
  { value: 'checkout_simulado', label: 'Checkout simulado' },
]
const OPCIONES_METODO = [
  { value: '', label: 'Todos' },
  ...['efectivo', 'tarjeta', 'yappy', 'transferencia'].map((m) => ({ value: m, label: m })),
]
const OPCIONES_ESTADO = [
  { value: '', label: 'Todos' },
  { value: 'aprobado', label: 'Aprobado' },
  { value: 'anulado', label: 'Anulado' },
]

// Estado del historial: filtros, paginación, carga y export CSV
function usePagos(token) {
  const toast = useToast()
  const [filtros, setFiltros] = useState(FILTROS_VACIO)
  const [page, setPage] = useState(0)
  const [exportando, setExportando] = useState(false)

  const pedir = useCallback(() => getPayments(token, { ...filtros, page }), [token, filtros, page])
  const { estado, datos, recargar: cargar } = useRecursoAdmin(pedir)
  const data = datos || { rows: [], total: 0, page: 0, pageSize: 20, totales: null, truncado: false }

  async function descargar() {
    setExportando(true)
    const r = await exportPayments(token, filtros)
    setExportando(false)
    if (!r.ok) {
      toast.error(r.error)
      return
    }
    descargarBlob(r.blob, 'pagos-forja.csv')
    toast.ok('Reporte CSV generado')
  }

  return { estado, data, filtros, setFiltros, page, setPage, exportando, cargar, descargar }
}

function descargarBlob(blob, nombre) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function PagosFiltros({ filtros, setFiltros, setPage }) {
  const setCampo = (k) => (v) => { setFiltros({ ...filtros, [k]: v }); setPage(0) }
  const hayFiltros = Object.values(filtros).some(Boolean)
  return (
    <div className="ppl-toolbar">
      <RangoFechas desde={filtros.desde} hasta={filtros.hasta} onAplicar={(desde, hasta) => { setFiltros({ ...filtros, desde, hasta }); setPage(0) }} />
      <FiltroDropdown label="Origen" value={filtros.origen} onChange={setCampo('origen')} opciones={OPCIONES_ORIGEN} />
      <FiltroDropdown label="Método" value={filtros.metodo} onChange={setCampo('metodo')} opciones={OPCIONES_METODO} capitalizar />
      <FiltroDropdown label="Estado" value={filtros.estado} onChange={setCampo('estado')} opciones={OPCIONES_ESTADO} />
      {hayFiltros && (
        <button type="button" className="ppl-reset" onClick={() => { setFiltros(FILTROS_VACIO); setPage(0) }}>Reset</button>
      )}
    </div>
  )
}

function PagosTotales({ t }) {
  const money = useMoney()
  if (!t) return null
  return (
    <div className="admin-kpi-grid">
      <div className="admin-kpi">
        <span className="admin-kpi-label">Ingresos recepción</span>
        <strong className="admin-kpi-value">{money(t.recepcion)}</strong>
      </div>
      <div className="admin-kpi">
        <span className="admin-kpi-label">Checkout simulado</span>
        <strong className="admin-kpi-value">{money(t.checkout_simulado)}</strong>
        <span className="admin-kpi-sub">no contable</span>
      </div>
      <div className="admin-kpi">
        <span className="admin-kpi-label">Pagos aprobados</span>
        <strong className="admin-kpi-value">{t.aprobados}</strong>
        {t.anulados > 0 && <span className="admin-kpi-sub">{t.anulados} anulados</span>}
      </div>
    </div>
  )
}

function FilaPago({ p }) {
  const { fecha } = useFechas()
  const money = useMoney()
  const anon = !p.cliente || p.cliente === '—'
  const anulado = p.estado === 'anulado'
  const avatarStyle = anon
    ? { background: 'var(--surface-2)', color: 'var(--muted)' }
    : { background: colorAvatar(p.cliente), color: '#fff' }
  return (
    <tr className={anulado ? 'ppl-row-static ppl-row--muted' : 'ppl-row-static'}>
      <td>
        <div className="ppl-person">
          <span className="ppl-avatar ppl-avatar--sm" style={avatarStyle}>{anon ? '—' : iniciales(p.cliente)}</span>
          <span className="ppl-name">{anon ? 'Sin cuenta' : p.cliente}</span>
        </div>
      </td>
      <td>{fecha(p.created_at)}</td>
      <td style={{ textTransform: 'capitalize' }}>{p.metodo || '—'}</td>
      <td><span className="ppl-badge ppl-badge--muted">{p.origen === 'recepcion' ? 'Recepción' : 'Simulado'}</span></td>
      <td>
        {anulado ? (
          <span className="ppl-badge ppl-badge--muted">Anulado</span>
        ) : (
          <span className="ppl-badge ppl-badge--ok">Aprobado</span>
        )}
      </td>
      <td className="ppl-th--right">
        <strong className={anulado ? 'ppl-monto-anulado' : 'ppl-monto'}>{money(p.monto)}</strong>
      </td>
    </tr>
  )
}

function PagosTabla({ rows }) {
  return (
    <div className="ppl-table-wrap">
      <table className="ppl-table">
        <thead>
          <tr>
            <th className="ppl-th">Cliente</th>
            <th className="ppl-th">Fecha</th>
            <th className="ppl-th">Método</th>
            <th className="ppl-th">Origen</th>
            <th className="ppl-th">Estado</th>
            <th className="ppl-th ppl-th--right">Monto</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => <FilaPago key={p.id} p={p} />)}
        </tbody>
      </table>
    </div>
  )
}

function PagosContenido({ data, page, setPage }) {
  const totalPages = Math.ceil(data.total / data.pageSize) || 1
  return (
    <div className="ppl-card">
      <div className="ppl-meta">
        <span>Total de {data.total} {data.total === 1 ? 'pago' : 'pagos'}</span>
        {data.truncado && <span className="ppl-meta-warn">Mostrando los primeros {data.total}; acota el rango</span>}
      </div>
      {data.rows.length === 0 ? (
        <p className="admin-muted" style={{ padding: 'var(--sp-5)' }}>
          Aún no hay pagos registrados para este filtro. Los cobros aparecerán aquí desde la fecha de corte acordada.
        </p>
      ) : (
        <PagosTabla rows={data.rows} />
      )}
      <div className="admin-pager">
        <button className="btn btn-ghost btn-sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Anterior</button>
        <span className="admin-muted">Página {page + 1} de {totalPages}</span>
        <button className="btn btn-ghost btn-sm" disabled={page + 1 >= totalPages} onClick={() => setPage(page + 1)}>Siguiente</button>
      </div>
    </div>
  )
}

export default function AdminPayments() {
  const { session } = useAuth()
  const token = session?.access_token
  const puede = usePermisos()
  const { estado, data, filtros, setFiltros, page, setPage, exportando, cargar, descargar } = usePagos(token)

  return (
    <section className="admin-page">
      <div className="admin-page-head admin-head-row">
        <div>
          <h1>Pagos</h1>
          <p className="admin-muted">Historial de cobros. Los anulados no cuentan en los totales.</p>
        </div>
        {puede('payment.export') && (
          <button className="btn btn-ghost" onClick={descargar} disabled={exportando || data.total === 0}>
            {exportando ? 'Generando…' : 'Exportar CSV'}
          </button>
        )}
      </div>

      <PagosFiltros filtros={filtros} setFiltros={setFiltros} setPage={setPage} />
      {estado === 'ok' && <PagosTotales t={data.totales} />}
      <EstadoRecurso estado={estado} onReintentar={cargar}>
        <PagosContenido data={data} page={page} setPage={setPage} />
      </EstadoRecurso>
    </section>
  )
}
