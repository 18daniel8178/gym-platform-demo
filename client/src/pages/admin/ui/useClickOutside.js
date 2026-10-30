import { useEffect } from 'react'

// Cierra un popover/menú al hacer clic o tocar fuera del contenedor, o con Escape.
// Uso: useClickOutside(ref, open, () => setOpen(false))
export default function useClickOutside(ref, activo, onFuera) {
  useEffect(() => {
    if (!activo) return
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onFuera()
    }
    const onKey = (e) => {
      if (e.key === 'Escape') onFuera()
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [ref, activo, onFuera])
}
