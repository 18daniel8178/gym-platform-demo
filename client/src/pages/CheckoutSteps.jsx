import { useMoney, useInfoPublica } from '../lib/infoPublica.js'
import Skeleton from '../components/Skeleton.jsx'

// Piezas presentacionales del checkout: stepper, pasos y estados del pago.
// Extraídas de Checkout.jsx; el estado y la llamada al server viven allá.

const PASOS = ['Plan', 'Pago', 'Confirmación']
const INDICE_PASO = { plan: 0, metodo: 1, procesando: 2, exito: 2 }

// Clase CSS de cada paso del stepper (evita ternarios anidados)
function claseDePaso({ done, current }) {
  if (done) return 'done'
  if (current) return 'current'
  return ''
}

// Indicador de pasos
export function Stepper({ step }) {
  const stepIndex = INDICE_PASO[step]
  const allDone = step === 'exito'
  return (
    <ol className="stepper" aria-label="Progreso de contratación">
      {PASOS.map((p, i) => {
        const done = allDone || i < stepIndex
        const current = !allDone && i === stepIndex
        return (
          <li key={p} className={claseDePaso({ done, current })} aria-current={current ? 'step' : undefined}>
            <span className="step-dot">{done ? '✓' : i + 1}</span>
            <span className="step-label">{p}</span>
          </li>
        )
      })}
    </ol>
  )
}

// Tarjeta de un plan (estilo Netflix)
function TarjetaPlan({ plan, seleccionado, onSelect }) {
  const money = useMoney()
  return (
    <button
      type="button"
      className={`netflix-card ${seleccionado ? 'selected' : ''} ${plan.destacado ? 'featured' : ''}`}
      onClick={onSelect}
    >
      {plan.destacado && <span className="plan-badge">Más popular</span>}
      <h3>{plan.nombre}</h3>
      <div className="plan-price">{money(plan.precio)}</div>
      <div className="plan-period">por periodo {plan.periodo}</div>
      <ul className="plan-benefits">
        {(plan.beneficios ?? []).slice(0, 4).map((b) => (
          <li key={b}>{b}</li>
        ))}
      </ul>
      {seleccionado && <span className="netflix-check">✓ Seleccionado</span>}
    </button>
  )
}

// Paso 1: elegir plan (tarjetas estilo Netflix)
export function PasoPlan({ plans, planId, setPlanId, planSel, onCancelar, onContinuar }) {
  return (
    <>
      <p className="page-subtitle">Elige tu plan</p>
      <div className="netflix-grid">
        {plans.map((plan) => (
          <TarjetaPlan key={plan.id} plan={plan} seleccionado={planId === plan.id} onSelect={() => setPlanId(plan.id)} />
        ))}
      </div>
      <div className="checkout-actions">
        <button className="btn btn-outline" onClick={onCancelar}>
          Cancelar
        </button>
        <button className="btn btn-primary" disabled={!planSel} onClick={onContinuar}>
          Continuar
        </button>
      </div>
    </>
  )
}

// Mini-formulario de tarjeta (solo presentación, no se guarda)
function FormTarjeta({ card, setCard }) {
  return (
    <div className="pay-form">
      <label>
        Número de tarjeta
        <input
          inputMode="numeric"
          placeholder="1234 5678 9012 3456"
          value={card.numero}
          onChange={(e) => setCard({ ...card, numero: e.target.value })}
        />
      </label>
      <div className="pay-form-row">
        <label>
          Fecha (MM/AA)
          <input placeholder="12/28" value={card.fecha} onChange={(e) => setCard({ ...card, fecha: e.target.value })} />
        </label>
        <label>
          CVV
          <input inputMode="numeric" placeholder="123" value={card.cvv} onChange={(e) => setCard({ ...card, cvv: e.target.value })} />
        </label>
      </div>
    </div>
  )
}

// Mini-formulario según la forma de pago elegida
function FormularioPago({ metodo, campos }) {
  const { yappyTel, setYappyTel, ref, setRef } = campos
  return (
    <>
      {metodo === 'tarjeta' && <FormTarjeta card={campos.card} setCard={campos.setCard} />}
      {metodo === 'yappy' && (
        <div className="pay-form">
          <label>
            Número de teléfono Yappy
            <input inputMode="tel" placeholder="6000-0000" value={yappyTel} onChange={(e) => setYappyTel(e.target.value)} />
          </label>
        </div>
      )}
      {metodo === 'transferencia' && (
        <div className="pay-form">
          <label>
            Referencia / banco
            <input placeholder="Ej. Banco General - 00012345" value={ref} onChange={(e) => setRef(e.target.value)} />
          </label>
          <p className="pay-note">Envía el comprobante por WhatsApp para validar tu pago.</p>
        </div>
      )}
      {metodo === 'efectivo' && (
        <div className="pay-form">
          <p className="pay-note">Pagas al llegar al gym. Para esta demo, tu plan se activa de una vez.</p>
        </div>
      )}
    </>
  )
}

// Paso 2: forma de pago + mini-formulario
export function PasoMetodo({ planSel, metodo, setMetodo, campos, onVolver, onPagar }) {
  const money = useMoney()
  // Los métodos son los que el gimnasio tenga activos en Ajustes; el servidor
  // rechaza cualquier otro, así que ofrecer más sería mentir.
  const { metodos, cargando } = useInfoPublica()
  return (
    <>
      <p className="page-subtitle">
        Plan {planSel.nombre} — {money(planSel.precio)}
      </p>
      <h2 className="section-title">Forma de pago</h2>
      {/* Mientras la lista viaja se enseña el esqueleto y no una lista a medias:
          elegir un método que el servidor no acepta acaba en un error que el
          visitante no puede arreglar. */}
      <div className="pay-methods">
        {cargando
          ? [0, 1, 2, 3].map((i) => <Skeleton key={i} height={46} style={{ borderRadius: 'var(--r-sm)' }} />)
          : metodos.map((m) => (
            <label key={m.clave} className={`pay-method ${metodo === m.clave ? 'active' : ''}`}>
              <input
                type="radio"
                name="metodo"
                value={m.clave}
                checked={metodo === m.clave}
                onChange={() => setMetodo(m.clave)}
              />
              {m.nombre}
            </label>
          ))}
      </div>

      <FormularioPago metodo={metodo} campos={campos} />

      <p className="pay-sim-note">Pago simulado — no se conecta ningún banco ni se guardan tus datos.</p>

      <div className="checkout-actions">
        <button className="btn btn-outline" onClick={onVolver}>
          Volver
        </button>
        <button className="btn btn-primary" disabled={!metodo} onClick={onPagar}>
          Pagar {money(planSel.precio)}
        </button>
      </div>
    </>
  )
}

// Paso 3: procesando
export function Procesando() {
  return (
    <div className="pay-status reveal" aria-live="polite">
      <div className="spinner" />
      <p>Procesando…</p>
    </div>
  )
}

// Paso 4: éxito
export function Exito({ planSel, onIrDashboard }) {
  return (
    <div className="pay-status reveal" aria-live="polite">
      <div className="pay-check">✓</div>
      <h2>Pago realizado exitosamente</h2>
      <p className="page-subtitle" style={{ textAlign: 'center' }}>
        ¡Bienvenido al plan {planSel?.nombre}! Tu membresía ya está activa.
      </p>
      <div className="checkout-actions" style={{ justifyContent: 'center' }}>
        <button className="btn btn-primary" onClick={onIrDashboard}>
          Ir a mi dashboard
        </button>
      </div>
    </div>
  )
}
