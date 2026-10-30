import { useEffect, useState } from 'react'
import { useMoney } from '../lib/infoPublica.js'
import { useNavigate } from 'react-router-dom'
import MembershipStatus from '../components/MembershipStatus.jsx'
import Skeleton from '../components/Skeleton.jsx'

function PlansSkeleton() {
  return (
    <div className="plans-grid" aria-hidden="true">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="skeleton-card">
          <Skeleton width="50%" height={22} />
          <Skeleton width="40%" height={34} />
          <Skeleton.Lines count={4} />
          <Skeleton height={40} style={{ borderRadius: 'var(--radius)' }} />
        </div>
      ))}
    </div>
  )
}

function PlanCard({ plan, onContratar }) {
  const money = useMoney()
  return (
    <article className={`card plan-card ${plan.destacado ? 'featured' : ''}`}>
      {plan.destacado && <span className="plan-badge">Más popular</span>}
      <h3>{plan.nombre}</h3>
      <div className="plan-price">{money(plan.precio)}</div>
      <div className="plan-period">por periodo {plan.periodo}</div>
      <ul className="plan-benefits">
        {(plan.beneficios ?? []).map((b) => (
          <li key={b}>{b}</li>
        ))}
      </ul>
      <button className="btn btn-primary" style={{ marginTop: 'auto' }} onClick={onContratar}>
        Contratar
      </button>
    </article>
  )
}

export default function Subscription() {
  const navigate = useNavigate()
  const [plans, setPlans] = useState([])
  const [status, setStatus] = useState('loading')

  useEffect(() => {
    fetch('/api/plans')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => {
        setPlans(data)
        setStatus('ok')
      })
      .catch(() => setStatus('error'))
  }, [])

  return (
    <main className="container page">
      <h1 className="page-title">
        Tu <span>membresía</span>
      </h1>
      <p className="page-subtitle">Consulta tu plan actual y descubre los planes disponibles.</p>

      <MembershipStatus showCta={false} />

      <h2 className="section-title">Planes disponibles</h2>

      {status === 'loading' && <PlansSkeleton />}
      {status === 'error' && (
        <div className="empty-state">No se pudieron cargar los planes. Intenta más tarde.</div>
      )}

      {status === 'ok' && (
        <div className="plans-grid">
          {plans.map((plan) => (
            <PlanCard key={plan.id} plan={plan} onContratar={() => navigate(`/pagar?plan=${plan.id}`)} />
          ))}
        </div>
      )}
    </main>
  )
}
