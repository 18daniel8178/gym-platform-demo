import { useState } from 'react'
import { CONTACT_INFO } from '../contactInfo.js'
import { IconSend } from '../components/Icons.jsx'

const TEMAS = ['Membresías', 'Entrenamiento personal', 'Productos', 'Otro']

// Estado inicial del formulario (objeto nuevo en cada uso)
const formVacio = () => ({ nombre: '', tema: TEMAS[0], mensaje: '' })

// Aviso de éxito tras abrir WhatsApp con el mensaje compuesto
function MensajeEnviado({ onReset }) {
  return (
    <div className="cform-success" aria-live="polite">
      <div className="pay-check">✓</div>
      <h3>Tu mensaje está listo en WhatsApp</h3>
      <p>Se abrió una conversación con el gym con tu mensaje ya escrito. Solo pulsa enviar.</p>
      <button className="btn btn-outline" onClick={onReset}>
        Escribir otro mensaje
      </button>
    </div>
  )
}

// Campos del formulario: nombre, tema y mensaje (con errores tras blur)
function CamposContacto({ form }) {
  const { f, setF, errors, err, marcar } = form
  return (
    <>
      <label>
        Nombre
        <input
          type="text"
          autoComplete="name"
          className={err('nombre') ? 'error' : ''}
          value={f.nombre}
          onChange={(e) => setF({ ...f, nombre: e.target.value })}
          onBlur={marcar('nombre')}
          placeholder="Tu nombre"
        />
        {err('nombre') && <span className="field-error">{errors.nombre}</span>}
      </label>

      <label>
        ¿Sobre qué nos escribes?
        <select value={f.tema} onChange={(e) => setF({ ...f, tema: e.target.value })}>
          {TEMAS.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </label>

      <label>
        Mensaje
        <textarea
          rows={4}
          className={err('mensaje') ? 'error' : ''}
          value={f.mensaje}
          onChange={(e) => setF({ ...f, mensaje: e.target.value })}
          onBlur={marcar('mensaje')}
          placeholder="¿En qué podemos ayudarte?"
        />
        {err('mensaje') && <span className="field-error">{errors.mensaje}</span>}
      </label>
    </>
  )
}

// Formulario que compone el mensaje y lo abre en WhatsApp (canal real del negocio)
export default function ContactForm() {
  const [f, setF] = useState(formVacio())
  const [touched, setTouched] = useState({})
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  const errors = {
    nombre: f.nombre.trim() ? '' : 'Escribe tu nombre.',
    mensaje: f.mensaje.trim().length >= 10 ? '' : 'Cuéntanos un poco más (mínimo 10 caracteres).',
  }
  const invalid = Boolean(errors.nombre || errors.mensaje)
  const marcar = (campo) => () => setTouched((t) => ({ ...t, [campo]: true }))
  const err = (campo) => (touched[campo] ? errors[campo] : '')

  async function onSubmit(e) {
    e.preventDefault()
    setTouched({ nombre: true, mensaje: true })
    if (invalid) return
    setSending(true)
    await new Promise((r) => setTimeout(r, 550))
    const texto = encodeURIComponent(`Hola, soy ${f.nombre.trim()}. [${f.tema}] ${f.mensaje.trim()}`)
    window.open(`https://wa.me/${CONTACT_INFO.whatsapp}?text=${texto}`, '_blank', 'noopener')
    setSending(false)
    setSent(true)
  }

  const reiniciar = () => {
    setSent(false)
    setF(formVacio())
    setTouched({})
  }

  if (sent) return <MensajeEnviado onReset={reiniciar} />

  return (
    <form className="auth-form cform" onSubmit={onSubmit} noValidate>
      <CamposContacto form={{ f, setF, errors, err, marcar }} />
      <button className={`btn btn-primary cform-submit ${sending ? 'loading' : ''}`} type="submit" disabled={sending}>
        <IconSend width={18} height={18} /> Enviar por WhatsApp
      </button>
      <p className="cform-note">Se abre WhatsApp con tu mensaje listo — respondemos en horario de atención.</p>
    </form>
  )
}
