const { supabase } = require('../../infrastructure/supabase');
const { validarSucursal } = require('./validadores');

// La sucursal donde ocurre la operación. El documento maestro (§9) dice que toda
// operación pertenece a una organización y, cuando aplique, a una sucursal; en
// esta fase el gimnasio opera con UNA, pero la identidad existe desde ya para
// que los pagos, ventas, cajas e inventarios cuelguen de ella sin migrar datos
// reales después.
//
// La multisucursal (elegir sucursal, permisos por sucursal, traspasos) queda
// fuera de la Fase 1 a propósito: aquí solo vive la principal.
const CODIGO_PRINCIPAL = 'principal';

// Igual que los ajustes: la lee el sitio público en cada visita y cambia una vez
// al año. La caché es por proceso; en Vercel cada instancia tiene la suya.
const VIDA_CACHE_MS = 60_000;
const CAMPOS = 'id, codigo, nombre, direccion, telefono, zona_horaria, activa';

let cache = null;
let cacheHasta = 0;
// Época: sube en cada invalidación. Una lectura que empezó ANTES de un guardado
// no puede repoblar la caché al resolver — lo haría con la fila vieja y con 60 s
// de vida por delante, que es peor que no tener caché.
let epoca = 0;

function invalidarCache() {
  cache = null;
  cacheHasta = 0;
  epoca += 1;
}

// La migración puede no estar aplicada todavía: el sitio público no puede
// caerse por eso. Mismos códigos que en ajustes — 42P01 es Postgres y PGRST205
// es PostgREST diciendo lo mismo.
const TABLA_AUSENTE = new Set(['42P01', 'PGRST205', 'PGRST202']);
let avisado = false;

// Sin sucursal en la base, el resto del sistema sigue funcionando con la que
// siempre estuvo implícita en el código.
const SUCURSAL_HEREDADA = Object.freeze({
  id: null,
  codigo: CODIGO_PRINCIPAL,
  nombre: 'FORJA GYM',
  direccion: '',
  telefono: '',
  zona_horaria: 'America/Panama',
  activa: true,
});

function avisarUnaVez() {
  if (avisado) return;
  avisado = true;
  console.warn('[sucursal] branches no existe todavía: ejecuta server/db/2026_09_sucursal.sql');
}

async function leerSucursal() {
  if (cache && Date.now() < cacheHasta) return { sucursal: cache };

  const epocaAlLeer = epoca;
  const { data, error } = await supabase
    .from('branches')
    .select(CAMPOS)
    .eq('codigo', CODIGO_PRINCIPAL)
    .maybeSingle();

  if (error && TABLA_AUSENTE.has(error.code)) {
    avisarUnaVez();
    return { sucursal: SUCURSAL_HEREDADA };
  }
  if (error) return { error };
  if (!data) return { sucursal: SUCURSAL_HEREDADA };

  // Si alguien guardó mientras este SELECT viajaba, el dato ya nació viejo: se
  // devuelve a quien preguntó, pero no se cachea.
  if (epocaAlLeer === epoca) {
    cache = data;
    cacheHasta = Date.now() + VIDA_CACHE_MS;
  }
  return { sucursal: data };
}

// Como en los ajustes, el "antes" del diff auditado se lee FRESCO: partir de la
// caché escribiría en la bitácora —que es inmutable— un cambio que no ocurrió.
async function leerSucursalFresca() {
  const { data, error } = await supabase
    .from('branches')
    .select(CAMPOS)
    .eq('codigo', CODIGO_PRINCIPAL)
    .maybeSingle();
  if (error) return { error };
  if (!data) return { error: 'no-existe' };
  return { sucursal: data };
}

// Devuelve { antes, despues } para que el router registre la bitácora.
async function guardarSucursal({ cambios }) {
  const { datos, error: eClaves } = validarSucursal(cambios);
  if (eClaves) return { error: eClaves, invalido: true };

  const { sucursal: antes, error: eLeer } = await leerSucursalFresca();
  if (eLeer) return { error: 'No se pudo leer la sucursal' };

  const { data, error } = await supabase
    .from('branches')
    .update(datos)
    .eq('codigo', CODIGO_PRINCIPAL)
    .select(CAMPOS)
    .single();
  if (error) return { error: 'No se pudo guardar la sucursal' };

  invalidarCache();
  return { antes, despues: data };
}

module.exports = {
  CODIGO_PRINCIPAL,
  leerSucursal,
  leerSucursalFresca,
  guardarSucursal,
  invalidarCache,
};
