// Réplica en JS de normalizar_documento() y normalizar_email() (migración
// 2026_09_miembros.sql). La base es la fuente de la regla —la columna generada
// documento_normalizado sale de ahí—; esta copia existe para comparar donde no
// hay base de por medio: la búsqueda del listado y las filas de un CSV entre sí.
// Los tests fijan los mismos casos que casos_miembros.sql.

const texto = (valor) => (valor == null ? '' : String(valor));

// Letras y dígitos ASCII en mayúsculas: '8-123-456' y '8 123 456' son el mismo.
const normalizarDocumento = (valor) => texto(valor).replace(/[^A-Za-z0-9]/g, '').toUpperCase() || null;

// Sin espacios en ningún sitio y en minúsculas.
const normalizarEmail = (valor) => texto(valor).replace(/\s/g, '').toLowerCase() || null;

module.exports = { normalizarDocumento, normalizarEmail };
