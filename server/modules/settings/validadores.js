// Validadores de los ajustes. Devuelven un mensaje EN ESPAÑOL o null.
//
// El servidor valida siempre: el panel es una comodidad, no una barrera. Cada
// sección declara en catalogo.js qué claves acepta, así que una clave que no
// esté ahí ni siquiera llega hasta aquí (no hay asignación masiva posible).

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

const esTexto = (v) => typeof v === 'string';
const vacio = (v) => !esTexto(v) || v.trim() === '';

// Sin expresión regular: las clásicas de correo tienen retroceso exponencial
// (el gate de lint las rechaza, con razón) y esto es más fácil de leer.
function correoValido(valor) {
  const texto = String(valor);
  if (/\s/.test(texto)) return false;
  const partes = texto.split('@');
  if (partes.length !== 2) return false;
  const [usuario, dominio] = partes;
  const puntoInterno = dominio.includes('.') && !dominio.startsWith('.') && !dominio.endsWith('.');
  return usuario.length > 0 && dominio.length > 2 && puntoInterno;
}

// Número dentro de un rango, aceptando el string que llega de un <input>.
// Number('') y Number(null) valen 0, así que un campo vaciado en el panel pasaba
// como "0 por ciento" en vez de dar error: solo se aceptan números y textos con
// algo escrito dentro.
function numeroEntre(valor, min, max) {
  const esNumeroONumeroEscrito = typeof valor === 'number'
    || (typeof valor === 'string' && valor.trim() !== '');
  if (!esNumeroONumeroEscrito) return null;
  const n = Number(valor);
  if (!Number.isFinite(n)) return null;
  return n >= min && n <= max ? n : null;
}

function textoOpcional(valor, etiqueta, maximo = 200) {
  if (valor === null || valor === undefined) return null;
  if (!esTexto(valor)) return `${etiqueta} debe ser texto`;
  if (valor.length > maximo) return `${etiqueta} no puede pasar de ${maximo} caracteres`;
  return null;
}

// ── Perfil del negocio ───────────────────────────────────────────────────────
function validarNegocio(datos) {
  if ('nombre_comercial' in datos && vacio(datos.nombre_comercial)) {
    return 'El nombre comercial no puede quedar vacío';
  }
  if ('correo' in datos && !vacio(datos.correo) && !correoValido(datos.correo)) {
    return 'El correo de contacto no tiene un formato válido';
  }
  if ('logo_url' in datos && datos.logo_url !== null && vacio(datos.logo_url)) {
    return 'El logo debe ser una dirección válida o quedar vacío';
  }
  const campos = ['nombre_comercial', 'razon_social', 'ruc', 'dv', 'telefono', 'correo', 'direccion'];
  return campos.map((c) => (c in datos ? textoOpcional(datos[c], c.replace('_', ' ')) : null)).find(Boolean) || null;
}

// ── Impuestos por categoría ──────────────────────────────────────────────────
function validarImpuestos(datos) {
  for (const [categoria, tasa] of Object.entries(datos)) {
    if (numeroEntre(tasa, 0, 100) === null) {
      return `La tasa de ${categoria} debe ser un porcentaje entre 0 y 100`;
    }
  }
  return null;
}

// ── Moneda ───────────────────────────────────────────────────────────────────
// El locale acaba en un Intl.NumberFormat que se ejecuta en CADA importe del
// panel y del sitio: uno mal formado lanza RangeError durante el render, así que
// se comprueba aquí, donde entra, y no en los veinte sitios donde se usa.
function localeValido(valor) {
  if (vacio(valor)) return false;
  try {
    new Intl.NumberFormat(valor);
    return true;
  } catch {
    return false;
  }
}

// Cada clave con lo que tiene que cumplir y el mensaje si no lo cumple: una
// moneda con más campos es una fila más, no otra rama dentro de la función.
const REGLAS_MONEDA = [
  ['locale', localeValido, 'El formato regional no es válido (por ejemplo: es-PA)'],
  ['simbolo', (valor) => !vacio(valor), 'El símbolo de la moneda no puede quedar vacío'],
  ['codigo', (valor) => !vacio(valor), 'El código de la moneda no puede quedar vacío'],
  ['decimales', (valor) => numeroEntre(valor, 0, 4) !== null, 'Los decimales deben estar entre 0 y 4'],
  ['usd_habilitado', (valor) => typeof valor === 'boolean', 'El soporte de USD debe ser sí o no'],
];

function validarMoneda(datos) {
  const rota = REGLAS_MONEDA.find(([clave, cumple]) => clave in datos && !cumple(datos[clave]));
  return rota ? rota[2] : null;
}

