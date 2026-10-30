// El día de hoy en la puerta (demo). Sin esto, la pantalla de check-in y el
// aforo se verían en blanco en la demo, que es justo lo contrario de lo que
// hay que mostrar.
//
// No reproduce la decisión real: la elige. Los rechazos se reparten entre los
// socios a los que de verdad les tocaría ese motivo, para que la pantalla y la
// ficha de esa persona cuenten lo mismo.

const ENTRADAS_DEL_DIA = [26, 38]; // un día normal de un gimnasio de barrio
const APERTURA = 6;
const PROBABILIDAD_MANUAL = 0.12; // a alguien se le queda el teléfono en casa

const dosDigitos = (n) => String(n).padStart(2, '0');
const marca = (hoy, hora, minuto) => `${hoy}T${dosDigitos(hora)}:${dosDigitos(minuto)}:00-05:00`;

// Entre la apertura y la hora en que se siembra: a nadie le ha pasado todavía
// lo que va a pasar esta tarde.
function momentoDelDia(azar, { hoy, hastaHora }) {
  const hora = azar.entero(APERTURA, Math.max(APERTURA, hastaHora));
  return marca(hoy, hora, azar.entero(0, 59));
}

const metodoDe = (azar) => (azar.probabilidad(PROBABILIDAD_MANUAL) ? 'manual' : 'qr');

function entrada(azar, { socio, hoy, hastaHora, resultado, motivo }) {
  return {
    clave: socio.clave,
    resultado,
    motivo,
    metodo: metodoDe(azar),
    ocurrido_en: momentoDelDia(azar, { hoy, hastaHora }),
  };
}

// Quién entra hoy: socios al día, cada uno una sola vez (volver a escanear no
// crea otra entrada, y el aforo del día tiene que poder conciliarse).
function entradasPermitidas(azar, { socios, hoy, hastaHora }) {
  const alDia = socios.filter((s) => s.estado === 'activo' && s.membresia && s.membresia.fecha_fin >= hoy);
  const cuantos = Math.min(alDia.length, azar.entero(ENTRADAS_DEL_DIA[0], ENTRADAS_DEL_DIA[1]));
  const elegidos = new Set();
  while (elegidos.size < cuantos) elegidos.add(azar.elegir(alDia).clave);
  return [...elegidos].map((clave) => entrada(azar, {
    socio: { clave }, hoy, hastaHora, resultado: 'permitido', motivo: 'permitido',
  }));
}

// Los rechazos del día, cada uno con el socio al que le corresponde ese motivo.
function rechazos(azar, { socios, hoy, hastaHora }) {
  const porMotivo = [
    ['membresia_vencida', socios.filter((s) => s.membresia && s.membresia.fecha_fin < hoy)],
    ['socio_bloqueado', socios.filter((s) => s.estado === 'bloqueado')],
  ];
  return porMotivo.flatMap(([motivo, candidatos]) => {
    if (!candidatos.length) return [];
    const cuantos = azar.entero(1, Math.min(3, candidatos.length));
    return Array.from({ length: cuantos }, () => entrada(azar, {
      socio: azar.elegir(candidatos), hoy, hastaHora, resultado: 'rechazado', motivo,
    }));
  });
}

function generarCheckinsDeHoy(azar, { socios, hoy, hastaHora = 18 }) {
  return [
    ...entradasPermitidas(azar, { socios, hoy, hastaHora }),
    ...rechazos(azar, { socios, hoy, hastaHora }),
  ].sort((a, b) => a.ocurrido_en.localeCompare(b.ocurrido_en));
}

module.exports = { generarCheckinsDeHoy, ENTRADAS_DEL_DIA };
