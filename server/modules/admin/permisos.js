// Catálogo único de los permisos `recurso.accion` del backoffice.
//
// Es la ÚNICA lista válida: el seed de la migración, los guards de los endpoints
// y las comprobaciones del cliente se validan contra ella (permisos.test.js).
// Antes los strings vivían sueltos en los tres sitios y una errata no fallaba en
// ninguno: el endpoint quedaba inalcanzable o el botón desaparecía en silencio.
//
// Muchos permisos se siembran ya aunque su módulo llegue en un bloque posterior
// (POS, caja, check-in, facturación): así los roles no hay que re-migrarlos.
const CATALOGO = Object.freeze([
  // Panel e informes
  'audit.read',
  'dashboard.read',
  'report.read',

  // Caja
  'cash.close',
  'cash.movement',
  'cash.open',
  'cash.review',

  // Control de acceso
  'checkin.override',
  'checkin.perform',
  'checkin.read',

  // Productos e inventario
  'inventory.adjust',
  'product.manage',
  'product.read',

  // Facturación
  'invoice.read',

  // Socios
  'member.archive',
  'member.consent',
  'member.create',
  'member.import',
  'member.read',
  'member.update',

  // Membresías
  'membership.adjust',
  'membership.collect',
  'membership.read',

  // Cobros y pagos
  'payment.create',
  'payment.export',
  'payment.read',
  'payment.refund',
  'payment.void',

  // Planes
  'plan.create',
  'plan.read',
  'plan.update',

  // Punto de venta
  'pos.return',
  'pos.sell',

  // Equipo y accesos
  'session.manage',
  'user.manage',
  'user.read',

  // Configuración
  'settings.read',
  'settings.update',
]);

const VALIDOS = new Set(CATALOGO);

// Falla al construir el router, no en producción: un permiso mal escrito en un
// requirePermission dejaría el endpoint inalcanzable para cualquier cuenta.
function validarPermiso(permiso) {
  if (!VALIDOS.has(permiso)) {
    throw new Error(
      `Permiso desconocido: ${permiso}. Añádelo al catálogo y al seed de la migración.`
    );
  }
  return permiso;
}

module.exports = { CATALOGO, validarPermiso };
