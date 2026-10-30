import { useCallback, useEffect, useRef, useState } from 'react'

// Lectura de un recurso del API admin. Un SOLO sitio traduce la respuesta a un
// estado y descarta las respuestas fuera de orden.
//
// Antes cada página reimplementaba este ciclo y cada copia cubría un subconjunto
// distinto: casi ninguna distinguía un 403 de un fallo de red, así que a quien
// no tenía permiso se le ofrecía un «Reintentar» que iba a fallar siempre.

// Traducción única de la respuesta a estado. `sin-permiso` y `sesion-caida` son
// decisiones del servidor —reintentar no las cambia—; `error` sí es reintentable.
export function estadoDeRespuesta(r) {
  if (r.ok) return 'ok'
  if (r.status === 403) return 'sin-permiso'
  if (r.status === 401) return 'sesion-caida'
  return 'error'
}

// `pedir` debe venir memoizado (useCallback) con sus propias dependencias.
export default function useRecursoAdmin(pedir) {
  const [estado, setEstado] = useState('cargando')
  const [datos, setDatos] = useState(null)
  const peticion = useRef(0)

  const recargar = useCallback(async () => {
    const id = ++peticion.current
    setEstado('cargando')
    const r = await pedir()
    if (id !== peticion.current) return // respuesta vieja: gana la última
    if (r.ok) setDatos(r.data)
    setEstado(estadoDeRespuesta(r))
  }, [pedir])

  useEffect(() => {
    recargar()
  }, [recargar])

  return { estado, datos, recargar }
}
