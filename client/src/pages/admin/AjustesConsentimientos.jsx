import { useCallback, useState } from 'react'
import {
  getHistorialConsentimientos, publicarVersionConsentimiento, corregirVersionConsentimiento,
} from '../../services/adminService.js'
import { useFechas } from '../../lib/fechas.js'
import { useToast } from './ui/toast.jsx'
import Dialog from './ui/Dialog.jsx'
import EstadoRecurso from './ui/EstadoRecurso.jsx'
import useRecursoAdmin from './useRecursoAdmin.js'

// Documentos que el socio acepta al inscribirse (§13.7). En cuanto alguien
// acepta una versión, esa versión queda congelada: corregirle el texto cambiaría
// lo que esa persona firmó. Por eso lo que se hace es publicar una versión
// nueva, y los socios quedan "pendientes de aceptar" la nueva en su ficha.

function FormVersion({ version, confirmar, onGuardar, onCerrar }) {
  const [titulo, setTitulo] = useState(version.titulo)
  const [texto, setTexto] = useState(version.texto || '')
  const [busy, setBusy] = useState(false)

  async function enviar(e) {
    e.preventDefault()
    setBusy(true)
    await onGuardar({ titulo: titulo.trim(), texto })
    setBusy(false)
  }

  return (
    <form onSubmit={enviar}>
      <label className="admin-field">
        Título
        <input value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={120} required autoFocus />
      </label>
      <label className="admin-field">
        Texto del documento
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={12}
          placeholder="Pega aquí el texto que el socio acepta al inscribirse."
        />
      </label>
      <div className="dlg-actions">
        <button type="button" className="btn btn-ghost" onClick={onCerrar}>Cancelar</button>
        <button type="submit" className="btn btn-primary" disabled={busy || !titulo.trim()}>
          {busy ? 'Guardando…' : confirmar}
        </button>
      </div>
    </form>
  )
}

function Anteriores({ versiones, fecha }) {
  if (versiones.length === 0) return null
  return (
    <>
      <h4 className="consent-anteriores-titulo">Versiones anteriores</h4>
      <ul className="admin-list">
      {versiones.map((v) => (
        <li key={v.id} className="admin-list-row">
          <span>Versión {v.version} · {fecha(v.publicado_en)}</span>
          <strong>{v.aceptaciones} {v.aceptaciones === 1 ? 'aceptación' : 'aceptaciones'}</strong>
        </li>
        ))}
      </ul>
    </>
  )
}

function resumenAceptaciones(n) {
  if (n === 0) return 'sin aceptaciones todavía, se puede corregir'
  return n === 1 ? '1 socio la aceptó' : `${n} socios la aceptaron`
}

function DocumentoCard({ doc, fecha, onEditar }) {
  const { vigente } = doc
  return (
    <div className="admin-card">
      <div className="socio-consentimiento-cab">
        <h3>{vigente.titulo}</h3>
        <span className="ppl-badge ppl-badge--ok">Versión {vigente.version}</span>
      </div>
      <p className="admin-muted">
        {vigente.obligatorio ? 'Obligatorio en el alta' : 'Opcional'} · publicada el {fecha(vigente.publicado_en)} ·{' '}
        {resumenAceptaciones(vigente.aceptaciones)}
      </p>
      <pre className="consent-texto">{vigente.texto || 'Sin texto cargado todavía.'}</pre>
      <div className="admin-actions">
        <button type="button" className="btn btn-primary btn-sm" onClick={() => onEditar(doc, 'publicar')}>
          Publicar versión nueva
        </button>
        {vigente.editable && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => onEditar(doc, 'corregir')}>
            Corregir esta versión
          </button>
        )}
      </div>
      <Anteriores versiones={doc.anteriores} fecha={fecha} />
    </div>
  )
}

// Publicar crea la versión siguiente; corregir solo se ofrece mientras nadie la
// haya aceptado, y la base lo vuelve a comprobar antes de escribir.
function useEdicion(token, recargar) {
  const [editando, setEditando] = useState(null)
  const toast = useToast()

  async function guardar({ titulo, texto }) {
    const { doc, modo } = editando
    const r = modo === 'publicar'
      ? await publicarVersionConsentimiento(token, { codigo: doc.codigo, titulo, texto })
      : await corregirVersionConsentimiento(token, doc.vigente.id, { titulo, texto })
    if (!r.ok) return toast.error(r.error)
    toast.ok(modo === 'publicar' ? `Publicada la versión ${r.data.version}` : 'Documento corregido')
    setEditando(null)
    return recargar()
  }

  return { editando, abrir: (doc, modo) => setEditando({ doc, modo }), cerrar: () => setEditando(null), guardar }
}

export default function AjustesConsentimientos({ token }) {
  const pedir = useCallback(() => getHistorialConsentimientos(token), [token])
  const { estado, datos, recargar } = useRecursoAdmin(pedir)
  const { editando, abrir, cerrar, guardar } = useEdicion(token, recargar)
  const { fecha } = useFechas()

  return (
    <div className="admin-card-stack">
      <p className="admin-muted">
        Lo que el socio acepta al inscribirse. Una versión aceptada no se toca: para cambiar el texto se
        publica una versión nueva, y las fichas de los socios muestran que les falta aceptarla.
      </p>
      <EstadoRecurso estado={estado} onReintentar={recargar} alto={240}>
        {(datos || []).map((doc) => (
          <DocumentoCard key={doc.codigo} doc={doc} fecha={fecha} onEditar={abrir} />
        ))}
      </EstadoRecurso>
      {editando && (
        <Dialog
          title={editando.modo === 'publicar' ? 'Publicar versión nueva' : 'Corregir documento'}
          onClose={cerrar}
          ancho={640}
        >
          <FormVersion
            version={editando.doc.vigente}
            confirmar={editando.modo === 'publicar' ? 'Publicar versión' : 'Guardar cambios'}
            onGuardar={guardar}
            onCerrar={cerrar}
          />
        </Dialog>
      )}
    </div>
  )
}
