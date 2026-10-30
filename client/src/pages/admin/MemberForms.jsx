import { useEffect, useState } from 'react'
import { cobrarRecepcion, ajustarFechas, updateMember } from '../../services/adminService.js'
import { useMoney } from './adminUi.js'
import { useInfoPublica } from '../../lib/infoPublica.js'
import { useToast } from './ui/toast.jsx'
import AvisoDuplicado from './AvisoDuplicado.jsx'

// Los métodos ya no viven aquí: son configurables desde Ajustes y se ofrecen
// solo los ACTIVOS, que es lo mismo que el servidor va a aceptar al cobrar.
export function SelectMetodo({ value, onChange }) {
  const { metodos, cargando } = useInfoPublica()

  // La lista llega asíncrona y puede no incluir el método preseleccionado (el
  // dueño puede desactivar Efectivo desde Ajustes): se pasa al primero activo,
  // porque el servidor rechaza al cobrar cualquiera que no lo esté.
  useEffect(() => {
    if (!cargando && !metodos.some((m) => m.clave === value)) onChange(metodos[0].clave)
  }, [metodos, cargando, value, onChange])

  return (
    <label>
      Método
      <select value={value} onChange={(e) => onChange(e.target.value)} disabled={cargando}>
        {metodos.map((m) => (
          <option key={m.clave} value={m.clave}>{m.nombre}</option>
        ))}
      </select>
    </label>
  )
}

// Cobro de un plan en recepción (registra pago + activa/renueva membresía)
export function FormCobro({ token, userId, planes, onHecho }) {
  const money = useMoney()
  const toast = useToast()
  const [planId, setPlanId] = useState(planes[0]?.id || '')
  const [metodo, setMetodo] = useState('efectivo')
  const [busy, setBusy] = useState(false)

  // Si los planes llegan después de montar (carga async), selecciona el primero.
  useEffect(() => {
    if (!planId && planes.length > 0) setPlanId(planes[0].id)
  }, [planes, planId])

  if (planes.length === 0) {
    return <p className="admin-aviso">No hay planes activos disponibles. Revisa la sección Planes.</p>
  }

  async function enviar(e) {
    e.preventDefault()
    setBusy(true)
    const r = await cobrarRecepcion(token, userId, { plan_id: Number(planId), metodo })
    setBusy(false)
    if (r.ok) {
      toast.ok('Cobro registrado y membresía activada')
      onHecho()
    } else toast.error(r.error)
  }

  return (
    <form className="admin-inline-form" onSubmit={enviar}>
      <div className="admin-field-row">
        <label>
          Plan
          <select value={planId} onChange={(e) => setPlanId(e.target.value)}>
            {planes.map((p) => (
              <option key={p.id} value={p.id}>{p.nombre} · {money(p.precio)}</option>
            ))}
          </select>
        </label>
        <SelectMetodo value={metodo} onChange={setMetodo} />
      </div>
      <button type="submit" className="btn btn-primary btn-sm" disabled={busy || !planId}>
        {busy ? 'Cobrando…' : 'Registrar cobro'}
      </button>
    </form>
  )
}

// Corrección excepcional de fechas de la membresía (sin generar pago)
export function FormFechas({ token, userId, membresia, onHecho }) {
  const toast = useToast()
  const [inicio, setInicio] = useState(membresia.fecha_inicio)
  const [fin, setFin] = useState(membresia.fecha_fin)
  const [busy, setBusy] = useState(false)

  async function enviar(e) {
    e.preventDefault()
    setBusy(true)
    const r = await ajustarFechas(token, userId, { fecha_inicio: inicio, fecha_fin: fin })
    setBusy(false)
    if (r.ok) {
      toast.ok('Fechas actualizadas')
      onHecho()
    } else toast.error(r.error)
  }

  return (
    <form className="admin-inline-form" onSubmit={enviar}>
      <div className="admin-field-row">
        <label>Inicio<input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} /></label>
        <label>Fin<input type="date" value={fin} onChange={(e) => setFin(e.target.value)} /></label>
      </div>
      <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>
        {busy ? 'Guardando…' : 'Guardar fechas'}
      </button>
    </form>
  )
}

