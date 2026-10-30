import { useState } from 'react'
import { registrarConsentimiento } from '../../services/adminService.js'
import { useFechas } from '../../lib/fechas.js'
import { useToast } from './ui/toast.jsx'
import BotonAccion from './ui/BotonAccion.jsx'

// Qué aceptó el socio y qué le falta (§13.7). Publicar una versión nueva no toca
// lo aceptado antes: deja el documento "desactualizado" hasta que alguien
// capture la aceptación de la nueva, y eso es otra fila, nunca una corrección.

const ESTADO = {
  al_dia: { txt: 'Al día', cls: 'ppl-badge ppl-badge--ok' },
  desactualizado: { txt: 'Versión nueva por aceptar', cls: 'ppl-badge ppl-badge--warn' },
  pendiente: { txt: 'Pendiente', cls: 'ppl-badge ppl-badge--warn' },
}

const MEDIO = { mostrador: 'en recepción', web: 'por la web' }

function Evidencia({ aceptado, fechaHora }) {
  if (!aceptado) return <p className="admin-muted">Sin registro de aceptación.</p>
  const quien = aceptado.registrado_por_email ? ` · lo registró ${aceptado.registrado_por_email}` : ''
  return (
    <p className="admin-muted">
      Versión {aceptado.version} aceptada {MEDIO[aceptado.medio] || aceptado.medio} el {fechaHora(aceptado.aceptado_en)}
      {quien}
    </p>
  )
}

function FilaConsentimiento({ doc, fechaHora, onRegistrar, registrando }) {
  const estado = ESTADO[doc.estado] || ESTADO.pendiente
  return (
    <li className="socio-consentimiento">
      <div className="socio-consentimiento-cab">
        <strong>{doc.titulo}</strong>
        <span className={estado.cls}>{estado.txt}</span>
      </div>
      <Evidencia aceptado={doc.aceptado} fechaHora={fechaHora} />
      {doc.estado !== 'al_dia' && (
        <BotonAccion
          permiso="member.consent"
          variante="ghost btn-sm"
          disabled={registrando}
          onClick={() => onRegistrar(doc)}
        >
          {registrando ? 'Registrando…' : `Registrar aceptación (v${doc.version_vigente})`}
        </BotonAccion>
      )}
    </li>
  )
}

export default function ConsentimientosSocio({ consentimientos, token, userId, onRefrescar }) {
  const { fechaHora } = useFechas()
  const toast = useToast()
  const [registrando, setRegistrando] = useState(null)

  async function registrar(doc) {
    setRegistrando(doc.codigo)
    const r = await registrarConsentimiento(token, userId, doc.codigo)
    setRegistrando(null)
    if (!r.ok) return toast.error(r.error)
    toast.ok(`${doc.titulo}: aceptación registrada`)
    return onRefrescar()
  }

  return (
    <div className="admin-card">
      <h2>Consentimientos</h2>
      {consentimientos.length === 0 ? (
        <p className="admin-muted">No hay documentos de consentimiento publicados.</p>
      ) : (
        <ul className="socio-consentimientos-lista">
          {consentimientos.map((doc) => (
            <FilaConsentimiento
              key={doc.codigo}
              doc={doc}
              fechaHora={fechaHora}
              onRegistrar={registrar}
              registrando={registrando === doc.codigo}
            />
          ))}
        </ul>
      )}
    </div>
  )
}
