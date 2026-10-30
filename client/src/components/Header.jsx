import { useEffect, useState } from 'react'
import { NavLink, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import ThemeToggle from './ThemeToggle.jsx'
import { IconUser } from './Icons.jsx'
import logo from '../assets/logo.webp'

const SERVICIOS = [
  { label: 'Membresías', to: '/suscripcion' },
  { label: 'Coffee', to: '/productos#coffee' },
  { label: 'Merch', to: '/productos#merch' },
  { label: 'Suplementos', to: '/productos?cat=suplemento' },
  { label: 'Entrenamiento personal', to: '/entrenamiento' },
]

// Sombra sutil del header al hacer scroll
function useScrolled() {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  return scrolled
}

// Menú desplegable de servicios
function ServiciosDropdown({ open, onToggle, onNavigate }) {
  return (
    <div className={`nav-dropdown ${open ? 'expanded' : ''}`}>
      <button
        type="button"
        className="nav-link nav-dropdown-toggle"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={onToggle}
      >
        Servicios <span className="caret">▾</span>
      </button>
      <div className="dropdown-panel">
        {SERVICIOS.map((s) => (
          <Link key={s.label} to={s.to} className="dropdown-item" onClick={onNavigate}>
            {s.label}
          </Link>
        ))}
      </div>
    </div>
  )
}

// Zona de cuenta: perfil, tema y CTA de unirse si no hay sesión
function NavAccount({ session, onNavigate }) {
  return (
    <div className="nav-account">
      <NavLink to="/perfil" className="nav-profile" title="Perfil" aria-label="Perfil" onClick={onNavigate}>
        <IconUser width={20} height={20} />
        <span className="nav-profile-label">Perfil</span>
      </NavLink>
      <ThemeToggle />
      {!session && (
        <Link to="/join" className="btn btn-primary btn-join" onClick={onNavigate}>
          Únete
        </Link>
      )}
    </div>
  )
}

export default function Header() {
  const { session, accesoPanel } = useAuth()
  const [open, setOpen] = useState(false)
  const [servicesOpen, setServicesOpen] = useState(false)
  const scrolled = useScrolled()

  const close = () => {
    setOpen(false)
    setServicesOpen(false)
  }

  return (
    <header className={`header ${scrolled ? 'scrolled' : ''}`}>
      <div className="container header-inner">
        <NavLink to="/" className="header-brand" onClick={close}>
          <img src={logo} alt="Logo FORJA GYM" />
          FORJA <span>GYM</span>
        </NavLink>

        <button
          className="hamburger"
          aria-label="Abrir menú"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? '✕' : '☰'}
        </button>

        <nav className={`nav-links ${open ? 'open' : ''}`}>
          <NavLink to="/" end className="nav-link" onClick={close}>
            Inicio
          </NavLink>

          <ServiciosDropdown
            open={servicesOpen}
            onToggle={() => setServicesOpen((v) => !v)}
            onNavigate={close}
          />

          <NavLink to="/galeria" className="nav-link" onClick={close}>
            Galería
          </NavLink>
          <NavLink to="/contacto" className="nav-link" onClick={close}>
            Contáctanos
          </NavLink>
          {accesoPanel && (
            <NavLink to="/admin" className="nav-link" onClick={close}>
              Admin
            </NavLink>
          )}

          <NavAccount session={session} onNavigate={close} />
        </nav>
      </div>
    </header>
  )
}
