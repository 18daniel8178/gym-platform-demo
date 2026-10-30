import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { cuentasDemo, entrarComo } from '../services/demoService.js'

// Botones "Entrar como…" de la demo local: una cuenta por
// rol del panel y un socio, sin contraseñas. Solo se monta con VITE_DEMO_MODE
// (ver Login.jsx); el server valida la cuenta contra su lista de todas formas.
export default function EntradaDemo() {
  const navigate = useNavigate()
  const [cuentas, setCuentas] = useState(null) // null = cargando
  const [entrando, setEntrando] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    cuentasDemo().then(setCuentas)
  }, [])

  async function entrar(cuenta) {
    setError('')
    setEntrando(cuenta.clave)
    const { error: e } = await entrarComo(cuenta.clave)
    setEntrando(null)
    if (e) return setError(e)
    return navigate(cuenta.clave === 'socio' ? '/perfil' : '/admin', { replace: true })
  }

  if (cuentas === null) return <p className="demo-entrada-nota">Cargando cuentas de la demo…</p>
  if (cuentas.length === 0) return <p className="auth-error">La API de la demo no responde. ¿Arrancaste con npm run demo?</p>

  return (
    <section className="demo-entrada" aria-label="Entrar a la demo sin contraseña">
      <p className="demo-entrada-titulo">Demo · entra con un clic</p>
      <div className="demo-entrada-grid">
        {cuentas.map((c) => (
          <button key={c.clave} type="button" className="demo-entrada-btn" disabled={Boolean(entrando)} onClick={() => entrar(c)}>
            <strong>{c.etiqueta}</strong>
            <span>{entrando === c.clave ? 'Entrando…' : c.nombre}</span>
          </button>
        ))}
      </div>
      {error && <div className="auth-error">{error}</div>}
    </section>
  )
}
