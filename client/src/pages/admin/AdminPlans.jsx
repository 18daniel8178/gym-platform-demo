import { useCallback, useState } from 'react'
import { useAuth } from '../../context/AuthContext.jsx'
import { getPlans, createPlan, updatePlan } from '../../services/adminService.js'
import { useMoney, usePermisos } from './adminUi.js'
import { useInfoPublica } from '../../lib/infoPublica.js'
import { useToast } from './ui/toast.jsx'
import Dialog, { ConfirmDialog } from './ui/Dialog.jsx'
import EstadoRecurso from './ui/EstadoRecurso.jsx'
import useRecursoAdmin from './useRecursoAdmin.js'

const PERIODOS = ['diario', 'mensual', 'trimestral', 'semestral', 'anual']
const VACIO = { nombre: '', precio: '', periodo: 'mensual', beneficios: '', destacado: false }

function planAFormulario(p) {
  return {
    id: p.id,
    nombre: p.nombre,
    precio: String(p.precio),
    periodo: p.periodo,
    beneficios: (p.beneficios || []).join('\n'),
    destacado: p.destacado,
  }
}

function formularioAPayload(f) {
  return {
    nombre: f.nombre,
    precio: Number(f.precio),
    periodo: f.periodo,
    beneficios: f.beneficios.split('\n').map((s) => s.trim()).filter(Boolean),
    destacado: f.destacado,
  }
}

// Estado del listado de planes y sus acciones
function usePlanes(token) {
  const toast = useToast()
  const pedir = useCallback(() => getPlans(token), [token])
  const { estado, datos, recargar: cargar } = useRecursoAdmin(pedir)
  const planes = datos || []

  async function alternarActivo(p) {
    const r = await updatePlan(token, p.id, { activo: !p.activo })
    if (r.ok) {
      toast.ok(p.activo ? `Plan "${p.nombre}" archivado` : `Plan "${p.nombre}" reactivado`)
      cargar()
    } else toast.error(r.error)
  }

  async function guardar(edit) {
    const payload = formularioAPayload(edit)
    const r = edit.id ? await updatePlan(token, edit.id, payload) : await createPlan(token, payload)
    if (r.ok) {
      toast.ok(edit.id ? 'Plan actualizado' : 'Plan creado')
      cargar()
    } else toast.error(r.error)
    return r.ok
  }

  return { estado, planes, cargar, alternarActivo, guardar }
}

function CamposPlan({ f, setF }) {
  // El símbolo sale de Ajustes → Operación: la etiqueta decía "(USD)" a mano
  // mientras el resto del panel formateaba en balboas.
  const { moneda } = useInfoPublica()
  return (
    <>
      <div className="admin-field-row">
        <label className="admin-field">Nombre<input value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} required /></label>
        <label className="admin-field">Precio ({moneda.simbolo})<input type="number" min="0.01" step="0.01" value={f.precio} onChange={(e) => setF({ ...f, precio: e.target.value })} required /></label>
        <label className="admin-field">
          Periodo
          <select value={f.periodo} onChange={(e) => setF({ ...f, periodo: e.target.value })}>
            {PERIODOS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>
      </div>
      <label className="admin-field">Beneficios (uno por línea)<textarea rows={4} value={f.beneficios} onChange={(e) => setF({ ...f, beneficios: e.target.value })} /></label>
      <label className="admin-check">
        <input type="checkbox" checked={f.destacado} onChange={(e) => setF({ ...f, destacado: e.target.checked })} />
        Destacado (resaltado en la web)
      </label>
    </>
  )
}

// Modal de crear/editar. Si cambia el precio de un plan existente, pide confirmación.
function PlanDialog({ inicial, precioOriginal, onGuardar, onCerrar }) {
  const money = useMoney()
  const [f, setF] = useState(inicial)
  const [busy, setBusy] = useState(false)
  const [confirmando, setConfirmando] = useState(false)

  const cambioPrecio = f.id && precioOriginal != null && Number(f.precio) !== Number(precioOriginal)

  async function ejecutar() {
    setBusy(true)
    const ok = await onGuardar(f)
    setBusy(false)
    if (ok) onCerrar()
  }

  function enviar(e) {
    e.preventDefault()
    if (cambioPrecio) setConfirmando(true)
    else ejecutar()
  }

  return (
    <Dialog title={f.id ? 'Editar plan' : 'Nuevo plan'} onClose={onCerrar} ancho={560}>
      <form onSubmit={enviar}>
        <CamposPlan f={f} setF={setF} />
        <div className="dlg-actions">
          <button type="button" className="btn btn-ghost" onClick={onCerrar}>Cancelar</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </form>
      {confirmando && (
        <ConfirmDialog
          title="Cambio de precio"
          mensaje={`Vas a cambiar el precio de "${f.nombre}" de ${money(precioOriginal)} a ${money(f.precio)}. Los pagos ya registrados conservan su monto.`}
          confirmar="Cambiar precio"
          onConfirm={ejecutar}
          onClose={() => setConfirmando(false)}
        />
      )}
    </Dialog>
  )
}

