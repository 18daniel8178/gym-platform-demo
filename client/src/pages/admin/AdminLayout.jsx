import { useCallback, useEffect, useRef, useState } from 'react'
import { NavLink, Link, Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { getMe } from '../../services/adminService.js'
import ThemeToggle from '../../components/ThemeToggle.jsx'
import {
  IconMenu, IconCollapse, IconExpand, IconExternal, IconLogout, IconUser,
} from '../../components/Icons.jsx'
import { ToastProvider } from './ui/toast.jsx'
import Forbidden from './ui/Forbidden.jsx'
import useClickOutside from './ui/useClickOutside.js'
import { tienePermiso } from './adminUi.js'
import { SECCIONES, rutaDe, seccionActiva } from './secciones.js'
import { useInfoPublica } from '../../lib/infoPublica.js'

// Colapso del sidebar, recordado entre sesiones.
function useColapso() {
  const [colapsado, setColapsado] = useState(() => localStorage.getItem('forja-admin-sidebar') === '1')
  const toggle = () =>
    setColapsado((v) => {
      localStorage.setItem('forja-admin-sidebar', v ? '0' : '1')
      return !v
    })
  return { colapsado, toggle }
}

// Guard: sesión + permisos confirmados por el server (GET /api/admin/me).
// Solo UX (menú); la seguridad real es server-side en cada request.
//
// Distingue "el servidor dijo que no" (403/401 → fuera del panel) de "no pude
// preguntar" (red caída o 5xx → pantalla de reintento DENTRO del panel). Antes
// cualquier fallo expulsaba al inicio, así que un hipo de red parecía una
// expulsión y el operador no sabía si le habían quitado el acceso.
function useAdminGate() {
  const { session, loading } = useAuth()
  const [gate, setGate] = useState({ estado: 'checking', me: null })
  const token = session?.access_token

  const consultar = useCallback(async () => {
    if (loading) return
    if (!token) {
      setGate({ estado: 'denied', me: null })
      return
    }
    setGate({ estado: 'checking', me: null })
    const r = await getMe(token)
    if (r.ok) setGate({ estado: 'ok', me: r.data })
    else if (r.status === 403 || r.status === 401) setGate({ estado: 'denied', me: null })
    else setGate({ estado: 'no-disponible', me: null })
  }, [loading, token])

  useEffect(() => {
    consultar()
  }, [consultar])

  return { ...gate, reintentar: consultar }
}

function Sidebar({ secciones, colapsado, onToggle, movil, onCerrarMovil }) {
  return (
    <aside className={`admin-sidebar ${movil ? 'is-open' : ''}`}>
      <Link to="/" className="admin-brand" onClick={onCerrarMovil}>
        FORJA {!colapsado && <span>GYM</span>}
      </Link>
      {!colapsado && <span className="admin-badge">Panel admin</span>}
      <nav className="admin-nav">
        {secciones.map((seccion) => {
          const { label, Icono } = seccion
          const to = rutaDe(seccion)
          return (
          <NavLink key={to} to={to} end={!seccion.ruta} className="admin-nav-link" title={label} onClick={onCerrarMovil}>
            <Icono width={19} height={19} />
            {!colapsado && <span>{label}</span>}
          </NavLink>
          )
        })}
      </nav>
      <button type="button" className="admin-nav-link admin-collapse-btn" onClick={onToggle} title={colapsado ? 'Expandir' : 'Colapsar'}>
        {colapsado ? <IconExpand width={19} height={19} /> : <IconCollapse width={19} height={19} />}
        {!colapsado && <span>Colapsar</span>}
      </button>
    </aside>
  )
}

function UserMenu({ email, onLogout }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useClickOutside(ref, open, () => setOpen(false))
  return (
    <div className="ppl-pop-wrap admin-user" ref={ref}>
      <button type="button" className="admin-user-btn" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-haspopup="menu" aria-label="Menú de usuario">
        <IconUser width={18} height={18} />
      </button>
      {open && (
        <div className="ppl-menu admin-user-menu" role="menu" aria-label="Cuenta">
          <span className="admin-user-email">{email}</span>
          <Link to="/" className="ppl-menu-item" role="menuitem">
            <span>Ver sitio público</span>
            <IconExternal width={15} height={15} />
          </Link>
          <button type="button" className="ppl-menu-item" role="menuitem" onClick={onLogout}>
            <span>Cerrar sesión</span>
            <IconLogout width={15} height={15} />
          </button>
        </div>
      )}
    </div>
  )
}

function Topbar({ seccion, onMenuMovil, email, onLogout }) {
  // De useInfoPublica y no de /me: al guardar Ajustes se olvida esa copia, así
  // que el nombre nuevo aparece sin recargar la página.
  const { sucursal } = useInfoPublica()
  return (
    <header className="admin-topbar">
      <button type="button" className="admin-burger" onClick={onMenuMovil} aria-label="Abrir navegación">
        <IconMenu width={20} height={20} />
      </button>
      <nav className="admin-crumb" aria-label="Ubicación">
        <span className="admin-crumb-root">Panel</span>
        <span className="admin-crumb-sep">/</span>
        <span className="admin-crumb-here">{seccion}</span>
      </nav>
      {/* En qué sucursal se está operando. Hoy hay una sola, así que se muestra
          y no se elige; el día que haya varias, este es el sitio del selector. */}
      {sucursal && <span className="admin-tag admin-tag--soft admin-sucursal" title="Sucursal en la que operas">{sucursal.nombre}</span>}
      <div className="admin-topbar-right">
        <ThemeToggle />
        <UserMenu email={email} onLogout={onLogout} />
      </div>
    </header>
  )
}

// Rol cuyas herramientas todavía no existen en el panel (p. ej. cajero o
// inventario, que llegan con POS e inventario): mejor decirlo que dejar un
// panel vacío con errores de permiso.
function SinSecciones({ email }) {
  return (
    <section className="admin-page">
      <div className="admin-page-head">
        <h1>Sin secciones disponibles</h1>
        <p className="admin-muted">
          La cuenta {email} no tiene acceso a ninguna sección del panel todavía. Las herramientas de tu rol se
          habilitarán en una próxima entrega; si crees que es un error, pide al administrador que revise tus roles.
        </p>
      </div>
    </section>
  )
}

// Sección inexistente: una URL del panel que no está en el registro.
function SeccionNoEncontrada() {
  return (
    <section className="admin-page">
      <div className="admin-page-head">
        <h1>Sección no encontrada</h1>
        <p className="admin-muted">
          Esa dirección no corresponde a ninguna sección del panel. Usa el menú lateral para volver.
        </p>
      </div>
    </section>
  )
}

// Qué se pinta en el área principal. La página SOLO se monta si la URL
// corresponde a una sección del registro y el usuario tiene su permiso: una
// ruta que nadie declaró no puede colarse por el Outlet.
function ContenidoAdmin({ secciones, actual, me, email }) {
  if (secciones.length === 0) return <SinSecciones email={email} />
  if (!actual) return <SeccionNoEncontrada />
  if (!tienePermiso(me, actual.permiso)) return <Forbidden />
  return <Outlet context={{ me }} />
}

export default function AdminLayout() {
  const { estado, me, reintentar } = useAdminGate()
  const { user, logout } = useAuth()
  const { pathname } = useLocation()
  const { colapsado, toggle } = useColapso()
  const [movilOpen, setMovilOpen] = useState(false)

  const email = user?.email
  const secciones = SECCIONES.filter((s) => tienePermiso(me, s.permiso))
  const actual = seccionActiva(pathname)

  if (estado === 'checking') {
    return <div className="admin-gate" aria-live="polite" aria-busy="true">Verificando acceso…</div>
  }
  // Solo una respuesta del servidor saca del panel; un fallo de red ofrece reintentar.
  if (estado === 'denied') return <Navigate to="/" replace />
  if (estado === 'no-disponible') {
    return (
      <div className="admin-gate">
        <p>No se pudo comprobar tu acceso. Puede ser un problema de conexión.</p>
        <button className="btn btn-primary" onClick={reintentar}>Reintentar</button>
      </div>
    )
  }

  return (
    <ToastProvider>
      <div className={`admin-shell ${colapsado ? 'is-collapsed' : ''}`}>
        <Sidebar secciones={secciones} colapsado={colapsado && !movilOpen} onToggle={toggle} movil={movilOpen} onCerrarMovil={() => setMovilOpen(false)} />
        {movilOpen && <div className="admin-scrim" onClick={() => setMovilOpen(false)} aria-hidden="true" />}
        <div className="admin-main-col">
          <Topbar seccion={actual ? actual.label : 'Panel'} onMenuMovil={() => setMovilOpen(true)} email={email} onLogout={logout} />
          <main className="admin-main">
            <ContenidoAdmin secciones={secciones} actual={actual} me={me} email={email} />
          </main>
        </div>
      </div>
    </ToastProvider>
  )
}
