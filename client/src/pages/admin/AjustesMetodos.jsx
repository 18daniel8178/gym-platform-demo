import { useState } from 'react'
import { crearMetodoPago, cambiarMetodoPago } from '../../services/adminService.js'
import { useToast } from './ui/toast.jsx'
import Dialog, { ConfirmDialog } from './ui/Dialog.jsx'
import MenuAcciones from './ui/MenuAcciones.jsx'

function NuevoMetodoDialog({ onGuardar, onCerrar }) {
  const [nombre, setNombre] = useState('')
  const [busy, setBusy] = useState(false)

  async function enviar(e) {
    e.preventDefault()
    setBusy(true)
    const ok = await onGuardar(nombre.trim())
    setBusy(false)
    if (ok) onCerrar()
  }

  return (
    <Dialog title="Nuevo método de pago" onClose={onCerrar} ancho={420}>
      <form onSubmit={enviar}>
        <label className="admin-field">
          Nombre
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Yappy Business" required autoFocus />
        </label>
        <p className="admin-muted">
          Quedará disponible al cobrar en cuanto lo guardes, sin necesidad de desplegar nada.
        </p>
        <div className="dlg-actions">
          <button type="button" className="btn btn-ghost" onClick={onCerrar}>Cancelar</button>
          <button type="submit" className="btn btn-primary" disabled={busy || !nombre.trim()}>
            {busy ? 'Creando…' : 'Crear método'}
          </button>
        </div>
      </form>
    </Dialog>
  )
}

function FilaMetodo({ metodo, onAlternar }) {
  const acciones = [
    {
      id: 'estado',
      label: metodo.activo ? 'Desactivar' : 'Activar',
      destructivo: metodo.activo,
      onClick: () => onAlternar(metodo),
    },
  ]
  return (
    <tr className={metodo.activo ? 'ppl-row-static' : 'ppl-row-static ppl-row--muted'}>
      <td><span className="ppl-name">{metodo.nombre}</span></td>
      <td className="admin-muted">{metodo.clave}</td>
      <td>
        {metodo.activo
          ? <span className="ppl-badge ppl-badge--ok">Activo</span>
          : <span className="ppl-badge ppl-badge--muted">Desactivado</span>}
      </td>
      <td className="admin-row-actions">
        <MenuAcciones etiqueta={`Acciones para ${metodo.nombre}`} acciones={acciones} />
      </td>
    </tr>
  )
}

function TablaMetodos({ metodos, onNuevo, onAlternar }) {
  return (
    <div className="ppl-card">
      <div className="ppl-meta">
        <span>
          {metodos.filter((m) => m.activo).length} métodos activos · un método con pagos registrados se
          desactiva, nunca se elimina
        </span>
        <button className="btn btn-primary btn-sm" onClick={onNuevo}>Nuevo método</button>
      </div>
      <div className="ppl-table-wrap">
        <table className="ppl-table">
          <thead>
            <tr>
              <th className="ppl-th">Método</th>
              <th className="ppl-th">Clave</th>
              <th className="ppl-th">Estado</th>
              <th className="ppl-th" aria-label="Acciones"></th>
            </tr>
          </thead>
          <tbody>
            {metodos.map((m) => <FilaMetodo key={m.clave} metodo={m} onAlternar={onAlternar} />)}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function AjustesMetodos({ token, metodos, onRecargar }) {
  const toast = useToast()
  const [dialogo, setDialogo] = useState(null) // 'nuevo' | metodo a desactivar

  async function crear(nombre) {
    const r = await crearMetodoPago(token, nombre)
    if (r.ok) {
      toast.ok(`Método "${nombre}" creado`)
      onRecargar()
    } else toast.error(r.error)
    return r.ok
  }

  async function alternar(metodo) {
    const r = await cambiarMetodoPago(token, metodo.clave, !metodo.activo)
    if (r.ok) {
      toast.ok(metodo.activo ? `"${metodo.nombre}" desactivado` : `"${metodo.nombre}" activado`)
      onRecargar()
    } else toast.error(r.error)
  }

  return (
    <>
      <TablaMetodos
        metodos={metodos}
        onNuevo={() => setDialogo('nuevo')}
        onAlternar={(m) => (m.activo ? setDialogo(m) : alternar(m))}
      />

      {dialogo === 'nuevo' && <NuevoMetodoDialog onGuardar={crear} onCerrar={() => setDialogo(null)} />}
      {dialogo && dialogo !== 'nuevo' && (
        <ConfirmDialog
          title="Desactivar método"
          mensaje={`"${dialogo.nombre}" dejará de ofrecerse al cobrar. Los pagos ya registrados con ese método no cambian.`}
          confirmar="Desactivar"
          destructivo
          onConfirm={() => alternar(dialogo)}
          onClose={() => setDialogo(null)}
        />
      )}
    </>
  )
}
