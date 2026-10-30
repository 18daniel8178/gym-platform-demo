import { useRef, useState } from 'react'
import useClickOutside from './ui/useClickOutside.js'

// Filtro tipo dropdown: el botón muestra la categoría (p. ej. "Método") cuando
// no hay selección, o el valor elegido cuando lo hay; el menú lista "Todos"
// primero y luego las opciones. `capitalizar` aplica a valores en minúscula.
export default function FiltroDropdown({ label, value, opciones, onChange, capitalizar }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useClickOutside(ref, open, () => setOpen(false))

  const activo = value !== '' && value != null
  const seleccionada = opciones.find((o) => o.value === value)

  return (
    <div className="ppl-pop-wrap" ref={ref}>
      <button
        type="button"
        className={`ppl-chip ppl-chip-btn ${activo ? 'is-active' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span className={capitalizar && activo ? 'ppl-cap' : undefined}>{activo ? seleccionada?.label : label}</span>
        <span className="ppl-chip-caret">▾</span>
      </button>
      {open && (
        <div className="ppl-menu" role="menu" aria-label={label}>
          {opciones.map((o) => (
            <button
              type="button"
              role="menuitemradio"
              aria-checked={o.value === value}
              key={o.value || 'todos'}
              className={`ppl-menu-item ${o.value === value ? 'is-selected' : ''} ${capitalizar && o.value ? 'ppl-cap' : ''}`}
              onClick={() => { onChange(o.value); setOpen(false) }}
            >
              {o.label}
              {o.value === value && <span className="ppl-menu-check">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
