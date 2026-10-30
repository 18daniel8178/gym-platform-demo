const { supabase } = require('../../infrastructure/supabase');

// Los métodos de pago dejaron de vivir aquí: son datos configurables desde el
// panel (tabla payment_methods, módulo settings). Registrar exige uno ACTIVO;
// filtrar el historial acepta cualquiera CONOCIDO, o los pagos hechos con un
// método ya retirado desaparecerían del informe.
const DEDUP_MS = 20000; // ventana anti doble-cobro para pagos de recepción

// Busca un cobro de recepción idéntico registrado hace instantes (reintento,
// doble submit). Devuelve el pago duplicado o null si no lo hay.
async function buscarDuplicadoRecepcion({ userId, nombreCliente, monto, metodo }) {
  const desde = new Date(Date.now() - DEDUP_MS).toISOString();
  let dq = supabase
    .from('payments')
    .select('id')
    .eq('origen', 'recepcion')
    .eq('estado', 'aprobado')
    .eq('monto', monto)
    .eq('metodo', metodo)
    .gte('created_at', desde)
    .limit(1);
  dq = userId ? dq.eq('user_id', userId) : dq.eq('nombre_cliente', nombreCliente);
  const { data: dup } = await dq;
  return dup && dup.length ? dup[0] : null;
}

// Único punto de inserción de pagos: lo consumen el checkout online y el cobro
// en recepción. El monto es SNAPSHOT del precio al momento del cobro.
//   origen: 'checkout_simulado' (pago simulado, no infla ingresos reales) | 'recepcion'
//   userId null + nombreCliente: pase diario a un visitante sin cuenta
//   registradoPor: staff que cobró en recepción (null en el checkout online)
// Devuelve { data:{id}, error, duplicado? }. Para 'recepcion' deduplica cobros
// idénticos muy recientes (reintento, doble submit) para no cobrar dos veces.
async function registrarPago({
  userId = null,
  nombreCliente = null,
  planId = null,
  monto,
  metodo = null,
  origen,
  referencia = null,
  registradoPor = null,
}) {
  if (origen === 'recepcion') {
    const dup = await buscarDuplicadoRecepcion({ userId, nombreCliente, monto, metodo });
    if (dup) return { data: dup, error: null, duplicado: true };
  }

  const { data, error } = await supabase
    .from('payments')
    .insert({
      user_id: userId,
      nombre_cliente: nombreCliente,
      plan_id: planId,
      monto,
      metodo,
      origen,
      referencia,
      registrado_por: registradoPor,
    })
    .select('id')
    .single();
  return { data, error };
}

// Anula un pago (para compensación interna). Compare-and-swap sobre estado.
async function anularPagoInterno(id, motivo) {
  return supabase.from('payments').update({ estado: 'anulado', motivo_anulacion: motivo }).eq('id', id).eq('estado', 'aprobado');
}

module.exports = { registrarPago, anularPagoInterno };
