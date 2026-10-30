import { useState } from 'react'
import { guardarNumeracion } from '../../services/adminService.js'
import { useToast } from './ui/toast.jsx'
import useSeccionAjustes from './useSeccionAjustes.js'

const CATEGORIAS = [
  { clave: 'membresias', etiqueta: 'Membresías' },
  { clave: 'productos', etiqueta: 'Productos' },
  { clave: 'servicios', etiqueta: 'Servicios' },
]

const TIPOS = [
  { tipo: 'recibo', etiqueta: 'Recibos' },
  { tipo: 'factura', etiqueta: 'Facturas' },
]

function Impuestos({ token, inicial, onGuardado }) {
  const { valor, cambiar, guardando, guardar } = useSeccionAjustes({
    token,
    seccion: 'impuestos',
    inicial,
    etiqueta: 'Impuestos',
    onGuardado,
  })

  return (
    <form className="admin-card" onSubmit={guardar}>
      <h2>Impuestos por categoría</h2>
      <p className="admin-muted">
        ITBMS que se aplicará a los documentos nuevos. Los ya emitidos conservan la tasa con la que se
        calcularon y no se recalculan.
      </p>
      <div className="admin-field-row">
        {CATEGORIAS.map(({ clave, etiqueta }) => (
          <label key={clave} className="admin-field">
            {etiqueta} (%)
            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={valor[clave] ?? 0}
              onChange={(e) => cambiar(clave, e.target.value)}
            />
            {Number(valor[clave]) === 0 && <span className="ppl-badge ppl-badge--muted">Exento</span>}
          </label>
        ))}
      </div>
      <p className="admin-muted">
        Servicios está en 0% como supuesto pendiente de confirmar con contabilidad antes de emitir
        documentos fiscales reales.
      </p>
      <div className="admin-actions">
        <button type="submit" className="btn btn-primary" disabled={guardando}>
          {guardando ? 'Guardando…' : 'Guardar impuestos'}
        </button>
      </div>
    </form>
  )
}

function FilaSerie({ serie, onGuardar }) {
  const [datos, setDatos] = useState(serie)
  const [guardando, setGuardando] = useState(false)
  const etiqueta = TIPOS.find((t) => t.tipo === serie.tipo)?.etiqueta || serie.tipo

  async function guardar(e) {
    e.preventDefault()
    setGuardando(true)
    const actualizado = await onGuardar(serie.tipo, {
      prefijo: datos.prefijo,
      proximo: Number(datos.proximo),
      relleno: Number(datos.relleno),
    })
    setGuardando(false)
    if (actualizado) setDatos(actualizado)
  }

  const ejemplo = `${datos.prefijo || ''}${String(datos.proximo || 1).padStart(Number(datos.relleno) || 0, '0')}`

  return (
    <form className="admin-card" onSubmit={guardar}>
      <h2>{etiqueta}</h2>
      <div className="admin-field-row">
        <label className="admin-field">
          Prefijo
          <input value={datos.prefijo || ''} maxLength={10} onChange={(e) => setDatos({ ...datos, prefijo: e.target.value })} />
        </label>
        <label className="admin-field">
          Próximo número
          <input type="number" min="1" value={datos.proximo} onChange={(e) => setDatos({ ...datos, proximo: e.target.value })} />
        </label>
        <label className="admin-field">
          Ceros a la izquierda
          <input type="number" min="0" max="12" value={datos.relleno} onChange={(e) => setDatos({ ...datos, relleno: e.target.value })} />
        </label>
      </div>
      <p className="admin-muted">
        El próximo documento saldrá como <strong>{ejemplo}</strong>. El correlativo solo avanza: bajarlo
        repetiría números ya emitidos.
      </p>
      <div className="admin-actions">
        <button type="submit" className="btn btn-primary" disabled={guardando}>
          {guardando ? 'Guardando…' : 'Guardar numeración'}
        </button>
      </div>
    </form>
  )
}

export default function AjustesFacturacion({ token, impuestos, series, onRecargar }) {
  const toast = useToast()

  async function guardarSerie(tipo, cambios) {
    const r = await guardarNumeracion(token, tipo, cambios)
    if (!r.ok) {
      toast.error(r.error)
      return null
    }
    toast.ok('Numeración guardada')
    await onRecargar?.()
    return r.data.serie
  }

  return (
    <>
      <div className="admin-card">
        <span className="admin-tag">Sucursal principal</span>
        <p className="admin-muted">
          En esta fase el gimnasio opera con una sola sucursal, así que la numeración es la suya.
        </p>
      </div>
      <Impuestos token={token} inicial={impuestos} onGuardado={onRecargar} />
      {series.map((s) => (
        <FilaSerie key={s.tipo} serie={s} onGuardar={guardarSerie} />
      ))}
    </>
  )
}
