import { supabase } from '../supabaseClient.js'

// Demo local: entrada de un clic sin contraseña. El server
// solo expone /api/demo en modo demo y contra un Supabase local; aquí se pide
// el token de un enlace mágico y se canjea con verifyOtp. AuthContext escucha
// los cambios de sesión, así que la recoge sin tocarlo.

export async function cuentasDemo() {
  try {
    const r = await fetch('/api/demo/cuentas')
    return r.ok ? await r.json() : []
  } catch {
    return []
  }
}

export async function entrarComo(clave) {
  let r
  try {
    r = await fetch('/api/demo/entrar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cuenta: clave }),
    })
  } catch {
    return { error: 'Sin conexión con la API de la demo' }
  }
  const body = await r.json().catch(() => null)
  if (!r.ok) return { error: body?.error || 'No se pudo entrar a la demo' }
  const { error } = await supabase.auth.verifyOtp({ token_hash: body.token_hash, type: body.tipo })
  return { error: error ? error.message : null }
}
