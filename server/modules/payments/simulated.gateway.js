// Pasarela simulada: aprueba cualquier pago sin conectarse a ningún banco.
// Cumple el contrato del puerto PaymentGateway (ver gateway.js).
const simulatedGateway = {
  async charge(_input) {
    return { ok: true, reference: `sim-${Date.now()}` };
  },
};

module.exports = { simulatedGateway };
