const { supabase } = require('../../infrastructure/supabase');
const { SECCIONES, NOMBRES, TIPOS_DOCUMENTO, filtrarClaves } = require('./catalogo');
const { validarSerie } = require('./validadores');

// Acceso a los ajustes del negocio. Los lee media aplicación (cobros, moneda,
// horarios, y en los bloques siguientes impuestos y numeración), así que van
// cacheados unos segundos: son datos que cambian una vez al mes, no por request.
//
// La caché es por proceso. En Vercel cada instancia tiene la suya, así que un
// cambio puede tardar hasta VIDA_CACHE_MS en verse en otra instancia; para
// horarios y tasas es aceptable y evita una consulta en cada cobro.
const VIDA_CACHE_MS = 60_000;

let cache = null;
let cacheHasta = 0;

function invalidarCache() {
  cache = null;
  cacheHasta = 0;
}

// La migración todavía no se ha ejecutado. Se devuelven secciones vacías en vez
// de un error para que desplegar el código antes que la migración no tumbe el
// sitio público; cada consumidor cae a su valor por defecto y avisa en el log.
//
// Son DOS códigos y hay que mirar los dos: 42P01 es Postgres diciendo "no existe
// la relación", pero a través de PostgREST llega PGRST205 ("no encuentro la
// tabla en el esquema"). Comprobado contra el proyecto real, no supuesto.
const TABLA_AUSENTE = new Set(['42P01', 'PGRST205', 'PGRST202']);
let avisado = false;

function avisarUnaVez() {
  if (avisado) return;
  avisado = true;
  console.warn('[ajustes] app_settings no existe todavía: ejecuta server/db/2026_08_ajustes.sql');
}

async function leerTodo() {
  if (cache && Date.now() < cacheHasta) return { ajustes: cache };

  const { data, error } = await supabase.from('app_settings').select('seccion, valor');
  if (error && TABLA_AUSENTE.has(error.code)) {
    avisarUnaVez();
    return { ajustes: Object.fromEntries(NOMBRES.map((n) => [n, {}])) };
  }
  if (error) return { error };

  const ajustes = Object.fromEntries(NOMBRES.map((n) => [n, {}]));
  for (const fila of data || []) ajustes[fila.seccion] = fila.valor || {};
  cache = ajustes;
  cacheHasta = Date.now() + VIDA_CACHE_MS;
  return { ajustes };
}

async function leerSeccion(nombre) {
  const { ajustes, error } = await leerTodo();
  if (error) return { error };
  return { valor: ajustes[nombre] || {} };
}

// El "antes" de un guardado NO puede salir de la caché. El PATCH es parcial y se
// mezcla sobre ese valor: partir de una foto de hasta 60 s resucitaría las claves
// que otro administrador acaba de cambiar y, peor, escribiría un diff falso en
// una bitácora que ahora es inmutable. En Vercel cada instancia tiene su caché,
// así que invalidar la propia no basta.
async function leerSeccionFresca(nombre) {
  const { data, error } = await supabase
    .from('app_settings')
    .select('valor')
    .eq('seccion', nombre)
    .maybeSingle();
  if (error && TABLA_AUSENTE.has(error.code)) {
    avisarUnaVez();
    return { valor: {} };
  }
  if (error) return { error };
  return { valor: data?.valor || {} };
}

// Guarda una sección: lista blanca → validación → escritura → diff para auditar.
// Devuelve { antes, despues } para que el router registre la bitácora.
async function guardarSeccion({ nombre, cambios, actorId }) {
  const { datos, error: eClaves } = filtrarClaves(nombre, cambios);
  if (eClaves) return { error: eClaves, invalido: true };

  const { valor: antes, error: eLeer } = await leerSeccionFresca(nombre);
  if (eLeer) return { error: 'No se pudieron leer los ajustes' };

  const despues = { ...antes, ...datos };
  const eValidar = SECCIONES[nombre].validar(despues);
  if (eValidar) return { error: eValidar, invalido: true };

  const { error } = await supabase
    .from('app_settings')
    .update({ valor: despues, updated_at: new Date().toISOString(), updated_by: actorId })
    .eq('seccion', nombre);
  if (error) return { error: 'No se pudieron guardar los ajustes' };

  invalidarCache();
  return { antes, despues };
}

