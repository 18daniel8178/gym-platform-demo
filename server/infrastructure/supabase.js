const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || SUPABASE_URL.includes('TU-PROYECTO') || !SERVICE_KEY || SERVICE_KEY.includes('xxxx')) {
  console.warn('⚠  Supabase no está configurado. Completa server/.env con SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.');
}

// Único punto del server donde se crea el cliente de Supabase (service role key)
const supabase = createClient(SUPABASE_URL || 'http://localhost', SERVICE_KEY || 'sin-clave');

module.exports = { supabase };
