import { useCallback, useState } from 'react'
import { getMember, completarFirmaFoto, anularPago } from '../../services/adminService.js'
import { useMoney } from './adminUi.js'
import { useFechas } from '../../lib/fechas.js'
import { useToast } from './ui/toast.jsx'
import { PromptDialog } from './ui/Dialog.jsx'
import BotonAccion from './ui/BotonAccion.jsx'
import EstadoRecurso from './ui/EstadoRecurso.jsx'
import useRecursoAdmin from './useRecursoAdmin.js'
import { FormCobro, FormFechas, FormEditarPerfil } from './MemberForms.jsx'
import FichaCabecera from './FichaCabecera.jsx'
import ConsentimientosSocio from './ConsentimientosSocio.jsx'
import LineaDeTiempo from './LineaDeTiempo.jsx'

// Un socio importado puede no traer nacimiento ni contactos de emergencia: la
// ficha los marca pendientes para completarlos en recepción.
const PENDIENTE = <span className="ppl-badge ppl-badge--warn">Pendiente</span>

function contacto(nombre, telefono) {
  return nombre && telefono ? `${nombre} · ${telefono}` : PENDIENTE
}

function MembresiaCard({ membresia, accion, setAccion, token, userId, planes, onRefrescar }) {
  return (
    <div className="admin-card">
      <h2>Membresía</h2>
      {membresia ? (
        <p>{membresia.plan?.nombre} · {membresia.estado} · {membresia.fecha_inicio} → {membresia.fecha_fin}</p>
      ) : (
        <p className="admin-muted">Sin membresía activa.</p>
      )}
      <div className="admin-actions">
        <BotonAccion permiso="membership.collect" variante="primary btn-sm" onClick={() => setAccion(accion === 'cobro' ? null : 'cobro')}>
          Cobrar en recepción
        </BotonAccion>
        {membresia && (
          <BotonAccion permiso="membership.adjust" variante="ghost btn-sm" onClick={() => setAccion(accion === 'fechas' ? null : 'fechas')}>
            Ajustar fechas
          </BotonAccion>
        )}
      </div>
      {accion === 'cobro' && <FormCobro token={token} userId={userId} planes={planes} onHecho={onRefrescar} />}
      {accion === 'fechas' && membresia && <FormFechas token={token} userId={userId} membresia={membresia} onHecho={onRefrescar} />}
    </div>
  )
}

function DatosCard({ perfil, accion, setAccion, token, userId, onRefrescar, onFirmaFoto }) {
  return (
    <div className="admin-card">
      <h2>Datos del socio</h2>
      <ul className="admin-list">
        <li className="admin-list-row"><span>Nacimiento</span><strong>{perfil.fecha_nacimiento || PENDIENTE}</strong></li>
        <li className="admin-list-row"><span>Emergencia 1</span><strong>{contacto(perfil.emergencia1_nombre, perfil.emergencia1_telefono)}</strong></li>
        <li className="admin-list-row"><span>Emergencia 2</span><strong>{contacto(perfil.emergencia2_nombre, perfil.emergencia2_telefono)}</strong></li>
        <li className="admin-list-row"><span>Entrenado antes</span><strong>{perfil.entrenado_antes ? 'Sí' : 'No'}</strong></li>
        <li className="admin-list-row"><span>Condiciones médicas</span><strong>{perfil.condiciones_medicas || 'Ninguna'}</strong></li>
        <li className="admin-list-row">
          <span>Firma/foto</span>
          {perfil.firma_foto_pendiente ? (
            <BotonAccion permiso="member.update" variante="ghost btn-sm" onClick={onFirmaFoto}>Marcar completado</BotonAccion>
          ) : (
            <strong className="admin-badge-ok">Completado</strong>
          )}
        </li>
      </ul>
      <div className="admin-actions">
        <BotonAccion permiso="member.update" variante="ghost btn-sm" onClick={() => setAccion(accion === 'editar' ? null : 'editar')}>
          Corregir datos
        </BotonAccion>
      </div>
      {accion === 'editar' && <FormEditarPerfil token={token} userId={userId} perfil={perfil} onHecho={onRefrescar} />}
    </div>
  )
}

