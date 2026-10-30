import { useCallback, useState } from 'react'
import { useAuth } from '../../context/AuthContext.jsx'
import { registrarCheckin, buscarSociosCheckin, getCheckinHoy, anularCheckin } from '../../services/adminService.js'
import { usePermisos } from './adminUi.js'
import { useFechas } from '../../lib/fechas.js'
import { useToast } from './ui/toast.jsx'
import { PromptDialog } from './ui/Dialog.jsx'
import BotonAccion from './ui/BotonAccion.jsx'
import EstadoRecurso from './ui/EstadoRecurso.jsx'
import useRecursoAdmin from './useRecursoAdmin.js'
import EscanerQr from './EscanerQr.jsx'
import { ESTADO_SOCIO } from './sociosUi.jsx'

// La pantalla de la puerta (§ Bloque 6). Recepción escanea el carnet o busca al
// socio; el SERVIDOR decide y aquí solo se muestra el resultado, grande y de un
// color que se entiende de lejos. Gerencia puede forzar una entrada rechazada
// con su motivo, y anular una registrada por error.

function Resultado({ resultado, onForzar }) {
  if (!resultado) {
    return (
      <div className="checkin-resultado checkin-resultado--espera">
        <p>Escanea el carnet del socio o búscalo por su nombre.</p>
      </div>
    )
  }
  const { decision, mensaje, socio, forzado } = resultado
  const estado = ESTADO_SOCIO[socio.estado_miembro]
  return (
    <div className={`checkin-resultado checkin-resultado--${decision}`}>
      <strong className="checkin-nombre">{socio.nombre_completo}</strong>
      <p className="checkin-mensaje">{mensaje}</p>
      <div className="checkin-badges">
        {estado && <span className={estado.cls}>{estado.txt}</span>}
        {forzado && <span className="ppl-badge ppl-badge--warn">Entrada forzada</span>}
        {socio.firma_foto_pendiente && <span className="ppl-badge ppl-badge--warn">Firma/foto pendiente</span>}
        {(socio.etiquetas || []).map((e) => <span key={e} className="ppl-badge ppl-badge--muted">{e}</span>)}
      </div>
      {decision === 'rechazar' && (
        <BotonAccion permiso="checkin.override" variante="ghost btn-sm" onClick={onForzar}>
          Autorizar de todos modos
        </BotonAccion>
      )}
    </div>
  )
}

