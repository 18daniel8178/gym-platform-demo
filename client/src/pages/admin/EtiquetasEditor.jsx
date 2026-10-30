import { useState } from 'react'
import { guardarEtiquetasSocio } from '../../services/adminService.js'
import { useToast } from './ui/toast.jsx'

// Etiquetas del socio: se quitan con × y se añaden escribiendo y pulsando Enter.
// Se guarda la lista entera; el server la normaliza ("Corporativo " y
// "corporativo" son la misma) y audita el diff. La lista mostrada es la que el
// server devuelve, no la que se escribió.
export default function EtiquetasEditor({ token, userId, inicial }) {
  const toast = useToast()
  const [etiquetas, setEtiquetas] = useState(inicial || [])
  const [nueva, setNueva] = useState('')
  const [busy, setBusy] = useState(false)

  async function guardar(lista) {
    setBusy(true)
    const r = await guardarEtiquetasSocio(token, userId, lista)
    setBusy(false)
    if (!r.ok) return toast.error(r.error)
    setEtiquetas(r.data.etiquetas)
    setNueva('')
    return undefined
  }

  function agregar(e) {
    e.preventDefault()
    if (nueva.trim()) guardar([...etiquetas, nueva])
  }

  return (
    <div className="socio-etiquetas">
      {etiquetas.map((et) => (
        <span key={et} className="admin-tag admin-tag--soft socio-etiqueta">
          {et}
          <button
            type="button"
            className="socio-etiqueta-quitar"
            aria-label={`Quitar la etiqueta ${et}`}
            disabled={busy}
            onClick={() => guardar(etiquetas.filter((x) => x !== et))}
          >
            ×
          </button>
        </span>
      ))}
      <form onSubmit={agregar}>
        <input
          className="socio-etiqueta-input"
          value={nueva}
          maxLength={30}
          placeholder="+ etiqueta"
          aria-label="Añadir etiqueta"
          disabled={busy}
          onChange={(e) => setNueva(e.target.value)}
        />
      </form>
    </div>
  )
}
