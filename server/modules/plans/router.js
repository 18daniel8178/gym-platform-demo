const { Router } = require('express');
const { supabase } = require('../../infrastructure/supabase');

// Caché en el Edge/CDN para datos públicos (Vercel respeta s-maxage)
const CACHE_PUBLIC = 'public, s-maxage=300, stale-while-revalidate=600';

const router = Router();

// Planes visibles al público: solo los activos (soft-delete).
router.get('/plans', async (_req, res) => {
  const { data, error } = await supabase
    .from('membership_plans')
    .select('*')
    .eq('activo', true)
    .order('precio');
  if (error) return res.status(500).json({ error: 'No se pudieron obtener los planes' });
  res.set('Cache-Control', CACHE_PUBLIC);
  res.json(data);
});

module.exports = router;
