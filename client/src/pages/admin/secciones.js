import { lazy } from 'react'
import {
  IconDashboard, IconUsers, IconTag, IconReceipt, IconSettings, IconShield, IconScan,
} from '../../components/Icons.jsx'

// Registro único de las secciones del panel: su ruta, su permiso, su icono y su
// página. App.jsx monta las rutas desde aquí y AdminLayout arma con el MISMO
// dato el menú y el gate de la ruta, así que no pueden desincronizarse.
//
// Antes la ruta se escribía a mano en App.jsx y el permiso vivía aparte en
// AdminLayout: registrar una sección y olvidar su entrada en el menú fallaba
// ABIERTO —el gate daba por permitida cualquier ruta que no reconociera y
// pintaba la página entera, con sus acciones, a cualquiera del personal—.
export const SECCIONES = [
  {
    ruta: '',
    label: 'Dashboard',
    Icono: IconDashboard,
    permiso: 'dashboard.read',
    Pagina: lazy(() => import('./AdminDashboard.jsx')),
  },
  {
    ruta: 'socios',
    label: 'Socios',
    Icono: IconUsers,
    permiso: 'member.read',
    Pagina: lazy(() => import('./AdminMembers.jsx')),
  },
  {
    // La pantalla de la puerta: recepción la tiene abierta a diario.
    ruta: 'checkin',
    label: 'Check-in',
    Icono: IconScan,
    permiso: 'checkin.perform',
    Pagina: lazy(() => import('./AdminCheckin.jsx')),
  },
  {
    ruta: 'planes',
    label: 'Planes',
    Icono: IconTag,
    permiso: 'plan.read',
    Pagina: lazy(() => import('./AdminPlans.jsx')),
  },
  {
    ruta: 'pagos',
    label: 'Pagos',
    Icono: IconReceipt,
    permiso: 'payment.read',
    Pagina: lazy(() => import('./AdminPayments.jsx')),
  },
  {
    ruta: 'equipo',
    label: 'Equipo',
    Icono: IconShield,
    permiso: 'user.read',
    Pagina: lazy(() => import('./AdminEquipo.jsx')),
  },
  {
    // Se gatea con settings.update porque hoy la página solo sirve para editar;
    // cuando el bloque de Ajustes traiga contenido de solo lectura, pasará a
    // settings.read con el guardar gateado aparte.
    ruta: 'ajustes',
    label: 'Ajustes',
    Icono: IconSettings,
    permiso: 'settings.update',
    Pagina: lazy(() => import('./AdminSettings.jsx')),
  },
]

// URL completa de una sección ('' es el índice del panel).
export const rutaDe = (seccion) => (seccion.ruta ? `/admin/${seccion.ruta}` : '/admin')

// Sección que corresponde a la URL actual (undefined si no es ninguna).
export function seccionActiva(pathname) {
  return SECCIONES.find((s) => (s.ruta ? pathname.startsWith(rutaDe(s)) : pathname === '/admin'))
}
