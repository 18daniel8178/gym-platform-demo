import { useCallback, useEffect, useState } from 'react'
import { getSesiones } from '../../services/adminService.js'
import Dialog, { ConfirmDialog } from './ui/Dialog.jsx'
import { useFechas } from '../../lib/fechas.js'


// Sistema del dispositivo a partir del user agent (el detalle completo queda
// en el title, sin prometer más precisión de la que da la cadena).
function dispositivo(ua = '') {
  if (/iPhone|iPad|iOS/i.test(ua)) return 'iPhone o iPad'
  if (/Android/i.test(ua)) return 'Android'
  if (/Windows/i.test(ua)) return 'Windows'
  if (/Mac OS|Macintosh/i.test(ua)) return 'Mac'
  if (/Linux/i.test(ua)) return 'Linux'
  return 'Dispositivo desconocido'
}

function ListaSesiones({ estado, rows }) {
  const { fechaHora } = useFechas()
  if (estado === 'loading') return <div className="admin-skeleton" style={{ height: 120 }} />
  if (estado === 'error') {
    return <p className="admin-muted">No se pudieron cargar las sesiones. Si la migración de roles aún no se aplicó, ejecútala primero.</p>
  }
  if (rows.length === 0) return <p className="admin-muted">Esta cuenta no tiene sesiones abiertas.</p>
  return (
    <ul className="admin-sesiones">
      {rows.map((s) => (
        <li key={s.id}>
          <span title={s.user_agent || ''}>
            <strong>{dispositivo(s.user_agent)}</strong>
            <span className="admin-muted"> · {s.ip || 'IP desconocida'}</span>
          </span>
          <span className="admin-muted">
            Inicio {fechaHora(s.inicio)} · Última actividad {fechaHora(s.ultima_actividad)}
          </span>
        </li>
      ))}
    </ul>
  )
}

// Sesiones abiertas de una cuenta del personal, con cierre remoto de todas.
// El servidor solo devuelve metadatos: nunca tokens ni identificadores de sesión
// reutilizables.
export default function SesionesDialog({ usuario, token, esPropia, onCerrarTodas, onCerrar }) {
  const [estado, setEstado] = useState('loading')
  const [rows, setRows] = useState([])
  const [confirmando, setConfirmando] = useState(false)

  const recargar = useCallback(async () => {
    setEstado('loading')
    const r = await getSesiones(token, usuario.id)
    setRows(r.ok ? r.data.rows : [])
    setEstado(r.ok ? 'ok' : 'error')
  }, [token, usuario.id])
  useEffect(() => { recargar() }, [recargar])

  async function cerrarTodas() {
    const ok = await onCerrarTodas(usuario)
    if (ok) recargar()
  }

  return (
    <Dialog title="Sesiones activas" onClose={onCerrar} ancho={520}>
      <p className="admin-muted">{usuario.email}</p>
      <ListaSesiones estado={estado} rows={rows} />
      <div className="dlg-actions">
        <button type="button" className="btn btn-ghost" onClick={onCerrar}>Cerrar</button>
        <button
          type="button"
          className="btn btn-danger"
          disabled={estado !== 'ok' || rows.length === 0}
          onClick={() => setConfirmando(true)}
        >
          Cerrar todas
        </button>
      </div>
      {confirmando && (
        <ConfirmDialog
          title="Cerrar sesiones"
          mensaje={
            esPropia
              ? 'Es tu propia cuenta: se cerrará también la sesión con la que estás usando el panel y tendrás que iniciar sesión de nuevo.'
              : `Se cerrarán todas las sesiones abiertas de ${usuario.email}. Tendrá que iniciar sesión de nuevo.`
          }
          confirmar="Cerrar sesiones"
          destructivo
          onConfirm={cerrarTodas}
          onClose={() => setConfirmando(false)}
        />
      )}
    </Dialog>
  )
}
