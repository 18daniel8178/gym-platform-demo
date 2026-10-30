// Validación de la sucursal. Devuelve { datos } con lo que se puede escribir, o
// { error } con un mensaje EN ESPAÑOL.
//
// Misma idea que el catálogo de ajustes: lista blanca de claves. `id`, `codigo`
// y `activa` NO se tocan desde el panel — el código es la clave estable a la que
// apunta la numeración, y desactivar la única sucursal dejaría al gimnasio sin
// dónde registrar nada.

const esTexto = (v) => typeof v === 'string';
const vacio = (v) => !esTexto(v) || v.trim() === '';

// Se comprueba contra Intl porque es exactamente quien la va a usar: el horario
// y el check-in deciden la hora local con ella.
function zonaHorariaValida(valor) {
  if (vacio(valor)) return false;
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: valor });
    return true;
  } catch {
    return false;
  }
}

const REGLAS = [
  ['nombre', (v) => !vacio(v) && v.length <= 80, 'El nombre de la sucursal no puede quedar vacío'],
  ['direccion', (v) => esTexto(v) && v.length <= 200, 'La dirección no puede pasar de 200 caracteres'],
  ['telefono', (v) => esTexto(v) && v.length <= 40, 'El teléfono no puede pasar de 40 caracteres'],
  ['zona_horaria', zonaHorariaValida, 'La zona horaria no es válida (por ejemplo: America/Panama)'],
];

const CLAVES = REGLAS.map(([clave]) => clave);

function validarSucursal(cuerpo) {
  const entrada = cuerpo || {};
  const desconocidas = Object.keys(entrada).filter((k) => !CLAVES.includes(k));
  if (desconocidas.length > 0) return { error: `Esta sección no admite: ${desconocidas.join(', ')}` };
  if (Object.keys(entrada).length === 0) return { error: 'No hay nada que guardar' };

  const rota = REGLAS.find(([clave, cumple]) => clave in entrada && !cumple(entrada[clave]));
  if (rota) return { error: rota[2] };

  return { datos: entrada };
}

module.exports = { validarSucursal, CLAVES };
