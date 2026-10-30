import { useState } from 'react'
import { usePermisos } from './adminUi.js'
import { useFechas } from '../../lib/fechas.js'
import { BadgeSocio, BadgeMembresia, ListaEtiquetas, ESTADO_SOCIO, ORIGEN } from './sociosUi.jsx'
import EtiquetasEditor from './EtiquetasEditor.jsx'
import EstadoSocioDialog from './EstadoSocio.jsx'

// Bloqueado o archivado no son estados más: condicionan qué se puede hacer con
// el socio, así que la ficha lo dice arriba, con el motivo y desde cuándo.
function AvisoEstado({ perfil }) {
  const { fecha } = useFechas()
  if (!['bloqueado', 'archivado'].includes(perfil.estado_miembro)) return null
  const desde = perfil.estado_cambiado_en ? ` desde el ${fecha(perfil.estado_cambiado_en)}` : ''
  return (
    <p className={`socio-aviso-estado socio-aviso-estado--${perfil.estado_miembro}`} role="status">
      <strong>{ESTADO_SOCIO[perfil.estado_miembro].txt}{desde}.</strong> {perfil.estado_motivo}
    </p>
  )
}

export default function FichaCabecera({ ficha, token, userId, onRecargar }) {
  const puede = usePermisos()
  const [dialogo, setDialogo] = useState(false)
  const { perfil, membresia } = ficha
  // Solo las salidas que este usuario puede ejecutar; el server revalida igual.
  const opciones = (ficha.transiciones || []).filter((t) => puede(t.permiso))

  return (
    <div className="admin-page-head socio-cabecera">
      <div className="socio-cabecera-titulo">
        <h1>{perfil.nombre_completo}</h1>
        <BadgeSocio estado={perfil.estado_miembro} />
        <BadgeMembresia estado={membresia?.estado || 'sin'} />
      </div>
      <p className="admin-muted">
        Documento {perfil.documento} · {perfil.telefono} · Llegó por {ORIGEN[perfil.origen] || perfil.origen}
      </p>
      <AvisoEstado perfil={perfil} />
      {puede('member.update') ? (
        <EtiquetasEditor token={token} userId={userId} inicial={perfil.etiquetas} />
      ) : (
        <ListaEtiquetas etiquetas={perfil.etiquetas} />
      )}
      {opciones.length > 0 && (
        <div className="admin-actions">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDialogo(true)}>Cambiar estado</button>
        </div>
      )}
      {dialogo && (
        <EstadoSocioDialog
          token={token}
          userId={userId}
          opciones={opciones}
          onCerrar={() => setDialogo(false)}
          onHecho={() => { setDialogo(false); onRecargar() }}
        />
      )}
    </div>
  )
}
