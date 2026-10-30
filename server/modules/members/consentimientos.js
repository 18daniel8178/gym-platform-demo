// Documentos de consentimiento y lo que cada socio aceptó (§13.7).
//
// La base guarda una fila por VERSIÓN (consent_documents); la vigente de cada
// documento es la de número más alto. La reducción vive aquí, en puro, porque
// PostgREST no expresa "el máximo por grupo" sin una función SQL por consulta.

// La que regía EN UNA FECHA: quien se inscribió antes de publicarse la v2
// aceptó la v1, y su ficha tiene que seguir diciendo eso.
function vigentesAl(filas, fecha) {
  const limite = Date.parse(fecha);
  const porCodigo = new Map();
  for (const doc of filas || []) {
    if (Date.parse(doc.publicado_en) > limite) continue;
    const actual = porCodigo.get(doc.codigo);
    if (!actual || doc.version > actual.version) porCodigo.set(doc.codigo, doc);
  }
  return [...porCodigo.values()].sort((a, b) => a.codigo.localeCompare(b.codigo));
}

// La vigente hoy de cada documento: la que se acepta en el alta.
function vigentesDe(filas) {
  return vigentesAl(filas, Date.now());
}

// De un documento, la aceptación que vale: la de versión más alta y, entre dos
// de la misma versión, la más reciente. Las filas son de solo agregar, así que
// aceptar otra vez suma una fila y la anterior sigue ahí tal como se firmó.
function mandaSobre(candidata, actual) {
  if (!actual) return true;
  if (candidata.documento.version !== actual.documento.version) {
    return candidata.documento.version > actual.documento.version;
  }
  return Date.parse(candidata.aceptado_en) > Date.parse(actual.aceptado_en);
}

function estadoDe(aceptada, versionVigente) {
  if (!aceptada) return 'pendiente';
  return aceptada.documento.version >= versionVigente ? 'al_dia' : 'desactualizado';
}

// Para la ficha: cada documento vigente con lo que este socio aceptó. Una
// versión nueva no toca lo aceptado antes, solo deja el documento
// "desactualizado" hasta que alguien capture la aceptación de la versión nueva.
function estadoDeConsentimientos({ vigentes, aceptados, emails = {} }) {
  const ultima = new Map();
  for (const fila of aceptados || []) {
    const { codigo } = fila.documento;
    if (mandaSobre(fila, ultima.get(codigo))) ultima.set(codigo, fila);
  }
  return (vigentes || [])
    .map((doc) => {
      const a = ultima.get(doc.codigo);
      return {
        codigo: doc.codigo,
        titulo: doc.titulo,
        obligatorio: doc.obligatorio,
        version_vigente: doc.version,
        estado: estadoDe(a, doc.version),
        aceptado: a
          ? {
            version: a.documento.version,
            aceptado_en: a.aceptado_en,
            medio: a.medio,
            evidencia: a.evidencia,
            registrado_por: a.registrado_por,
            // Solo lo trae quien puede ver cuentas del personal; si no, null.
            registrado_por_email: emails[a.registrado_por] ?? null,
          }
          : null,
      };
    })
    .sort((a, b) => a.codigo.localeCompare(b.codigo));
}

// Para Ajustes: cada documento con su versión vigente y las anteriores, de la
// más nueva a la más vieja. Las anteriores se conservan porque hay socios que
// aceptaron justo esas y su aceptación dice qué texto firmaron.
function agruparVersiones(filas) {
  const porCodigo = new Map();
  for (const v of filas || []) {
    if (!porCodigo.has(v.codigo)) porCodigo.set(v.codigo, []);
    porCodigo.get(v.codigo).push(v);
  }
  return [...porCodigo.entries()]
    .map(([codigo, versiones]) => {
      const [vigente, ...anteriores] = [...versiones].sort((a, b) => b.version - a.version);
      return { codigo, vigente, anteriores };
    })
    .sort((a, b) => a.codigo.localeCompare(b.codigo));
}

// Lo que el dueño escribe al publicar o corregir una versión. Los topes son los
// mismos CHECK de la base: fallar aquí da un mensaje; fallar allá, un 500.
const TITULO_MAX = 120;

function leerVersionDocumento(body = {}) {
  const titulo = typeof body.titulo === 'string' ? body.titulo.trim() : '';
  if (!titulo) return { ok: false, error: 'El documento necesita un título' };
  if (titulo.length > TITULO_MAX) return { ok: false, error: `El título no puede pasar de ${TITULO_MAX} caracteres` };

  const texto = body.texto ?? '';
  if (typeof texto !== 'string') return { ok: false, error: 'El texto del documento tiene que ser texto' };
  return { ok: true, datos: { titulo, texto } };
}

module.exports = { vigentesDe, vigentesAl, estadoDeConsentimientos, agruparVersiones, leerVersionDocumento };
