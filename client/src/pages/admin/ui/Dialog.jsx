import { useEffect, useRef, useState } from 'react'

// Pila de dialogs abiertos a nivel de módulo: con dialogs anidados (p. ej. una
// confirmación sobre un formulario), Escape solo cierra el TOPE de la pila y el
// scroll del body se restaura únicamente al cerrar el último.
const pila = []

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

function useComportamientoDialog(onClose, cardRef) {
  // onClose vía ref estable: el efecto corre UNA vez por montaje, así los
  // re-renders del padre no reordenan la pila ni re-disparan el foco.
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    const id = Symbol('dlg')
    pila.push(id)
    if (pila.length === 1) document.body.style.overflow = 'hidden'

    const focoPrevio = document.activeElement
    cardRef.current?.focus()

    const onKey = (e) => {
      if (e.key === 'Escape' && pila[pila.length - 1] === id) onCloseRef.current()
      if (e.key === 'Tab' && pila[pila.length - 1] === id) atraparTab(e, cardRef.current)
    }
    document.addEventListener('keydown', onKey)

    return () => {
      document.removeEventListener('keydown', onKey)
      pila.splice(pila.indexOf(id), 1)
      if (pila.length === 0) document.body.style.overflow = ''
      focoPrevio?.focus?.()
    }
  }, [cardRef])
}

// Mantiene el Tab ciclando dentro del dialog (trampa de foco simple)
function atraparTab(e, card) {
  if (!card) return
  const focusables = card.querySelectorAll(FOCUSABLE)
  if (focusables.length === 0) return
  const primero = focusables[0]
  const ultimo = focusables[focusables.length - 1]
  if (e.shiftKey && document.activeElement === primero) {
    e.preventDefault()
    ultimo.focus()
  } else if (!e.shiftKey && document.activeElement === ultimo) {
    e.preventDefault()
    primero.focus()
  }
}

// Modal accesible sobre overlay (reemplaza cards inline y confirm/prompt nativos).
// Cierra con Escape y clic en el fondo. Sin dependencias.
export default function Dialog({ title, onClose, children, ancho = 520 }) {
  const cardRef = useRef(null)
  useComportamientoDialog(onClose, cardRef)

  return (
    <div className="dlg-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        className="dlg-card"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        ref={cardRef}
        tabIndex={-1}
        style={{ maxWidth: ancho }}
      >
        <div className="dlg-head">
          <h2>{title}</h2>
          <button type="button" className="dlg-close" onClick={onClose} aria-label="Cerrar">
            ✕
          </button>
        </div>
        <div className="dlg-body">{children}</div>
      </div>
    </div>
  )
}

// Confirmación (reemplaza window.confirm). `destructivo` pinta la acción en rojo.
export function ConfirmDialog({ title, mensaje, confirmar = 'Confirmar', destructivo, onConfirm, onClose }) {
  return (
    <Dialog title={title} onClose={onClose} ancho={420}>
      <p className="dlg-msg">{mensaje}</p>
      <div className="dlg-actions">
        <button type="button" className="btn btn-ghost" onClick={onClose}>
          Cancelar
        </button>
        <button
          type="button"
          className={destructivo ? 'btn btn-danger' : 'btn btn-primary'}
          onClick={() => {
            onConfirm()
            onClose()
          }}
        >
          {confirmar}
        </button>
      </div>
    </Dialog>
  )
}

// Pide un texto obligatorio (reemplaza window.prompt), p. ej. el motivo de anulación.
export function PromptDialog({ title, label, confirmar = 'Confirmar', destructivo, onConfirm, onClose }) {
  const [texto, setTexto] = useState('')
  const valido = texto.trim().length > 0
  return (
    <Dialog title={title} onClose={onClose} ancho={440}>
      <label className="admin-field">
        {label}
        <textarea rows={2} value={texto} onChange={(e) => setTexto(e.target.value)} autoFocus />
      </label>
      <div className="dlg-actions">
        <button type="button" className="btn btn-ghost" onClick={onClose}>
          Cancelar
        </button>
        <button
          type="button"
          className={destructivo ? 'btn btn-danger' : 'btn btn-primary'}
          disabled={!valido}
          onClick={() => {
            onConfirm(texto.trim())
            onClose()
          }}
        >
          {confirmar}
        </button>
      </div>
    </Dialog>
  )
}
