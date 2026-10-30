const { createHmac, timingSafeEqual } = require('node:crypto');

// Credencial QR del socio (Fase 1 · Bloque 6). El carnet llevaba `forja:<user_id>`
// y un id no es un secreto: cualquiera que lo conozca dibuja ese QR y entra. Ahora
// lleva además una firma del servidor, que el lector comprueba antes de decidir.
//
// Firma, no cifrado: el id viaja a la vista (el socio ya lo conoce) y lo que
// importa es que nadie pueda fabricar uno ajeno. Sin caducidad: el carnet vive en
// el teléfono del socio y se invalida rotando el secreto.

const PREFIJO = 'forja';
const LARGO_FIRMA = 32; // 128 bits de HMAC-SHA256 en hexadecimal

// Secreto propio del carnet. Si no está configurado se deriva del service role,
// que el server ya necesita para existir: la demo y los entornos nuevos
// funcionan sin añadir nada, y producción puede fijar el suyo para rotarlo
// aparte. Deriva, no reutiliza: nunca es la clave original.
function secreto() {
  if (process.env.CHECKIN_SECRET) return process.env.CHECKIN_SECRET;
  const base = process.env.SUPABASE_SERVICE_ROLE_KEY || 'forja-sin-secreto';
  return createHmac('sha256', base).update('carnet-de-socio-v1').digest('hex');
}

const firmaDe = (userId) => createHmac('sha256', secreto()).update(`carnet:${userId}`).digest('hex').slice(0, LARGO_FIRMA);

const tokenDeCarnet = (userId) => `${PREFIJO}:${userId}:${firmaDe(userId)}`;

// Comparación en tiempo constante: comparar firmas con === filtra información
// por el tiempo de respuesta, y esto corre en cada escaneo.
function firmaValida(firma, esperada) {
  const a = Buffer.from(firma);
  const b = Buffer.from(esperada);
  return a.length === b.length && timingSafeEqual(a, b);
}

function leerTokenDeCarnet(texto) {
  if (typeof texto !== 'string') return { ok: false };
  const [prefijo, userId, firma, ...resto] = texto.trim().split(':');
  if (prefijo !== PREFIJO || !userId || !firma || resto.length) return { ok: false };
  if (!firmaValida(firma, firmaDe(userId))) return { ok: false };
  return { ok: true, userId };
}

module.exports = { tokenDeCarnet, leerTokenDeCarnet };
