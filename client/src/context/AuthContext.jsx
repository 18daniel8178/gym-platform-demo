import { createContext, useContext, useEffect, useState } from 'react'
import { supabase, supabaseConfigured } from '../supabaseClient.js'

const AuthContext = createContext(null)

// ¿Esta cuenta tiene acceso al backoffice? Lo decide el SERVER: el personal no
// lleva marca alguna en su JWT, así que derivarlo de app_metadata dejaba el
// enlace «Admin» oculto para gerentes y recepción, que sí pueden entrar.
// Solo es UX: el panel y cada endpoint revalidan permisos de todas formas.
function useAccesoPanel(session) {
  const [acceso, setAcceso] = useState(false)
  const token = session?.access_token

  useEffect(() => {
    if (!token) {
      setAcceso(false)
      return undefined
    }
    let vivo = true
    fetch('/api/admin/me', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => vivo && setAcceso(r.ok))
      .catch(() => vivo && setAcceso(false))
    return () => {
      vivo = false
    }
  }, [token])

  return acceso
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!supabaseConfigured) {
      setLoading(false)
      return
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  const login = (email, password) => supabase.auth.signInWithPassword({ email, password })
  const register = (email, password) => supabase.auth.signUp({ email, password })
  const logout = () => supabase.auth.signOut()

  const user = session?.user ?? null
  const accesoPanel = useAccesoPanel(session)

  return (
    <AuthContext.Provider
      value={{ session, user, loading, accesoPanel, login, register, logout, configured: supabaseConfigured }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