function FilaPlan({ p, onEditar, onAlternar, puedeEditar }) {
  const money = useMoney()
  return (
    <tr className={p.activo ? 'ppl-row-static' : 'ppl-row-static ppl-row--muted'}>
      <td>
        <span className="ppl-name">{p.nombre}</span>
        {p.destacado && <span className="admin-tag">Destacado</span>}
      </td>
      <td><strong className="ppl-monto">{money(p.precio)}</strong></td>
      <td style={{ textTransform: 'capitalize' }}>{p.periodo}</td>
      <td>
        {p.activo ? (
          <span className="ppl-badge ppl-badge--ok">Activo</span>
        ) : (
          <span className="ppl-badge ppl-badge--muted">Archivado</span>
        )}
      </td>
      <td className="admin-row-actions">
        {puedeEditar && (
          <>
            <button className="btn btn-ghost btn-sm" onClick={() => onEditar(p)}>Editar</button>
            <button className="btn btn-ghost btn-sm" onClick={() => onAlternar(p)}>{p.activo ? 'Archivar' : 'Reactivar'}</button>
          </>
        )}
      </td>
    </tr>
  )
}

function PlanesContenido({ planes, onEditar, onAlternar, puedeEditar }) {
  if (planes.length === 0) {
    return (
      <div className="admin-card">
        <p className="admin-muted">Aún no hay planes. Crea el primero con "Nuevo plan".</p>
      </div>
    )
  }
  return (
    <div className="ppl-card">
      <div className="ppl-meta"><span>Total de {planes.length} planes · archivar no borra el historial</span></div>
      <div className="ppl-table-wrap">
        <table className="ppl-table">
          <thead>
            <tr>
              <th className="ppl-th">Plan</th>
              <th className="ppl-th">Precio</th>
              <th className="ppl-th">Periodo</th>
              <th className="ppl-th">Estado</th>
              <th className="ppl-th" aria-label="Acciones"></th>
            </tr>
          </thead>
          <tbody>
            {planes.map((p) => (
              <FilaPlan key={p.id} p={p} onEditar={onEditar} onAlternar={onAlternar} puedeEditar={puedeEditar} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function AdminPlans() {
  const { session } = useAuth()
  const token = session?.access_token
  const puede = usePermisos()
  const { estado, planes, cargar, alternarActivo, guardar } = usePlanes(token)
  const [dialogo, setDialogo] = useState(null) // { inicial, precioOriginal } | null

  const abrirNuevo = () => setDialogo({ inicial: { ...VACIO }, precioOriginal: null })
  const abrirEditar = (p) => setDialogo({ inicial: planAFormulario(p), precioOriginal: p.precio })

  return (
    <section className="admin-page">
      <div className="admin-page-head admin-head-row">
        <div>
          <h1>Planes</h1>
          <p className="admin-muted">Gestiona los planes de membresía del sitio público.</p>
        </div>
        {puede('plan.create') && (
          <button className="btn btn-primary" onClick={abrirNuevo}>Nuevo plan</button>
        )}
      </div>

      <EstadoRecurso estado={estado} onReintentar={cargar} alto={220}>
        <PlanesContenido
          planes={planes}
          onEditar={abrirEditar}
          onAlternar={alternarActivo}
          puedeEditar={puede('plan.update')}
        />
      </EstadoRecurso>

      {dialogo && (
        <PlanDialog inicial={dialogo.inicial} precioOriginal={dialogo.precioOriginal} onGuardar={guardar} onCerrar={() => setDialogo(null)} />
      )}
    </section>
  )
}
