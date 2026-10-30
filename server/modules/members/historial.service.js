const { supabase } = require('../../infrastructure/supabase');
const { consentimientosDe } = require('./consentimientos.service');

// Las fuentes del expediente, cada una de su tabla. La bitácora guarda los
// eventos del socio bajo su propio id (perfil, membresías); los pagos NO —se
// auditan con el id del pago—, así que salen de `payments`.

// Por fuente, no del total: la línea de tiempo recorta después al tope.
const LIMITE = 80;
const ENTIDADES = ['profiles', 'memberships'];

const dato = ({ data, error }) => (error ? { error } : { data: data || [] });

async function fuentesDelExpediente(userId) {
  const [perfil, auditoria, pagos, consentimientos, notas] = await Promise.all([
    supabase.from('profiles').select('created_at, origen').eq('user_id', userId).maybeSingle(),
    supabase.from('admin_audit_log').select('accion, created_at, actor_email, detalle')
      .eq('entidad_id', userId).in('entidad', ENTIDADES)
      .order('created_at', { ascending: false }).limit(LIMITE),
    supabase.from('payments').select('id, created_at, monto, metodo, origen, estado, motivo_anulacion')
      .eq('user_id', userId).order('created_at', { ascending: false }).limit(LIMITE),
    consentimientosDe(userId),
    supabase.from('member_notes').select('created_at, texto, autor_email')
      .eq('user_id', userId).order('created_at', { ascending: false }).limit(LIMITE),
  ]);

  const partes = [auditoria, pagos, consentimientos, notas].map(dato);
  const fallo = [perfil, ...partes].find((p) => p.error);
  if (fallo) return { error: fallo.error };

  const [a, p, c, n] = partes.map((x) => x.data);
  return { fuentes: { perfil: perfil.data, auditoria: a, pagos: p, consentimientos: c, notas: n } };
}

module.exports = { fuentesDelExpediente };
