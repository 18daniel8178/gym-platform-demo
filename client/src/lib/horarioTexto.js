// Los días en el orden del horario (1 lunes … 7 domingo), que NO es el de
// `Date.getDay()` (ese empieza en domingo y lo usan Home y Contacto para
// resaltar el día de hoy). Se comparten entre el editor de horarios y la
// bitácora, que tiene que explicar en palabras lo que cambió.

export const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

export const nombreDia = (dow) => DIAS[Number(dow) - 1] || `Día ${dow}`

// Cómo se lee un día del horario: "05:00–22:00", "Cerrado" o "—" si no existía.
export function horarioDeDia(dia) {
  if (!dia) return '—'
  return dia.cerrado ? 'Cerrado' : `${dia.abre}–${dia.cierra}`
}
