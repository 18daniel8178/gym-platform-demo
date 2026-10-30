// Reglas puras de horario. Sin acceso a la base y sin Express: son las que el
// check-in del Bloque 6 tendrá que aplicar para decidir si el gimnasio está
// abierto, y nacen aquí porque el horario y los cierres se configuran aquí.

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

// Horario por defecto si la configuración viene vacía: nunca dejar el sitio
// público sin horarios por un traslado a medias.
const HORARIO_BASE = {
  1: { abre: '05:00', cierra: '22:00' },
  6: { abre: '07:00', cierra: '18:00' },
  7: { abre: '08:00', cierra: '14:00' },
};

const POR_DEFECTO = DIAS.map((_, i) => {
  const dow = i + 1;
  const { abre, cierra } = HORARIO_BASE[dow] || HORARIO_BASE[1];
  return { dow, abre, cierra, cerrado: false };
});

const nombreDe = (dow) => DIAS[dow - 1] || '';

// El servidor corre en UTC y el gimnasio abre en hora local, así que cuanto
// decide "qué día y qué hora es" pasa por aquí, con la zona fijada.
//
// Se leen las PARTES por nombre en vez de partir el texto formateado: es-PA
// escribe las fechas como MM/DD/AAAA, no DD/MM, y confiar en ese orden es la
// clase de suposición que rompe en silencio.
const ZONA = 'America/Panama';

function partesDe(momento, opciones) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONA, ...opciones })
    .formatToParts(momento)
    .reduce((acc, p) => ({ ...acc, [p.type]: p.value }), {});
}

// Día ISO (1 lunes … 7 domingo) en Panamá.
const ORDEN_DIAS = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

function diaSemanaPanama(momento) {
  const { weekday } = partesDe(momento, { weekday: 'short' });
  return ORDEN_DIAS[weekday] || 1;
}

// 'HH:MM' local de Panamá (h23: la medianoche es 00:00, nunca 24:00).
function horaPanama(momento) {
  const { hour, minute } = partesDe(momento, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  return `${hour}:${minute}`;
}

// 'AAAA-MM-DD' local de Panamá.
function fechaPanama(momento) {
  const { year, month, day } = partesDe(momento, { year: 'numeric', month: '2-digit', day: '2-digit' });
  return `${year}-${month}-${day}`;
}

const conDias = (horario) => (horario?.dias?.length ? horario.dias : POR_DEFECTO);

// ¿Está abierto el gimnasio en ese momento? Devuelve el motivo cuando no lo está,
// que es lo que el check-in mostrará al socio.
function estaAbierto(momento, horario) {
  const fecha = fechaPanama(momento);
  const cierre = (horario?.cierres || []).find((c) => c.fecha === fecha);
  if (cierre) return { abierto: false, motivo: cierre.motivo };

  const dia = conDias(horario).find((d) => Number(d.dow) === diaSemanaPanama(momento));
  if (!dia || dia.cerrado) return { abierto: false, motivo: 'El gimnasio no abre ese día' };

  const hora = horaPanama(momento);
  if (hora < dia.abre || hora >= dia.cierra) {
    return { abierto: false, motivo: `Fuera del horario (${dia.abre} a ${dia.cierra})` };
  }
  return { abierto: true, motivo: null };
}

// Forma que espera el sitio público: [{dia:'Lunes', abre, cierra}]. El nombre se
// compone aquí y no se guarda, para que la configuración no dependa de acentos.
function paraSitioPublico(horario) {
  return conDias(horario).map((d) => ({
    dia: nombreDe(Number(d.dow)),
    abre: d.cerrado ? null : d.abre,
    cierra: d.cerrado ? null : d.cierra,
    cerrado: Boolean(d.cerrado),
  }));
}

module.exports = { DIAS, POR_DEFECTO, estaAbierto, paraSitioPublico, nombreDe, fechaPanama, diaSemanaPanama };
