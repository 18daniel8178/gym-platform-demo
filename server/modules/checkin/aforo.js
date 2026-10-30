const { supabase } = require('../../infrastructure/supabase');
const { leerSucursal } = require('../branches/service');
const { inicioDelDia } = require('../branches/zona');

// Aforo actual (Fase 1 · Bloque 6). Antes era un número que el personal tecleaba
// y que nadie podía conciliar con nada. Ahora sale de las ENTRADAS permitidas del
// día (sin las anuladas) más una corrección manual del propio día: el personal
// sigue pudiendo decir "ahora mismo hay nueve" cuando ve salir gente, pero esa
// corrección caduca con el día y queda auditada.

const calcularAforo = ({ entradas, ajuste, ajusteFecha, hoy }) =>
  Math.max(0, entradas + (ajusteFecha === hoy ? ajuste || 0 : 0));

// El personal dice el total que ve; se guarda la diferencia contra lo contado.
const correccionPara = ({ objetivo, entradas }) => objetivo - entradas;

// Hoy y el inicio del día EN LA SUCURSAL: el día del negocio no es el del
// servidor, que en Vercel y en el CI corre en UTC.
async function diaDeLaSucursal() {
  const { sucursal } = await leerSucursal();
  const zona = sucursal?.zona_horaria || 'America/Panama';
  const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: zona }).format(new Date());
  return { hoy, desde: inicioDelDia(hoy, zona), branchId: sucursal?.id };
}

// Entradas permitidas de hoy, sin las anuladas: es exactamente lo que suma al
// aforo, y lo que el historial del día tiene que poder conciliar.
async function entradasDeHoy({ desde, branchId }) {
  let consulta = supabase
    .from('checkins')
    .select('id', { count: 'exact', head: true })
    .eq('resultado', 'permitido')
    .is('anulado_en', null)
    .gte('ocurrido_en', desde);
  if (branchId) consulta = consulta.eq('branch_id', branchId);
  const { count, error } = await consulta;
  return { entradas: count || 0, error };
}

async function leerOcupacion() {
  return supabase.from('occupancy').select('ajuste, ajuste_fecha, max_capacity, updated_at').eq('id', 1).maybeSingle();
}

// Lo que leen la web pública, el dashboard y la pantalla de check-in.
async function aforoActual() {
  const [{ data: fila, error: eFila }, dia] = await Promise.all([leerOcupacion(), diaDeLaSucursal()]);
  if (eFila) return { error: eFila };
  if (!fila) return { error: new Error('no hay fila de aforo') };

  const { entradas, error } = await entradasDeHoy(dia);
  if (error) return { error };

  return {
    aforo: {
      current_count: calcularAforo({ entradas, ajuste: fila.ajuste, ajusteFecha: fila.ajuste_fecha, hoy: dia.hoy }),
      max_capacity: fila.max_capacity,
      entradas_hoy: entradas,
      updated_at: fila.updated_at,
    },
  };
}

// Corrección manual: se guarda la diferencia contra lo contado, con su fecha.
async function fijarAforo({ objetivo, maxCapacity }) {
  const dia = await diaDeLaSucursal();
  const { entradas, error } = await entradasDeHoy(dia);
  if (error) return { error };

  const { data, error: eUpdate } = await supabase
    .from('occupancy')
    .update({
      ajuste: correccionPara({ objetivo, entradas }),
      ajuste_fecha: dia.hoy,
      max_capacity: maxCapacity,
      updated_at: new Date().toISOString(),
    })
    .eq('id', 1)
    .select('ajuste, ajuste_fecha, max_capacity')
    .maybeSingle();
  if (eUpdate) return { error: eUpdate };
  return { guardado: { ...data, current_count: Math.max(0, objetivo), entradas_hoy: entradas } };
}

module.exports = { calcularAforo, correccionPara, aforoActual, fijarAforo };