function Busqueda({ token, onSocio }) {
  const [q, setQ] = useState('')
  const [socios, setSocios] = useState([])
  const [buscando, setBuscando] = useState(false)

  async function buscar(e) {
    e.preventDefault()
    setBuscando(true)
    const r = await buscarSociosCheckin(token, q)
    setBuscando(false)
    setSocios(r.ok ? r.data : [])
  }

  return (
    <div className="checkin-busqueda">
      <form onSubmit={buscar} className="checkin-busqueda-form">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Nombre, documento o teléfono"
          aria-label="Buscar socio para el check-in"
        />
        <button type="submit" className="btn btn-ghost" disabled={buscando || q.trim().length < 2}>
          {buscando ? 'Buscando…' : 'Buscar'}
        </button>
      </form>
      <ul className="admin-list">
        {socios.map((s) => (
          <li key={s.user_id} className="admin-list-row">
            <span>{s.nombre_completo} · <span className="admin-muted">{s.documento_parcial}</span></span>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => onSocio(s)}>Registrar entrada</button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Historial({ entradas, fechaHora, onAnular }) {
  if (entradas.length === 0) return <p className="admin-muted">Todavía no hay entradas hoy.</p>
  return (
    <ul className="admin-list">
      {entradas.map((e) => (
        <li key={e.id} className={`admin-list-row checkin-fila checkin-fila--${e.resultado}`}>
          <div>
            <strong>{e.nombre}</strong>
            <span className="admin-muted">
              {' · '}{fechaHora(e.ocurrido_en)}{' · '}{e.motivo}{e.forzado ? ' (forzada)' : ''}{e.anulado_en ? ' · anulada' : ''}
            </span>
          </div>
          {e.resultado === 'permitido' && !e.anulado_en && (
            <BotonAccion permiso="checkin.override" variante="ghost btn-sm" onClick={() => onAnular(e)}>
              Anular
            </BotonAccion>
          )}
        </li>
      ))}
    </ul>
  )
}

// Un intento: lo mismo da que venga del lector o de la búsqueda.
function useCheckin(token, recargar) {
  const [resultado, setResultado] = useState(null)
  const [ultimoIntento, setUltimoIntento] = useState(null)
  const toast = useToast()

  const intentar = useCallback(async (datos) => {
    const r = await registrarCheckin(token, datos)
    if (!r.ok) {
      setResultado(null)
      toast.error(r.error)
      return
    }
    setUltimoIntento(datos)
    setResultado(r.data)
    recargar()
  }, [token, toast, recargar])

  return { resultado, ultimoIntento, intentar, limpiar: () => setResultado(null) }
}

// Lo que pasó hoy en la puerta, con el aforo del momento.
function PuertaHoy({ estado, datos, recargar, fechaHora, onAnular }) {
  const aforo = datos?.aforo
  return (
    <div className="admin-card">
      <h2>Hoy en la puerta</h2>
      {aforo && (
        <p className="checkin-aforo">
          <strong>{aforo.current_count}</strong> de {aforo.max_capacity} personas ·{' '}
          <span className="admin-muted">
            {aforo.entradas_hoy} {aforo.entradas_hoy === 1 ? 'entrada registrada' : 'entradas registradas'} hoy
          </span>
        </p>
      )}
      <EstadoRecurso estado={estado} onReintentar={recargar} alto={200}>
        {datos && <Historial entradas={datos.entradas} fechaHora={fechaHora} onAnular={onAnular} />}
      </EstadoRecurso>
    </div>
  )
}

// Autorizar pese al rechazo y anular una entrada: las dos piden un motivo por
// escrito, así que comparten el mismo ciclo abrir → confirmar → recargar.
function useAccionesCheckin({ token, intentar, ultimoIntento, recargar }) {
  const [forzando, setForzando] = useState(false)
  const [anulando, setAnulando] = useState(null)
  const toast = useToast()

  async function confirmarForzar(motivo) {
    await intentar({ ...ultimoIntento, forzar: true, motivo_forzado: motivo })
    setForzando(false)
  }

  async function confirmarAnulacion(motivo) {
    const r = await anularCheckin(token, anulando.id, motivo)
    setAnulando(null)
    if (!r.ok) return toast.error(r.error)
    toast.ok('Entrada anulada')
    return recargar()
  }

  return { forzando, setForzando, anulando, setAnulando, confirmarForzar, confirmarAnulacion }
}

// Los dos motivos que esta pantalla pide por escrito: autorizar pese al rechazo
// y anular una entrada registrada por error.
function DialogosCheckin({ forzando, anulando, puede, onForzar, onAnular, cerrarForzar, cerrarAnular }) {
  return (
    <>
      {forzando && puede('checkin.override') && (
        <PromptDialog
          title="Autorizar la entrada"
          label="¿Por qué se autoriza pese al rechazo?"
          confirmar="Autorizar entrada"
          onConfirm={onForzar}
          onClose={cerrarForzar}
        />
      )}
      {anulando && (
        <PromptDialog
          title="Anular la entrada"
          label="Motivo de la anulación"
          confirmar="Anular entrada"
          destructivo
          onConfirm={onAnular}
          onClose={cerrarAnular}
        />
      )}
    </>
  )
}

export default function AdminCheckin() {
  const { session } = useAuth()
  const token = session?.access_token
  const puede = usePermisos()
  const { fechaHora } = useFechas()
  const pedir = useCallback(() => getCheckinHoy(token), [token])
  const { estado, datos, recargar } = useRecursoAdmin(pedir)
  const { resultado, ultimoIntento, intentar } = useCheckin(token, recargar)
  const acciones = useAccionesCheckin({ token, intentar, ultimoIntento, recargar })

  return (
    <section className="admin-page">
      <div className="admin-page-head">
        <h1>Check-in</h1>
        <p className="admin-muted">
          Escanea el carnet del socio o búscalo por su nombre. Quien decide es el sistema: tú ves el resultado.
        </p>
      </div>

      <div className="admin-columns">
        <div className="admin-card">
          <h2>Entrada</h2>
          <EscanerQr onLeer={(texto) => intentar({ token: texto })} />
          <Resultado resultado={resultado} onForzar={() => acciones.setForzando(true)} />
          <Busqueda token={token} onSocio={(s) => intentar({ user_id: s.user_id })} />
        </div>

        <PuertaHoy estado={estado} datos={datos} recargar={recargar} fechaHora={fechaHora} onAnular={acciones.setAnulando} />
      </div>

      <DialogosCheckin
        forzando={acciones.forzando}
        anulando={acciones.anulando}
        puede={puede}
        onForzar={acciones.confirmarForzar}
        onAnular={acciones.confirmarAnulacion}
        cerrarForzar={() => acciones.setForzando(false)}
        cerrarAnular={() => acciones.setAnulando(null)}
      />
    </section>
  )
}
