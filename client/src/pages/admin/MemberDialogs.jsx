import { useState } from 'react'
import Dialog from './ui/Dialog.jsx'
import { paseDiario } from '../../services/adminService.js'
import { useMoney } from './adminUi.js'
import { useToast } from './ui/toast.jsx'
import { SelectMetodo } from './MemberForms.jsx'

// Pase diario a un visitante sin cuenta (solo registra el pago). El alta
// presencial de socios vive en AltaSocio.jsx.
export function PaseDiario({ token, planes, onCerrar, onHecho }) {
  const money = useMoney()
  const toast = useToast()
  const diario = planes.find((p) => p.periodo === 'diario')
  const [nombre, setNombre] = useState('')
  const [metodo, setMetodo] = useState('efectivo')
  const [monto, setMonto] = useState(diario ? String(diario.precio) : '')
  const [busy, setBusy] = useState(false)

  async function enviar(e) {
    e.preventDefault()
    setBusy(true)
    const payload = diario
      ? { nombre_cliente: nombre, plan_id: diario.id, metodo }
      : { nombre_cliente: nombre, monto: Number(monto), metodo }
    const r = await paseDiario(token, payload)
    setBusy(false)
    if (r.ok) {
      toast.ok('Pase diario registrado')
      onHecho()
    } else toast.error(r.error)
  }

  return (
    <Dialog title="Pase diario (visitante sin cuenta)" onClose={onCerrar} ancho={460}>
      <form onSubmit={enviar}>
        <div className="admin-field-row">
          <label>Nombre del cliente<input value={nombre} onChange={(e) => setNombre(e.target.value)} required autoFocus /></label>
          {!diario && <label>Monto<input type="number" min="0.01" step="0.01" value={monto} onChange={(e) => setMonto(e.target.value)} required /></label>}
          <SelectMetodo value={metodo} onChange={setMetodo} />
        </div>
        {diario && <p className="admin-muted">Se cobra el plan "Diario" ({money(diario.precio)}).</p>}
        <div className="dlg-actions">
          <button type="button" className="btn btn-ghost" onClick={onCerrar}>Cancelar</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Registrando…' : 'Registrar pase'}</button>
        </div>
      </form>
    </Dialog>
  )
}
