import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { createProfile, getProfile, profilesEnabled } from '../services/profileService.js'
import { FormularioIngreso, PantallaExito, PantallaYaRegistrado } from './JoinSections.jsx'
import { CAMPOS_INICIALES, construirPerfil, crearCuentaSiFalta, validarFormulario } from './joinLogic.js'

// Hook: estados del envío (validar → crear cuenta si falta → guardar perfil)
function useEnvioJoin({ f, mode, register, session }) {
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(false)
  const [accountCreated, setAccountCreated] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!profilesEnabled) {
      setError('Supabase no está configurado.')
      return
    }
    const msgForm = validarFormulario(f)
    if (msgForm) {
      setError(msgForm)
      return
    }
    setSending(true)
    const cuenta = await crearCuentaSiFalta({ f, register, session, mode, accountCreated })
    if (cuenta.error) {
      setError(cuenta.error)
      setSending(false)
      return
    }
    if (cuenta.esNueva) setAccountCreated(true)
    const err = await createProfile(cuenta.userId, construirPerfil(f))
    setSending(false)
    if (err) {
      setError('Tu cuenta está lista pero no pudimos guardar tus datos. Pulsa "Enviar" de nuevo para reintentar.')
      return
    }
    setDone(true)
  }

  return { error, sending, done, accountCreated, handleSubmit }
}

export default function Join() {
  const { session, register } = useAuth()
  const [f, setF] = useState(CAMPOS_INICIALES)
  // 'full' = cuenta + datos | 'complete' = ya hay sesión, solo faltan datos | 'exists' = ya tiene perfil
  const [mode, setMode] = useState(session ? 'checking' : 'full')
  const { error, sending, done, accountCreated, handleSubmit } = useEnvioJoin({ f, mode, register, session })

  useEffect(() => {
    if (!session || !profilesEnabled) return
    getProfile().then(({ data }) => setMode(data ? 'exists' : 'complete'))
  }, [session])

  const set = (campo) => (e) => setF((prev) => ({ ...prev, [campo]: e.target.value }))

  if (done) return <PantallaExito />

  if (mode === 'checking') return <p className="loading">Cargando…</p>

  if (mode === 'exists') return <PantallaYaRegistrado />

  return (
    <FormularioIngreso
      mode={mode} f={f} set={set} error={error} sending={sending}
      accountCreated={accountCreated} onSubmit={handleSubmit}
    />
  )
}
