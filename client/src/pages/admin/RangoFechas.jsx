import { useRef, useState } from 'react'
import useClickOutside from './ui/useClickOutside.js'

const fechaCorta = (ymd) => {
  if (!ymd) return '…'
  return new Date(ymd + 'T00:00:00').toLocaleDateString('es-PA', { day: 'numeric', month: 'short' })
}

// Botón "Rango de fechas" que abre un popover con Desde/Hasta y Aplicar/Limpiar.
export default function RangoFechas({ desde, hasta, onAplicar }) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState({ desde: '', hasta: '' })
  const ref = useRef(null)
  useClickOutside(ref, open, () => setOpen(false))

  const activo = Boolean(desde || hasta)
  const invalido = Boolean(draft.desde && draft.hasta && draft.desde > draft.hasta)
  const abrir = () => { setDraft({ desde, hasta }); setOpen(true) }
  const aplicar = () => { onAplicar(draft.desde, draft.hasta); setOpen(false) }
  const limpiar = () => { onAplicar('', ''); setOpen(false) }

  return (
    <div className="ppl-pop-wrap" ref={ref}>
      <button
        type="button"
        className={`ppl-chip ppl-chip-btn ${activo ? 'is-active' : ''}`}
        onClick={() => (open ? setOpen(false) : abrir())}
        aria-expanded={open}
      >
        <svg viewBox="0 0 20 20" width="15" height="15" aria-hidden="true">
          <path d="M6 2v2M14 2v2M3 6h14M4 4h12a1 1 0 011 1v11a1 1 0 01-1 1H4a1 1 0 01-1-1V5a1 1 0 011-1z" fill="none" stroke="currentColor" strokeWidth="1.4" />
        </svg>
        {activo ? `${fechaCorta(desde)} – ${fechaCorta(hasta)}` : 'Rango de fechas'}
        <span className="ppl-chip-caret">▾</span>
      </button>
      {open && (
        <div className="ppl-popover" role="dialog" aria-label="Rango de fechas">
          <label className="ppl-pop-field">Desde<input type="date" value={draft.desde} onChange={(e) => setDraft({ ...draft, desde: e.target.value })} /></label>
          <label className="ppl-pop-field">Hasta<input type="date" value={draft.hasta} min={draft.desde || undefined} onChange={(e) => setDraft({ ...draft, hasta: e.target.value })} /></label>
          {invalido && <p className="ppl-pop-hint">La fecha final no puede ser anterior a la inicial.</p>}
          <div className="ppl-pop-actions">
            <button type="button" className="btn btn-ghost btn-sm" onClick={limpiar}>Limpiar</button>
            <button type="button" className="btn btn-primary btn-sm" disabled={invalido} onClick={aplicar}>Aplicar</button>
          </div>
        </div>
      )}
    </div>
  )
}
