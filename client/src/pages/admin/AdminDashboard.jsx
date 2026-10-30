import { useCallback, useState } from 'react'
import { useAuth } from '../../context/AuthContext.jsx'
import { getStats, completarFirmaFoto, updateOccupancy } from '../../services/adminService.js'
import BotonAccion from './ui/BotonAccion.jsx'
import EstadoRecurso from './ui/EstadoRecurso.jsx'
import useRecursoAdmin from './useRecursoAdmin.js'
import { useMoney } from './adminUi.js'
import { useToast } from './ui/toast.jsx'
import AforoControl from './AforoControl.jsx'

const fechaCorta = (iso) =>
  new Intl.DateTimeFormat('es-PA', { day: 'numeric', month: 'short' }).format(new Date(iso + 'T00:00:00'))

function KpiCards({ stats, onAjustarAforo }) {
  const money = useMoney()
  const ing = stats.ingresos_mes
  return (
    <div className="admin-kpi-grid">
      <div className="admin-kpi">
        <span className="admin-kpi-label">Socios activos</span>
        <strong className="admin-kpi-value">{stats.socios_activos}</strong>
      </div>
      <div className="admin-kpi">
        <span className="admin-kpi-label">Nuevos (30 días)</span>
        <strong className="admin-kpi-value">{stats.nuevos_30d}</strong>
      </div>
      <div className="admin-kpi">
        <span className="admin-kpi-label">Ingresos del mes (recepción)</span>
        <strong className="admin-kpi-value">{money(ing.recepcion)}</strong>
        {ing.checkout_simulado > 0 && (
          <span className="admin-kpi-sub">+ {money(ing.checkout_simulado)} simulado (no contable)</span>
        )}
      </div>
      <div className="admin-kpi">
        <span className="admin-kpi-label">Aforo actual</span>
        {stats.aforo ? (
          <>
            <strong className="admin-kpi-value">{stats.aforo.current_count}/{stats.aforo.max_capacity}</strong>
            <button className="admin-link-btn" onClick={onAjustarAforo}>Ajustar</button>
          </>
        ) : (
          <strong className="admin-kpi-value">—</strong>
        )}
      </div>
    </div>
  )
}

function PorVencer({ lista }) {
  return (
    <div className="admin-card">
      <h2>Por vencer (7 días)</h2>
      {lista.length === 0 ? (
        <p className="admin-muted">Ninguna membresía vence esta semana.</p>
      ) : (
        <ul className="admin-list">
          {lista.map((m) => (
            <li key={m.user_id} className="admin-list-row">
              <div>
                <strong>{m.nombre || 'Socio'}</strong>
                <span className="admin-muted"> · {m.plan || '—'} · vence {fechaCorta(m.fecha_fin)}</span>
              </div>
              {m.telefono_wa && (
                <a className="btn btn-ghost btn-sm" href={`https://wa.me/${m.telefono_wa}`} target="_blank" rel="noopener noreferrer">
                  WhatsApp
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function PendientesFirma({ total, lista, onCompletar }) {
  return (
    <div className="admin-card">
      <h2>Pendientes de firma/foto ({total})</h2>
      {lista.length === 0 ? (
        <p className="admin-muted">No hay socios pendientes.</p>
      ) : (
        <ul className="admin-list">
          {lista.map((p) => (
            <li key={p.user_id} className="admin-list-row">
              <strong>{p.nombre || 'Socio'}</strong>
              <BotonAccion permiso="member.update" variante="ghost btn-sm" onClick={() => onCompletar(p.user_id)}>
                  Marcar completado
                </BotonAccion>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function IngresosPorMetodo({ metodos }) {
  const money = useMoney()
  if (metodos.length === 0) return null
  return (
    <div className="admin-card">
      <h2>Ingresos de recepción por método</h2>
      <ul className="admin-list">
        {metodos.map(([m, total]) => (
          <li key={m} className="admin-list-row">
            <span style={{ textTransform: 'capitalize' }}>{m}</span>
            <strong>{money(total)}</strong>
          </li>
        ))}
      </ul>
    </div>
  )
}

// Estado y acciones del dashboard (carga de KPIs, firma/foto, aforo)
function useDashboard() {
  const { session } = useAuth()
  const token = session?.access_token
  const toast = useToast()
  const [aforoEdit, setAforoEdit] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const pedir = useCallback(() => getStats(token), [token])
  const { estado, datos: stats, recargar: cargar } = useRecursoAdmin(pedir)

  async function marcarCompletado(userId) {
    const r = await completarFirmaFoto(token, userId)
    if (r.ok) {
      toast.ok('Firma y foto completadas')
      cargar()
    } else toast.error(r.error)
  }

  async function guardarAforo(e) {
    e.preventDefault()
    setGuardando(true)
    const r = await updateOccupancy(token, {
      current_count: Number(aforoEdit.current_count),
      max_capacity: Number(aforoEdit.max_capacity),
    })
    setGuardando(false)
    if (r.ok) {
      setAforoEdit(null)
      toast.ok('Aforo actualizado; visible en la web en unos minutos')
      cargar()
    } else toast.error(r.error)
  }

  return { estado, stats, aforoEdit, setAforoEdit, guardando, cargar, marcarCompletado, guardarAforo }
}

export default function AdminDashboard() {
  const { estado, stats, aforoEdit, setAforoEdit, guardando, cargar, marcarCompletado, guardarAforo } = useDashboard()

  return (
    <section className="admin-page">
      <div className="admin-page-head">
        <h1>Dashboard</h1>
        <p className="admin-muted">Indicadores del mes en curso (hora de Panamá).</p>
      </div>

      <EstadoRecurso estado={estado} onReintentar={cargar}>
        {stats && (
          <>
          <KpiCards stats={stats} onAjustarAforo={() => setAforoEdit({ ...stats.aforo })} />
          {aforoEdit && (
            <AforoControl valor={aforoEdit} setValor={setAforoEdit} onGuardar={guardarAforo} onCancelar={() => setAforoEdit(null)} guardando={guardando} />
          )}
          <div className="admin-columns">
            <PorVencer lista={stats.por_vencer} />
            <PendientesFirma total={stats.pendientes_firma_foto} lista={stats.pendientes_lista} onCompletar={marcarCompletado} />
          </div>
            <IngresosPorMetodo metodos={Object.entries(stats.ingresos_mes.por_metodo || {})} />
          </>
        )}
      </EstadoRecurso>
    </section>
  )
}