// Contactos de emergencia (compartido entre corrección y alta presencial). En el
// alta son obligatorios; al corregir no, porque un socio importado puede no
// traerlos y eso no debe impedir corregirle, por ejemplo, el teléfono.
export function CamposEmergencias({ f, set, requeridos = true }) {
  return (
    <>
      <div className="admin-field-row">
        <label>Emergencia 1<input value={f.emergencia1_nombre} onChange={set('emergencia1_nombre')} required={requeridos} /></label>
        <label>Tel. 1<input value={f.emergencia1_telefono} onChange={set('emergencia1_telefono')} required={requeridos} /></label>
      </div>
      <div className="admin-field-row">
        <label>Emergencia 2<input value={f.emergencia2_nombre} onChange={set('emergencia2_nombre')} required={requeridos} /></label>
        <label>Tel. 2<input value={f.emergencia2_telefono} onChange={set('emergencia2_telefono')} required={requeridos} /></label>
      </div>
    </>
  )
}

const OPCIONALES = ['emergencia1_nombre', 'emergencia1_telefono', 'emergencia2_nombre', 'emergencia2_telefono']

// Un opcional vacío se omite: "sin cambio" (la ficha lo sigue mostrando
// pendiente), no un vacío que el server rechazaría.
function payloadEdicion(f) {
  const datos = { ...f, condiciones_medicas: f.condiciones_medicas.trim() || null }
  for (const campo of OPCIONALES) if (!datos[campo].trim()) delete datos[campo]
  return datos
}

function estadoInicial(perfil) {
  return {
    nombre_completo: perfil.nombre_completo,
    documento: perfil.documento,
    telefono: perfil.telefono,
    ...Object.fromEntries(OPCIONALES.map((c) => [c, perfil[c] || ''])),
    condiciones_medicas: perfil.condiciones_medicas || '',
  }
}

// Corrección de datos del perfil por el staff (lista blanca server-side). Si el
// documento nuevo coincide con otro socio, el server avisa y aquí se muestra.
export function FormEditarPerfil({ token, userId, perfil, onHecho }) {
  const toast = useToast()
  const [f, setF] = useState(() => estadoInicial(perfil))
  const [aviso, setAviso] = useState(null)
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => { setF({ ...f, [k]: e.target.value }); setAviso(null) }

  async function enviar(confirmarDuplicado) {
    setBusy(true)
    const r = await updateMember(token, userId, { ...payloadEdicion(f), confirmar_duplicado: confirmarDuplicado })
    setBusy(false)
    if (r.ok) {
      toast.ok('Datos del socio actualizados')
      onHecho()
    } else if (r.status === 409 && r.data?.coincidencias) setAviso(r.data)
    else toast.error(r.error)
  }

  return (
    <form className="admin-inline-form" onSubmit={(e) => { e.preventDefault(); enviar(false) }}>
      <label className="admin-field">Nombre<input value={f.nombre_completo} onChange={set('nombre_completo')} /></label>
      <div className="admin-field-row">
        <label>Documento<input value={f.documento} onChange={set('documento')} /></label>
        <label>Teléfono<input value={f.telefono} onChange={set('telefono')} /></label>
      </div>
      <CamposEmergencias f={f} set={set} requeridos={false} />
      <label className="admin-field">Condiciones médicas<textarea rows={2} value={f.condiciones_medicas} onChange={set('condiciones_medicas')} /></label>
      {aviso && <AvisoDuplicado aviso={aviso} confirmar="Es otra persona: guardar de todos modos" onConfirmar={() => enviar(true)} busy={busy} />}
      <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>
        {busy ? 'Guardando…' : 'Guardar'}
      </button>
    </form>
  )
}
