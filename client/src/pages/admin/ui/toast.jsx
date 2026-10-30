import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'

// Toasts de confirmación no bloqueantes (reemplazan a alert()).
// Uso: const toast = useToast(); toast.ok('Guardado'); toast.error('Falló X')
const ToastContext = createContext(null)

const DURACION_MS = 3800

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const nextId = useRef(1)

  const quitar = useCallback((id) => {
    setToasts((t) => t.filter((x) => x.id !== id))
  }, [])

  const push = useCallback(
    (tipo, mensaje) => {
      const id = nextId.current++
      setToasts((t) => [...t, { id, tipo, mensaje }])
      setTimeout(() => quitar(id), DURACION_MS)
    },
    [quitar]
  )

  const api = useMemo(
    () => ({
      ok: (m) => push('ok', m),
      error: (m) => push('error', m),
      info: (m) => push('info', m),
    }),
    [push]
  )

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-host" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast--${t.tipo}`} role="status">
            {t.mensaje}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}
