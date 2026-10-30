// Pestañas del panel. Nació en Equipo y ahora la comparten Equipo y Ajustes:
// el patrón ARIA (tablist, roving tabindex, flechas, tabpanel) se corrige en un
// solo sitio en vez de en cada pantalla que las use.
//
// `items` son pares [clave, etiqueta]. `idPanel` debe ser el id del contenedor
// que envuelve el contenido, para que aria-controls apunte a algo real.
export default function Tabs({ items, activo, onCambiar, etiqueta, idPanel }) {
  const onKeyDown = (e) => {
    const paso = { ArrowRight: 1, ArrowLeft: -1 }[e.key]
    if (!paso) return
    e.preventDefault()
    const i = items.findIndex(([clave]) => clave === activo)
    const [siguiente] = items[(i + paso + items.length) % items.length]
    onCambiar(siguiente)
    document.getElementById(`tab-${siguiente}`)?.focus()
  }

  return (
    <div className="admin-tabs" role="tablist" aria-label={etiqueta} onKeyDown={onKeyDown}>
      {items.map(([clave, texto]) => (
        <button
          key={clave}
          type="button"
          role="tab"
          id={`tab-${clave}`}
          aria-selected={clave === activo}
          aria-controls={idPanel}
          tabIndex={clave === activo ? 0 : -1}
          className={`admin-tab ${clave === activo ? 'is-active' : ''}`}
          onClick={() => onCambiar(clave)}
        >
          {texto}
        </button>
      ))}
    </div>
  )
}
