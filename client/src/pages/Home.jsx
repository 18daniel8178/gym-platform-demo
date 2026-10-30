import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import portada from '../assets/portada.webp'
import { PROMOTIONS } from '../promotions.js'
import Skeleton from '../components/Skeleton.jsx'

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

function occupancyLabel(pct) {
  if (pct < 50) return 'Poco lleno'
  if (pct <= 80) return 'Moderado'
  return 'Muy lleno'
}

// Hero full-bleed: imagen de portada abarcando la pantalla
function HeroSection({ info, navigate }) {
  return (
    <section className="hero-full">
      <img className="hero-bg" src={portada} alt="" aria-hidden="true" />
      <div className="container hero-content">
        <p className="hero-label reveal">FORJA GYM</p>
        <h1 className="reveal" style={{ animationDelay: '0.08s' }}>
          {info?.frase ?? 'Constancia que se nota'}
          <span>.</span>
        </h1>
        <p className="hero-desc reveal" style={{ animationDelay: '0.16s' }}>
          {info?.descripcion ??
            'Gimnasio de demostración: sala de pesas, clases grupales y un coffee corner para antes o después de entrenar.'}
        </p>
        <div className="hero-cta reveal" style={{ animationDelay: '0.24s' }}>
          <button className="btn btn-primary" onClick={() => navigate('/suscripcion')}>
            Ver membresías
          </button>
          <button className="btn btn-outline" onClick={() => navigate('/productos')}>
            Ver productos
          </button>
        </div>
      </div>
    </section>
  )
}

// Lista de horarios con el día actual resaltado; fallback si no hay datos
function ListaHorarios({ horarios, today }) {
  if (!horarios) return <div className="empty-state">Horarios no disponibles por ahora.</div>
  return (
    <ul className="schedule-list">
      {horarios.map((h) => (
        <li key={h.dia} className={h.dia === today ? 'today' : ''}>
          <span className="day">{h.dia}</span>
          {/* Un día marcado como cerrado en Ajustes llega sin horas: sin esto
              se leía "Lunes  –  " en el sitio público. */}
          <span>{h.cerrado || !h.abre ? 'Cerrado' : `${h.abre} – ${h.cierra}`}</span>
        </li>
      ))}
    </ul>
  )
}

// Panel de horarios
function PanelHorarios({ loading, horarios, today }) {
  return (
    <section className="card panel cell-horarios reveal">
      <h2 className="section-title">Horarios</h2>
      {loading ? (
        <Skeleton.Lines count={7} gap="0.5rem" />
      ) : (
        <ListaHorarios horarios={horarios} today={today} />
      )}
    </section>
  )
}

// Medidor de aforo: porcentaje, barra y conteo; fallback si el fetch falló
function AforoDetalle({ occupancy }) {
  if (!occupancy) return <div className="empty-state">No disponible en este momento.</div>
  return (
    <>
      <div className="occupancy-value">{occupancy.percentage}%</div>
      <div className="occupancy-track" role="progressbar" aria-valuenow={occupancy.percentage} aria-valuemin="0" aria-valuemax="100">
        <div className="occupancy-fill" style={{ width: `${occupancy.percentage}%` }} />
      </div>
      <div className="occupancy-meta">
        <span className="occupancy-label">{occupancyLabel(occupancy.percentage)}</span>
        <span>
          {occupancy.current_count} de {occupancy.max_capacity} personas
        </span>
      </div>
    </>
  )
}

// Panel de aforo
function PanelAforo({ loading, occupancy }) {
  return (
    <section className="card panel cell-aforo reveal" style={{ animationDelay: '0.08s' }}>
      <h2 className="section-title">¿Qué tan lleno está?</h2>
      {loading ? (
        <>
          <Skeleton width="30%" height={40} />
          <Skeleton height={18} style={{ marginTop: '1rem', borderRadius: '999px' }} />
        </>
      ) : (
        <AforoDetalle occupancy={occupancy} />
      )}
    </section>
  )
}

