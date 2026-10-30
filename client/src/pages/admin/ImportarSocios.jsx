import { useState } from 'react'
import { importarSocios } from '../../services/adminService.js'
import Dialog from './ui/Dialog.jsx'

// Importación del padrón del gimnasio desde su hoja de cálculo (§13.7). El
// archivo se lee en el navegador y viaja como texto: el servidor valida fila por
// fila, crea las que pueda y devuelve el reporte de las que no.

const PLANTILLA = [
  'nombre,documento,telefono,correo,nacimiento,emergencia1_nombre,emergencia1_telefono',
  'Ana Pérez Ríos,8-123-4567,6000-1111,ana.perez@example.com,1990-04-07,María Ríos,6000-2222',
  'Pedro Gómez Solís,8-765-4321,6000-3333,pedro.gomez@example.com,,,',
].join('\r\n')

function descargar(texto, nombre) {
  const url = URL.createObjectURL(new Blob([texto], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  a.click()
  URL.revokeObjectURL(url)
}

function Instrucciones() {
  return (
    <>
      <p className="admin-muted">
        Un socio por fila. Obligatorios: <strong>nombre, documento, teléfono y correo</strong>; el nacimiento
        y los contactos de emergencia pueden ir vacíos y se completan en recepción.
      </p>
      <p className="admin-muted">
        Cada socio importado entra con origen <strong>importación</strong>, sin consentimientos y con la
        firma/foto pendientes: su ficha lo muestra para resolverlo cuando venga al gimnasio.
      </p>
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => descargar(PLANTILLA, 'plantilla-socios.csv')}>
        Descargar plantilla
      </button>
    </>
  )
}

function Resultado({ resultado }) {
  const { creadas, omitidas, errores, reporte } = resultado
  return (
    <div className="importacion-resultado">
      <p>
        <strong>{creadas}</strong> {creadas === 1 ? 'socio creado' : 'socios creados'} ·{' '}
        <strong>{omitidas}</strong> {omitidas === 1 ? 'fila omitida' : 'filas omitidas'}
      </p>
      {omitidas > 0 && (
        <>
          <ul className="admin-list">
            {errores.slice(0, 5).map((e) => (
              <li key={e.fila} className="admin-list-row">
                <span>Fila {e.fila}{e.nombre ? ` · ${e.nombre}` : ''}</span>
                <strong>{e.causa}</strong>
              </li>
            ))}
          </ul>
          {errores.length > 5 && <p className="admin-muted">y {errores.length - 5} más en el reporte.</p>}
          <button type="button" className="btn btn-primary btn-sm" onClick={() => descargar(reporte, 'errores-importacion.csv')}>
            Descargar reporte de errores
          </button>
        </>
      )}
    </div>
  )
}

function useImportacion(token, onHecho) {
  const [archivo, setArchivo] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const [resultado, setResultado] = useState(null)
  const [error, setError] = useState('')

  async function importar(e) {
    e.preventDefault()
    setEnviando(true)
    setError('')
    const r = await importarSocios(token, await archivo.text())
    setEnviando(false)
    if (!r.ok) return setError(r.error)
    setResultado(r.data)
    return r.data.creadas > 0 && onHecho()
  }

  return { archivo, setArchivo, enviando, resultado, error, importar }
}

export default function ImportarSocios({ token, onCerrar, onHecho }) {
  const { archivo, setArchivo, enviando, resultado, error, importar } = useImportacion(token, onHecho)

  return (
    <Dialog title="Importar socios desde CSV" onClose={onCerrar} ancho={620}>
      {resultado ? (
        <>
          <Resultado resultado={resultado} />
          <div className="dlg-actions">
            <button type="button" className="btn btn-primary" onClick={onCerrar}>Listo</button>
          </div>
        </>
      ) : (
        <form onSubmit={importar}>
          <Instrucciones />
          {error && <div className="admin-aviso">{error}</div>}
          <label className="admin-field">
            Archivo CSV
            <input type="file" accept=".csv,text/csv" onChange={(e) => setArchivo(e.target.files[0] || null)} required />
          </label>
          <p className="admin-muted">Las filas con error no se importan: quedan en un reporte descargable.</p>
          <div className="dlg-actions">
            <button type="button" className="btn btn-ghost" onClick={onCerrar}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={enviando || !archivo}>
              {enviando ? 'Importando…' : 'Importar'}
            </button>
          </div>
        </form>
      )}
    </Dialog>
  )
}
