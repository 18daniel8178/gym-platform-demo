// Etiquetas de un socio: texto libre del personal ("corporativo", "turno mañana")
// normalizado para que "Corporativo" y "corporativo " sean la misma etiqueta y el
// filtro del listado no se parta en variantes. La base repite el tope de 20.

const MAX_ETIQUETAS = 20;
const MAX_LARGO = 30;
// Empieza por letra o número; luego letras (con tildes y ñ), números, espacios o guiones.
const FORMA = /^[\p{L}\p{N}][\p{L}\p{N} -]*$/u;

const error = (mensaje) => ({ ok: false, status: 400, error: mensaje });

const limpiar = (texto) => texto.trim().replace(/\s+/g, ' ').toLowerCase();

function validarUna(etiqueta) {
  if (etiqueta.length > MAX_LARGO) return `La etiqueta "${etiqueta}" supera ${MAX_LARGO} caracteres`;
  if (!FORMA.test(etiqueta)) return `La etiqueta "${etiqueta}" solo admite letras, números, espacios y guiones`;
  return null;
}

function normalizarEtiquetas(entrada) {
  if (!Array.isArray(entrada) || entrada.some((e) => typeof e !== 'string')) {
    return error('Las etiquetas deben ser una lista de textos');
  }
  const unicas = [...new Set(entrada.map(limpiar).filter(Boolean))];
  const invalida = unicas.map(validarUna).find(Boolean);
  if (invalida) return error(invalida);
  if (unicas.length > MAX_ETIQUETAS) return error(`Máximo ${MAX_ETIQUETAS} etiquetas por socio`);
  return { ok: true, etiquetas: unicas };
}

module.exports = { normalizarEtiquetas };
