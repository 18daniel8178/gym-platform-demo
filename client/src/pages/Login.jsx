import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import ThemeToggle from '../components/ThemeToggle.jsx'
import EntradaDemo from '../demo/EntradaDemo.jsx'
import logo from '../assets/logo.webp'

// Estado del formulario de inicio de sesión y envío de credenciales
function useLoginForm() {
  const { login, configured } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!configured) {
      setError('Supabase no está configurado. Completa client/.env con la URL del proyecto.')
      return
    }
    setSending(true)
    const { error: err } = await login(email, password)
    setSending(false)
    if (err) {
      setError('Correo o contraseña incorrectos.')
      return
    }
    navigate('/', { replace: true })
  }

  return { email, setEmail, password, setPassword, error, sending, handleSubmit }
}

function LoginForm() {
  const { email, setEmail, password, setPassword, error, sending, handleSubmit } = useLoginForm()
  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      {error && <div className="auth-error">{error}</div>}
      <label>
        Correo electrónico
        <input
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="tucorreo@ejemplo.com"
          required
        />
      </label>
      <label>
        Contraseña
        <input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          required
        />
      </label>
      <button className={`btn btn-primary ${sending ? 'loading' : ''}`} type="submit" disabled={sending}>
        Iniciar sesión
      </button>
    </form>
  )
}

export default function Login() {
  const { session } = useAuth()

  if (session) return <Navigate to="/" replace />

  return (
    <div className="auth-page">
      <Link to="/" className="auth-back">← Inicio</Link>
      <ThemeToggle className="theme-toggle-floating" />
      <div className="card auth-card">
        <img src={logo} alt="Logo FORJA GYM" />
        <h1>
          FORJA <span>GYM</span>
        </h1>
        <p className="subtitle">Constancia que se nota</p>

        {/* Demo local: condición literal para que el build de producción la elimine */}
        {import.meta.env.VITE_DEMO_MODE === 'true' && <EntradaDemo />}
        <LoginForm />

        <p className="auth-switch">
          ¿No tienes cuenta? <Link to="/join">Únete a FORJA GYM</Link>
        </p>
      </div>
    </div>
  )
}