// ── Numeración de documentos (tabla propia, contador atómico) ────────────────
async function leerSeries() {
  const { data, error } = await supabase
    .from('document_series')
    .select('sucursal, tipo, prefijo, proximo, relleno')
    .order('tipo');
  if (error) return { error };
  return { series: data || [] };
}

// Cambia prefijo/correlativo/relleno de un tipo de documento. El correlativo
// solo avanza: retrocederlo repetiría números ya emitidos.
async function guardarSerie({ tipo, cambios, sucursal = 'principal' }) {
  if (!TIPOS_DOCUMENTO.includes(tipo)) return { error: 'Tipo de documento desconocido', invalido: true };

  const { series, error: eLeer } = await leerSeries();
  if (eLeer) return { error: 'No se pudo leer la numeración' };
  const actual = series.find((s) => s.tipo === tipo && s.sucursal === sucursal);
  if (!actual) return { error: 'No hay serie configurada para ese documento', invalido: true };

  const eValidar = validarSerie(cambios, actual);
  if (eValidar) return { error: eValidar, invalido: true };

  const despues = { ...actual, ...cambios };
  const { error } = await supabase
    .from('document_series')
    .update({ prefijo: despues.prefijo, proximo: Number(despues.proximo), relleno: Number(despues.relleno) })
    .eq('sucursal', sucursal)
    .eq('tipo', tipo);
  if (error) return { error: 'No se pudo guardar la numeración' };

  return { antes: actual, despues };
}

// ── Métodos de pago ──────────────────────────────────────────────────────────
// Los mismos cuatro que vivían en el código, por si se consulta antes de que la
// migración exista. Sin esto, un cobro fallaría durante la ventana de despliegue.
const METODOS_HEREDADOS = [
  { clave: 'efectivo', nombre: 'Efectivo', activo: true, orden: 10 },
  { clave: 'tarjeta', nombre: 'Tarjeta', activo: true, orden: 20 },
  { clave: 'yappy', nombre: 'Yappy', activo: true, orden: 30 },
  { clave: 'transferencia', nombre: 'Transferencia', activo: true, orden: 40 },
];

async function leerMetodos({ soloActivos = false } = {}) {
  let consulta = supabase.from('payment_methods').select('clave, nombre, activo, orden').order('orden');
  if (soloActivos) consulta = consulta.eq('activo', true);
  const { data, error } = await consulta;
  if (error && TABLA_AUSENTE.has(error.code)) {
    avisarUnaVez();
    return { metodos: METODOS_HEREDADOS };
  }
  if (error) return { error };
  return { metodos: data || [] };
}


// Valida el método de un cobro y devuelve el error ya redactado, o null.
// Lo usan los tres puntos de cobro (checkout, recepción y pase diario) para no
// repetir la misma rama tres veces.
async function errorDeMetodoDeCobro(clave) {
  const { valido, error } = await metodoActivo(clave);
  if (error) return { estado: 500, mensaje: 'No se pudieron verificar los métodos de pago' };
  if (!valido) return { estado: 400, mensaje: 'Método de pago no válido' };
  return null;
}

// ¿Se puede COBRAR con este método? Solo los activos. Se separa de 'conocido'
// a propósito: filtrar el historial por un método ya desactivado tiene que
// seguir funcionando, o sus pagos desaparecerían del informe.
async function metodoActivo(clave) {
  const { metodos, error } = await leerMetodos();
  if (error) return { error };
  return { valido: metodos.some((m) => m.clave === clave && m.activo) };
}

async function metodoConocido(clave) {
  const { metodos, error } = await leerMetodos();
  if (error) return { error };
  return { valido: metodos.some((m) => m.clave === clave) };
}
module.exports = {
  leerTodo,
  leerSeccion,
  leerSeccionFresca,
  guardarSeccion,
  leerSeries,
  guardarSerie,
  leerMetodos,
  metodoActivo,
  errorDeMetodoDeCobro,
  metodoConocido,
  invalidarCache,
  VIDA_CACHE_MS,
};
