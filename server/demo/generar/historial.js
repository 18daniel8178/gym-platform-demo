const { sumarDias, DIAS_POR_PERIODO } = require('../../modules/memberships/service');

// Membresía y pagos ficticios de un socio según su ESTADO, relativos a hoy: así
// el panel de la demo siempre parece actual (vencimientos esta semana, morosos
// recientes, cobros de los últimos meses). Seis meses de historial de pagos: el
// panel empezó a registrar cobros hace poco, igual que pasaría con el real.
const VENTANA_DIAS = 180;

const PLANES = [['mensual', 62], ['trimestral', 18], ['semestral', 8], ['anual', 12]];
const METODOS = [['efectivo', 45], ['yappy', 30], ['tarjeta', 15], ['transferencia', 10]];
const ORIGENES = [['recepcion', 85], ['checkout_simulado', 15]];
// Picos reales de un gimnasio: temprano y a la salida del trabajo.
const HORAS = [
  [6, 12], [7, 12], [8, 8], [9, 5], [10, 4], [11, 4], [12, 5], [13, 4],
  [14, 3], [15, 3], [16, 5], [17, 12], [18, 12], [19, 8], [20, 3],
];
const MOTIVOS_ANULACION = ['Cobro duplicado', 'Se registró el plan equivocado', 'Pago devuelto por el banco'];
const PROB_ANULADO = 0.025;

// Fin de la membresía según el estado del socio. Los activos mezclan vigentes,
// por vencer esta semana y morosos recientes: es lo que el dashboard tiene que enseñar.
const FIN_SEGUN_ESTADO = {
  activo: (azar, { hoy, dias }) => {
    const tramo = azar.ponderado([['vigente', 66], ['porVencer', 14], ['vencida', 20]]);
    if (tramo === 'vigente') return sumarDias(hoy, azar.entero(8, Math.max(8, dias)));
    if (tramo === 'porVencer') return sumarDias(hoy, azar.entero(0, 7));
    return sumarDias(hoy, -azar.entero(1, 25));
  },
  bloqueado: (azar, { hoy }) => sumarDias(hoy, -azar.entero(5, 60)),
  inactivo: (azar, { hoy }) => sumarDias(hoy, -azar.entero(40, 170)),
  archivado: (azar, { hoy }) => sumarDias(hoy, -azar.entero(90, 170)),
};

const hora = (azar) =>
  `${String(azar.ponderado(HORAS)).padStart(2, '0')}:${String(azar.entero(0, 59)).padStart(2, '0')}`;

const marca = (dia, hhmm) => `${dia}T${hhmm}:00-05:00`; // Panamá no tiene horario de verano

// El cobro de un periodo y, rara vez, un cobro duplicado que recepción anuló.
function pagosDelPeriodo(azar, { periodo, dia }) {
  const pago = { periodo, metodo: azar.ponderado(METODOS), origen: azar.ponderado(ORIGENES), estado: 'aprobado', fecha: marca(dia, hora(azar)) };
  if (!azar.probabilidad(PROB_ANULADO)) return [pago];
  return [pago, { ...pago, estado: 'anulado', motivo_anulacion: azar.elegir(MOTIVOS_ANULACION) }];
}

// Periodos contiguos hacia atrás desde el actual, dentro de la ventana y nunca antes del alta.
function pagosDe(azar, { periodo, fin, alta, hoy }) {
  const dias = DIAS_POR_PERIODO[periodo];
  const ventana = sumarDias(hoy, -VENTANA_DIAS);
  const limite = alta > ventana ? alta : ventana;
  const pagos = [];
  for (let dia = sumarDias(fin, -dias); dia >= limite; dia = sumarDias(dia, -dias)) {
    if (dia <= hoy) pagos.push(...pagosDelPeriodo(azar, { periodo, dia }));
  }
  return pagos.reverse();
}

function historialSocio(azar, { estado, hoy }) {
  if (!FIN_SEGUN_ESTADO[estado]) return { alta: sumarDias(hoy, -azar.entero(1, 60)), membresia: null, pagos: [] };

  const periodo = azar.ponderado(PLANES);
  const dias = DIAS_POR_PERIODO[periodo];
  const fin = FIN_SEGUN_ESTADO[estado](azar, { hoy, dias });
  const inicioActual = sumarDias(fin, -dias);
  const alta = sumarDias(inicioActual, -azar.entero(0, 400)); // hay socios de hace más de un año
  const pagos = pagosDe(azar, { periodo, fin, alta, hoy });
  const fecha_inicio = pagos.length ? pagos[0].fecha.slice(0, 10) : inicioActual;
  return { alta, membresia: { periodo, fecha_inicio, fecha_fin: fin }, pagos };
}

module.exports = { historialSocio, pagosDe, VENTANA_DIAS, hora, marca };