// Paneles resumen: productos y suscripciones
function PanelesResumen({ navigate }) {
  return (
    <>
      <section className="card promo-card cell-productos reveal" style={{ animationDelay: '0.16s' }} onClick={() => navigate('/productos')}>
        <img src="/img/menu2.webp" alt="Desayuno de FORJA COFFEE" />
        <div className="promo-body">
          <h3>Comida y suplementos</h3>
          <p>FORJA COFFEE: cafés, smoothies, comidas fit y suplementos para acompañar tu entrenamiento.</p>
          <button
            className="btn btn-primary"
            onClick={(e) => {
              e.stopPropagation()
              navigate('/productos')
            }}
          >
            Ver productos
          </button>
        </div>
      </section>

      <section className="card promo-card cell-membresias reveal" style={{ animationDelay: '0.24s' }} onClick={() => navigate('/suscripcion')}>
        <img src="/img/Promocion.webp" alt="Promoción para socios de FORJA GYM" />
        <div className="promo-body">
          <h3>Membresías</h3>
          <p>Planes con beneficios para socios: clases grupales incluidas y un invitado gratis al mes.</p>
          <button
            className="btn btn-primary"
            onClick={(e) => {
              e.stopPropagation()
              navigate('/suscripcion')
            }}
          >
            Ver planes
          </button>
        </div>
      </section>
    </>
  )
}

// Promociones y actividades — solo visibles en el Home
function SeccionPromos({ onVer }) {
  if (PROMOTIONS.length === 0) return null
  return (
    <section className="promos">
      <h2 className="section-title">Promociones y actividades</h2>
      <div className="promos-grid">
        {PROMOTIONS.map((p) => (
          <button
            key={p.img}
            type="button"
            className="card promo-flyer"
            onClick={() => onVer(p)}
            aria-label={`Ver promoción: ${p.titulo}`}
          >
            <img src={p.img} alt={p.alt} loading="lazy" />
            <span className="promo-flyer-title">{p.titulo}</span>
          </button>
        ))}
      </div>
    </section>
  )
}

// Visor del flyer completo
function VisorPromo({ promo, onClose }) {
  if (!promo) return null
  return (
    <div className="lightbox" onClick={onClose}>
      <button className="lightbox-close" onClick={onClose} aria-label="Cerrar">
        ✕
      </button>
      <img src={promo.img} alt={promo.alt} onClick={(e) => e.stopPropagation()} />
    </div>
  )
}

export default function Home() {
  const navigate = useNavigate()
  const [info, setInfo] = useState(null)
  const [infoLoading, setInfoLoading] = useState(true)
  const [occupancy, setOccupancy] = useState(null)
  const [occupancyLoading, setOccupancyLoading] = useState(true)
  const [promoActiva, setPromoActiva] = useState(null)

  // Cerrar el visor de promociones con la tecla Escape
  useEffect(() => {
    if (!promoActiva) return
    const onKey = (e) => e.key === 'Escape' && setPromoActiva(null)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [promoActiva])

  useEffect(() => {
    fetch('/api/gym-info')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setInfo)
      .catch(() => setInfo(null))
      .finally(() => setInfoLoading(false))

    // Si el fetch falla, occupancy queda en null y el panel muestra su fallback
    fetch('/api/occupancy')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setOccupancy)
      .catch(() => setOccupancy(null))
      .finally(() => setOccupancyLoading(false))
  }, [])

  const today = DIAS[new Date().getDay()]

  return (
    <main>
      <HeroSection info={info} navigate={navigate} />
      <div className="container page">
        <div className="home-grid">
          <PanelHorarios loading={infoLoading} horarios={info?.horarios} today={today} />
          <PanelAforo loading={occupancyLoading} occupancy={occupancy} />
          <PanelesResumen navigate={navigate} />
        </div>
        <SeccionPromos onVer={setPromoActiva} />
      </div>
      <VisorPromo promo={promoActiva} onClose={() => setPromoActiva(null)} />
    </main>
  )
}
