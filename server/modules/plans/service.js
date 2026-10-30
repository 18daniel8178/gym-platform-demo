const { DIAS_POR_PERIODO } = require('../memberships/service');

const PERIODOS = Object.keys(DIAS_POR_PERIODO); // diario, mensual, trimestral, semestral, anual

// Validadores por campo: cada uno devuelve { error } o { valor } normalizado.
function validarNombre(v) {
  const nombre = typeof v === 'string' ? v.trim() : '';
  if (!nombre) return { error: 'El nombre es requerido' };
  return { valor: nombre };
}

function validarPrecio(v) {
  // Solo acepta número o cadena numérica (Number(true)=1 colaría un plan de $1).
  if (typeof v !== 'number' && typeof v !== 'string') return { error: 'El precio debe ser un número' };
  const precio = Number(v);
  if (!Number.isFinite(precio) || precio <= 0) return { error: 'El precio debe ser mayor que 0' };
  if (precio > 99999999.99) return { error: 'El precio es demasiado alto' }; // cota de numeric(10,2)
  return { valor: Math.round(precio * 100) / 100 }; // normaliza a 2 decimales
}

function validarPeriodo(v) {
  if (!PERIODOS.includes(v)) return { error: `El periodo debe ser uno de: ${PERIODOS.join(', ')}` };
  return { valor: v };
}

function validarBeneficios(v) {
  if (!Array.isArray(v) || !v.every((b) => typeof b === 'string')) {
    return { error: 'Los beneficios deben ser una lista de textos' };
  }
  return { valor: v.map((b) => b.trim()).filter(Boolean) };
}

function validarBooleano(campo) {
  return (v) => (typeof v === 'boolean' ? { valor: v } : { error: `${campo} debe ser booleano` });
}

// Reglas en el mismo orden de evaluación que la validación original.
// `obligatorio: true` = el campo se valida siempre salvo en modo parcial sin él.
const REGLAS = [
  { campo: 'nombre', obligatorio: true, validar: validarNombre },
  { campo: 'precio', obligatorio: true, validar: validarPrecio },
  { campo: 'periodo', obligatorio: true, validar: validarPeriodo },
  { campo: 'beneficios', obligatorio: false, validar: validarBeneficios },
  { campo: 'destacado', obligatorio: false, validar: validarBooleano('destacado') },
  { campo: 'activo', obligatorio: false, validar: validarBooleano('activo') },
];

// Valida y normaliza el payload de un plan (crear o editar). Devuelve
// { valido, error, datos } donde `datos` solo contiene columnas permitidas
// (lista blanca anti mass-assignment). No confía en el cliente.
function validarPlan(body, { parcial = false } = {}) {
  const datos = {};
  for (const { campo, obligatorio, validar } of REGLAS) {
    const aplica = obligatorio ? !parcial || campo in body : campo in body;
    if (!aplica) continue;
    const r = validar(body[campo]);
    if ('error' in r) return { valido: false, error: r.error };
    datos[campo] = r.valor;
  }
  if (Object.keys(datos).length === 0) return { valido: false, error: 'No hay campos válidos para actualizar' };
  return { valido: true, datos };
}

module.exports = { validarPlan, PERIODOS };
