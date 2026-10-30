const { crearRouterAdmin } = require('../../middleware/routerAdmin');
const { supabase } = require('../../infrastructure/supabase');
const { logAdminAction } = require('../admin/audit');
const { hoyPanama } = require('../memberships/service');
const { validarPerfilParcial } = require('./perfil');
const { ESTADOS_MIEMBRO, transicionesDesde } = require('./estado');
const { normalizarEtiquetas } = require('./etiquetas');
const { evaluarDuplicados } = require('./duplicados');
const { normalizarDocumento } = require('./normalizacion');
const { buscarCoincidencias, etiquetasEnUso } = require('./service');
const { permisosDe } = require('../../middleware/requirePermission');
const { estadoDeConsentimientos } = require('./consentimientos');
const { documentosVigentes, consentimientosDe, emailsDelPersonal } = require('./consentimientos.service');

// Listado, ficha y corrección de datos del socio. El alta presencial vive en
// alta.router.js y el estado y las etiquetas en gestion.router.js.

const router = crearRouterAdmin();

const CAP = 1000; // tope de perfiles a traer para filtrar/paginar en memoria (gym de una sede)

// Deriva el estado de la MEMBRESÍA de un socio respecto a hoy (no el del socio).
function estadoMembresia(m, hoy) {
  if (!m) return 'sin';
  return m.fecha_fin >= hoy ? 'activa' : 'vencida';
}

// Normaliza los parámetros de paginación del listado.
function leerPaginacion(query) {
  const page = Math.max(0, Number(query.page) || 0);
  const pageSize = Math.min(50, Math.max(1, Number(query.pageSize) || 20));
  return { page, pageSize };
}

// Filtros del listado. `miembro` es el estado del SOCIO; `estado`, el de su
// membresía: son independientes y se muestran con badges distintos (§13.7).
function leerFiltros(query) {
  const filtros = { q: (query.q || '').trim(), estado: query.estado || '', miembro: query.miembro || '', etiqueta: null };
  if (!query.etiqueta) return filtros;
  const n = normalizarEtiquetas([String(query.etiqueta)]);
  if (!n.ok || n.etiquetas.length !== 1) return { error: 'Etiqueta no válida' };
  return { ...filtros, etiqueta: n.etiquetas[0] };
}

// Sin estado de socio elegido quedan fuera los archivados: tienen su propia vista.
function filtrarPorSocio(query, { miembro, etiqueta }) {
  const porEstado = ESTADOS_MIEMBRO.includes(miembro)
    ? query.eq('estado_miembro', miembro)
    : query.neq('estado_miembro', 'archivado');
  return etiqueta ? porEstado.contains('etiquetas', [etiqueta]) : porEstado;
}

// Búsqueda por nombre, teléfono o documento; el documento también normalizado,
// así "8123456" encuentra a quien se registró como "8-123-456".
function filtrarPorBusqueda(query, q) {
  // Saneo: quita metacaracteres de PostgREST (, . ( ) : *) y comodines LIKE (% _ \)
  // para que un término con esos caracteres no rompa ni inyecte el filtro .or().
  const qSan = q.replace(/[%_,()\\*.:]/g, ' ').trim();
  if (!qSan) return query;
  const like = `%${qSan}%`;
  const filtros = [`nombre_completo.ilike.${like}`, `documento.ilike.${like}`, `telefono.ilike.${like}`];
  const doc = normalizarDocumento(q); // solo [A-Z0-9]: no puede inyectar nada
  if (doc) filtros.push(`documento_normalizado.like.%${doc}%`);
  return query.or(filtros.join(','));
}

// Proyección mínima: NO expone condiciones_medicas, contactos de emergencia ni
// documento completo.
function construirQueryPerfiles(filtros) {
  const base = supabase
    .from('profiles')
    .select('user_id, nombre_completo, telefono, created_at, firma_foto_pendiente, estado_miembro, etiquetas')
    .order('nombre_completo')
    .limit(CAP);
  return filtrarPorBusqueda(filtrarPorSocio(base, filtros), filtros.q);
}

