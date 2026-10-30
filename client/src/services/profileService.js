import { supabase, supabaseConfigured } from '../supabaseClient.js'

// Acceso a la tabla `profiles` (RLS: fila propia). Único punto del cliente
// que consulta esta tabla; las páginas no importan supabaseClient directamente.

export const profilesEnabled = supabaseConfigured

// Perfil del usuario con sesión activa (RLS limita a su propia fila)
export async function getProfile() {
  if (!supabaseConfigured) return { data: null, error: null }
  return supabase.from('profiles').select('user_id, nombre_completo, created_at').maybeSingle()
}

// Crea el perfil del usuario; `perfil` usa los nombres de columna de la tabla
export async function createProfile(userId, perfil) {
  const { error } = await supabase.from('profiles').insert({ user_id: userId, ...perfil })
  return error
}
