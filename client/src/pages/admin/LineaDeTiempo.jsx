import { useCallback } from 'react'
import { getHistorialSocio } from '../../services/adminService.js'
import { useFechas } from '../../lib/fechas.js'
import { useMoney } from './adminUi.js'
import EstadoRecurso from './ui/EstadoRecurso.jsx'
import useRecursoAdmin from './useRecursoAdmin.js'

// Línea de tiempo del expediente (§13.7): qué le ha pasado a este socio, del
// evento más reciente al más viejo. Va aparte de la ficha porque es la consulta
// más pesada; el servidor decide qué muestra cada quien (los importes piden
// permiso financiero y el nombre de quien actuó, permiso sobre cuentas).

function Evento({ evento, fechaHora, money }) {
  return (
    <li className={`linea-evento linea-evento--${evento.tipo}`}>
      <div className="linea-evento-cab">
        <strong>{evento.titulo}</strong>
        {evento.monto != null && <span className="linea-evento-monto">{money(evento.monto)}</span>}
      </div>
      {evento.detalle && <p className="admin-muted">{evento.detalle}</p>}
      <p className="linea-evento-meta">
        {fechaHora(evento.fecha)}
        {evento.actor && ` · ${evento.actor}`}
      </p>
    </li>
  )
}

export default function LineaDeTiempo({ token, userId }) {
  const pedir = useCallback(() => getHistorialSocio(token, userId), [token, userId])
  const { estado, datos, recargar } = useRecursoAdmin(pedir)
  const { fechaHora } = useFechas()
  const money = useMoney()

  return (
    <div className="admin-card">
      <h2>Línea de tiempo</h2>
      <EstadoRecurso estado={estado} onReintentar={recargar} alto={160}>
        {datos && (
          <>
            <ol className="linea-tiempo">
              {datos.eventos.map((e, i) => (
                <Evento key={`${e.fecha}-${e.tipo}-${i}`} evento={e} fechaHora={fechaHora} money={money} />
              ))}
            </ol>
            {datos.truncado && (
              <p className="admin-muted">Se muestran los eventos más recientes del expediente.</p>
            )}
          </>
        )}
      </EstadoRecurso>
    </div>
  )
}
