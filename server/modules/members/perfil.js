// condiciones_medicas es opcional: acepta null/undefined o texto; el texto se
// recorta y, si queda vacío, se guarda como null.
function validarCondicionesMedicas(v) {
  if (v != null && typeof v !== 'string') return { error: 'condiciones_medicas inválido' };
  if (v && v.trim) return v.trim() || null;
  return v;
}

// Validación del perfil de socio para corrección por el staff (lista blanca).
// El staff verifica los datos físicamente contra la cédula, por eso puede
// corregir incluso nombre/documento/fecha de nacimiento.
const CAMPOS = {
  nombre_completo: (v) => (typeof v === 'string' && v.trim() ? v.trim() : { error: 'El nombre no puede estar vacío' }),
  fecha_nacimiento: (v) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? v : { error: 'Fecha de nacimiento inválida (YYYY-MM-DD)' }),
  documento: (v) => (typeof v === 'string' && v.trim() ? v.trim() : { error: 'El documento no puede estar vacío' }),
  telefono: (v) => (typeof v === 'string' && v.trim() ? v.trim() : { error: 'El teléfono no puede estar vacío' }),
  emergencia1_nombre: (v) => (typeof v === 'string' && v.trim() ? v.trim() : { error: 'Contacto 1: nombre requerido' }),
  emergencia1_telefono: (v) => (typeof v === 'string' && v.trim() ? v.trim() : { error: 'Contacto 1: teléfono requerido' }),
  emergencia2_nombre: (v) => (typeof v === 'string' && v.trim() ? v.trim() : { error: 'Contacto 2: nombre requerido' }),
  emergencia2_telefono: (v) => (typeof v === 'string' && v.trim() ? v.trim() : { error: 'Contacto 2: teléfono requerido' }),
  entrenado_antes: (v) => (typeof v === 'boolean' ? v : { error: 'entrenado_antes debe ser booleano' }),
  condiciones_medicas: validarCondicionesMedicas,
  firma_foto_pendiente: (v) => (typeof v === 'boolean' ? v : { error: 'firma_foto_pendiente debe ser booleano' }),
};

// Filtra el body a la lista blanca y valida cada campo presente.
function validarPerfilParcial(body) {
  const datos = {};
  for (const [campo, validar] of Object.entries(CAMPOS)) {
    if (campo in body) {
      const r = validar(body[campo]);
      if (r && typeof r === 'object' && 'error' in r) return { valido: false, error: r.error };
      datos[campo] = r;
    }
  }
  if (Object.keys(datos).length === 0) return { valido: false, error: 'No hay campos válidos para actualizar' };
  return { valido: true, datos };
}

// Valida el perfil completo para el alta presencial (todos los campos del formulario).
function validarPerfilCompleto(body) {
  const requeridos = [
    'nombre_completo', 'fecha_nacimiento', 'documento', 'telefono',
    'emergencia1_nombre', 'emergencia1_telefono', 'emergencia2_nombre', 'emergencia2_telefono',
  ];
  for (const campo of requeridos) {
    if (!(campo in body)) return { valido: false, error: `Falta el campo ${campo}` };
  }
  const cuerpo = { ...body, entrenado_antes: body.entrenado_antes ?? false };
  const { valido, error, datos } = validarPerfilParcial(cuerpo);
  if (!valido) return { valido, error };
  if (!('condiciones_medicas' in datos)) datos.condiciones_medicas = null;
  delete datos.firma_foto_pendiente; // el alta nace pendiente por defecto
  return { valido: true, datos };
}

module.exports = { validarPerfilParcial, validarPerfilCompleto };
