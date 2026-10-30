const { crearRouterAdmin } = require('../../middleware/routerAdmin');
const { logAdminAction } = require('../admin/audit');
const { leerVersionDocumento } = require('./consentimientos');
const {
  documentosVigentes, documentosConHistorial, registrarAceptacion, publicarVersion, corregirVersion,
} = require('./consentimientos.service');

// Documentos de consentimiento y su captura (§13.7). En la base hay una fila por
// VERSIÓN: el alta y la ficha usan la vigente de cada documento, y el dueño
// publica versiones nuevas desde Ajustes. Lo aceptado no se corrige jamás —una
// aceptación nueva es otra fila—, así que aquí solo se agrega.

const router = crearRouterAdmin();

// Quien lo captura es personal que ve firmar al socio delante suyo.
const EVIDENCIA_FICHA = 'Aceptado ante el personal y registrado desde la ficha';
const CONGELADA = '42501'; // el trigger de la base rechaza tocar una versión ya aceptada

// GET /consent-documents — los vigentes, para las casillas del alta.
router.get('/consent-documents', 'member.read', async (_req, res) => {
  const { data, error } = await documentosVigentes();
  if (error) return res.status(500).json({ error: 'No se pudieron leer los documentos de consentimiento' });
  return res.json(data);
});

// GET /consent-documents/historial — todas las versiones, para Ajustes: cuántos
// las aceptaron y si todavía se pueden corregir.
router.get('/consent-documents/historial', 'settings.update', async (_req, res) => {
  const { data, error } = await documentosConHistorial();
  if (error) return res.status(500).json({ error: 'No se pudo leer el historial de documentos' });
  return res.json(data);
});

// POST /members/:userId/consentimientos — registra que el socio aceptó la versión
// VIGENTE del documento, hoy y ante quien lo captura. No toca lo aceptado antes.
router.post('/members/:userId/consentimientos', 'member.consent', async (req, res) => {
  const { userId } = req.params;
  const codigo = typeof req.body?.codigo === 'string' ? req.body.codigo.trim() : '';
  if (!codigo) return res.status(400).json({ error: 'Indica qué documento aceptó el socio' });

  const { data, error, desconocido } = await registrarAceptacion({
    userId, codigo, medio: 'mostrador', evidencia: EVIDENCIA_FICHA, registradoPor: req.user.id,
  });
  if (desconocido) return res.status(404).json({ error: 'Ese documento de consentimiento no existe' });
  if (error?.code === '23503') return res.status(404).json({ error: 'El socio no existe' });
  if (error) return res.status(500).json({ error: 'No se pudo registrar el consentimiento' });

  await logAdminAction(req.user, {
    accion: 'member.consent',
    entidad: 'member_consents',
    entidadId: userId,
    detalle: { codigo, version: data.version },
  });
  return res.status(201).json(data);
});

// POST /consent-documents — publica la versión siguiente de un documento. La
// anterior se queda donde está: los socios que la aceptaron, también.
router.post('/consent-documents', 'settings.update', async (req, res) => {
  const codigo = typeof req.body?.codigo === 'string' ? req.body.codigo.trim() : '';
  const leido = leerVersionDocumento(req.body);
  if (!leido.ok) return res.status(400).json({ error: leido.error });

  const { data, error, desconocido } = await publicarVersion({ codigo, ...leido.datos, publicadoPor: req.user.id });
  if (desconocido) return res.status(404).json({ error: 'Ese documento de consentimiento no existe' });
  if (error?.code === '23505') {
    return res.status(409).json({ error: 'Alguien publicó una versión mientras tanto: recarga y vuelve a intentarlo' });
  }
  if (error) return res.status(500).json({ error: 'No se pudo publicar la versión' });

  await logAdminAction(req.user, {
    accion: 'consent.publish',
    entidad: 'consent_documents',
    entidadId: data.id,
    detalle: { codigo: data.codigo, version: data.version, titulo: data.titulo },
  });
  return res.status(201).json(data);
});

// PATCH /consent-documents/:id — corrige una versión que nadie aceptó todavía.
// En cuanto alguien la acepta queda congelada y solo cabe publicar otra.
router.patch('/consent-documents/:id', 'settings.update', async (req, res) => {
  const leido = leerVersionDocumento(req.body);
  if (!leido.ok) return res.status(400).json({ error: leido.error });

  const { data, error } = await corregirVersion({ id: req.params.id, ...leido.datos });
  if (error?.code === CONGELADA) {
    return res.status(409).json({ error: 'Esa versión ya fue aceptada por alguien: publica una versión nueva' });
  }
  if (error) return res.status(500).json({ error: 'No se pudo corregir el documento' });
  if (!data) return res.status(404).json({ error: 'Esa versión del documento no existe' });

  await logAdminAction(req.user, {
    accion: 'consent.update',
    entidad: 'consent_documents',
    entidadId: data.id,
    detalle: { codigo: data.codigo, version: data.version, titulo: data.titulo },
  });
  return res.json(data);
});

module.exports = router;
