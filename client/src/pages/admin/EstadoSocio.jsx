import { useState } from 'react'
import Dialog from './ui/Dialog.jsx'
import { cambiarEstadoSocio } from '../../services/adminService.js'
import { useToast } from './ui/toast.jsx'
import { ESTADO_SOCIO } from './sociosUi.jsx'

const SENSIBLES = new Set(['bloqueado', 'archivado'])

// Estado del formulario y envío. `opciones` ya viene filtrada por los permisos de
// quien mira; el motivo es obligatorio donde la máquina de estados lo exige, y
// el server lo revalida igual.
function useCambioEstado({ token, userId, opciones, onHecho }) {
  const toast = useToast()
  const [destino, setDestino] = useState(opciones[0]?.estado || '')
  const [motivo, setMotivo] = useState('')
  const [busy, setBusy] = useState(false)
  const exigeMotivo = Boolean(opciones.find((t) => t.estado === destino)?.exigeMotivo)
  const listo = Boolean(destino) && !busy && !(exigeMotivo && !motivo.trim())

  async function enviar(e) {
    e.preventDefault()
    setBusy(true)
    const r = await cambiarEstadoSocio(token, userId, { estado: destino, motivo: motivo.trim() || null })
    setBusy(false)
    if (r.ok) {
      toast.ok(`Estado cambiado a ${ESTADO_SOCIO[destino].txt.toLowerCase()}`)
      onHecho()
    } else toast.error(r.error)
  }

  return { destino, setDestino, motivo, setMotivo, busy, exigeMotivo, listo, enviar }
}

// Cambia el estado del socio entre las salidas que el server permite desde el actual.
export default function EstadoSocioDialog({ token, userId, opciones, onHecho, onCerrar }) {
  const c = useCambioEstado({ token, userId, opciones, onHecho })

  return (
    <Dialog title="Cambiar estado del socio" onClose={onCerrar} ancho={440}>
      <form onSubmit={c.enviar}>
        <label className="admin-field">
          Nuevo estado
          <select value={c.destino} onChange={(e) => c.setDestino(e.target.value)} autoFocus>
            {opciones.map((t) => <option key={t.estado} value={t.estado}>{ESTADO_SOCIO[t.estado].txt}</option>)}
          </select>
        </label>
        <label className="admin-field">
          {c.exigeMotivo ? 'Motivo' : 'Motivo (opcional)'}
          <textarea rows={2} value={c.motivo} maxLength={300} required={c.exigeMotivo} onChange={(e) => c.setMotivo(e.target.value)} />
        </label>
        {c.destino === 'archivado' && (
          <p className="admin-muted">Sale de los listados y de la operación. Su historial, sus pagos y sus consentimientos se conservan, y se puede restaurar.</p>
        )}
        <div className="dlg-actions">
          <button type="button" className="btn btn-ghost" onClick={onCerrar}>Cancelar</button>
          <button type="submit" className={SENSIBLES.has(c.destino) ? 'btn btn-danger' : 'btn btn-primary'} disabled={!c.listo}>
            {c.busy ? 'Guardando…' : 'Cambiar estado'}
          </button>
        </div>
      </form>
    </Dialog>
  )
}
