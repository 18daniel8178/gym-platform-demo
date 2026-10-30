import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

// Consulta la membresía del usuario autenticado contra la API
function useMembership() {
  const { session } = useAuth()
  const [membership, setMembership] = useState(null)
  const [status, setStatus] = useState('loading') // loading | ok | none | error | nosession

  useEffect(() => {
    if (!session) {
      setStatus('nosession')
      return
    }
    fetch('/api/membership', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => {
        if (data) {
          setMembership(data)
          setStatus('ok')
        } else {
          setStatus('none')
        }
      })
      .catch(() => setStatus('error'))
  }, [session])

  return { membership, status }
}

function CargandoBox() {
  return (
    <div className="card membership-box" aria-hidden="true">
      <div className="skeleton" style={{ width: 90, height: 22, borderRadius: '999px' }} />
      <div className="skeleton" style={{ width: '55%', height: 20 }} />
      <div className="skeleton" style={{ width: '75%', height: 13 }} />
    </div>
  )
}

function SinSesionBox() {
  return (
    <div className="card membership-box">
      <span className="badge badge-none">Tu membresía</span>
      <p className="muted">Inicia sesión o únete a FORJA GYM para ver el estado de tu membresía.</p>
      <Link to="/join" className="btn btn-primary" style={{ width: 'fit-content' }}>
        Iniciar sesión / Únete
      </Link>
    </div>
  )
}

function ErrorBox() {
  return (
    <div className="card membership-box">
      <span className="badge badge-none">No disponible</span>
      <p className="muted">No se pudo consultar tu membresía en este momento.</p>
    </div>
  )
}

function SinMembresiaBox({ showCta }) {
  return (
    <div className="card membership-box">
      <span className="badge badge-none">Sin membresía activa</span>
      <p className="muted">Aún no tienes una membresía registrada.</p>
      {showCta && (
        <Link to="/pagar" className="btn btn-primary" style={{ width: 'fit-content' }}>
          Elegir un plan
        </Link>
      )}
    </div>
  )
}

// Muestra la membresía del usuario autenticado; se usa en Suscripción y Perfil
export default function MembershipStatus({ showCta = true }) {
  const { membership, status } = useMembership()

  if (status === 'loading') return <CargandoBox />
  if (status === 'nosession') return <SinSesionBox />
  if (status === 'error') return <ErrorBox />
  if (status === 'none') return <SinMembresiaBox showCta={showCta} />

  const activa = membership.estado === 'activa'
  return (
    <div className="card membership-box">
      <span className={`badge ${activa ? 'badge-active' : 'badge-expired'}`}>
        {activa ? 'Activa' : 'Vencida'}
      </span>
      <h3>Plan {membership.plan?.nombre}</h3>
      <p className="muted">
        Inicio: {membership.fecha_inicio} · Vence: {membership.fecha_fin}
      </p>
    </div>
  )
}
