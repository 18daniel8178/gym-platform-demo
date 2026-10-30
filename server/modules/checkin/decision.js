const { estaAbierto, fechaPanama } = require('../settings/horario');

// ¿Entra o no entra? (Fase 1 · Bloque 6). Regla pura: el socio, su membresía, el
// horario configurado y su última entrada llegan como argumento.
//
// El ORDEN de evaluación es fijo y está escrito aquí una sola vez. Un intento
// puede incumplir varias reglas a la vez —bloqueado, vencido y fuera de horario—
// y el operador tiene que ver siempre el mismo motivo, o el historial del día no
// se puede leer ni contar. Manda lo que el socio no puede resolver en el momento
// (su estado), luego lo que resuelve en recepción (su membresía) y al final lo
// que depende del reloj.

const MOTIVOS = Object.freeze({
  permitido: 'Entrada registrada',
  ya_registrado: 'Su entrada de hoy ya estaba registrada',
  socio_bloqueado: 'El socio está bloqueado: lo resuelve gerencia',
  socio_archivado: 'El socio está archivado: hay que reactivarlo antes de que entre',
  sin_membresia: 'No tiene membresía activa: puede contratar aquí en recepción',
  membresia_congelada: 'Su membresía está congelada: hay que reactivarla para entrar',
  membresia_vencida: 'Su membresía venció: hay que renovar para entrar',
  sin_entradas: 'Su plan se quedó sin entradas disponibles',
  fuera_de_horario: 'Fuera del horario del gimnasio',
});

// Estos dos estados cierran la puerta; 'inactivo' no, que es una etiqueta del
// personal para quien dejó de venir, no un castigo.
const ESTADOS_QUE_NO_ENTRAN = { bloqueado: 'socio_bloqueado', archivado: 'socio_archivado' };

const permitir = () => ({ decision: 'permitir', motivo: 'permitido', mensaje: MOTIVOS.permitido });
const rechazar = (motivo, mensaje) => ({ decision: 'rechazar', motivo, mensaje: mensaje || MOTIVOS[motivo] });

// Volver a presentarse a los pocos minutos es escanear dos veces, no entrar dos
// veces: no se registra nada ni se mueve el aforo.
function yaEstaDentro({ ultimaEntrada, momento, ventanaMinutos }) {
  if (!ultimaEntrada?.ocurrido_en || !ventanaMinutos) return false;
  const minutos = (momento.getTime() - Date.parse(ultimaEntrada.ocurrido_en)) / 60000;
  return minutos >= 0 && minutos < ventanaMinutos;
}

function motivoDeLaMembresia(membresia, hoy) {
  if (!membresia) return 'sin_membresia';
  if (membresia.estado === 'congelada') return 'membresia_congelada';
  if (membresia.fecha_fin < hoy) return 'membresia_vencida';
  if (Number.isInteger(membresia.entradas_restantes) && membresia.entradas_restantes <= 0) return 'sin_entradas';
  return null;
}

function evaluarCheckin({ socio, membresia, ultimaEntrada, horario, ahora, ventanaMinutos }) {
  // Las reglas de horario trabajan con Date; el momento se normaliza una vez.
  const momento = ahora instanceof Date ? ahora : new Date(ahora);

  if (yaEstaDentro({ ultimaEntrada, momento, ventanaMinutos })) {
    return { decision: 'ya_dentro', motivo: 'ya_registrado', mensaje: MOTIVOS.ya_registrado };
  }

  const porEstado = ESTADOS_QUE_NO_ENTRAN[socio?.estado_miembro];
  if (porEstado) return rechazar(porEstado);

  // El día se toma del mismo reloj que decide si el gimnasio está abierto: si no,
  // una membresía podría estar vencida para una regla y vigente para la otra.
  const porMembresia = motivoDeLaMembresia(membresia, fechaPanama(momento));
  if (porMembresia) return rechazar(porMembresia);

  const horarioHoy = estaAbierto(momento, horario);
  if (!horarioHoy.abierto) return rechazar('fuera_de_horario', horarioHoy.motivo || MOTIVOS.fuera_de_horario);

  return permitir();
}

module.exports = { evaluarCheckin, MOTIVOS };
