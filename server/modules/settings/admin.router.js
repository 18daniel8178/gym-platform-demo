const { crearRouterAdmin } = require('../../middleware/routerAdmin');
const { supabase } = require('../../infrastructure/supabase');
const { logAdminAction, entidadesVisiblesPara } = require('../admin/audit');
const { permisosDe } = require('../../middleware/requirePermission');
const { leerSucursal } = require('../branches/service');
const { inicioDelDia, finDelDia } = require('../branches/zona');
const { SECCIONES, esSeccion, TIPOS_DOCUMENTO } = require('./catalogo');
const { claveDesde } = require('./validadores');
const servicio = require('./service');

const router = crearRouterAdmin();

// Los ajustes se leen con settings.update, no con settings.read: esta respuesta
// lleva RUC y correlativos de facturación, y settings.read lo tienen sembrado
// todos los roles operativos (cajero, inventario…) para leer políticas.
const PERMISO = 'settings.update';

// Cada guardado deja su rastro con la sección como entidad_id, que es lo que
// permite filtrar después "solo los cambios fiscales".
async function auditar(req, { seccion, antes, despues }) {
  await logAdminAction(req.user, {
    accion: 'settings.update',
    entidad: 'settings',
    entidadId: seccion,
    detalle: { antes, despues },
  });
}

// GET /settings — todas las secciones, la numeración y los métodos de pago.
router.get('/settings', PERMISO, async (_req, res) => {
  const [{ ajustes, error }, { series, error: eSeries }, { metodos, error: eMetodos }] = await Promise.all([
    servicio.leerTodo(),
    servicio.leerSeries(),
    servicio.leerMetodos(),
  ]);
  if (error || eSeries || eMetodos) return res.status(500).json({ error: 'No se pudieron cargar los ajustes' });

  res.json({
    ajustes,
    series,
    metodos,
    secciones: Object.entries(SECCIONES).map(([clave, s]) => ({ clave, etiqueta: s.etiqueta })),
  });
});

// PATCH /settings/:seccion — guarda una sección con su lista blanca.
router.patch('/settings/:seccion', PERMISO, async (req, res) => {
  const { seccion } = req.params;
  if (!esSeccion(seccion)) return res.status(404).json({ error: 'Esa sección de ajustes no existe' });

  const { antes, despues, error, invalido } = await servicio.guardarSeccion({
    nombre: seccion,
    cambios: req.body || {},
    actorId: req.user.id,
  });
  if (error) return res.status(invalido ? 400 : 500).json({ error });

  await auditar(req, { seccion, antes, despues });
  res.json({ valor: despues });
});

// PATCH /settings/numeracion/:tipo — prefijo, correlativo y relleno.
router.patch('/settings/numeracion/:tipo', PERMISO, async (req, res) => {
  const { tipo } = req.params;
  if (!TIPOS_DOCUMENTO.includes(tipo)) return res.status(404).json({ error: 'Tipo de documento desconocido' });

  const { antes, despues, error, invalido } = await servicio.guardarSerie({ tipo, cambios: req.body || {} });
  if (error) return res.status(invalido ? 400 : 500).json({ error });

  await auditar(req, { seccion: `numeracion.${tipo}`, antes, despues });
  res.json({ serie: despues });
});

// POST /settings/metodos — método de pago nuevo, sin desplegar código.
router.post('/settings/metodos', PERMISO, async (req, res) => {
  const { clave, nombre } = req.body || {};
  if (typeof nombre !== 'string' || nombre.trim() === '') return res.status(400).json({ error: 'El nombre es obligatorio' });
  const claveFinal = claveDesde(clave || nombre);
  if (!claveFinal) return res.status(400).json({ error: 'El nombre debe tener al menos una letra o número' });

  const { error } = await supabase
    .from('payment_methods')
    .insert({ clave: claveFinal, nombre: nombre.trim(), orden: 500 });
  if (error) {
    const repetido = /duplicate|unique/i.test(error.message);
    return res.status(repetido ? 400 : 500).json({ error: repetido ? 'Ya existe un método con ese nombre' : 'No se pudo crear el método' });
  }

  await auditar(req, { seccion: 'metodos_pago', antes: null, despues: { clave: claveFinal, nombre: nombre.trim(), activo: true } });
  res.status(201).json({ clave: claveFinal });
});

