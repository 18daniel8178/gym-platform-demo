import { Link } from 'react-router-dom'
import { CONTACT_INFO } from '../contactInfo.js'
import { useInfoPublica } from '../lib/infoPublica.js'
import logo from '../assets/logo.webp'

// Columna de contacto: dirección, WhatsApp, Instagram y correo
function FooterContacto() {
  const { sucursal } = useInfoPublica()
  return (
    <div className="footer-col">
      <h3>Contacto</h3>
      <p>{sucursal?.direccion?.trim() || CONTACT_INFO.direccion}</p>
      <a href={`https://wa.me/${CONTACT_INFO.whatsapp}`} target="_blank" rel="noreferrer">
        {CONTACT_INFO.telefono}
      </a>
      <a href={`https://instagram.com/${CONTACT_INFO.instagram}`} target="_blank" rel="noreferrer">
        @{CONTACT_INFO.instagram}
      </a>
      <a href={`mailto:${CONTACT_INFO.email}`}>{CONTACT_INFO.email}</a>
    </div>
  )
}

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-grid">
        <div className="footer-brand">
          <div className="footer-logo">
            <img src={logo} alt="Logo FORJA GYM" />
            <span>
              FORJA <em>GYM</em>
            </span>
          </div>
          <p>
            Gimnasio ficticio creado para demostrar la plataforma: membresías en línea, panel del
            socio con carnet QR y backoffice para el personal.
          </p>
        </div>

        <div className="footer-col">
          <h3>Información</h3>
          <Link to="/">Inicio</Link>
          <Link to="/galeria">Galería</Link>
          <Link to="/contacto">Contáctanos</Link>
          <Link to="/perfil">Perfil</Link>
          <Link to="/join">Únete</Link>
        </div>

        <div className="footer-col">
          <h3>Servicios</h3>
          <Link to="/suscripcion">Membresías</Link>
          <Link to="/entrenamiento">Entrenamiento personal</Link>
          <Link to="/productos#coffee">Coffee</Link>
          <Link to="/productos#merch">Merch</Link>
          <Link to="/productos?cat=suplemento">Suplementos</Link>
        </div>

        <FooterContacto />
      </div>

      <div className="footer-bottom">
        <p>
          FORJA <span>GYM</span> © {new Date().getFullYear()} — Demo con datos ficticios
        </p>
      </div>
    </footer>
  )
}
