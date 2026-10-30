import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { checkout } from '../services/paymentService.js'
import { Exito, PasoMetodo, PasoPlan, Procesando, Stepper } from './CheckoutSteps.jsx'

// Hook: carga los planes y preselecciona el que venga en la URL (?plan=)
function usePlanes({ searchParams, onError }) {
  const [plans, setPlans] = useState([])
  const [planId, setPlanId] = useState(null)

  useEffect(() => {
    fetch('/api/plans')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => {
        setPlans(data)
        const pre = Number(searchParams.get('plan'))
        if (pre && data.some((p) => p.id === pre)) setPlanId(pre)
      })
      .catch(() => onError('No se pudieron cargar los planes.'))
  }, [searchParams, onError])

  return { plans, planId, setPlanId }
}

// Hook: campos de los mini-formularios (solo presentación, no se guardan)
function useCamposPago() {
  const [card, setCard] = useState({ numero: '', fecha: '', cvv: '' })
  const [yappyTel, setYappyTel] = useState('')
  const [ref, setRef] = useState('')
  return { card, setCard, yappyTel, setYappyTel, ref, setRef }
}

// El server procesa el pago (PaymentGateway); la animación es solo presentación
async function procesarPago({ planSel, metodo, session, setError, setStep }) {
  setError('')
  setStep('procesando')
  const animacion = new Promise((r) => setTimeout(r, 1900))
  const [resultado] = await Promise.all([
    checkout({ planId: planSel.id, metodo, token: session.access_token }),
    animacion,
  ])
  if (!resultado.ok) {
    setError(resultado.error || 'No se pudo activar la membresía.')
    setStep('metodo')
    return
  }
  setStep('exito')
}

export default function Checkout() {
  const { session, loading } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [step, setStep] = useState('plan') // plan | metodo | procesando | exito
  const [metodo, setMetodo] = useState('')
  const [error, setError] = useState('')
  const { plans, planId, setPlanId } = usePlanes({ searchParams, onError: setError })
  const campos = useCamposPago()

  // Al cambiar de paso (Plan → Pago → Confirmación) subir al inicio de la página
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [step])

  if (loading) return <p className="loading">Cargando…</p>
  if (!session) return <Navigate to="/join" replace />

  const planSel = plans.find((p) => p.id === planId)
  const pagar = () => procesarPago({ planSel, metodo, session, setError, setStep })

  return (
    <main className="container page checkout">
      <h1 className="page-title">
        Contratar <span>membresía</span>
      </h1>

      {/* Indicador de pasos */}
      <Stepper step={step} />

      {error && <div className="auth-error" style={{ marginBottom: '1rem' }}>{error}</div>}

      {step === 'plan' && (
        <PasoPlan
          plans={plans} planId={planId} setPlanId={setPlanId} planSel={planSel}
          onCancelar={() => navigate('/')} onContinuar={() => setStep('metodo')}
        />
      )}

      {step === 'metodo' && planSel && (
        <PasoMetodo
          planSel={planSel} metodo={metodo} setMetodo={setMetodo} campos={campos}
          onVolver={() => setStep('plan')} onPagar={pagar}
        />
      )}

      {step === 'procesando' && <Procesando />}

      {step === 'exito' && <Exito planSel={planSel} onIrDashboard={() => navigate('/perfil')} />}
    </main>
  )
}
