const { crearRouterAdmin } = require('../../middleware/routerAdmin');
const { supabase } = require('../../infrastructure/supabase');
const { logAdminAction } = require('../admin/audit');
const { validarPlan } = require('./service');

const router = crearRouterAdmin();

// Todos los planes (incluidos los archivados). Solo admin.
router.get('/plans', 'plan.read', async (_req, res) => {
  const { data, error } = await supabase
    .from('membership_plans')
    .select('*')
    .order('activo', { ascending: false })
    .order('precio');
  if (error) return res.status(500).json({ error: 'No se pudieron obtener los planes' });
  res.json(data);
});

// Crear plan.
router.post('/plans', 'plan.create', async (req, res) => {
  const { valido, error: vError, datos } = validarPlan(req.body || {});
  if (!valido) return res.status(400).json({ error: vError });

  const { data, error } = await supabase.from('membership_plans').insert(datos).select('*').single();
  if (error) return res.status(500).json({ error: 'No se pudo crear el plan' });

  await logAdminAction(req.user, {
    accion: 'plan.create',
    entidad: 'membership_plans',
    entidadId: data.id,
    detalle: { despues: datos },
  });
  res.status(201).json(data);
});

// Editar plan (incluye activo = archivar/reactivar y destacado). No existe DELETE.
router.patch('/plans/:id', 'plan.update', async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: 'Id inválido' });

  const { valido, error: vError, datos } = validarPlan(req.body || {}, { parcial: true });
  if (!valido) return res.status(400).json({ error: vError });

  const { data: antes, error: e0 } = await supabase
    .from('membership_plans')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (e0) return res.status(500).json({ error: 'No se pudo leer el plan' });
  if (!antes) return res.status(404).json({ error: 'El plan no existe' });

  const { data, error } = await supabase
    .from('membership_plans')
    .update(datos)
    .eq('id', id)
    .select('*')
    .single();
  if (error) return res.status(500).json({ error: 'No se pudo actualizar el plan' });

  await logAdminAction(req.user, {
    accion: 'plan.update',
    entidad: 'membership_plans',
    entidadId: id,
    detalle: { antes, despues: datos },
  });
  res.json(data);
});

module.exports = router;
