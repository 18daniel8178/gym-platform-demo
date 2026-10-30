import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { IconDots } from '../../../components/Icons.jsx'

const ANCHO = 210
const MARGEN = 8

// Ancla el menú al disparador en coordenadas de viewport, volteándolo hacia
// arriba si no cabe debajo.
function posicionar(boton, menu) {
  const r = boton.getBoundingClientRect()
  const alto = menu.offsetHeight
  const cabeAbajo = window.innerHeight - r.bottom > alto + MARGEN
  return {
    top: cabeAbajo ? r.bottom + 6 : Math.max(MARGEN, r.top - alto - 6),
    left: Math.max(MARGEN, Math.min(r.right - ANCHO, window.innerWidth - ANCHO - MARGEN)),
  }
}

// Mueve el foco entre las opciones con las flechas (patrón de menú ARIA).
function moverFoco(e, menu) {
  if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
  e.preventDefault()
  const items = [...menu.querySelectorAll('.ppl-menu-item')]
  const i = items.indexOf(document.activeElement)
  const paso = e.key === 'ArrowDown' ? 1 : -1
  items[(i + paso + items.length) % items.length]?.focus()
}

// Cierra al hacer clic fuera (el menú vive en un portal, así que hay que mirar
// disparador y menú por separado) y al hacer scroll o redimensionar.
function useCierreExterno({ abierto, cerrar, botonRef, menuRef }) {
  useEffect(() => {
    if (!abierto) return
    const fuera = (e) =>
      !botonRef.current?.contains(e.target) && !menuRef.current?.contains(e.target) && cerrar()
    document.addEventListener('mousedown', fuera)
    window.addEventListener('scroll', cerrar, true)
    window.addEventListener('resize', cerrar)
    return () => {
      document.removeEventListener('mousedown', fuera)
      window.removeEventListener('scroll', cerrar, true)
      window.removeEventListener('resize', cerrar)
    }
  }, [abierto, cerrar, botonRef, menuRef])
}

function OpcionesMenu({ etiqueta, acciones, menuRef, pos, onElegir, onCerrar }) {
  return createPortal(
    <div
      ref={menuRef}
      className="ppl-menu ppl-menu--flotante"
      role="menu"
      aria-label={etiqueta}
      style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999, minWidth: ANCHO }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onCerrar()
        else moverFoco(e, menuRef.current)
      }}
    >
      {acciones.map((a) => (
        <button
          key={a.id}
          type="button"
          role="menuitem"
          className={`ppl-menu-item ${a.destructivo ? 'ppl-menu-item--danger' : ''}`}
          onClick={() => onElegir(a)}
        >
          {a.label}
        </button>
      ))}
    </div>,
    document.body
  )
}

// Menú de acciones de una fila de tabla. El desplegable se renderiza en un
// portal con posición fija: dentro de la tabla lo recortarían el overflow de
// .ppl-card y el scroll horizontal de .ppl-table-wrap.
export default function MenuAcciones({ etiqueta, acciones }) {
  const [abierto, setAbierto] = useState(false)
  const [pos, setPos] = useState(null)
  const botonRef = useRef(null)
  const menuRef = useRef(null)

  // Devuelve el foco al disparador solo si estaba dentro del menú: al cerrar por
  // scroll, Escape o elegir una opción el foco no puede caer al body, pero si el
  // cierre vino de un clic fuera hay que respetar dónde clicó la persona.
  const cerrar = useCallback(() => {
    if (menuRef.current?.contains(document.activeElement)) botonRef.current?.focus()
    setAbierto(false)
    setPos(null)
  }, [])
  useCierreExterno({ abierto, cerrar, botonRef, menuRef })

  useLayoutEffect(() => {
    if (!abierto || !menuRef.current || !botonRef.current) return
    setPos(posicionar(botonRef.current, menuRef.current))
    menuRef.current.querySelector('.ppl-menu-item')?.focus()
  }, [abierto])

  const elegir = (a) => {
    cerrar()
    a.onClick()
  }

  return (
    <>
      <button
        ref={botonRef}
        type="button"
        className="btn btn-ghost btn-sm btn-icon"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        aria-haspopup="menu"
        aria-label={etiqueta}
        title="Acciones"
      >
        <IconDots width={16} height={16} />
      </button>
      {abierto && (
        <OpcionesMenu
          etiqueta={etiqueta}
          acciones={acciones}
          menuRef={menuRef}
          pos={pos}
          onElegir={elegir}
          onCerrar={cerrar}
        />
      )}
    </>
  )
}
