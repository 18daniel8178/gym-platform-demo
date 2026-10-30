import { useEffect, useState } from 'react'
import { CONTACT_INFO, FAQS } from '../contactInfo.js'
import { IconWhatsApp, IconInstagram, IconPin, IconClock } from '../components/Icons.jsx'
import Skeleton from '../components/Skeleton.jsx'
import ContactForm from './ContactForm.jsx'
import { useInfoPublica } from '../lib/infoPublica.js'

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

function parseHora(s) {
  const m = String(s ?? '').trim().match(/^(\d{1,2}):(\d{2})$/)
  return m ? Number(m[1]) * 60 + Number(m[2]) : null
}

// Franja de hoy: abierto ahora o abre más tarde; null si ya cerró o no hay datos
function estadoDeHoy(hoy, minutos) {
  const abre = parseHora(hoy?.abre)
  const cierra = parseHora(hoy?.cierra)
  if (abre == null) return null
  if (cierra != null && minutos >= abre && minutos < cierra) {
    return { abierto: true, detalle: `cierra a las ${hoy.cierra}` }
  }
  if (minutos < abre) {
    return { abierto: false, detalle: `abre hoy a las ${hoy.abre}` }
  }
  return null
}

// Próxima apertura dentro de los siguientes 7 días
function proximaApertura(porDia, ahora) {
  for (let i = 1; i <= 7; i++) {
    const d = porDia(DIAS[(ahora.getDay() + i) % 7])
    if (d && parseHora(d.abre) != null) {
      const cuando = i === 1 ? 'mañana' : 'el ' + d.dia.toLowerCase()
      return { abierto: false, detalle: `abre ${cuando} a las ${d.abre}` }
    }
  }
  return null
}

// Estado en vivo: abierto/cerrado según los horarios reales
function estadoApertura(horarios, ahora = new Date()) {
  if (!Array.isArray(horarios) || horarios.length === 0) return null
  const porDia = (nombre) => horarios.find((h) => h.dia === nombre)
  const minutos = ahora.getHours() * 60 + ahora.getMinutes()
  return estadoDeHoy(porDia(DIAS[ahora.getDay()]), minutos) ?? proximaApertura(porDia, ahora)
}

// Pill con el estado en vivo bajo el título
function EstadoPill({ loading, estado }) {
  if (loading) return <Skeleton width={190} height={30} style={{ borderRadius: '999px' }} />
  if (!estado) return null
  return (
    <span className={`status-pill ${estado.abierto ? 'open' : 'closed'}`}>
      <span className="status-dot" />
      {estado.abierto ? 'Abierto' : 'Cerrado'} · {estado.detalle}
    </span>
  )
}

// Canales directos: WhatsApp e Instagram
function CanalesRedes() {
  return (
    <>
      <a
        className="card channel-card reveal"
        style={{ animationDelay: '0.12s' }}
        href={`https://wa.me/${CONTACT_INFO.whatsapp}`}
        target="_blank"
        rel="noreferrer"
      >
        <span className="channel-icon"><IconWhatsApp /></span>
        <span>
          <strong>WhatsApp</strong>
          <em>{CONTACT_INFO.telefono}</em>
          <small>Respuesta rápida en horario de atención</small>
        </span>
      </a>

      <a
        className="card channel-card reveal"
        style={{ animationDelay: '0.18s' }}
        href={`https://instagram.com/${CONTACT_INFO.instagram}`}
        target="_blank"
        rel="noreferrer"
      >
        <span className="channel-icon"><IconInstagram /></span>
        <span>
          <strong>Instagram</strong>
          <em>@{CONTACT_INFO.instagram}</em>
          <small>Promociones y novedades del gym</small>
        </span>
      </a>
    </>
  )
}

// Horario completo desplegable con el día actual resaltado; fallback sin datos
function ListaHorarios({ horarios }) {
  if (!horarios) return <small>Horarios no disponibles por ahora.</small>
  return (
    <details className="schedule-details">
      <summary>Ver horario completo</summary>
      <ul className="schedule-list">
        {horarios.map((h) => (
          <li key={h.dia} className={h.dia === DIAS[new Date().getDay()] ? 'today' : ''}>
            <span className="day">{h.dia}</span>
            {/* Un día cerrado llega sin horas: ver "Sábado  –  " no dice nada. */}
            <span>{h.cerrado || !h.abre ? 'Cerrado' : `${h.abre} – ${h.cierra}`}</span>
          </li>
        ))}
      </ul>
    </details>
  )
}

// Tarjeta de horario de atención
function HorarioAtencion({ loading, horarios }) {
  return (
    <section className="card channel-card channel-static reveal" style={{ animationDelay: '0.24s' }}>
      <span className="channel-icon"><IconClock /></span>
      <span style={{ width: '100%' }}>
        <strong>Horario de atención</strong>
        {loading ? <Skeleton.Lines count={2} /> : <ListaHorarios horarios={horarios} />}
      </span>
    </section>
  )
}

// Tarjeta de dirección con mapa embebido y enlace a Google Maps
function SeccionDireccion() {
  const { sucursal } = useInfoPublica()
  const direccion = sucursal?.direccion?.trim() || CONTACT_INFO.direccion
  return (
    <section className="card channel-card channel-static reveal" style={{ animationDelay: '0.3s' }}>
      <span className="channel-icon"><IconPin /></span>
      <span style={{ width: '100%' }}>
        <strong>Dirección</strong>
        <em>{direccion}</em>
        {CONTACT_INFO.mapEmbedUrl && (
          <div className="map-embed map-compact">
            <iframe
              src={CONTACT_INFO.mapEmbedUrl}
              title="Ubicación de FORJA GYM"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        )}
        {CONTACT_INFO.mapLink && (
          <a className="btn btn-outline map-directions" href={CONTACT_INFO.mapLink} target="_blank" rel="noreferrer">
            Abrir en Google Maps
          </a>
        )}
      </span>
    </section>
  )
}

// Preguntas frecuentes
function PreguntasFrecuentes() {
  return (
    <section className="faq reveal" style={{ animationDelay: '0.36s' }}>
      <h2 className="section-title">Preguntas frecuentes</h2>
      <div className="faq-list">
        {FAQS.map((item) => (
          <details key={item.q} className="faq-item">
            <summary>{item.q}</summary>
            <p>{item.a}</p>
          </details>
        ))}
      </div>
    </section>
  )
}

export default function Contact() {
  const [info, setInfo] = useState(null)
  const [infoLoading, setInfoLoading] = useState(true)

  useEffect(() => {
    fetch('/api/gym-info')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setInfo)
      .catch(() => setInfo(null))
      .finally(() => setInfoLoading(false))
  }, [])

  const estado = estadoApertura(info?.horarios)

  return (
    <main className="container page">
      <div className="contact-head reveal">
        <h1 className="page-title">
          Contácta<span>nos</span>
        </h1>
        <p className="page-subtitle">Estamos para ayudarte. Escríbenos o visítanos.</p>
        <EstadoPill loading={infoLoading} estado={estado} />
      </div>

      <div className="contact-layout">
        {/* Formulario */}
        <section className="card contact-form-card reveal" style={{ animationDelay: '0.08s' }}>
          <h2 className="section-title">Envíanos un mensaje</h2>
          <ContactForm />
        </section>

        {/* Canales */}
        <div className="contact-channels">
          <CanalesRedes />
          <HorarioAtencion loading={infoLoading} horarios={info?.horarios} />
          <SeccionDireccion />
        </div>
      </div>

      <PreguntasFrecuentes />
    </main>
  )
}
