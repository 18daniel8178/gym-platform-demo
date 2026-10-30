// Lógica pura del formulario de ingreso: validaciones, payload del perfil
// e interpretación del registro de cuenta. Sin estado de React ni JSX.

export const CAMPOS_INICIALES = {
  nombre: '',
  nacimiento: '',
  documento: '',
  telefono: '',
  email: '',
  password: '',
  confirm: '',
  em1Nombre: '',
  em1Telefono: '',
  em2Nombre: '',
  em2Telefono: '',
  entrenado: '',
  enfermedad: '',
}

// Validación de campos del formulario: devuelve el mensaje de error o '' si está completo
export function validarFormulario(f) {
  const obligatorios = [f.nombre, f.nacimiento, f.documento, f.telefono, f.em1Nombre, f.em1Telefono, f.em2Nombre, f.em2Telefono]
  if (obligatorios.some((v) => !v.trim())) {
    return 'Completa todos los campos, incluidos los dos contactos de emergencia.'
  }
  if (!f.entrenado) return 'Indícanos si has entrenado antes.'
  return ''
}

// Validación de la cuenta nueva: devuelve el mensaje de error o '' si es válida
function validarCuenta(f) {
  if (f.password.length < 6) return 'La contraseña debe tener al menos 6 caracteres.'
  if (f.password !== f.confirm) return 'Las contraseñas no coinciden.'
  return ''
}

// ¿El resultado de register() indica que el email ya estaba registrado?
function emailYaRegistrado({ data, error }) {
  return error?.message?.toLowerCase().includes('already registered') || data?.user?.identities?.length === 0
}

// Interpreta el resultado de register(): mensaje de error o '' si la cuenta quedó lista
function mensajeErrorRegistro({ data, error }) {
  if (error || (data?.user && data.user.identities?.length === 0)) {
    return emailYaRegistrado({ data, error })
      ? 'Este email ya está registrado. Inicia sesión para continuar.'
      : 'No se pudo crear la cuenta. Intenta de nuevo.'
  }
  if (!data?.session) {
    return 'La cuenta se creó pero requiere confirmar el email. Confírmalo e inicia sesión para completar tus datos.'
  }
  return ''
}

// Payload del perfil de socio (nombres de columna de la tabla `profiles`)
export function construirPerfil(f) {
  return {
    nombre_completo: f.nombre.trim(),
    fecha_nacimiento: f.nacimiento,
    documento: f.documento.trim(),
    telefono: f.telefono.trim(),
    emergencia1_nombre: f.em1Nombre.trim(),
    emergencia1_telefono: f.em1Telefono.trim(),
    emergencia2_nombre: f.em2Nombre.trim(),
    emergencia2_telefono: f.em2Telefono.trim(),
    entrenado_antes: f.entrenado === 'si',
    condiciones_medicas: f.enfermedad.trim() || null,
  }
}

// Crea la cuenta si el flujo lo requiere; devuelve { userId, esNueva? } o { error }
export async function crearCuentaSiFalta({ f, register, session, mode, accountCreated }) {
  if (mode !== 'full' || accountCreated) {
    return { userId: session?.user?.id ?? null }
  }
  const msgCuenta = validarCuenta(f)
  if (msgCuenta) return { error: msgCuenta }
  const { data, error } = await register(f.email, f.password)
  const msgRegistro = mensajeErrorRegistro({ data, error })
  if (msgRegistro) return { error: msgRegistro }
  return { userId: data.user.id, esNueva: true }
}
