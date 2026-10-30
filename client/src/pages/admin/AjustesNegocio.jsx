import { useState } from 'react'
import { updateGymInfo } from '../../services/adminService.js'
import { useToast } from './ui/toast.jsx'
import useSeccionAjustes from './useSeccionAjustes.js'

// Datos que van en los documentos que emite el gimnasio. Se separan de la
// presentación pública a propósito: el RUC no es contenido de marketing.
const CAMPOS = [
  { campo: 'nombre_comercial', etiqueta: 'Nombre comercial', requerido: true },
  { campo: 'razon_social', etiqueta: 'Razón social' },
  { campo: 'ruc', etiqueta: 'RUC' },
  { campo: 'dv', etiqueta: 'DV' },
  { campo: 'telefono', etiqueta: 'Teléfono' },
  { campo: 'correo', etiqueta: 'Correo de contacto', tipo: 'email' },
]

function PerfilFiscal({ token, inicial, onGuardado }) {
  const { valor, cambiar, guardando, guardar } = useSeccionAjustes({
    token,
    seccion: 'negocio',
    inicial,
    etiqueta: 'Perfil del negocio',
    onGuardado,
  })

  return (
    <form className="admin-card" onSubmit={guardar}>
      <h2>Perfil del negocio</h2>
      <p className="admin-muted">
        Estos datos aparecerán en los recibos y facturas que se emitan a partir de ahora. Los documentos
        ya emitidos conservan los datos con los que se generaron.
      </p>
      <div className="admin-field-row">
        {CAMPOS.slice(0, 2).map(({ campo, etiqueta, requerido }) => (
          <label key={campo} className="admin-field">
            {etiqueta}
            <input value={valor[campo] || ''} onChange={(e) => cambiar(campo, e.target.value)} required={requerido} />
          </label>
        ))}
      </div>
      <div className="admin-field-row">
        {CAMPOS.slice(2).map(({ campo, etiqueta, tipo }) => (
          <label key={campo} className="admin-field">
            {etiqueta}
            <input type={tipo || 'text'} value={valor[campo] || ''} onChange={(e) => cambiar(campo, e.target.value)} />
          </label>
        ))}
      </div>
      <label className="admin-field">
        Dirección
        <textarea rows={2} value={valor.direccion || ''} onChange={(e) => cambiar('direccion', e.target.value)} />
      </label>
      <p className="admin-muted">
        El logo del negocio llegará con la emisión de documentos; hasta entonces no habría dónde mostrarlo.
      </p>
      <div className="admin-actions">
        <button type="submit" className="btn btn-primary" disabled={guardando}>
          {guardando ? 'Guardando…' : 'Guardar perfil'}
        </button>
      </div>
    </form>
  )
}

// Frase y descripción: contenido del sitio público, no del negocio. Siguen en
// gym_info, que es la tabla que el sitio lee sin autenticación.
function PresentacionPublica({ token, inicial }) {
  const toast = useToast()
  const [info, setInfo] = useState(inicial || { frase: '', descripcion: '' })
  const [guardando, setGuardando] = useState(false)

  async function guardar(e) {
    e.preventDefault()
    setGuardando(true)
    const r = await updateGymInfo(token, { frase: info.frase, descripcion: info.descripcion })
    setGuardando(false)
    if (r.ok) toast.ok('Presentación guardada; visible en la web en unos minutos')
    else toast.error(r.error)
  }

  return (
    <form className="admin-card" onSubmit={guardar}>
      <h2>Presentación en el sitio</h2>
      <p className="admin-muted">Lo que ve quien entra a la web. El caché tarda unos minutos en refrescarse.</p>
      <label className="admin-field">
        Frase de marca
        <input value={info.frase || ''} onChange={(e) => setInfo({ ...info, frase: e.target.value })} />
      </label>
      <label className="admin-field">
        Descripción
        <textarea rows={3} value={info.descripcion || ''} onChange={(e) => setInfo({ ...info, descripcion: e.target.value })} />
      </label>
      <div className="admin-actions">
        <button type="submit" className="btn btn-primary" disabled={guardando}>
          {guardando ? 'Guardando…' : 'Guardar presentación'}
        </button>
      </div>
    </form>
  )
}

export default function AjustesNegocio({ token, negocio, gymInfo, onRecargar }) {
  return (
    <>
      <PerfilFiscal token={token} inicial={negocio} onGuardado={onRecargar} />
      <PresentacionPublica token={token} inicial={gymInfo} />
    </>
  )
}
