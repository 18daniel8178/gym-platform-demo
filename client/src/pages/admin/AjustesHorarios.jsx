import { useState } from 'react'
import useSeccionAjustes from './useSeccionAjustes.js'
import { ConfirmDialog } from './ui/Dialog.jsx'
import { DIAS } from '../../lib/horarioTexto.js'

// El horario se guarda con el día como número (1 lunes … 7 domingo): emparejar
// por el nombre con acentos es un fallo silencioso esperando a ocurrir, y el
// check-in tendrá que leer esto para decidir si deja entrar.
const filaDe = (dias, dow) => dias.find((d) => Number(d.dow) === dow) || { dow, abre: '05:00', cierra: '22:00', cerrado: false };

// El horario que el servidor ESTÁ aplicando: /api/gym-info lo devuelve ya
// resuelto (con su propio horario por defecto si la sección está vacía). Sirve
// de semilla para no enseñar un horario inventado que no coincide con el real.
const desdePublico = (publico) =>
  (publico || [])
    .map((h) => ({
      dow: DIAS.indexOf(h.dia) + 1,
      abre: h.abre || '05:00',
      cierra: h.cierra || '22:00',
      cerrado: Boolean(h.cerrado),
    }))
    .filter((d) => d.dow > 0)

// La semana viaja SIEMPRE entera: el servidor la rechaza incompleta, porque
// guardar solo los días tocados borraría del sitio público los demás.
const semanaCompleta = (dias, publico) => {
  const base = dias.length > 0 ? dias : desdePublico(publico)
  return DIAS.map((_, i) => filaDe(base, i + 1))
}

const fechaLegible = (iso) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('es-PA', { day: 'numeric', month: 'long', year: 'numeric' })

function FilaDia({ dia, dow, onCambiar }) {
  const cerrado = Boolean(dia.cerrado)
  return (
    <div className="admin-horario-row">
      <span className="admin-horario-dia">{DIAS[dow - 1]}</span>
      <input
        type="time"
        value={dia.abre || ''}
        disabled={cerrado}
        onChange={(e) => onCambiar({ ...dia, abre: e.target.value })}
      />
      <span aria-hidden="true">–</span>
      <input
        type="time"
        value={dia.cierra || ''}
        disabled={cerrado}
        onChange={(e) => onCambiar({ ...dia, cierra: e.target.value })}
      />
      <label className="admin-check">
        <input type="checkbox" checked={cerrado} onChange={(e) => onCambiar({ ...dia, cerrado: e.target.checked })} />
        Cerrado
      </label>
    </div>
  )
}

function NuevoCierre({ onAgregar }) {
  const [fecha, setFecha] = useState('')
  const [motivo, setMotivo] = useState('')
  const valido = fecha && motivo.trim()

  function agregar(e) {
    e.preventDefault()
    onAgregar({ fecha, motivo: motivo.trim() })
    setFecha('')
    setMotivo('')
  }

  return (
    <div className="admin-field-row">
      <label className="admin-field">
        Fecha
        <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
      </label>
      <label className="admin-field">
        Motivo
        <input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Feriado, mantenimiento…" />
      </label>
      <button type="button" className="btn btn-ghost" disabled={!valido} onClick={agregar}>
        Añadir cierre
      </button>
    </div>
  )
}

function ListaCierres({ cierres, onQuitar }) {
  if (cierres.length === 0) {
    return <p className="admin-muted">Sin cierres programados. El gimnasio abre según el horario de arriba.</p>
  }
  return (
    <ul className="admin-list">
      {cierres.map((c) => (
        <li key={c.fecha} className="admin-list-row">
          <span>
            <strong>{fechaLegible(c.fecha)}</strong>
            <span className="admin-muted"> · {c.motivo}</span>
          </span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => onQuitar(c.fecha)}>Quitar</button>
        </li>
      ))}
    </ul>
  )
}

export default function AjustesHorarios({ token, horario, publico, onRecargar }) {
  const { valor, cambiar, guardando, guardar } = useSeccionAjustes({
    token,
    seccion: 'horario',
    inicial: {
      dias: semanaCompleta(horario?.dias || [], publico),
      cierres: horario?.cierres || [],
    },
    etiqueta: 'Horario',
    onGuardado: onRecargar,
  })
  const [confirmando, setConfirmando] = useState(null)

  const dias = valor.dias || []
  const cierres = [...(valor.cierres || [])].sort((a, b) => a.fecha.localeCompare(b.fecha))

  const cambiarDia = (dow, nuevo) =>
    cambiar('dias', dias.map((d) => (Number(d.dow) === dow ? nuevo : d)))

  return (
    <form className="admin-card" onSubmit={guardar}>
      <h2>Horario semanal</h2>
      <p className="admin-muted">
        Se aplica a los accesos nuevos. Los registros de asistencia ya guardados no cambian al editar el horario.
      </p>
      <div className="admin-horarios">
        {dias.map((d) => (
          <FilaDia key={d.dow} dow={Number(d.dow)} dia={d} onCambiar={(nuevo) => cambiarDia(Number(d.dow), nuevo)} />
        ))}
      </div>

      <h2 style={{ marginTop: 'var(--sp-5)' }}>Cierres excepcionales</h2>
      <p className="admin-muted">Días sueltos en los que el gimnasio no abre, con su motivo: feriados, mantenimiento…</p>
      <NuevoCierre onAgregar={(c) => cambiar('cierres', [...cierres.filter((x) => x.fecha !== c.fecha), c])} />
      <ListaCierres cierres={cierres} onQuitar={(fecha) => setConfirmando(fecha)} />

      <div className="admin-actions">
        <button type="submit" className="btn btn-primary" disabled={guardando}>
          {guardando ? 'Guardando…' : 'Guardar horario'}
        </button>
      </div>

      {confirmando && (
        <ConfirmDialog
          title="Quitar el cierre"
          mensaje={`El ${fechaLegible(confirmando)} volverá a regirse por el horario semanal.`}
          confirmar="Quitar"
          onConfirm={() => cambiar('cierres', cierres.filter((c) => c.fecha !== confirmando))}
          onClose={() => setConfirmando(null)}
        />
      )}
    </form>
  )
}
