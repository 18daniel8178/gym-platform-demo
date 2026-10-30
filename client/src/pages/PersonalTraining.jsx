import { Link } from 'react-router-dom'
import { CONTACT_INFO } from '../contactInfo.js'

export default function PersonalTraining() {
  return (
    <main className="container page">
      <h1 className="page-title">
        Entrenamiento <span>personal</span>
      </h1>
      <p className="page-subtitle">Resultados más rápidos con un plan hecho para ti.</p>

      <div className="training-hero reveal">
        <img src="/img/entrenamiento.webp" alt="Entrenador personal guiando a un cliente" />
        <div>
          <h2 className="section-title">Tu entrenador, tu plan</h2>
          <p style={{ color: 'var(--muted)', lineHeight: 1.6 }}>
            Trabaja uno a uno con nuestros entrenadores certificados: evaluación inicial, plan de
            entrenamiento a tu medida y seguimiento constante para que llegues a tu meta, sea perder
            grasa, ganar músculo o mejorar tu rendimiento.
          </p>
          <ul className="training-benefits">
            <li>Evaluación física inicial y seguimiento de progreso</li>
            <li>Rutinas personalizadas según tu objetivo</li>
            <li>Guía de nutrición básica incluida</li>
            <li>Horarios flexibles dentro del horario del gym</li>
          </ul>
          <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginBottom: '1.2rem' }}>
            Precios y disponibilidad: consulta en recepción o escríbenos.
          </p>
          <div style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap' }}>
            <a
              className="btn btn-primary"
              href={`https://wa.me/${CONTACT_INFO.whatsapp}?text=Hola,%20quiero%20información%20sobre%20entrenamiento%20personal`}
              target="_blank"
              rel="noreferrer"
            >
              Escríbenos por WhatsApp
            </a>
            <Link className="btn btn-outline" to="/contacto">
              Ver contacto
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}
