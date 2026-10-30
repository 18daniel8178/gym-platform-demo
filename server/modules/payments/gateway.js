/**
 * Puerto PaymentGateway — contrato común para procesar un pago de membresía.
 *
 * Toda implementación debe respetar el mismo contrato (Liskov):
 * - El rechazo de un pago es un resultado (`{ ok: false, error }`), nunca una excepción.
 * - Solo los fallos de infraestructura (red, configuración) pueden lanzar.
 *
 * @typedef {Object} ChargeInput
 * @property {string} userId  Id del usuario autenticado (Supabase auth).
 * @property {Object} plan    Fila de `membership_plans` (id, nombre, precio, periodo, …).
 * @property {string} metodo  'tarjeta' | 'yappy' | 'transferencia' | 'efectivo'.
 *
 * @typedef {{ ok: true, reference: string } | { ok: false, error: string }} ChargeResult
 *
 * @typedef {Object} PaymentGateway
 * @property {(input: ChargeInput) => Promise<ChargeResult>} charge
 */

const { simulatedGateway } = require('./simulated.gateway');

/**
 * Composición en un solo lugar: aquí se decide qué pasarela usa la app.
 * Integrar una pasarela real = nuevo archivo `<proveedor>.gateway.js` + cambiar este return.
 * @returns {PaymentGateway}
 */
function getGateway() {
  return simulatedGateway;
}

module.exports = { getGateway };
