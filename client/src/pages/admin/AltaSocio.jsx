import { useEffect, useState } from 'react'
import Dialog from './ui/Dialog.jsx'
import { createMember, getDocumentosConsentimiento } from '../../services/adminService.js'
import { useToast } from './ui/toast.jsx'
import { CamposEmergencias } from './MemberForms.jsx'
import AvisoDuplicado from './AvisoDuplicado.jsx'

const ALTA_INICIAL = {
  email: '', password: '', nombre_completo: '', fecha_nacimiento: '', documento: '', telefono: '',
  emergencia1_nombre: '', emergencia1_telefono: '', emergencia2_nombre: '', emergencia2_telefono: '',
  entrenado_antes: false, condiciones_medicas: '', estado_inicial: '', origen: 'mostrador',
}

function CamposCuenta({ f, set }) {
  return (
    <div className="admin-field-row">
      <label>Email<input type="email" value={f.email} onChange={set('email')} required /></label>
      <label>Contraseña temporal<input type="text" value={f.password} onChange={set('password')} required minLength={6} /></label>
    </div>
  )
}

function CamposPersonales({ f, set }) {
  return (
    <>
      <label className="admin-field">Nombre completo<input value={f.nombre_completo} onChange={set('nombre_completo')} required /></label>
      <div className="admin-field-row">
        <label>Nacimiento<input type="date" value={f.fecha_nacimiento} onChange={set('fecha_nacimiento')} required /></label>
        <label>Documento<input value={f.documento} onChange={set('documento')} required /></label>
        <label>Teléfono<input value={f.telefono} onChange={set('telefono')} required /></label>
      </div>
    </>
  )
}

// Con qué estado nace el socio y por qué canal llegó (§13.7). El estado no tiene
// valor por defecto a propósito: marcar como activo a quien solo dejó sus datos
// es justo el error que la spec pide evitar.
function CamposIngreso({ f, set }) {
  return (
    <div className="admin-field-row">
      <label>
        ¿Contrata hoy?
        <select value={f.estado_inicial} onChange={set('estado_inicial')} required>
          <option value="" disabled>Elige una opción</option>
          <option value="activo">Sí: queda activo</option>
          <option value="prospecto">No, solo deja sus datos: prospecto</option>
        </select>
      </label>
      <label>
        ¿Cómo llegó?
        <select value={f.origen} onChange={set('origen')}>
          <option value="mostrador">Mostrador</option>
          <option value="referido">Referido por un socio</option>
        </select>
      </label>
    </div>
  )
}

// Casillas de los documentos VIGENTES: el socio los firma en el formulario de
// ingreso delante de recepción, que es la evidencia que queda registrada.
function CamposConsentimiento({ documentos, aceptados, onCambiar }) {
  if (documentos === null) return <p className="admin-muted">Cargando documentos de consentimiento…</p>
  if (documentos.length === 0) return <p className="admin-aviso">No se pudieron cargar los documentos de consentimiento.</p>
  return (
    <fieldset className="socio-consentimientos">
      <legend>Firmó en el formulario de ingreso</legend>
      {documentos.map((d) => (
        <label key={d.codigo} className="admin-check">
          <input
            type="checkbox"
            checked={aceptados.includes(d.codigo)}
            onChange={() => onCambiar(d.codigo)}
            required={d.obligatorio}
          />
          <span>
            {d.titulo} <span className="admin-muted">· versión {d.version}{d.obligatorio ? ' · obligatorio' : ''}</span>
          </span>
        </label>
      ))}
    </fieldset>
  )
}

function useDocumentosVigentes(token) {
  const [documentos, setDocumentos] = useState(null) // null = cargando
  useEffect(() => {
    getDocumentosConsentimiento(token).then((r) => setDocumentos(r.ok ? r.data : []))
  }, [token])
  return documentos
}

// Estado del formulario y envío, con el aviso de duplicado que devuelve el server.
function useAlta({ token, onHecho }) {
  const toast = useToast()
  const [f, setF] = useState(ALTA_INICIAL)
  const [aceptados, setAceptados] = useState([])
  const [aviso, setAviso] = useState(null)
  const [busy, setBusy] = useState(false)

  // Tocar un campo invalida el aviso: ya no describe lo que está escrito.
  const set = (k) => (e) => { setF({ ...f, [k]: e.target.value }); setAviso(null) }
  const alternar = (codigo) => setAceptados((a) => (a.includes(codigo) ? a.filter((c) => c !== codigo) : [...a, codigo]))

  async function enviar(confirmarDuplicado) {
    setBusy(true)
    const r = await createMember(token, {
      ...f,
      condiciones_medicas: f.condiciones_medicas.trim() || null,
      consentimientos: aceptados,
      confirmar_duplicado: confirmarDuplicado,
    })
    setBusy(false)
    if (r.ok) {
      toast.ok('Socio creado; puede iniciar sesión con su email')
      onHecho()
    } else if (r.status === 409 && r.data?.coincidencias) setAviso(r.data)
    else toast.error(r.error)
  }

  return { f, set, aceptados, alternar, aviso, busy, enviar }
}

// Alta presencial: crea la cuenta + el perfil + los consentimientos desde recepción.
export default function AltaSocio({ token, onCerrar, onHecho }) {
  const documentos = useDocumentosVigentes(token)
  const { f, set, aceptados, alternar, aviso, busy, enviar } = useAlta({ token, onHecho })

  return (
    <Dialog title="Alta presencial de socio" onClose={onCerrar} ancho={560}>
      <form onSubmit={(e) => { e.preventDefault(); enviar(false) }}>
        <CamposCuenta f={f} set={set} />
        <CamposPersonales f={f} set={set} />
        <CamposEmergencias f={f} set={set} />
        <label className="admin-field">Condiciones médicas (opcional)<textarea rows={2} value={f.condiciones_medicas} onChange={set('condiciones_medicas')} /></label>
        <CamposIngreso f={f} set={set} />
        <CamposConsentimiento documentos={documentos} aceptados={aceptados} onCambiar={alternar} />
        {aviso && <AvisoDuplicado aviso={aviso} confirmar="Es otra persona: crear de todos modos" onConfirmar={() => enviar(true)} busy={busy} />}
        <div className="dlg-actions">
          <button type="button" className="btn btn-ghost" onClick={onCerrar}>Cancelar</button>
          <button type="submit" className="btn btn-primary" disabled={busy || !documentos?.length}>{busy ? 'Creando…' : 'Crear socio'}</button>
        </div>
      </form>
    </Dialog>
  )
}
