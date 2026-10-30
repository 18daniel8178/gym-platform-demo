import { Link, useNavigate } from 'react-router-dom'
import ThemeToggle from '../components/ThemeToggle.jsx'
import { IconPin } from '../components/Icons.jsx'
import logo from '../assets/logo.webp'

// Piezas presentacionales de Join: pantallas de resultado y secciones del
// formulario. Extraídas de Join.jsx; el estado y el envío viven allá.

// Pantalla final: registro completado
export function PantallaExito() {
  const navigate = useNavigate()
  return (
    <div className="auth-page">
      <Link to="/" className="auth-back">← Inicio</Link>
      <ThemeToggle className="theme-toggle-floating" />
      <div className="card auth-card join-card join-done reveal">
        <img src={logo} alt="Logo FORJA GYM" />
        <span className="success-badge">
          <span className="dot">✓</span> Registro completado
        </span>
        <h1>
          ¡Ya casi <span>eres parte</span>!
        </h1>

        <div className="next-step">
          <span className="next-step-icon">
            <IconPin width={22} height={22} />
          </span>
          <div className="next-step-body">
            <h3>Último paso, en el gym</h3>
            <p>
              Visita FORJA GYM para <strong>firmar tu formulario</strong> y{' '}
              <strong>tomarte la foto</strong> de socio. Con eso quedas activo.
            </p>
          </div>
        </div>

        <p className="join-decide">¿Quieres activar tu membresía ahora?</p>
        <div className="join-actions">
          <button className="btn btn-primary" onClick={() => navigate('/pagar')}>
            Elegir membresía
          </button>
          <button className="btn btn-ghost" onClick={() => navigate('/')}>
            Seguir sin membresía
          </button>
        </div>
      </div>
    </div>
  )
}

// Pantalla para quien ya envió su formulario de ingreso
export function PantallaYaRegistrado() {
  const navigate = useNavigate()
  return (
    <div className="auth-page">
      <Link to="/" className="auth-back">← Inicio</Link>
      <ThemeToggle className="theme-toggle-floating" />
      <div className="card auth-card">
        <img src={logo} alt="Logo FORJA GYM" />
        <h1>
          Ya estás <span>registrado</span>
        </h1>
        <p className="subtitle">Tu formulario de ingreso ya fue enviado.</p>
        <button className="btn btn-primary" onClick={() => navigate('/')}>
          Ir al inicio
        </button>
      </div>
    </div>
  )
}

// Sección: datos personales
function SeccionDatosPersonales({ f, set }) {
  return (
    <>
      <h2 className="join-section">Datos personales</h2>
      <div className="join-grid">
        <label>
          Nombre completo
          <input type="text" autoComplete="name" value={f.nombre} onChange={set('nombre')} placeholder="Nombre y apellidos" required />
        </label>
        <label>
          Fecha de nacimiento
          <input type="date" value={f.nacimiento} onChange={set('nacimiento')} required />
        </label>
        <label>
          Documento de identidad
          <input type="text" value={f.documento} onChange={set('documento')} placeholder="Cédula o pasaporte" required />
        </label>
        <label>
          Teléfono
          <input type="tel" autoComplete="tel" value={f.telefono} onChange={set('telefono')} placeholder="6000-0000" required />
        </label>
      </div>
    </>
  )
}

// Sección: cuenta nueva (solo en modo 'full')
function SeccionCuenta({ f, set, accountCreated }) {
  return (
    <>
      <h2 className="join-section">Tu cuenta</h2>
      <div className="join-grid">
        <label>
          Correo electrónico
          <input type="email" autoComplete="email" value={f.email} onChange={set('email')} placeholder="tucorreo@ejemplo.com" required disabled={accountCreated} />
        </label>
        <label>
          Contraseña (mínimo 6 caracteres)
          <input type="password" autoComplete="new-password" value={f.password} onChange={set('password')} placeholder="••••••••" required disabled={accountCreated} />
        </label>
        <label>
          Confirmar contraseña
          <input type="password" autoComplete="new-password" value={f.confirm} onChange={set('confirm')} placeholder="••••••••" required disabled={accountCreated} />
        </label>
      </div>
    </>
  )
}

// Sección: contactos de emergencia
function SeccionEmergencia({ f, set }) {
  return (
    <>
      <h2 className="join-section">Contactos de emergencia</h2>
      <div className="join-grid">
        <label>
          Contacto 1 — Nombre
          <input type="text" value={f.em1Nombre} onChange={set('em1Nombre')} placeholder="Nombre del contacto" required />
        </label>
        <label>
          Contacto 1 — Teléfono
          <input type="tel" value={f.em1Telefono} onChange={set('em1Telefono')} placeholder="6000-0000" required />
        </label>
        <label>
          Contacto 2 — Nombre
          <input type="text" value={f.em2Nombre} onChange={set('em2Nombre')} placeholder="Nombre del contacto" required />
        </label>
        <label>
          Contacto 2 — Teléfono
          <input type="tel" value={f.em2Telefono} onChange={set('em2Telefono')} placeholder="6000-0000" required />
        </label>
      </div>
    </>
  )
}

// Sección: salud y experiencia
function SeccionSalud({ f, set }) {
  return (
    <>
      <h2 className="join-section">Salud y experiencia</h2>
      <div className="join-grid">
        <label>
          ¿Has entrenado antes?
          <select value={f.entrenado} onChange={set('entrenado')} required>
            <option value="">Selecciona una opción</option>
            <option value="si">Sí, ya he entrenado</option>
            <option value="no">No, soy principiante</option>
          </select>
        </label>
        <label className="join-full">
          ¿Sufres de alguna enfermedad o condición médica?
          <textarea
            value={f.enfermedad}
            onChange={set('enfermedad')}
            rows={3}
            placeholder="Escríbela aquí (alergias, lesiones, condiciones…). Déjalo vacío si ninguna."
          />
        </label>
      </div>
    </>
  )
}

// Formulario de ingreso completo (crea cuenta cuando el modo es 'full')
export function FormularioIngreso({ mode, f, set, error, sending, accountCreated, onSubmit }) {
  return (
    <div className="auth-page">
      <Link to="/" className="auth-back">← Inicio</Link>
      <ThemeToggle className="theme-toggle-floating" />
      <div className="card auth-card join-card">
        <img src={logo} alt="Logo FORJA GYM" />
        <h1>
          Únete a FORJA <span>GYM</span>
        </h1>
        <p className="subtitle">
          {mode === 'complete'
            ? 'Completa tu formulario de ingreso'
            : 'Formulario de ingreso — crea tu cuenta de socio'}
        </p>

        <form className="auth-form" onSubmit={onSubmit}>
          {error && <div className="auth-error">{error}</div>}

          <SeccionDatosPersonales f={f} set={set} />
          {mode === 'full' && <SeccionCuenta f={f} set={set} accountCreated={accountCreated} />}
          <SeccionEmergencia f={f} set={set} />
          <SeccionSalud f={f} set={set} />

          <p className="join-note">
            Al enviar, tu ingreso quedará pendiente de la <strong>firma</strong> y la <strong>foto</strong> que se toman en el gym.
          </p>

          <button className={`btn btn-primary ${sending ? 'loading' : ''}`} type="submit" disabled={sending}>
            Enviar formulario
          </button>
        </form>

        {mode === 'full' && (
          <p className="auth-switch">
            ¿Ya tienes cuenta? <Link to="/login">Inicia sesión</Link>
          </p>
        )}
      </div>
    </div>
  )
}
