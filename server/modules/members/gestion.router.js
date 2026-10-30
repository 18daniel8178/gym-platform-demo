const { crearRouterAdmin } = require('../../middleware/routerAdmin');
const { permisosDe } = require('../../middleware/requirePermission');
const { logAdminAction } = require('../admin/audit');
const { validarTransicion } = require('./estado');
const { normalizarEtiquetas } = require('./etiquetas');
const { leerEstado, aplicarEstado, guardarEtiquetas } = require('./service');

// Gestión del expediente del socio (§13.7): su estado, sus etiquetas y la regla
// de que un socio no se borra. Los datos personales se corrigen en admin.router.

const router = crearRouterAdmin();

const MSG_SENSIBLE = 'Bloquear, archivar o deshacerlo lo decide gerencia';

// Lee al socio o responde 404/500. Devuelve null si ya respondió.
async function socioOResponder(res, userId) {
  const { data, error } = await leerEstado(userId);
  if (error) res.status(500).json({ error: 'No se pudo leer el socio' });
  else if (!data) res.status(404).json({ error: 'El socio no existe' });
  return error ? null : data;
}

// POST /members/:userId/estado — la ruta exige member.update; bloquear, archivar
// y deshacerlos exigen además member.archive. Eso lo decide la máquina de
// estados (estado.js), no la ruta: así no hacen falta cuatro endpoints.
router.post('/members/:userId/estado', 'member.update', async (req, res) => {
  const { userId } = req.params;
  const body = req.body || {};
  const socio = await socioOResponder(res, userId);
  if (!socio) return undefined;

  const t = validarTransicion({ de: socio.estado_miembro, a: body.estado, motivo: body.motivo });
  if (!t.ok) return res.status(t.status).json({ error: t.error });
  const permisos = await permisosDe(req);
  if (!permisos.has(t.permiso)) return res.status(403).json({ error: MSG_SENSIBLE });

  const { cambiado, error } = await aplicarEstado({ userId, de: socio.estado_miembro, a: body.estado, motivo: t.motivo });
  if (error) return res.status(500).json({ error: 'No se pudo cambiar el estado' });
  if (!cambiado) return res.status(409).json({ error: 'El estado del socio cambió mientras tanto: recarga la ficha' });

  await logAdminAction(req.user, {
    accion: 'member.estado',
    entidad: 'profiles',
    entidadId: userId,
    detalle: {
      antes: { estado_miembro: socio.estado_miembro, estado_motivo: socio.estado_motivo },
      despues: { estado_miembro: body.estado, estado_motivo: t.motivo },
    },
  });
  return res.json({ estado_miembro: body.estado, estado_motivo: t.motivo });
});

const mismasEtiquetas = (a, b) => a.length === b.length && a.every((e, i) => e === b[i]);

// PUT /members/:userId/etiquetas — reemplaza la lista entera: el diff auditado
// muestra de una vez lo que se asignó y lo que se quitó.
router.put('/members/:userId/etiquetas', 'member.update', async (req, res) => {
  const { userId } = req.params;
  const n = normalizarEtiquetas((req.body || {}).etiquetas);
  if (!n.ok) return res.status(n.status).json({ error: n.error });

  const socio = await socioOResponder(res, userId);
  if (!socio) return undefined;
  if (mismasEtiquetas(socio.etiquetas || [], n.etiquetas)) return res.json({ etiquetas: n.etiquetas });

  const { error } = await guardarEtiquetas(userId, n.etiquetas);
  if (error) return res.status(500).json({ error: 'No se pudieron guardar las etiquetas' });

  await logAdminAction(req.user, {
    accion: 'member.etiquetas',
    entidad: 'profiles',
    entidadId: userId,
    detalle: { antes: { etiquetas: socio.etiquetas || [] }, despues: { etiquetas: n.etiquetas } },
  });
  return res.json({ etiquetas: n.etiquetas });
});

// DELETE /members/:userId — los socios no se borran (§13.7): se archivan. La
// base lo impide de todas formas (guardas en auth.users y profiles); esta ruta
// existe para que quien lo intente reciba el porqué y la alternativa.
router.delete('/members/:userId', 'member.archive', (_req, res) => {
  res.status(409).json({
    error:
      'Los socios no se eliminan: archívalo para retirarlo de la operación. Su historial, sus pagos y sus consentimientos se conservan.',
    alternativa: 'archivar',
  });
});

module.exports = router;
