const { estadoObjetivo } = require('./users.service');
const { logAdminAction } = require('./audit');

// Políticas sobre la CUENTA OBJETIVO de una acción del panel (`/users/:id/...`).
// Se declaran en la ruta (ver crearRouterAdmin) en vez de encadenarse a mano:
// olvidar una era invisible hasta que alguien la explotaba.

// Los UUID de Postgres y GoTrue no distinguen mayúsculas: comparar los ids tal
// cual permitiría saltarse el guard mandando el propio id en mayúsculas.
const mismoUsuario = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();

// Carga de UNA consulta el estado del objetivo; el resto de guards lo leen de
// `req.objetivo` sin volver a la base.
async function cargarObjetivo(req, res, next) {
  const { objetivo, error } = await estadoObjetivo(req.params.id);
  if (error) return res.status(500).json({ error: 'No se pudo verificar la cuenta' });
  if (!objetivo.existe) return res.status(404).json({ error: 'La cuenta no existe' });
  req.objetivo = objetivo;
  return next();
}

// La cuenta del propietario no se modifica desde el panel: es el bootstrap del
// RBAC y bloquearla dejaría al gimnasio sin acceso (solo recuperable en
// Supabase). Ocultar la fila en la UI no es seguridad: el intento se audita.
async function rechazarPropietario(req, res, next) {
  if (!req.objetivo.propietario) return next();
  await logAdminAction(req.user, {
    accion: 'user.denied',
    entidad: 'auth.users',
    entidadId: req.params.id,
    detalle: { nota: 'intento de modificar la cuenta del propietario' },
  });
  return res.status(403).json({ error: 'La cuenta del propietario no se puede modificar desde el panel' });
}

// Equipo gestiona cuentas del PERSONAL: un socio no se administra desde aquí y
// su dispositivo o IP no tienen por qué verse en el panel.
function exigirStaff(req, res, next) {
  if (!req.objetivo.esStaff) return res.status(404).json({ error: 'Esa cuenta no es del personal' });
  return next();
}

// Evita que alguien se deje a sí mismo sin acceso.
function noSobreSiMismo(mensaje) {
  return (req, res, next) => {
    if (mismoUsuario(req.params.id, req.user.id)) return res.status(400).json({ error: mensaje });
    return next();
  };
}

const CLAVES = new Set(['objetivo', 'prohibirPropietario', 'prohibirSiMismo']);
const OBJETIVOS = new Set(['staff', 'cualquiera']);

// Traduce la política declarada en la ruta a su cadena de guards, siempre en el
// mismo orden: lo barato primero, y nada que dependa de `req.objetivo` antes de
// cargarlo.
function guardsDeObjetivo(politica) {
  const desconocidas = Object.keys(politica).filter((k) => !CLAVES.has(k));
  if (desconocidas.length > 0) throw new Error(`Política de objetivo desconocida: ${desconocidas.join(', ')}`);
  if (politica.objetivo && !OBJETIVOS.has(politica.objetivo)) {
    throw new Error(`objetivo debe ser 'staff' o 'cualquiera', no '${politica.objetivo}'`);
  }

  const guards = [];
  if (politica.prohibirSiMismo) guards.push(noSobreSiMismo(politica.prohibirSiMismo));
  if (politica.objetivo || politica.prohibirPropietario) guards.push(cargarObjetivo);
  if (politica.prohibirPropietario) guards.push(rechazarPropietario);
  if (politica.objetivo === 'staff') guards.push(exigirStaff);
  return guards;
}

module.exports = { guardsDeObjetivo, mismoUsuario };
