import { useCallback, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import {
  getUsuarios, getRoles, crearUsuario, setRolesUsuario,
  activarUsuario, desactivarUsuario, cerrarSesionesUsuario,
} from '../../services/adminService.js'
import { useToast } from './ui/toast.jsx'
import { ConfirmDialog } from './ui/Dialog.jsx'
import EstadoRecurso from './ui/EstadoRecurso.jsx'
import useRecursoAdmin from './useRecursoAdmin.js'
import MenuAcciones from './ui/MenuAcciones.jsx'
import { useFechas } from '../../lib/fechas.js'
import Tabs from './ui/Tabs.jsx'
import { tienePermiso } from './adminUi.js'
import EquipoRoles from './EquipoRoles.jsx'
import SesionesDialog from './EquipoSesiones.jsx'
import { NuevoUsuarioDialog, EditarRolesDialog } from './EquipoDialogs.jsx'


// Usuarios del personal y catálogo de roles: la página los necesita juntos, así
// que se piden como un solo recurso y comparten estado.
function useEquipo(token) {
  const pedir = useCallback(async () => {
    const [ru, rr] = await Promise.all([getUsuarios(token), getRoles(token)])
    const fallo = [ru, rr].find((r) => !r.ok)
    if (fallo) return fallo
    return { ok: true, data: { usuarios: ru.data.rows, roles: rr.data.rows } }
  }, [token])

  const { estado, datos, recargar: cargar } = useRecursoAdmin(pedir)
  return { estado, usuarios: datos?.usuarios || [], roles: datos?.roles || [], cargar }
}

// Acciones sobre usuarios (toast + recarga tras cada operación).
function useAccionesEquipo(token, cargar) {
  const toast = useToast()

  async function ejecutar(promesa, mensajeOk) {
    const r = await promesa
    if (r.ok) {
      toast.ok(mensajeOk)
      cargar()
    } else toast.error(r.error)
    return r.ok
  }

  return {
    guardarNuevo: (f) => ejecutar(crearUsuario(token, f), `Usuario ${f.email} creado`),
    guardarRoles: (u, roles) => ejecutar(setRolesUsuario(token, u.id, roles), 'Roles actualizados'),
    desactivar: (u) => ejecutar(desactivarUsuario(token, u.id), `Cuenta ${u.email} desactivada`),
    activar: (u) => ejecutar(activarUsuario(token, u.id), `Cuenta ${u.email} activada`),
    cerrarSesiones: (u) => ejecutar(cerrarSesionesUsuario(token, u.id), 'Sesiones cerradas'),
  }
}

// Acciones que la fila ofrece: reflejan lo que el server permite (la cuenta del
// propietario no se toca desde el panel, y nadie se edita a sí mismo).
function accionesDe(u, permisos, handlers) {
  if (u.propietario) return []
  const acciones = []
  const propia = u.id === permisos.yoId
  if (permisos.gestionar && !propia) {
    acciones.push({ id: 'roles', label: 'Editar roles', onClick: () => handlers.onRoles(u) })
    acciones.push({
      id: 'estado',
      label: u.desactivado ? 'Activar cuenta' : 'Desactivar cuenta',
      destructivo: !u.desactivado,
      onClick: () => handlers.onAlternar(u),
    })
  }
  if (permisos.sesiones) {
    acciones.push({ id: 'sesiones', label: 'Sesiones activas', onClick: () => handlers.onSesiones(u) })
  }
  return acciones
}

function FilaUsuario({ u, permisos, handlers }) {
  const { fecha } = useFechas()
  const acciones = accionesDe(u, permisos, handlers)
  return (
    <tr className={u.desactivado ? 'ppl-row-static ppl-row--muted' : 'ppl-row-static'}>
      <td>
        <span className="ppl-name">{u.email}</span>
        {u.propietario && <span className="admin-tag">Propietario</span>}
        {u.id === permisos.yoId && <span className="admin-tag admin-tag--soft">Tú</span>}
      </td>
      <td>
        {u.propietario ? (
          <span className="admin-muted">Acceso total</span>
        ) : (
          <div className="admin-permisos">
            {u.roles.map((r) => <span key={r.id} className="admin-tag admin-tag--soft">{r.nombre}</span>)}
          </div>
        )}
      </td>
      <td>
        {u.desactivado
          ? <span className="ppl-badge ppl-badge--danger">Desactivado</span>
          : <span className="ppl-badge ppl-badge--ok">Activo</span>}
      </td>
      <td>{fecha(u.ultimo_acceso)}</td>
      <td className="admin-row-actions">
        {acciones.length > 0 && <MenuAcciones etiqueta={`Acciones para ${u.email}`} acciones={acciones} />}
      </td>
    </tr>
  )
}

function TablaUsuarios({ usuarios, permisos, handlers }) {
  return (
    <div className="ppl-card">
      <div className="ppl-meta">
        <span>{usuarios.length} cuentas del personal · la del propietario no se modifica desde el panel</span>
      </div>
      <div className="ppl-table-wrap">
        <table className="ppl-table">
          <thead>
            <tr>
              <th className="ppl-th">Usuario</th>
              <th className="ppl-th">Roles</th>
              <th className="ppl-th">Estado</th>
              <th className="ppl-th">Último acceso</th>
              <th className="ppl-th" aria-label="Acciones"></th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map((u) => <FilaUsuario key={u.id} u={u} permisos={permisos} handlers={handlers} />)}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function EquipoContenido({ tab, equipo, permisos, handlers }) {
  const { usuarios, roles } = equipo
  if (tab === 'roles') return <EquipoRoles roles={roles} />
  return <TablaUsuarios usuarios={usuarios} permisos={permisos} handlers={handlers} />
}

// Confirmación de desactivar (la única acción destructiva directa de la fila).
function confirmarDesactivar(usuario, acciones) {
  return {
    title: 'Desactivar cuenta',
    mensaje: `${usuario.email} no podrá iniciar sesión y sus sesiones activas se cerrarán. Puedes reactivarla cuando quieras.`,
    confirmar: 'Desactivar',
    destructivo: true,
    onConfirm: () => acciones.desactivar(usuario),
  }
}

// Render del dialog activo (crear, roles, sesiones o confirmación).
function DialogoEquipo({ dialogo, roles, acciones, sesion, onCerrar }) {
  if (!dialogo) return null
  if (dialogo.tipo === 'nuevo') {
    return <NuevoUsuarioDialog roles={roles} onGuardar={acciones.guardarNuevo} onCerrar={onCerrar} />
  }
  if (dialogo.tipo === 'roles') {
    return <EditarRolesDialog usuario={dialogo.usuario} roles={roles} onGuardar={acciones.guardarRoles} onCerrar={onCerrar} />
  }
  if (dialogo.tipo === 'sesiones') {
    return (
      <SesionesDialog
        usuario={dialogo.usuario}
        token={sesion.token}
        esPropia={dialogo.usuario.id === sesion.yoId}
        onCerrarTodas={acciones.cerrarSesiones}
        onCerrar={onCerrar}
      />
    )
  }
  return <ConfirmDialog {...confirmarDesactivar(dialogo.usuario, acciones)} onClose={onCerrar} />
}

function CabeceraEquipo({ mostrarAlta, onNuevo }) {
  return (
    <div className="admin-page-head admin-head-row">
      <div>
        <h1>Equipo</h1>
        <p className="admin-muted">Cuentas del personal, roles y accesos al panel.</p>
      </div>
      {/* Sin el catálogo de roles cargado, el alta no tendría qué asignar */}
      {mostrarAlta && <button className="btn btn-primary" onClick={onNuevo}>Nuevo usuario</button>}
    </div>
  )
}

export default function AdminEquipo() {
  const { session } = useAuth()
  const { me } = useOutletContext()
  const token = session?.access_token
  const equipo = useEquipo(token)
  const acciones = useAccionesEquipo(token, equipo.cargar)
  const [tab, setTab] = useState('usuarios')
  const [dialogo, setDialogo] = useState(null) // {tipo:'nuevo'|'roles'|'desactivar'|'sesiones', usuario?}
  const permisos = {
    gestionar: tienePermiso(me, 'user.manage'),
    sesiones: tienePermiso(me, 'session.manage'),
    yoId: me?.id,
  }

  const handlers = {
    onRoles: (u) => setDialogo({ tipo: 'roles', usuario: u }),
    onAlternar: (u) => (u.desactivado ? acciones.activar(u) : setDialogo({ tipo: 'desactivar', usuario: u })),
    onSesiones: (u) => setDialogo({ tipo: 'sesiones', usuario: u }),
  }

  return (
    <section className="admin-page">
      <CabeceraEquipo
        mostrarAlta={permisos.gestionar && tab === 'usuarios' && equipo.estado === 'ok'}
        onNuevo={() => setDialogo({ tipo: 'nuevo' })}
      />

      <Tabs
        items={[['usuarios', 'Usuarios'], ['roles', 'Roles']]}
        activo={tab}
        onCambiar={setTab}
        etiqueta="Secciones de equipo"
        idPanel="equipo-panel"
      />
      <div id="equipo-panel" role="tabpanel" aria-labelledby={`tab-${tab}`} tabIndex={0}>
        <EstadoRecurso estado={equipo.estado} onReintentar={equipo.cargar} alto={220}>
          <EquipoContenido tab={tab} equipo={equipo} permisos={permisos} handlers={handlers} />
        </EstadoRecurso>
      </div>
      <DialogoEquipo
        dialogo={dialogo}
        roles={equipo.roles}
        acciones={acciones}
        sesion={{ token, yoId: permisos.yoId }}
        onCerrar={() => setDialogo(null)}
      />
    </section>
  )
}
