import { useCallback, useState } from 'react'
import { getActividadAjustes } from '../../services/adminService.js'
import useRecursoAdmin from './useRecursoAdmin.js'
import EstadoRecurso from './ui/EstadoRecurso.jsx'
import FiltroDropdown from './FiltroDropdown.jsx'
import RangoFechas from './RangoFechas.jsx'
import { DIAS, nombreDia, horarioDeDia } from '../../lib/horarioTexto.js'
import { useFechas } from '../../lib/fechas.js'

// Qué se cambió, en el vocabulario del negocio. `entidad` es la tabla que tocó
// la acción; `entidad_id` afina dentro de ella (la sección de ajustes, el tipo
// de documento…). El filtro trabaja sobre `entidad` porque es lo que separa
// "cambios de configuración" de "cambios sobre una cuenta".
const TIPOS = [
  { value: '', label: 'Todo el panel' },
  { value: 'settings', label: 'Ajustes del negocio' },
  { value: 'branch', label: 'Sucursal' },
  { value: 'auth.users', label: 'Cuentas' },
  { value: 'user_roles', label: 'Roles asignados' },
  { value: 'profiles', label: 'Datos de socios' },
  { value: 'memberships', label: 'Membresías' },
  { value: 'membership_plans', label: 'Planes' },
  { value: 'payments', label: 'Cobros' },
  { value: 'gym_info', label: 'Sitio público' },
  { value: 'occupancy', label: 'Aforo' },
]

const etiquetaDe = (entidad) => TIPOS.find((t) => t.value === entidad)?.label || entidad

// Cambiar un día toca UNA entrada dentro de una lista de siete, y cambiar un
// cierre, una dentro de otra lista: comparando solo la clave de primer nivel, la
// bitácora escupía las dos semanas enteras en JSON y no había quien la leyera.
// Estas dos bajan un nivel y dejan únicamente lo que de verdad cambió.
function cambiosDeDias(antes, despues) {
  const de = (lista, dow) => (lista || []).find((d) => Number(d.dow) === dow)
  return DIAS.map((_, i) => ({
    campo: nombreDia(i + 1),
    antes: horarioDeDia(de(antes, i + 1)),
    despues: horarioDeDia(de(despues, i + 1)),
  })).filter((d) => d.antes !== d.despues)
}

function cambiosDeCierres(antes, despues) {
  const motivo = (lista, fecha) => (lista || []).find((c) => c.fecha === fecha)?.motivo
  const fechas = [...new Set([...(antes || []), ...(despues || [])].map((c) => c.fecha))].sort()
  return fechas
    .map((fecha) => ({ campo: fecha, antes: motivo(antes, fecha), despues: motivo(despues, fecha) }))
    .filter((c) => c.antes !== c.despues)
}

const DETALLE_POR_CLAVE = { dias: cambiosDeDias, cierres: cambiosDeCierres }

// Pinta el diff como "campo: antes → después". Solo lo que cambió: una entrada
// con quince campos iguales no dice nada.
function cambios(detalle) {
  const antes = detalle?.antes || {}
  const despues = detalle?.despues || {}
  const claves = [...new Set([...Object.keys(antes), ...Object.keys(despues)])]
  return claves
    .filter((k) => JSON.stringify(antes[k]) !== JSON.stringify(despues[k]))
    .flatMap((k) => (DETALLE_POR_CLAVE[k]
      ? DETALLE_POR_CLAVE[k](antes[k], despues[k])
      : [{ campo: k, antes: antes[k], despues: despues[k] }]))
}

// Claves de primer nivel que no son el diff: en eventos como user.denied o
// client.create_orphan son el ÚNICO contenido que hay.
const sueltasDe = (detalle) =>
  Object.entries(detalle || {})
    .filter(([clave]) => clave !== 'antes' && clave !== 'despues')
    .map(([clave, valor]) => ({ campo: clave, valor }))

const comoTexto = (v) => {
  if (v === undefined || v === null || v === '') return '—'
  if (typeof v === 'boolean') return v ? 'sí' : 'no'
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

function FilaActividad({ entrada }) {
  const { fechaHora } = useFechas()
  const lista = cambios(entrada.detalle)
  const sueltas = sueltasDe(entrada.detalle)
  return (
    <tr className="ppl-row-static">
      <td>{fechaHora(entrada.created_at)}</td>
      <td><span className="ppl-name">{entrada.actor_email}</span></td>
      <td>
        <span className="admin-tag admin-tag--soft">{etiquetaDe(entrada.entidad)}</span>
        <small className="admin-muted"> {entrada.accion}</small>
        {/* Sin esto, dos anulaciones distintas salen como la misma fila. */}
        {entrada.entidad_id && <div className="admin-muted"><code>{entrada.entidad_id}</code></div>}
      </td>
      <td>
        {lista.length === 0 && sueltas.length === 0 ? (
          <span className="admin-muted">Sin cambios de valor</span>
        ) : (
          <div className="admin-permisos">
            {lista.map((c) => (
              <span key={c.campo} className="admin-muted">
                {c.campo}: {comoTexto(c.antes)} → <strong>{comoTexto(c.despues)}</strong>
              </span>
            ))}
            {sueltas.map((s) => (
              <span key={s.campo} className="admin-muted">
                {s.campo}: <strong>{comoTexto(s.valor)}</strong>
              </span>
            ))}
          </div>
        )}
      </td>
    </tr>
  )
}

function TablaActividad({ filas, truncado, tope }) {
  return (
    <div className="ppl-card">
      <div className="ppl-meta">
        <span>
          {truncado
            ? `Los ${tope} cambios más recientes (hay más: acota por tipo o por fechas)`
            : `${filas.length} cambios`}
          {' · la bitácora no se puede editar ni borrar, tampoco desde el API'}
        </span>
      </div>
      <div className="ppl-table-wrap">
        <table className="ppl-table">
          <thead>
            <tr>
              <th className="ppl-th">Fecha y hora</th>
              <th className="ppl-th">Quién</th>
              <th className="ppl-th">Qué</th>
              <th className="ppl-th">Cambio</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((e) => <FilaActividad key={e.id} entrada={e} />)}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function AjustesActividad({ token }) {
  const [filtros, setFiltros] = useState({ entidad: '', desde: '', hasta: '' })

  const pedir = useCallback(() => getActividadAjustes(token, filtros), [token, filtros])
  const { estado, datos, recargar } = useRecursoAdmin(pedir)
  const filas = datos?.rows || []

  return (
    <>
      <div className="ppl-toolbar">
        <FiltroDropdown
          label="Qué"
          value={filtros.entidad}
          onChange={(v) => setFiltros({ ...filtros, entidad: v })}
          opciones={TIPOS}
        />
        <RangoFechas
          desde={filtros.desde}
          hasta={filtros.hasta}
          onAplicar={(desde, hasta) => setFiltros({ ...filtros, desde, hasta })}
        />
        {(filtros.entidad || filtros.desde) && (
          <button type="button" className="ppl-reset" onClick={() => setFiltros({ entidad: '', desde: '', hasta: '' })}>
            Reset
          </button>
        )}
      </div>
      <EstadoRecurso
        estado={estado}
        onReintentar={recargar}
        alto={220}
        vacio={filas.length === 0 && 'No hay cambios registrados en ese rango.'}
      >
        <TablaActividad filas={filas} truncado={datos?.truncado} tope={datos?.tope} />
      </EstadoRecurso>
    </>
  )
}
