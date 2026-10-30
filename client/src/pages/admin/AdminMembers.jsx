import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext.jsx'
import { getMembers, getPlans } from '../../services/adminService.js'
import { usePermisos } from './adminUi.js'
import FiltroDropdown from './FiltroDropdown.jsx'
import FichaSocio from './FichaSocio.jsx'
import AltaSocio from './AltaSocio.jsx'
import ImportarSocios from './ImportarSocios.jsx'
import { PaseDiario } from './MemberDialogs.jsx'
import { SociosContenido, Pager } from './SociosTabla.jsx'
import EstadoRecurso from './ui/EstadoRecurso.jsx'
import Tabs from './ui/Tabs.jsx'
import useRecursoAdmin from './useRecursoAdmin.js'

const VISTAS = [['socios', 'Socios'], ['archivados', 'Archivados']]

// El estado del SOCIO. 'archivado' no está: los archivados tienen su pestaña.
const OPCIONES_SOCIO = [
  { value: '', label: 'Todos' },
  { value: 'prospecto', label: 'Prospecto' },
  { value: 'activo', label: 'Activo' },
  { value: 'inactivo', label: 'Inactivo' },
  { value: 'bloqueado', label: 'Bloqueado' },
]
const OPCIONES_MEMBRESIA = [
  { value: '', label: 'Todas' },
  { value: 'activa', label: 'Activa' },
  { value: 'vencida', label: 'Vencida' },
  { value: 'sin', label: 'Sin membresía' },
]
const FILTROS_VACIOS = { q: '', estado: '', miembro: '', etiqueta: '' }

// Estado del listado: vista, filtros aplicados y paginación. `q` solo cambia al
// enviar la búsqueda (no en cada tecla) y las respuestas fuera de orden se
// descartan (última petición gana, en useRecursoAdmin).
function useSocios(token) {
  const [vista, setVista] = useState('socios')
  const [filtros, setFiltros] = useState(FILTROS_VACIOS)
  const [page, setPage] = useState(0)

  const pedir = useCallback(() => {
    const miembro = vista === 'archivados' ? 'archivado' : filtros.miembro
    return getMembers(token, { ...filtros, miembro, page })
  }, [token, vista, filtros, page])
  const { estado, datos, recargar: cargar } = useRecursoAdmin(pedir)
  const data = datos || { rows: [], total: 0, page: 0, pageSize: 20, etiquetas: [] }

  const filtrar = (cambios) => { setFiltros((f) => ({ ...f, ...cambios })); setPage(0) }
  const cambiarVista = (v) => { setVista(v); setFiltros(FILTROS_VACIOS); setPage(0) }
  return { estado, data, vista, cambiarVista, filtros, filtrar, page, setPage, cargar }
}

function SociosToolbar({ socios }) {
  const [texto, setTexto] = useState('')
  const { filtros, filtrar, vista, data } = socios
  const opcionesEtiqueta = [
    { value: '', label: 'Todas' },
    ...(data.etiquetas || []).map((e) => ({ value: e.etiqueta, label: `${e.etiqueta} (${e.socios})` })),
  ]
  const hayFiltro = Object.values(filtros).some(Boolean)
  return (
    <form className="ppl-toolbar" onSubmit={(e) => { e.preventDefault(); filtrar({ q: texto }) }}>
      <div className="ppl-search">
        <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
          <path d="M9 3a6 6 0 104.47 10.03l3.25 3.25 1.06-1.06-3.25-3.25A6 6 0 009 3zm0 1.5a4.5 4.5 0 110 9 4.5 4.5 0 010-9z" fill="currentColor" />
        </svg>
        <input placeholder="Buscar por nombre, documento o teléfono" value={texto} onChange={(e) => setTexto(e.target.value)} />
      </div>
      {vista === 'socios' && (
        <FiltroDropdown label="Estado" value={filtros.miembro} onChange={(v) => filtrar({ miembro: v })} opciones={OPCIONES_SOCIO} />
      )}
      <FiltroDropdown label="Membresía" value={filtros.estado} onChange={(v) => filtrar({ estado: v })} opciones={OPCIONES_MEMBRESIA} />
      {opcionesEtiqueta.length > 1 && (
        <FiltroDropdown label="Etiqueta" value={filtros.etiqueta} onChange={(v) => filtrar({ etiqueta: v })} opciones={opcionesEtiqueta} />
      )}
      <button type="submit" className="btn btn-ghost">Buscar</button>
      {(texto || hayFiltro) && (
        <button type="button" className="ppl-reset" onClick={() => { setTexto(''); filtrar(FILTROS_VACIOS) }}>Reset</button>
      )}
    </form>
  )
}

function Encabezado({ puede, onModal }) {
  return (
    <div className="admin-page-head admin-head-row">
      <div>
        <h1>Socios</h1>
        <p className="admin-muted">Busca, gestiona fichas y cobra en recepción.</p>
      </div>
      <div className="admin-actions" style={{ marginTop: 0 }}>
        {puede('payment.create') && (
          <button className="btn btn-ghost" onClick={() => onModal('pase')}>Pase diario</button>
        )}
        {puede('member.import') && (
          <button className="btn btn-ghost" onClick={() => onModal('importar')}>Importar CSV</button>
        )}
        {puede('member.create') && (
          <button className="btn btn-primary" onClick={() => onModal('alta')}>Alta presencial</button>
        )}
      </div>
    </div>
  )
}

export default function AdminMembers() {
  const { session } = useAuth()
  const token = session?.access_token
  const puede = usePermisos()
  const socios = useSocios(token)
  const [seleccion, setSeleccion] = useState(null)
  const [modal, setModal] = useState(null) // 'alta' | 'pase' | null
  const [planes, setPlanes] = useState([])

  useEffect(() => {
    if (token) getPlans(token).then((r) => r.ok && setPlanes(r.data.filter((p) => p.activo)))
  }, [token])

  if (seleccion) {
    return <FichaSocio userId={seleccion} token={token} planes={planes} onVolver={() => { setSeleccion(null); socios.cargar() }} />
  }

  const totalPages = Math.ceil(socios.data.total / socios.data.pageSize) || 1
  const hayFiltro = Object.values(socios.filtros).some(Boolean)
  return (
    <section className="admin-page">
      <Encabezado puede={puede} onModal={setModal} />

      {modal === 'alta' && <AltaSocio token={token} onCerrar={() => setModal(null)} onHecho={() => { setModal(null); socios.cargar() }} />}
      {modal === 'pase' && <PaseDiario token={token} planes={planes} onCerrar={() => setModal(null)} onHecho={() => setModal(null)} />}
      {modal === 'importar' && <ImportarSocios token={token} onCerrar={() => setModal(null)} onHecho={socios.cargar} />}

      <Tabs items={VISTAS} activo={socios.vista} onCambiar={socios.cambiarVista} etiqueta="Vista de socios" idPanel="panel-socios" />
      <div id="panel-socios" role="tabpanel" aria-labelledby={`tab-${socios.vista}`}>
        <SociosToolbar key={socios.vista} socios={socios} />
        <EstadoRecurso estado={socios.estado} onReintentar={socios.cargar}>
          <SociosContenido
            data={socios.data}
            onVer={setSeleccion}
            archivados={socios.vista === 'archivados'}
            hayFiltro={hayFiltro}
            pager={<Pager page={socios.page} setPage={socios.setPage} totalPages={totalPages} />}
          />
        </EstadoRecurso>
      </div>
    </section>
  )
}
