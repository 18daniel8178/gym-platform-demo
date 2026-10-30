import { useState } from 'react'
import { guardarSucursal } from '../../services/adminService.js'
import { useToast } from './ui/toast.jsx'

// Zonas horarias con las que este negocio puede operar de verdad. No es un
// selector de las 400 de la IANA: el documento pide una sucursal, en Panamá, y
// una lista corta se elige sin equivocarse. El servidor valida contra Intl, así
// que ampliarla no exige tocar nada más.
const ZONAS = [
  ['America/Panama', 'Panamá (UTC-5)'],
  ['America/Bogota', 'Bogotá (UTC-5)'],
  ['America/Costa_Rica', 'San José (UTC-6)'],
  ['America/New_York', 'Nueva York (UTC-5/-4)'],
  ['America/Mexico_City', 'Ciudad de México (UTC-6)'],
]

function CamposSucursal({ valor, cambiar }) {
  return (
    <>
      <div className="admin-field-row">
        <label className="admin-field">
          Nombre
          <input value={valor.nombre || ''} onChange={(e) => cambiar('nombre', e.target.value)} required />
        </label>
        <label className="admin-field">
          Teléfono
          <input value={valor.telefono || ''} onChange={(e) => cambiar('telefono', e.target.value)} />
        </label>
      </div>
      <label className="admin-field">
        Dirección
        <textarea
          rows={2}
          value={valor.direccion || ''}
          onChange={(e) => cambiar('direccion', e.target.value)}
          placeholder="Calle, edificio y punto de referencia"
        />
        <small className="admin-muted">
          Es la que ve quien entra al sitio, en Contáctanos y en el pie de página.
        </small>
      </label>
      <label className="admin-field">
        Zona horaria
        <select
          value={valor.zona_horaria || 'America/Panama'}
          onChange={(e) => cambiar('zona_horaria', e.target.value)}
        >
          {ZONAS.map(([clave, etiqueta]) => <option key={clave} value={clave}>{etiqueta}</option>)}
        </select>
        <small className="admin-muted">
          Con ella se decide qué día y qué hora es al validar un acceso o cerrar la caja.
        </small>
      </label>
    </>
  )
}

export default function AjustesSucursal({ token, sucursal, onRecargar }) {
  const toast = useToast()
  const [valor, setValor] = useState(sucursal || {})
  const [guardando, setGuardando] = useState(false)

  const cambiar = (campo, nuevo) => setValor((previo) => ({ ...previo, [campo]: nuevo }))

  async function guardar(e) {
    e.preventDefault()
    setGuardando(true)
    const r = await guardarSucursal(token, {
      nombre: valor.nombre || '',
      direccion: valor.direccion || '',
      telefono: valor.telefono || '',
      zona_horaria: valor.zona_horaria || 'America/Panama',
    })
    setGuardando(false)
    if (r.ok) {
      setValor(r.data.sucursal)
      toast.ok('Sucursal guardada')
      await onRecargar?.()
    } else toast.error(r.error)
  }

  // Sin id no hay fila en la base: el server está sirviendo la sucursal
  // heredada del código porque la migración todavía no se ha ejecutado. Se dice
  // en vez de dejar que el usuario descubra el fallo al pulsar Guardar.
  const sinMigrar = !sucursal?.id

  return (
    <form className="admin-card" onSubmit={guardar}>
      <h2>Sucursal principal</h2>
      <p className="admin-muted">
        Dónde ocurre la operación. Cada cobro, membresía y —cuando lleguen— cada venta, caja y
        movimiento de inventario quedan asociados a esta sucursal.
      </p>
      {sinMigrar && (
        <p className="admin-aviso">
          Todavía no se ha ejecutado la migración <code>server/db/2026_09_sucursal.sql</code>: estos
          valores son los de siempre y no se pueden guardar hasta aplicarla.
        </p>
      )}
      <CamposSucursal valor={valor} cambiar={cambiar} />
      <div className="admin-actions">
        <button type="submit" className="btn btn-primary" disabled={guardando || sinMigrar}>
          {guardando ? 'Guardando…' : 'Guardar sucursal'}
        </button>
      </div>
    </form>
  )
}
