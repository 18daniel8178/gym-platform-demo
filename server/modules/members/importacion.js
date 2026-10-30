const { toCsv } = require('../../lib/csv');
const { validarPerfilParcial } = require('./perfil');
const { normalizarDocumento, normalizarEmail } = require('./normalizacion');

// Importación CSV del padrón del gimnasio (§13.7, decisión 38). Lógica pura: el
// archivo entra como texto y sale la lista de filas listas y el reporte de las
// rechazadas, con su número de fila y la causa exacta.
//
// El archivo lo exporta el gimnasio desde su hoja de cálculo, así que hay que
// tolerar lo que exporta Excel en español: punto y coma, BOM y CRLF. El número
// de fila del reporte es el que se ve en Excel, con el encabezado como fila 1.

const LIMITE_FILAS = 500;

// Encabezado tal como venga → campo del expediente. Lo que no esté aquí se
// ignora: la hoja del gimnasio trae columnas suyas (plan, pagado, notas…).
const COLUMNAS = {
  nombre: 'nombre_completo', nombre_completo: 'nombre_completo', nombres: 'nombre_completo', socio: 'nombre_completo',
  documento: 'documento', cedula: 'documento', identificacion: 'documento', id: 'documento',
  telefono: 'telefono', celular: 'telefono', movil: 'telefono',
  correo: 'correo', email: 'correo', e_mail: 'correo', correo_electronico: 'correo',
  nacimiento: 'fecha_nacimiento', fecha_nacimiento: 'fecha_nacimiento', fecha_de_nacimiento: 'fecha_nacimiento',
  emergencia1_nombre: 'emergencia1_nombre', emergencia1_telefono: 'emergencia1_telefono',
  emergencia2_nombre: 'emergencia2_nombre', emergencia2_telefono: 'emergencia2_telefono',
  condiciones_medicas: 'condiciones_medicas', condiciones: 'condiciones_medicas',
};

const MINIMAS = ['nombre_completo', 'documento', 'telefono', 'correo'];
const ETIQUETA_MINIMA = { nombre_completo: 'el nombre', documento: 'el documento', telefono: 'el teléfono', correo: 'el correo' };
const OPCIONALES = ['fecha_nacimiento', 'emergencia1_nombre', 'emergencia1_telefono', 'emergencia2_nombre', 'emergencia2_telefono', 'condiciones_medicas'];

// Sin regex: comprobar un correo con cuantificadores anidados es la receta de un
// catastrophic backtracking, y aquí entra texto de un archivo ajeno.
function pareceCorreo(valor) {
  const partes = valor.split('@');
  if (partes.length !== 2 || /\s/.test(valor)) return false;
  const [usuario, dominio] = partes;
  const punto = dominio.lastIndexOf('.');
  return Boolean(usuario) && punto > 0 && dominio.length - punto > 2;
}

// "Cédula" → "cedula", "E-mail" → "e_mail": así un encabezado escrito a mano
// sigue encontrando su campo.
const claveDeColumna = (texto) => texto
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .trim().toLowerCase()
  .replace(/[^a-z0-9]+/g, '_')
  .replace(/^_|_$/g, '');

// Separador del archivo: el que más aparezca fuera de comillas en el encabezado.
function separadorDe(primeraLinea) {
  const fuera = primeraLinea.split('"').filter((_, i) => i % 2 === 0).join('');
  return (fuera.match(/;/g) || []).length > (fuera.match(/,/g) || []).length ? ';' : ',';
}

// Partidor de CSV en condiciones: comillas que envuelven separadores y saltos de
// línea, y comillas dobles escapadas ("") dentro del valor.
function partirCsv(texto, sep) {
  const filas = [];
  let celda = '';
  let fila = [];
  let entreComillas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (entreComillas) {
      if (c !== '"') celda += c;
      else if (texto[i + 1] === '"') { celda += '"'; i++; }
      else entreComillas = false;
    } else if (c === '"') entreComillas = true;
    else if (c === sep) { fila.push(celda); celda = ''; }
    else if (c === '\n') { fila.push(celda); filas.push(fila); fila = []; celda = ''; }
    else if (c !== '\r') celda += c;
  }
  fila.push(celda);
  filas.push(fila);
  return filas;
}

const vacia = (celdas) => celdas.every((c) => !c.trim());

function leerEncabezado(celdas) {
  const columnas = celdas.map((c) => COLUMNAS[claveDeColumna(c)] || null);
  const faltan = MINIMAS.filter((m) => !columnas.includes(m));
  if (faltan.length) return { error: `Al archivo le faltan columnas obligatorias: ${faltan.join(', ')}` };
  return { columnas };
}

