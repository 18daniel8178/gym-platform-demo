import { useCallback, useState } from 'react'
import { useAuth } from '../../context/AuthContext.jsx'
import { getAjustes, getSucursal } from '../../services/adminService.js'
import { usePermisos } from './adminUi.js'
import { olvidarInfoPublica } from '../../lib/infoPublica.js'
import useRecursoAdmin from './useRecursoAdmin.js'
import EstadoRecurso from './ui/EstadoRecurso.jsx'
import Tabs from './ui/Tabs.jsx'
import AjustesNegocio from './AjustesNegocio.jsx'
import AjustesSucursal from './AjustesSucursal.jsx'
import AjustesHorarios from './AjustesHorarios.jsx'
import AjustesFacturacion from './AjustesFacturacion.jsx'
import AjustesMetodos from './AjustesMetodos.jsx'
import AjustesOperacion from './AjustesOperacion.jsx'
import AjustesConsentimientos from './AjustesConsentimientos.jsx'
import AjustesActividad from './AjustesActividad.jsx'

const PESTANAS = [
  ['negocio', 'Negocio'],
  ['sucursal', 'Sucursal'],
  ['horarios', 'Horarios'],
  ['facturacion', 'Facturación'],
  ['metodos', 'Métodos de pago'],
  ['operacion', 'Operación'],
  ['consentimientos', 'Consentimientos'],
]

// Los ajustes y la presentación pública viven en sitios distintos (uno es
// configuración del negocio, el otro contenido del sitio), pero la pantalla los
// necesita juntos: se piden como un solo recurso.
function useAjustes(token) {
  const pedir = useCallback(async () => {
    const [ajustes, sucursal, publico] = await Promise.all([
      getAjustes(token),
      getSucursal(token),
      fetch(`/api/gym-info?fresh=${Date.now()}`, { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    ])
    if (!ajustes.ok) return ajustes
    if (!sucursal.ok) return sucursal
    return { ok: true, data: { ...ajustes.data, sucursal: sucursal.data.sucursal, gymInfo: publico } }
  }, [token])

  return useRecursoAdmin(pedir)
}

// Cada pestaña recibe `onRecargar`: al guardar, la pantalla vuelve a pedir los
// ajustes. Cambiar de pestaña desmonta la tarjeta, así que sin esto la siguiente
// visita partiría de la foto vieja y podría reescribirla.
function Contenido({ tab, token, datos, onRecargar }) {
  const { ajustes, series, metodos, gymInfo, sucursal } = datos
  if (tab === 'sucursal') return <AjustesSucursal token={token} sucursal={sucursal} onRecargar={onRecargar} />
  if (tab === 'horarios') {
    return <AjustesHorarios token={token} horario={ajustes.horario} publico={gymInfo?.horarios} onRecargar={onRecargar} />
  }
  if (tab === 'facturacion') {
    return <AjustesFacturacion token={token} impuestos={ajustes.impuestos} series={series} onRecargar={onRecargar} />
  }
  if (tab === 'metodos') return <AjustesMetodos token={token} metodos={metodos} onRecargar={onRecargar} />
  if (tab === 'operacion') {
    return <AjustesOperacion token={token} moneda={ajustes.moneda} politicas={ajustes.politicas} onRecargar={onRecargar} />
  }
  // Se pide aparte: es el único dato de esta pantalla que no viene de ajustes.
  if (tab === 'consentimientos') return <AjustesConsentimientos token={token} />
  if (tab === 'actividad') return <AjustesActividad token={token} />
  return <AjustesNegocio token={token} negocio={ajustes.negocio} gymInfo={gymInfo} onRecargar={onRecargar} />
}

export default function AdminSettings() {
  const { session } = useAuth()
  const token = session?.access_token
  const puede = usePermisos()
  const [tab, setTab] = useState('negocio')
  const { estado, datos, recargar } = useAjustes(token)

  // Un guardado aquí cambia lo que el resto del panel (y el sitio) ya tiene
  // cargado: la moneda de los importes y los métodos que se ofrecen al cobrar.
  // Se olvida la copia compartida para que la siguiente pantalla no siga
  // pintando la configuración anterior.
  const trasGuardar = useCallback(async () => {
    olvidarInfoPublica()
    await recargar()
  }, [recargar])

  // La bitácora solo la ve quien puede leer auditoría; para el resto la pestaña
  // ni aparece (y el endpoint respondería 403 igual).
  const pestanas = puede('audit.read') ? [...PESTANAS, ['actividad', 'Actividad']] : PESTANAS

  return (
    <section className="admin-page">
      <div className="admin-page-head">
        <h1>Ajustes</h1>
        <p className="admin-muted">
          Datos del negocio, horarios, impuestos, métodos de pago y políticas. Lo que se configura aquí
          manda sobre lo que hace el sistema.
        </p>
      </div>

      <Tabs
        items={pestanas}
        activo={tab}
        onCambiar={setTab}
        etiqueta="Secciones de ajustes"
        idPanel="ajustes-panel"
      />
      <div id="ajustes-panel" role="tabpanel" aria-labelledby={`tab-${tab}`} tabIndex={0}>
        <EstadoRecurso estado={estado} onReintentar={recargar} alto={260}>
          {datos && <Contenido tab={tab} token={token} datos={datos} onRecargar={trasGuardar} />}
        </EstadoRecurso>
      </div>
    </section>
  )
}