function PagosCard({ pagos, onAnular }) {
  const money = useMoney()
  const { fecha } = useFechas()
  return (
    <div className="admin-card">
      <h2>Últimos pagos</h2>
      {pagos.length === 0 ? (
        <p className="admin-muted">Sin pagos registrados.</p>
      ) : (
        <ul className="admin-list">
          {pagos.map((p) => (
            <li key={p.id} className="admin-list-row">
              <span>
                {fecha(p.created_at)} · {p.metodo || '—'} · {p.origen}
                {p.estado === 'anulado' ? ' (anulado)' : ''}
              </span>
              <span className="admin-row-actions">
                <strong>{money(p.monto)}</strong>
                {p.estado === 'aprobado' && (
                  <BotonAccion permiso="payment.void" variante="ghost btn-sm" onClick={() => onAnular(p.id)}>
                    Anular
                  </BotonAccion>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// Carga de la ficha y acciones (firma/foto, anulación de pagos)
function useFicha(token, userId) {
  const toast = useToast()
  const [anulando, setAnulando] = useState(null) // id del pago a anular
  const pedir = useCallback(() => getMember(token, userId), [token, userId])
  const { estado, datos: ficha, recargar: cargar } = useRecursoAdmin(pedir)

  async function marcarFirmaFoto() {
    const r = await completarFirmaFoto(token, userId)
    if (r.ok) { toast.ok('Firma y foto completadas'); cargar() } else toast.error(r.error)
  }

  async function confirmarAnulacion(motivo) {
    const r = await anularPago(token, anulando, motivo)
    if (r.ok) {
      toast.ok('Pago anulado')
      if (r.data?.aviso) toast.info(r.data.aviso)
      cargar()
    } else toast.error(r.error)
  }

  return { estado, ficha, cargar, anulando, setAnulando, marcarFirmaFoto, confirmarAnulacion }
}

export default function FichaSocio({ userId, token, planes, onVolver }) {
  const { estado, ficha, cargar, anulando, setAnulando, marcarFirmaFoto, confirmarAnulacion } = useFicha(token, userId)
  const [accion, setAccion] = useState(null) // 'cobro' | 'editar' | 'fechas'

  const refrescar = () => { setAccion(null); cargar() }

  if (estado !== 'ok') {
    return (
      <section className="admin-page">
        <button className="btn btn-ghost btn-sm" onClick={onVolver}>← Socios</button>
        <div style={{ marginTop: 12 }}>
          <EstadoRecurso estado={estado} onReintentar={cargar} />
        </div>
      </section>
    )
  }

  const { perfil, membresia, pagos, consentimientos } = ficha
  return (
    <section className="admin-page">
      <button className="btn btn-ghost btn-sm" onClick={onVolver}>← Socios</button>
      <FichaCabecera ficha={ficha} token={token} userId={userId} onRecargar={cargar} />
      <div className="admin-columns">
        <MembresiaCard membresia={membresia} accion={accion} setAccion={setAccion} token={token} userId={userId} planes={planes} onRefrescar={refrescar} />
        <DatosCard perfil={perfil} accion={accion} setAccion={setAccion} token={token} userId={userId} onRefrescar={refrescar} onFirmaFoto={marcarFirmaFoto} />
      </div>
      <div className="admin-columns">
        <ConsentimientosSocio consentimientos={consentimientos || []} token={token} userId={userId} onRefrescar={refrescar} />
        <PagosCard pagos={pagos} onAnular={setAnulando} />
      </div>
      <LineaDeTiempo token={token} userId={userId} />
      {anulando && (
        <PromptDialog
          title="Anular pago"
          label="Motivo de la anulación"
          confirmar="Anular pago"
          destructivo
          onConfirm={confirmarAnulacion}
          onClose={() => setAnulando(null)}
        />
      )}
    </section>
  )
}