// Membresías de esos socios (merge por user_id: no hay FK directa profiles↔memberships)
async function obtenerMembresiasPorId(ids) {
  if (ids.length === 0) return { memPorId: {} };
  const { data: mems, error } = await supabase
    .from('memberships')
    .select('user_id, fecha_fin, plan:membership_plans(nombre)')
    .in('user_id', ids);
  if (error) return { error };
  return { memPorId: Object.fromEntries((mems || []).map((m) => [m.user_id, m])) };
}

// Proyección de una fila del listado (sin datos sensibles).
function filaSocio(p, m, hoy) {
  return {
    user_id: p.user_id,
    nombre_completo: p.nombre_completo,
    telefono: p.telefono,
    firma_foto_pendiente: p.firma_foto_pendiente,
    estado_miembro: p.estado_miembro,
    etiquetas: p.etiquetas || [],
    plan: m?.plan?.nombre ?? null,
    fecha_fin: m?.fecha_fin ?? null,
    estado: estadoMembresia(m, hoy),
  };
}

// GET /members — listado con búsqueda y filtros; trae las etiquetas en uso para
// el desplegable del filtro (una consulta más, a esta escala no se nota).
router.get('/members', 'member.read', async (req, res) => {
  const filtros = leerFiltros(req.query);
  if (filtros.error) return res.status(400).json({ error: filtros.error });
  const { page, pageSize } = leerPaginacion(req.query);

  const { data: perfiles, error } = await construirQueryPerfiles(filtros);
  if (error) return res.status(500).json({ error: 'No se pudieron obtener los socios' });
  const truncado = (perfiles || []).length >= CAP; // se alcanzó el tope: puede haber más

  const ids = (perfiles || []).map((p) => p.user_id);
  const { memPorId, error: e2 } = await obtenerMembresiasPorId(ids);
  if (e2) return res.status(500).json({ error: 'No se pudieron obtener las membresías' });

  const hoy = hoyPanama();
  let filas = (perfiles || []).map((p) => filaSocio(p, memPorId[p.user_id], hoy));
  if (['activa', 'vencida', 'sin'].includes(filtros.estado)) {
    filas = filas.filter((f) => f.estado === filtros.estado);
  }

  const { data: etiquetas } = await etiquetasEnUso();
  const inicio = page * pageSize;
  return res.json({ total: filas.length, page, pageSize, truncado, rows: filas.slice(inicio, inicio + pageSize), etiquetas });
});

// Qué aceptó el socio, contra lo vigente hoy. El correo de quien lo capturó solo
// se resuelve para quien puede ver cuentas del personal, como en la bitácora.
async function consentimientosDeLaFicha(req, userId) {
  const [{ data: vigentes }, { data: aceptados }] = await Promise.all([
    documentosVigentes(),
    consentimientosDe(userId),
  ]);
  const permisos = await permisosDe(req);
  const emails = permisos.has('user.read')
    ? await emailsDelPersonal((aceptados || []).map((a) => a.registrado_por))
    : {};
  return estadoDeConsentimientos({ vigentes: vigentes || [], aceptados: aceptados || [], emails });
}

