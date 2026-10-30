const { supabase } = require('../infrastructure/supabase');

// Valida el JWT de Supabase enviado como "Authorization: Bearer <token>"
async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'No autorizado' });
  }
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    return res.status(401).json({ error: 'No autorizado' });
  }
  req.user = data.user;
  next();
}

module.exports = { requireAuth };
