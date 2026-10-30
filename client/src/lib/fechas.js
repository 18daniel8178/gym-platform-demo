import { useCallback, useMemo } from 'react'
import { useInfoPublica } from './infoPublica.js'

// Único punto donde se decide cómo se ve una fecha. Antes cada pantalla llamaba
// a toLocaleDateString('es-PA') sin zona horaria, así que el navegador ponía la
// suya: un cobro de las 22:30 en Panamá se le veía al día siguiente a alguien
// con el portátil en hora de España. El día del negocio lo fija la sucursal.
//
// La zona sale de la sucursal (Ajustes → Sucursal), que es la misma con la que
// el servidor decide si el gimnasio está abierto.

export const ZONA_POR_DEFECTO = 'America/Panama'
const LOCALE = 'es-PA'

// Una zona inválida haría que Intl lance en pleno render. La configuración se
// valida en el servidor, pero esto es lo único que separa un dato raro de una
// pantalla en blanco.
function zonaSegura(zona) {
  try {
    new Intl.DateTimeFormat(LOCALE, { timeZone: zona });
    return zona;
  } catch {
    return ZONA_POR_DEFECTO;
  }
}

export function formatearFecha(iso, zona = ZONA_POR_DEFECTO, opciones = {}) {
  if (!iso) return '—'
  const fecha = new Date(iso)
  if (Number.isNaN(fecha.getTime())) return '—'
  return new Intl.DateTimeFormat(LOCALE, { timeZone: zonaSegura(zona), ...opciones }).format(fecha)
}

// Formateadores ya ligados a la zona de la sucursal: `const { fecha } = useFechas()`.
export function useFechas() {
  const { sucursal } = useInfoPublica()
  const zona = sucursal?.zona_horaria || ZONA_POR_DEFECTO

  // Campos explícitos y no dateStyle: 'short' en es-PA abrevia el año a dos
  // dígitos ("08/19/26"), que es justo lo que estas pantallas NO mostraban.
  const fecha = useCallback(
    (iso) => formatearFecha(iso, zona, { day: '2-digit', month: '2-digit', year: 'numeric' }),
    [zona]
  )
  const fechaHora = useCallback(
    (iso) => formatearFecha(iso, zona, { dateStyle: 'medium', timeStyle: 'short' }),
    [zona]
  )

  return useMemo(() => ({ fecha, fechaHora, zona }), [fecha, fechaHora, zona])
}
