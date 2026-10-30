import { aforoPct, aforoNivel, aforoLabel } from './adminUi.js'

// Vista previa en vivo: %, badge y barra de color (igual que la Home pública)
function AforoPreview({ pct }) {
  const nivel = aforoNivel(pct)
  return (
    <>
      <div className="aforo-preview">
        <span className="aforo-pct">{pct}%</span>
        <span className={`ppl-badge aforo-badge--${nivel}`}>{aforoLabel(pct)}</span>
      </div>
      <div className="aforo-bar">
        <div className={`aforo-bar-fill aforo-bar-fill--${nivel}`} style={{ width: `${pct}%` }} />
      </div>
    </>
  )
}

function AforoPresets({ max, setActual }) {
  return (
    <div className="aforo-presets">
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setActual(0)}>Vacío</button>
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setActual(Math.round(max / 2))}>Medio</button>
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setActual(max)}>Lleno</button>
    </div>
  )
}

// Control del aforo del Dashboard: slider "qué tan lleno está" + capacidad máxima.
export default function AforoControl({ valor, setValor, onGuardar, onCancelar, guardando }) {
  const max = Math.max(1, Number(valor.max_capacity) || 1)
  const actual = Math.max(0, Math.min(Number(valor.current_count) || 0, max))
  const setActual = (v) => setValor({ ...valor, current_count: Math.max(0, Math.min(v, max)) })

  return (
    <form className="admin-card aforo-control" onSubmit={onGuardar}>
      <h2>¿Qué tan lleno está el gym?</h2>
      <p className="admin-muted">Ajusta el aforo actual; se refleja en la página pública en pocos minutos.</p>

      <AforoPreview pct={aforoPct(actual, max)} />

      <input
        type="range"
        className="aforo-range"
        min="0"
        max={max}
        step="1"
        value={actual}
        onChange={(e) => setActual(Number(e.target.value))}
        aria-label="Aforo actual"
      />
      <div className="aforo-readout">
        <strong>{actual}</strong> de {max} personas
      </div>

      <AforoPresets max={max} setActual={setActual} />

      <label className="admin-field aforo-max">
        Capacidad máxima
        <input
          type="number"
          min="1"
          value={valor.max_capacity}
          onChange={(e) => {
            // Al bajar el máximo se recorta también el conteo actual en el ESTADO
            // (no solo en la vista), para no enviar un valor inválido al server.
            const nuevoMax = Math.max(1, Number(e.target.value) || 1)
            const actualRecortado = Math.min(Number(valor.current_count) || 0, nuevoMax)
            setValor({ ...valor, max_capacity: e.target.value, current_count: actualRecortado })
          }}
        />
      </label>

      <div className="admin-actions">
        <button type="submit" className="btn btn-primary" disabled={guardando}>
          {guardando ? 'Guardando…' : 'Guardar aforo'}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCancelar}>Cancelar</button>
      </div>
    </form>
  )
}
