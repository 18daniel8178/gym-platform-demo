import { useState } from 'react'
import Dialog from './ui/Dialog.jsx'

// Lista de roles con checkbox (compartida por crear usuario y editar roles).
function RolesCheckList({ roles, seleccion, onToggle }) {
  return (
    <fieldset className="admin-roles-list">
      <legend className="admin-muted">Roles</legend>
      {roles.map((r) => (
        <label key={r.id} className="admin-check">
          <input
            type="checkbox"
            checked={seleccion.includes(r.id)}
            onChange={() => onToggle(r.id)}
          />
          <span>
            {r.nombre}
            {r.descripcion && <small className="admin-muted"> — {r.descripcion}</small>}
          </span>
        </label>
      ))}
    </fieldset>
  )
}

function alternarId(lista, id) {
  return lista.includes(id) ? lista.filter((x) => x !== id) : [...lista, id]
}

// Alta de una cuenta del personal: email + contraseña temporal + roles.
export function NuevoUsuarioDialog({ roles, onGuardar, onCerrar }) {
  const [f, setF] = useState({ email: '', password: '', roles: [] })
  const [busy, setBusy] = useState(false)
  const valido = f.email.includes('@') && f.password.length >= 8 && f.roles.length > 0

  async function enviar(e) {
    e.preventDefault()
    setBusy(true)
    const ok = await onGuardar(f)
    setBusy(false)
    if (ok) onCerrar()
  }

  return (
    <Dialog title="Nuevo usuario" onClose={onCerrar} ancho={480}>
      <form onSubmit={enviar}>
        <label className="admin-field">
          Email
          <input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required autoFocus />
        </label>
        <label className="admin-field">
          Contraseña temporal (mínimo 8 caracteres)
          <input type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} minLength={8} required />
        </label>
        <RolesCheckList roles={roles} seleccion={f.roles} onToggle={(id) => setF({ ...f, roles: alternarId(f.roles, id) })} />
        <div className="dlg-actions">
          <button type="button" className="btn btn-ghost" onClick={onCerrar}>Cancelar</button>
          <button type="submit" className="btn btn-primary" disabled={!valido || busy}>
            {busy ? 'Creando…' : 'Crear usuario'}
          </button>
        </div>
      </form>
    </Dialog>
  )
}

// Reasignación de roles de un usuario existente.
export function EditarRolesDialog({ usuario, roles, onGuardar, onCerrar }) {
  const [seleccion, setSeleccion] = useState(usuario.roles.map((r) => r.id))
  const [busy, setBusy] = useState(false)

  async function enviar(e) {
    e.preventDefault()
    setBusy(true)
    const ok = await onGuardar(usuario, seleccion)
    setBusy(false)
    if (ok) onCerrar()
  }

  return (
    <Dialog title="Editar roles" onClose={onCerrar} ancho={480}>
      <form onSubmit={enviar}>
        <p className="admin-muted">{usuario.email}</p>
        <RolesCheckList roles={roles} seleccion={seleccion} onToggle={(id) => setSeleccion(alternarId(seleccion, id))} />
        {seleccion.length === 0 && (
          <p className="admin-muted">
            Una cuenta del personal necesita al menos un rol. Para quitarle el acceso, desactiva la cuenta.
          </p>
        )}
        <div className="dlg-actions">
          <button type="button" className="btn btn-ghost" onClick={onCerrar}>Cancelar</button>
          <button type="submit" className="btn btn-primary" disabled={busy || seleccion.length === 0}>
            {busy ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </form>
    </Dialog>
  )
}
