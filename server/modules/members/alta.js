// Lo que el alta presencial suma al perfil (§13.7): con qué estado nace el socio,
// por qué canal llegó y qué documentos aceptó. Lógica pura: los documentos
// vigentes llegan como argumento, así se prueba sin base de datos.

const ESTADOS_INICIALES = ['activo', 'prospecto'];
// 'web' es del formulario público e 'importacion' del CSV: un alta en recepción
// que dijera venir de ahí falsearía el origen.
const ORIGENES_PRESENCIALES = ['mostrador', 'referido'];

const error = (mensaje) => ({ ok: false, status: 400, error: mensaje });

function leerConsentimientos(entrada, vigentes) {
  if (!Array.isArray(entrada) || entrada.some((c) => typeof c !== 'string')) {
    return { error: 'Indica los documentos que el socio aceptó' };
  }
  const codigos = [...new Set(entrada)];
  const desconocido = codigos.find((c) => !vigentes.some((d) => d.codigo === c));
  if (desconocido) return { error: `Documento de consentimiento desconocido: ${desconocido}` };

  const faltan = vigentes.filter((d) => d.obligatorio && !codigos.includes(d.codigo)).map((d) => d.titulo);
  if (faltan.length) return { error: `Falta que el socio acepte: ${faltan.join(', ')}` };
  return { codigos };
}

function leerDatosAlta(body, vigentes) {
  if (!ESTADOS_INICIALES.includes(body.estado_inicial)) {
    return error('Indica si el socio contrata hoy (activo) o solo deja sus datos (prospecto)');
  }
  const origen = body.origen ?? 'mostrador';
  if (!ORIGENES_PRESENCIALES.includes(origen)) return error('Origen del alta no válido');

  const consentimientos = leerConsentimientos(body.consentimientos, vigentes);
  if (consentimientos.error) return error(consentimientos.error);

  return { ok: true, datos: { estado: body.estado_inicial, origen, consentimientos: consentimientos.codigos } };
}

module.exports = { leerDatosAlta };