function leerCsv(texto) {
  const limpio = String(texto || '').replace(/^\uFEFF/, '');
  if (!limpio.trim()) return { ok: false, error: 'El archivo está vacío' };

  const partido = partirCsv(limpio, separadorDe(limpio.split('\n')[0]));
  const { columnas, error } = leerEncabezado(partido[0]);
  if (error) return { ok: false, error };

  const cuerpo = partido.slice(1).map((celdas, i) => ({ numero: i + 2, celdas })).filter((f) => !vacia(f.celdas));
  if (!cuerpo.length) return { ok: false, error: 'El archivo no trae ninguna fila de socios' };
  if (cuerpo.length > LIMITE_FILAS) {
    return { ok: false, error: `El archivo trae ${cuerpo.length} filas y el tope por importación es ${LIMITE_FILAS}: pártelo en varios` };
  }

  const filas = cuerpo.map(({ numero, celdas }) => {
    const valores = {};
    columnas.forEach((campo, i) => { if (campo) valores[campo] = (celdas[i] || '').trim(); });
    return { numero, valores };
  });
  return { ok: true, filas };
}

// ── Validación fila por fila ─────────────────────────────────────────────────

// Lo que exporta una hoja de cálculo en español: 1990-04-07 o 07/04/1990.
function fechaDeNacimiento(valor) {
  if (!valor) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) return valor;
  const dmy = valor.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (!dmy) return { error: 'Fecha de nacimiento inválida: usa 1990-04-07 o 07/04/1990' };
  const [, d, m, y] = dmy;
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

// Un contacto de emergencia va completo o no va: un nombre sin teléfono no sirve
// para llamar a nadie.
function contactoCompleto(valores, n) {
  const nombre = valores[`emergencia${n}_nombre`];
  const telefono = valores[`emergencia${n}_telefono`];
  if (Boolean(nombre) === Boolean(telefono)) return null;
  return `Contacto de emergencia ${n}: hacen falta el nombre y el teléfono, o ninguno de los dos`;
}

// Lo que la fila tiene que traer sí o sí, con el mensaje que leerá quien abra el
// reporte en Excel.
function faltaAlgoMinimo(valores) {
  const vacio = MINIMAS.find((campo) => !valores[campo]);
  if (vacio) return `Falta ${ETIQUETA_MINIMA[vacio]}`;
  if (!pareceCorreo(valores.correo)) return `Correo inválido: ${valores.correo}`;
  return contactoCompleto(valores, 1) || contactoCompleto(valores, 2);
}

function perfilDeFila(valores) {
  const falta = faltaAlgoMinimo(valores);
  if (falta) return { error: falta };

  const nacimiento = fechaDeNacimiento(valores.fecha_nacimiento);
  if (nacimiento?.error) return { error: nacimiento.error };

  const perfil = { nombre_completo: valores.nombre_completo, documento: valores.documento, telefono: valores.telefono };
  const { valido, error } = validarPerfilParcial(perfil);
  if (!valido) return { error };

  for (const campo of OPCIONALES) perfil[campo] = valores[campo] || null;
  perfil.fecha_nacimiento = nacimiento;
  return { perfil, email: normalizarEmail(valores.correo) };
}

// Duplicados: contra la base y entre las filas del propio archivo. Un duplicado
// NO se crea: la importación es masiva y nadie está mirando fila por fila.
function duplicado(fila, { documentos, vistos }) {
  const doc = normalizarDocumento(fila.perfil.documento);
  if (documentos.has(doc)) return `El documento ${fila.perfil.documento} ya existe en un socio registrado`;
  if (vistos.documentos.has(doc)) return `Documento repetido: ya venía en la fila ${vistos.documentos.get(doc)}`;
  if (vistos.correos.has(fila.email)) return `Correo repetido: ya venía en la fila ${vistos.correos.get(fila.email)}`;
  vistos.documentos.set(doc, fila.numero);
  vistos.correos.set(fila.email, fila.numero);
  return null;
}

function validarImportacion(filas, { documentos }) {
  const listas = [];
  const errores = [];
  const vistos = { documentos: new Map(), correos: new Map() };

  for (const { numero, valores } of filas) {
    const nombre = valores.nombre_completo || '';
    const { perfil, email, error } = perfilDeFila(valores);
    if (error) { errores.push({ fila: numero, nombre, causa: error }); continue; }

    const repetido = duplicado({ numero, perfil, email }, { documentos, vistos });
    if (repetido) errores.push({ fila: numero, nombre, causa: repetido });
    else listas.push({ numero, email, perfil });
  }
  return { listas, errores };
}

const reporteDeErrores = (errores) => toCsv(['fila', 'nombre', 'causa'], errores.map((e) => [e.fila, e.nombre, e.causa]));

module.exports = { leerCsv, validarImportacion, reporteDeErrores, LIMITE_FILAS };
