import useSeccionAjustes from './useSeccionAjustes.js'
import { money } from './adminUi.js'

// Políticas que condicionan la operación. Cada una la consume un bloque
// posterior (pase diario, caja, inventario, check-in); se configuran aquí para
// que ninguna acabe escrita en el código.
const POLITICAS = [
  {
    clave: 'pase_diario_entradas_dia',
    etiqueta: 'Entradas por pase diario',
    tipo: 'numero',
    ayuda: 'Cuántas veces puede entrar quien compra un pase de un día.',
  },
  {
    clave: 'checkin_ventana_minutos',
    etiqueta: 'Ventana anti doble check-in (minutos)',
    tipo: 'numero',
    ayuda: 'Tiempo mínimo entre dos accesos del mismo socio.',
  },
  {
    clave: 'umbral_caja',
    etiqueta: 'Diferencia de caja tolerada',
    tipo: 'numero',
    ayuda: 'Por encima de esta diferencia, el cierre de caja necesita aprobación.',
  },
  {
    clave: 'stock_negativo',
    etiqueta: 'Permitir vender sin existencias',
    tipo: 'si_no',
    ayuda: 'Si se desactiva, el punto de venta bloquea la venta cuando no hay stock.',
  },
  {
    clave: 'cierre_ciego',
    etiqueta: 'Cierre de caja a ciegas',
    tipo: 'si_no',
    ayuda: 'El cajero cuenta el efectivo sin ver antes lo que el sistema espera.',
  },
]

function CampoPolitica({ politica, valor, onCambiar }) {
  const { clave, etiqueta, tipo, ayuda } = politica
  if (tipo === 'si_no') {
    return (
      <label className="admin-check">
        <input type="checkbox" checked={Boolean(valor)} onChange={(e) => onCambiar(clave, e.target.checked)} />
        <span>
          {etiqueta}
          <small className="admin-muted"> — {ayuda}</small>
        </span>
      </label>
    )
  }
  return (
    <label className="admin-field">
      {etiqueta}
      <input type="number" min="0" step="0.01" value={valor ?? 0} onChange={(e) => onCambiar(clave, e.target.value)} />
      <small className="admin-muted">{ayuda}</small>
    </label>
  )
}

function Moneda({ token, inicial, onGuardado }) {
  const { valor, cambiar, guardando, guardar } = useSeccionAjustes({
    token,
    seccion: 'moneda',
    inicial,
    etiqueta: 'Moneda',
    onGuardado,
  })

  return (
    <form className="admin-card" onSubmit={guardar}>
      <h2>Moneda y formato</h2>
      <p className="admin-muted">
        Así se ven los montos en el panel, en el sitio y en los documentos. Ahora mismo:{' '}
        <strong>{money(1234.5, valor)}</strong>
      </p>
      <div className="admin-field-row">
        <label className="admin-field">
          Símbolo
          <input value={valor.simbolo || ''} onChange={(e) => cambiar('simbolo', e.target.value)} required />
        </label>
        <label className="admin-field">
          Código
          <input value={valor.codigo || ''} onChange={(e) => cambiar('codigo', e.target.value)} required />
        </label>
        <label className="admin-field">
          Decimales
          <input type="number" min="0" max="4" value={valor.decimales ?? 2} onChange={(e) => cambiar('decimales', e.target.value)} />
        </label>
      </div>
      <label className="admin-check">
        <input
          type="checkbox"
          checked={Boolean(valor.usd_habilitado)}
          onChange={(e) => cambiar('usd_habilitado', e.target.checked)}
        />
        <span>
          Aceptar montos en dólares
          <small className="admin-muted"> — los montos ya guardados en balboas no se alteran.</small>
        </span>
      </label>
      <div className="admin-actions">
        <button type="submit" className="btn btn-primary" disabled={guardando}>
          {guardando ? 'Guardando…' : 'Guardar moneda'}
        </button>
      </div>
    </form>
  )
}

function Politicas({ token, inicial, onGuardado }) {
  const { valor, cambiar, guardando, guardar } = useSeccionAjustes({
    token,
    seccion: 'politicas',
    inicial,
    etiqueta: 'Políticas',
    onGuardado,
  })

  return (
    <form className="admin-card" onSubmit={guardar}>
      <h2>Políticas de operación</h2>
      <p className="admin-muted">
        Las aplican el pase diario, el control de acceso, el punto de venta y la caja a medida que se
        habiliten.
      </p>
      <div className="admin-field-row">
        {POLITICAS.filter((p) => p.tipo === 'numero').map((p) => (
          <CampoPolitica key={p.clave} politica={p} valor={valor[p.clave]} onCambiar={cambiar} />
        ))}
      </div>
      {POLITICAS.filter((p) => p.tipo === 'si_no').map((p) => (
        <CampoPolitica key={p.clave} politica={p} valor={valor[p.clave]} onCambiar={cambiar} />
      ))}
      <div className="admin-actions">
        <button type="submit" className="btn btn-primary" disabled={guardando}>
          {guardando ? 'Guardando…' : 'Guardar políticas'}
        </button>
      </div>
    </form>
  )
}

export default function AjustesOperacion({ token, moneda, politicas, onRecargar }) {
  return (
    <>
      <Moneda token={token} inicial={moneda} onGuardado={onRecargar} />
      <Politicas token={token} inicial={politicas} onGuardado={onRecargar} />
    </>
  )
}
