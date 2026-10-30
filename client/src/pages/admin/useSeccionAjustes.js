import { useState } from 'react'
import { guardarSeccion } from '../../services/adminService.js'
import { useToast } from './ui/toast.jsx'

// Estado de una tarjeta de ajustes: los valores en edición y su guardado.
//
// La unidad de guardado es la SECCIÓN, no la página: es también el grano del
// diff que se audita y del filtro de la pestaña Actividad, así que lo que se
// guarda junto es lo que después se lee junto en la bitácora.
// `onGuardado` avisa al padre para que recargue: sin él, la pantalla se queda
// con la foto que trajo al montarse y volver a la pestaña (que desmonta y monta
// la tarjeta) enseñaría —y podría reescribir— el valor anterior.
export default function useSeccionAjustes({ token, seccion, inicial, etiqueta, onGuardado }) {
  const toast = useToast()
  const [valor, setValor] = useState(inicial || {})
  const [guardando, setGuardando] = useState(false)

  const cambiar = (campo, nuevo) => setValor((previo) => ({ ...previo, [campo]: nuevo }))

  async function guardar(evento) {
    evento?.preventDefault?.()
    setGuardando(true)
    const r = await guardarSeccion(token, seccion, valor)
    setGuardando(false)
    if (r.ok) {
      setValor(r.data.valor)
      toast.ok(`${etiqueta} guardado`)
      await onGuardado?.()
    } else toast.error(r.error)
    return r.ok
  }

  return { valor, setValor, cambiar, guardando, guardar }
}