// GET /members/:userId — ficha completa (incluye datos sensibles bajo demanda).
router.get('/members/:userId', 'member.read', async (req, res) => {
  const userId = req.params.userId;
  const { data: perfil, error } = await supabase.from('profiles').select('*').eq('user_id', userId).maybeSingle();
  if (error) return res.status(500).json({ error: 'No se pudo leer el perfil' });
  if (!perfil) return res.status(404).json({ error: 'El socio no existe' });

  const { data: membresia } = await supabase
    .from('memberships')
    .select('*, plan:membership_plans(nombre, periodo, precio)')
    .eq('user_id', userId)
    .maybeSingle();
  const { data: pagos } = await supabase
    .from('payments')
    .select('id, monto, metodo, origen, estado, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(10);

  const estado = estadoMembresia(membresia, hoyPanama());
  return res.json({
    perfil,
    membresia: membresia ? { ...membresia, estado } : null,
    pagos: pagos || [],
    consentimientos: await consentimientosDeLaFicha(req, userId),
    // A qué estados puede pasar el socio, con su permiso: la ficha no copia la tabla.
    transiciones: transicionesDesde(perfil.estado_miembro),
  });
});

// Si la corrección CAMBIA el documento, avisa de posibles duplicados (§13.7), sin
// contar al propio socio. Reenviar el mismo documento no vuelve a preguntar: si
// no, un duplicado ya confirmado bloquearía cualquier corrección posterior.
async function revisarDocumento({ userId, datos, antes, confirmado }) {
  const nuevo = normalizarDocumento(datos.documento);
  if (!('documento' in datos) || nuevo === antes.documento_normalizado) return { confirmados: [] };
  const { data, error } = await buscarCoincidencias({ documento: datos.documento, excluir: userId });
  if (error) return { rechazo: { status: 500, body: { error: 'No se pudo comprobar si el documento ya existe' } } };
  const dup = evaluarDuplicados(data, { confirmado });
  if (dup.accion === 'rechazar') return { rechazo: { status: dup.status, body: dup.body } };
  return { confirmados: dup.confirmados };
}

// PATCH /members/:userId — corrige el perfil (lista blanca ampliada, auditado).
router.patch('/members/:userId', 'member.update', async (req, res) => {
  const userId = req.params.userId;
  const body = req.body || {};
  const { valido, error: vError, datos } = validarPerfilParcial(body);
  if (!valido) return res.status(400).json({ error: vError });

  const { data: antes, error: e0 } = await supabase.from('profiles').select('*').eq('user_id', userId).maybeSingle();
  if (e0) return res.status(500).json({ error: 'No se pudo leer el perfil' });
  if (!antes) return res.status(404).json({ error: 'El socio no existe' });

  const revision = await revisarDocumento({ userId, datos, antes, confirmado: body.confirmar_duplicado });
  if (revision.rechazo) return res.status(revision.rechazo.status).json(revision.rechazo.body);

  const { data, error } = await supabase.from('profiles').update(datos).eq('user_id', userId).select('*').single();
  if (error) return res.status(500).json({ error: 'No se pudo actualizar el perfil' });

  const detalle = { antes, despues: datos }; // condiciones_medicas se redacta en audit.js
  if (revision.confirmados.length) detalle.duplicado_confirmado = revision.confirmados;
  await logAdminAction(req.user, { accion: 'client.update', entidad: 'profiles', entidadId: userId, detalle });
  return res.json(data);
});

// POST /members/:userId/firma-foto — marca firma/foto completada (cola del dashboard).
router.post('/members/:userId/firma-foto', 'member.update', async (req, res) => {
  const userId = req.params.userId;
  const { data: antes, error: e0 } = await supabase
    .from('profiles')
    .select('user_id, firma_foto_pendiente')
    .eq('user_id', userId)
    .maybeSingle();
  if (e0) return res.status(500).json({ error: 'No se pudo leer el perfil' });
  if (!antes) return res.status(404).json({ error: 'El socio no existe' });
  if (antes.firma_foto_pendiente === false) return res.json({ ok: true }); // idempotente

  const { error } = await supabase.from('profiles').update({ firma_foto_pendiente: false }).eq('user_id', userId);
  if (error) return res.status(500).json({ error: 'No se pudo actualizar el perfil' });

  await logAdminAction(req.user, {
    accion: 'profile.firma_foto',
    entidad: 'profiles',
    entidadId: userId,
    detalle: { antes: { firma_foto_pendiente: antes.firma_foto_pendiente }, despues: { firma_foto_pendiente: false } },
  });
  return res.json({ ok: true });
});

module.exports = router;