// PATCH /settings/metodos/:clave — activar o desactivar. Nunca se borra: un
// método con historial tiene que seguir explicando los pagos que ya existen.
router.patch('/settings/metodos/:clave', PERMISO, async (req, res) => {
  const activo = req.body?.activo;
  if (typeof activo !== 'boolean') return res.status(400).json({ error: 'Indica si el método queda activo o no' });

  const { metodos, error: eLeer } = await servicio.leerMetodos();
  if (eLeer) return res.status(500).json({ error: 'No se pudieron leer los métodos de pago' });
  const actual = metodos.find((m) => m.clave === req.params.clave);
  if (!actual) return res.status(404).json({ error: 'Ese método de pago no existe' });

  const activosRestantes = metodos.filter((m) => m.activo && m.clave !== actual.clave).length;
  if (!activo && activosRestantes === 0) {
    return res.status(400).json({ error: 'Debe quedar al menos un método de pago activo' });
  }

  const { error } = await supabase.from('payment_methods').update({ activo }).eq('clave', actual.clave);
  if (error) return res.status(500).json({ error: 'No se pudo actualizar el método' });

  await auditar(req, { seccion: 'metodos_pago', antes: { [actual.clave]: actual.activo }, despues: { [actual.clave]: activo } });
  res.json({ ok: true });
});

// GET /settings/auditoria — la bitácora del panel, filtrable por tipo de cambio.
// Solo lectura: es append-only y ahora lo impone un trigger.
//
// Antes estaba clavada en entidad='settings', así que los cambios de usuarios,
// roles, planes y cobros SE ESCRIBÍAN pero no se podían leer desde ninguna
// pantalla: una bitácora que solo se consulta entrando a la base no cumple su
// función. Ahora `entidad` es un filtro más, y por omisión se ven todos.
// Sin paginación: se devuelven los más recientes y se DICE que hay corte. Al
// dejar de filtrar por entidad='settings', el listado pasó a competir con los
// cobros del día, así que callarlo escondería cambios de configuración.
const TOPE = 100;

router.get('/settings/auditoria', 'audit.read', async (req, res) => {
  const { seccion, entidad, desde, hasta } = req.query;
  let consulta = supabase
    .from('admin_audit_log')
    .select('id, actor_email, accion, entidad, entidad_id, detalle, created_at')
    .order('created_at', { ascending: false })
    .limit(TOPE + 1);

  // Lista blanca: solo las entidades que este lector puede ver por la puerta
  // principal. Sin esto, abrir la bitácora la convertía en la puerta de atrás.
  consulta = consulta.in('entidad', entidadesVisiblesPara(await permisosDe(req)));
  if (entidad) consulta = consulta.eq('entidad', entidad);
  if (seccion) consulta = consulta.eq('entidad_id', seccion);
  // El día del negocio lo fija la sucursal, que es la misma zona con la que el
  // panel pinta la columna "Fecha y hora": con -05:00 clavado, el listado y su
  // propio filtro se contradecían en cuanto la sucursal no estaba en UTC-5.
  const { sucursal } = await leerSucursal();
  const zona = sucursal?.zona_horaria;
  if (desde) consulta = consulta.gte('created_at', inicioDelDia(desde, zona));
  if (hasta) consulta = consulta.lte('created_at', finDelDia(hasta, zona));

  const { data, error } = await consulta;
  if (error) return res.status(500).json({ error: 'No se pudo cargar la actividad' });
  const filas = data || [];
  res.json({ rows: filas.slice(0, TOPE), truncado: filas.length > TOPE, tope: TOPE });
});

module.exports = router;