// ── Horario y cierres excepcionales ──────────────────────────────────────────
function validarDia(dia) {
  if (numeroEntre(dia?.dow, 1, 7) === null) return 'Cada día debe indicar cuál es (1 lunes … 7 domingo)';
  if (dia.cerrado === true) return null; // un día cerrado no necesita horas
  if (!HORA.test(dia.abre || '') || !HORA.test(dia.cierra || '')) {
    return 'Las horas deben tener el formato HH:MM';
  }
  if (dia.cierra <= dia.abre) return 'La hora de cierre debe ser posterior a la de apertura';
  return null;
}

function validarCierre(cierre) {
  if (!FECHA.test(cierre?.fecha || '')) return 'Cada cierre excepcional necesita una fecha (AAAA-MM-DD)';
  if (vacio(cierre.motivo)) return 'Cada cierre excepcional necesita un motivo';
  return null;
}

// `dias` es la semana ENTERA, nunca un parche: el servidor solo cae al horario
// por defecto cuando la lista está vacía, así que guardar tres días dejaría al
// sitio público sin los otros cuatro. O vienen los siete, o no viene la clave.
function validarDias(dias) {
  if (!Array.isArray(dias)) return 'Los días deben venir como lista';
  const error = dias.map(validarDia).find(Boolean);
  if (error) return error;
  const dows = new Set(dias.map((d) => Number(d.dow)));
  if (dows.size !== dias.length) return 'Hay un día repetido en el horario';
  if (dows.size !== 7) return 'El horario debe incluir los siete días de la semana';
  return null;
}

function validarHorario(datos) {
  if ('dias' in datos) {
    const error = validarDias(datos.dias);
    if (error) return error;
  }
  if ('cierres' in datos) {
    if (!Array.isArray(datos.cierres)) return 'Los cierres deben venir como lista';
    const error = datos.cierres.map(validarCierre).find(Boolean);
    if (error) return error;
  }
  return null;
}

// ── Políticas de operación ───────────────────────────────────────────────────
const RANGOS_POLITICAS = {
  pase_diario_entradas_dia: [1, 10],
  umbral_caja: [0, 1000],
  checkin_ventana_minutos: [0, 1440],
};

function validarPoliticas(datos) {
  for (const [clave, valor] of Object.entries(datos)) {
    const rango = RANGOS_POLITICAS[clave];
    if (rango && numeroEntre(valor, rango[0], rango[1]) === null) {
      return `El valor de ${clave.replace(/_/g, ' ')} debe estar entre ${rango[0]} y ${rango[1]}`;
    }
    if (!rango && typeof valor !== 'boolean') return `El valor de ${clave.replace(/_/g, ' ')} debe ser sí o no`;
  }
  return null;
}

// La clave va en la URL del PATCH y en la columna: solo letras sin acento,
// números y guion bajo. NFD separa la tilde de la letra, pero hay que BORRARLA:
// sin el segundo replace, "Tarjeta Débito" daba la clave "tarjeta_d_bito".
function claveDesde(texto) {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

// ── Numeración de documentos ─────────────────────────────────────────────────
// `proximo` solo puede avanzar: bajarlo repetiría números ya emitidos.
// El prefijo va a una columna NOT NULL y acaba dentro del número de documento:
// ni null (reventaría en la base con un 500) ni caracteres que no se puedan
// escribir en un recibo.
const PREFIJO_OK = /^[A-Za-z0-9._/-]*$/;

function validarPrefijo(prefijo) {
  if (!esTexto(prefijo)) return 'El prefijo debe ser texto';
  if (prefijo.length > 10) return 'El prefijo no puede pasar de 10 caracteres';
  if (!PREFIJO_OK.test(prefijo)) return 'El prefijo solo admite letras, números, punto, guion y barra';
  return null;
}

function validarSerie(serie, actual) {
  if ('prefijo' in serie) {
    const error = validarPrefijo(serie.prefijo);
    if (error) return error;
  }
  if ('relleno' in serie && numeroEntre(serie.relleno, 0, 12) === null) {
    return 'El relleno de ceros debe estar entre 0 y 12';
  }
  if ('proximo' in serie) {
    const n = numeroEntre(serie.proximo, 1, Number.MAX_SAFE_INTEGER);
    if (n === null || !Number.isInteger(n)) return 'El correlativo debe ser un número entero mayor que cero';
    if (actual && n < actual.proximo) {
      return `El correlativo no puede retroceder: ya se emitieron documentos hasta el ${actual.proximo - 1}`;
    }
  }
  return null;
}

module.exports = {
  claveDesde,
  validarNegocio,
  validarImpuestos,
  validarMoneda,
  validarHorario,
  validarPoliticas,
  validarSerie,
  HORA,
  FECHA,
};
