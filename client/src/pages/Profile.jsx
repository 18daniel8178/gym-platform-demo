import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { getProfile } from '../services/profileService.js'
import MembershipStatus from '../components/MembershipStatus.jsx'
import QrCard from '../components/QrCard.jsx'
import Skeleton from '../components/Skeleton.jsx'
import { IconLogout } from '../components/Icons.jsx'

// Las fechas de la BD son YYYY-MM-DD; se parsean como fecha local para no correrse un día
function parseLocal(fecha) {
  if (!fecha) return null
  const [y, m, d] = fecha.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function diasRestantes(fechaFin) {
  const fin = parseLocal(fechaFin)
  if (!fin) return null
  const hoy = new Date(new Date().toDateString())
  return Math.max(0, Math.ceil((fin - hoy) / 86400000))
}

function progresoPeriodo(inicio, fin) {
  const a = parseLocal(inicio)
  const b = parseLocal(fin)
  if (!a || !b || b <= a) return 0
  const hoy = new Date(new Date().toDateString())
  return Math.min(100, Math.max(0, Math.round(((hoy - a) / (b - a)) * 100)))
}

function fechaLegible(fecha) {
  const d = parseLocal(fecha)
  return d ? d.toLocaleDateString('es-PA', { day: 'numeric', month: 'long', year: 'numeric' }) : ''
}

// "Socio desde marzo 2026" a partir del timestamp de registro del perfil
function socioDesde(createdAt) {
  if (!createdAt) return ''
  const d = new Date(createdAt)
  if (isNaN(d)) return ''
  return d.toLocaleDateString('es-PA', { month: 'long', year: 'numeric' })
}

// Primer nombre a mostrar: del perfil o, en su defecto, del correo
function primerNombreDe(nombre, user) {
  if (nombre) return nombre.trim().split(' ')[0]
  return user?.email?.split('@')[0] ?? ''
}

// Carga en paralelo el perfil y la membresía del socio autenticado
function usePerfilDashboard(session) {
  const [nombre, setNombre] = useState('')
  const [desde, setDesde] = useState('')
  const [membership, setMembership] = useState(null)
  const [carnet, setCarnet] = useState(null)
  const [dashLoading, setDashLoading] = useState(true)

  useEffect(() => {
    if (!session) return
    const conSesion = { headers: { Authorization: `Bearer ${session.access_token}` } }
    const profileQuery = getProfile()
    const membershipQuery = fetch('/api/membership', conSesion).then((r) => (r.ok ? r.json() : null))
    // El carnet lo firma el servidor: el socio solo puede pedir el suyo.
    const carnetQuery = fetch('/api/carnet', conSesion).then((r) => (r.ok ? r.json() : null))

    Promise.all([profileQuery, membershipQuery, carnetQuery])
      .then(([p, m, c]) => {
        setNombre(p?.data?.nombre_completo ?? '')
        setDesde(socioDesde(p?.data?.created_at))
        setMembership(m)
        setCarnet(c?.token ?? null)
      })
      .catch(() => {})
      .finally(() => setDashLoading(false))
  }, [session])

  return { nombre, desde, membership, carnet, dashLoading }
}

// Aviso al visitante que aún no ha iniciado sesión
function PerfilSinSesion() {
  return (
    <main className="container page">
      <h1 className="page-title">
        Mi <span>perfil</span>
      </h1>
      <div className="card profile-card" style={{ textAlign: 'center' }}>
        <div className="profile-avatar" style={{ margin: '0 auto' }}>?</div>
        <div>
          <h3 style={{ marginBottom: '0.4rem' }}>Aún no has iniciado sesión</h3>
          <p style={{ color: 'var(--muted)', fontSize: '0.92rem' }}>
            Crea tu cuenta o inicia sesión para ver tu perfil y tu membresía.
          </p>
        </div>
        <Link className="btn btn-primary" to="/join">
          Iniciar sesión / Únete
        </Link>
      </div>
    </main>
  )
}

function DashboardSkeleton() {
  return (
    <div className="dash-grid" aria-hidden="true">
      <div className="skeleton-card dash-identity"><Skeleton width="40%" height={22} /><Skeleton.Lines count={2} /></div>
      <div className="skeleton-card dash-membership"><Skeleton width="55%" height={20} /><Skeleton width="35%" height={40} /></div>
      <div className="skeleton-card dash-nextpay"><Skeleton width="50%" height={20} /><Skeleton width="70%" height={16} /></div>
      <div className="skeleton-card dash-qr"><Skeleton height={170} style={{ borderRadius: 'var(--r-md)' }} /></div>
    </div>
  )
}

// Identidad del socio: avatar, nombre, correo y cierre de sesión
function IdentityCard({ nombre, desde, primerNombre, user, onLogout }) {
  return (
    <section className="card dash-cell dash-identity reveal">
      <div className="profile-avatar">{(primerNombre[0] ?? user?.email?.[0] ?? '?').toUpperCase()}</div>
      <div className="dash-identity-info">
        <h3>{nombre || 'Cliente FORJA GYM'}</h3>
        <p className="dash-muted">{user?.email}</p>
        {desde && <p className="dash-since">Socio desde {desde}</p>}
      </div>
      <button className="btn btn-ghost dash-logout" onClick={onLogout}>
        <IconLogout width={18} height={18} /> Cerrar sesión
      </button>
    </section>
  )
}

// Membresía activa: días restantes, progreso del periodo y próximo pago
function MembershipCells({ membership }) {
  const navigate = useNavigate()
  const dias = diasRestantes(membership.fecha_fin)
  // Periodo en curso calculado por la API: fecha_inicio abarca toda la cadena
  // de renovaciones a tiempo y daría un progreso inflado. Sin él (una API
  // anterior), mejor un progreso aproximado que tumbar el panel entero.
  const { inicio, fin } = membership.periodo_actual ?? { inicio: membership.fecha_inicio, fin: membership.fecha_fin }
  const progreso = progresoPeriodo(inicio, fin)
  return (
    <>
      {/* Membresía con progreso */}
      <section className="card dash-cell dash-membership reveal" style={{ animationDelay: '0.08s' }}>
        <div className="dash-cell-head">
          <h3>Plan {membership.plan?.nombre}</h3>
          <span className="badge badge-active">Activa</span>
        </div>
        <div className="days-number">{dias}</div>
        <div className="days-label">{dias === 1 ? 'día restante' : 'días restantes'}</div>
        <div className="period-track" role="progressbar" aria-valuenow={progreso} aria-valuemin="0" aria-valuemax="100" aria-label="Progreso del periodo">
          <div className="period-fill" style={{ width: `${progreso}%` }} />
        </div>
        <p className="dash-muted">{progreso}% del periodo transcurrido</p>
      </section>

      {/* Próximo pago */}
      <section className="card dash-cell dash-nextpay reveal" style={{ animationDelay: '0.16s' }}>
        <h3>Próximo pago</h3>
        <p className="nextpay-date">{fechaLegible(membership.fecha_fin)}</p>
        <p className="dash-muted">Renueva antes de esa fecha para no perder tu ritmo.</p>
        <button className="btn btn-primary" onClick={() => navigate('/pagar')}>
          Renovar plan
        </button>
      </section>
    </>
  )
}

// Accesos rápidos
function QuickActions({ activa }) {
  const navigate = useNavigate()
  return (
    <section className="card dash-cell dash-actions reveal" style={{ animationDelay: '0.32s' }}>
      <h3>Accesos rápidos</h3>
      <div className="dash-actions-row">
        <button className="btn btn-outline" onClick={() => navigate('/pagar')}>
          {activa ? 'Cambiar de plan' : 'Elegir un plan'}
        </button>
        <Link className="btn btn-outline" to="/contacto">
          Contacto
        </Link>
        <Link className="btn btn-outline" to="/productos">
          Productos
        </Link>
      </div>
    </section>
  )
}

// Grid del panel de socio con los datos ya cargados
function DashboardGrid({ dash, primerNombre, user, onLogout }) {
  const activa = dash.membership?.estado === 'activa'
  return (
    <div className="dash-grid">
      {/* Identidad */}
      <IdentityCard
        nombre={dash.nombre}
        desde={dash.desde}
        primerNombre={primerNombre}
        user={user}
        onLogout={onLogout}
      />

      {activa ? (
        <MembershipCells membership={dash.membership} />
      ) : (
        <section className="dash-cell dash-mem-cta reveal" style={{ animationDelay: '0.08s' }}>
          <MembershipStatus />
        </section>
      )}

      {/* Carnet QR */}
      <section className="card dash-cell dash-qr reveal" style={{ animationDelay: '0.24s' }}>
        <QrCard token={dash.carnet} userId={user?.id} />
      </section>

      <QuickActions activa={activa} />
    </div>
  )
}

export default function Profile() {
  const { user, session, loading, logout } = useAuth()
  const navigate = useNavigate()
  const dash = usePerfilDashboard(session)

  async function handleLogout() {
    await logout()
    navigate('/', { replace: true })
  }

  if (loading) return <p className="loading">Cargando…</p>

  if (!session) return <PerfilSinSesion />

  const primerNombre = primerNombreDe(dash.nombre, user)

  return (
    <main className="container page">
      <h1 className="dashboard-greeting reveal">
        Hola, <span>{primerNombre || 'socio'}</span>
      </h1>
      <p className="page-subtitle">Este es tu panel de socio de FORJA GYM.</p>

      {dash.dashLoading ? (
        <DashboardSkeleton />
      ) : (
        <DashboardGrid dash={dash} primerNombre={primerNombre} user={user} onLogout={handleLogout} />
      )}
    </main>
  )
}
