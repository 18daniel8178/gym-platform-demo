const v = require('./validadores');

// Catálogo de secciones de ajustes: qué claves acepta cada una y quién las
// valida. Es la lista blanca del PATCH — una clave que no esté aquí se descarta
// con 400, así que no hay asignación masiva ni campos "fantasma" en la base.
//
// Mismo espíritu que el catálogo de permisos del Bloque 1: una sola fuente de
// verdad, y que un descuido reviente pronto y ruidosamente.
const SECCIONES = Object.freeze({
  negocio: {
    etiqueta: 'Perfil del negocio',
    claves: ['nombre_comercial', 'razon_social', 'ruc', 'dv', 'telefono', 'correo', 'direccion', 'logo_url'],
    validar: v.validarNegocio,
  },
  moneda: {
    etiqueta: 'Moneda y formato',
    claves: ['codigo', 'simbolo', 'decimales', 'locale', 'usd_habilitado'],
    numericas: ['decimales'],
    validar: v.validarMoneda,
  },
  impuestos: {
    etiqueta: 'Impuestos',
    claves: ['membresias', 'productos', 'servicios'],
    numericas: ['membresias', 'productos', 'servicios'],
    validar: v.validarImpuestos,
  },
  horario: {
    etiqueta: 'Horarios y cierres',
    claves: ['dias', 'cierres'],
    validar: v.validarHorario,
  },
  politicas: {
    etiqueta: 'Políticas de operación',
    claves: ['pase_diario_entradas_dia', 'stock_negativo', 'umbral_caja', 'checkin_ventana_minutos', 'cierre_ciego'],
    numericas: ['pase_diario_entradas_dia', 'umbral_caja', 'checkin_ventana_minutos'],
    validar: v.validarPoliticas,
  },
});

const NOMBRES = Object.keys(SECCIONES);

// La numeración no vive en app_settings: son filas de document_series, con su
// contador atómico. Se declara aparte para que el panel la trate igual.
const TIPOS_DOCUMENTO = Object.freeze(['recibo', 'factura']);

function esSeccion(nombre) {
  return Object.prototype.hasOwnProperty.call(SECCIONES, nombre);
}

// Un <input type="number"> manda "7", no 7. Lo que se valida tiene que ser
// exactamente lo que se guarda, o la sección acaba con tipos mezclados en jsonb
// (unas tasas número, otras texto) y quien las lea tendrá que adivinar.
// Lo que no sea convertible se deja intacto: el validador dará el mensaje bueno.
function convertirNumeros(seccion, datos) {
  const salida = { ...datos };
  for (const clave of seccion.numericas || []) {
    const valor = salida[clave];
    if (typeof valor !== 'string' || valor.trim() === '') continue;
    const n = Number(valor);
    if (Number.isFinite(n)) salida[clave] = n;
  }
  return salida;
}

// Se queda solo con las claves declaradas. Devuelve { datos } o { error }.
function filtrarClaves(nombre, cuerpo) {
  const seccion = SECCIONES[nombre];
  const desconocidas = Object.keys(cuerpo).filter((k) => !seccion.claves.includes(k));
  if (desconocidas.length > 0) {
    return { error: `Esta sección no admite: ${desconocidas.join(', ')}` };
  }
  if (Object.keys(cuerpo).length === 0) return { error: 'No hay nada que guardar' };
  return { datos: convertirNumeros(seccion, cuerpo) };
}

module.exports = { SECCIONES, NOMBRES, TIPOS_DOCUMENTO, esSeccion, filtrarClaves };
