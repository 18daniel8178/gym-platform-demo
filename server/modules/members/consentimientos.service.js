const { supabase } = require('../../infrastructure/supabase');
const { vigentesDe, agruparVersiones } = require('./consentimientos');

// Acceso a datos de los documentos de consentimiento y de lo que aceptó cada
// socio (§13.7). Las filas de member_consents son de SOLO AGREGAR —un trigger lo
// impone en la base—, así que aquí no hay ningún update ni delete sobre ellas:
// una aceptación nueva es una fila nueva y la anterior queda tal como se firmó.

const CAMPOS_DOC = 'id, codigo, version, titulo, texto, obligatorio, publicado_en';

// La vigente de cada documento es la de versión más alta; la reducción es pura.
async function documentosVigentes() {
  const { data, error } = await supabase.from('consent_documents').select(CAMPOS_DOC);
  return { data: vigentesDe(data), error };
}

// Lo que aceptó un socio, con la versión del documento que aceptó entonces.
async function consentimientosDe(userId) {
  const { data, error } = await supabase
    .from('member_consents')
    .select('aceptado_en, medio, evidencia, registrado_por, documento:consent_documents(codigo, version, titulo)')
    .eq('user_id', userId)
    .order('aceptado_en', { ascending: false });
  return { data: data || [], error };
}

// Registra una aceptación de la versión VIGENTE del documento. Devuelve la fila
// insertada; si el documento no existe, lo dice sin tocar la base.
async function registrarAceptacion({ userId, codigo, medio, evidencia, registradoPor }) {
  const { data: vigentes, error: eDocs } = await documentosVigentes();
  if (eDocs) return { data: null, error: eDocs };
  const documento = vigentes.find((d) => d.codigo === codigo);
  if (!documento) return { data: null, error: null, desconocido: true };

  const { data, error } = await supabase
    .from('member_consents')
    .insert({ user_id: userId, documento_id: documento.id, medio, evidencia, registrado_por: registradoPor })
    .select('aceptado_en')
    .single();
  return { data: data && { ...data, codigo, version: documento.version }, error };
}

// Correo de quien capturó cada aceptación, para la ficha. Una sola consulta por
// ficha, y solo se pide para quien puede ver cuentas del personal (user.read).
async function emailsDelPersonal(ids) {
  const buscados = new Set((ids || []).filter(Boolean));
  if (!buscados.size) return {};
  const { data } = await supabase.rpc('staff_users');
  return Object.fromEntries((data || []).filter((u) => buscados.has(u.id)).map((u) => [u.id, u.email]));
}

// Todas las versiones de cada documento, de la más nueva a la más vieja, con
// cuántos socios aceptaron cada una: con una sola aceptación la versión queda
// congelada (trigger consent_documents_congelada) y ya no se puede corregir.
async function documentosConHistorial() {
  const { data, error } = await supabase
    .from('consent_documents')
    .select(`${CAMPOS_DOC}, publicado_por, aceptaciones:member_consents(count)`)
    .order('codigo')
    .order('version', { ascending: false });
  if (error) return { data: null, error };
  return { data: agruparVersiones((data || []).map(conAceptaciones)), error: null };
}

function conAceptaciones({ aceptaciones, ...doc }) {
  const total = aceptaciones?.[0]?.count ?? 0;
  return { ...doc, aceptaciones: total, editable: total === 0 };
}

// Publica una versión nueva de un documento: la siguiente de la vigente. El
// único (codigo, version) de la base decide si dos publican a la vez.
async function publicarVersion({ codigo, titulo, texto, publicadoPor }) {
  const { data: vigentes, error: eDocs } = await documentosVigentes();
  if (eDocs) return { data: null, error: eDocs };
  const actual = vigentes.find((d) => d.codigo === codigo);
  if (!actual) return { data: null, error: null, desconocido: true };

  const { data, error } = await supabase
    .from('consent_documents')
    .insert({ codigo, version: actual.version + 1, titulo, texto, obligatorio: actual.obligatorio, publicado_por: publicadoPor })
    .select(CAMPOS_DOC)
    .single();
  return { data, error };
}

// Corrige el título o el texto de una versión que nadie aceptó todavía. Si
// alguien ya la aceptó, el trigger de la base rechaza el update.
async function corregirVersion({ id, titulo, texto }) {
  const { data, error } = await supabase
    .from('consent_documents')
    .update({ titulo, texto })
    .eq('id', id)
    .select(CAMPOS_DOC)
    .maybeSingle();
  return { data, error };
}

module.exports = {
  documentosVigentes,
  consentimientosDe,
  emailsDelPersonal,
  registrarAceptacion,
  documentosConHistorial,
  publicarVersion,
  corregirVersion,
};
