const { test } = require('node:test');
const assert = require('node:assert/strict');
const { vigentesDe, vigentesAl, estadoDeConsentimientos, leerVersionDocumento, agruparVersiones } = require('./consentimientos');

const fila = (codigo, version, extra = {}) => ({
  id: `${codigo}-${version}`,
  codigo,
  version,
  titulo: `${codigo} v${version}`,
  texto: '',
  obligatorio: true,
  publicado_en: '2026-09-21T12:00:00Z',
  ...extra,
});

test('de cada documento queda su versión de número más alto', () => {
  const r = vigentesDe([fila('reglamento', 1), fila('reglamento', 3), fila('reglamento', 2), fila('datos_personales', 1)]);
  assert.deepEqual(
    r.map((d) => `${d.codigo}@${d.version}`),
    ['datos_personales@1', 'reglamento@3']
  );
});

test('sin documentos publicados, la lista está vacía', () => {
  assert.deepEqual(vigentesDe([]), []);
  assert.deepEqual(vigentesDe(null), []);
});

test('la obligatoriedad y el texto son los de la versión vigente', () => {
  const [vigente] = vigentesDe([
    fila('fotos', 1, { obligatorio: true, texto: 'viejo' }),
    fila('fotos', 2, { obligatorio: false, texto: 'nuevo' }),
  ]);
  assert.equal(vigente.obligatorio, false);
  assert.equal(vigente.texto, 'nuevo');
});

// Estado de cada documento para la ficha: lo aceptado contra lo vigente. La
// aceptación anterior no se toca nunca (las filas son de solo agregar), así que
// "desactualizado" es información, no un error que corregir sobre el pasado.
const aceptacion = (codigo, version, extra = {}) => ({
  aceptado_en: '2026-09-21T15:30:00Z',
  medio: 'mostrador',
  evidencia: 'Aceptado en recepción',
  registrado_por: 'staff-1',
  documento: { codigo, version },
  ...extra,
});

test('sin aceptaciones, cada documento vigente queda pendiente', () => {
  const r = estadoDeConsentimientos({ vigentes: [fila('reglamento', 2), fila('datos_personales', 1)], aceptados: [] });
  assert.deepEqual(r.map((d) => [d.codigo, d.estado, d.aceptado]), [
    ['datos_personales', 'pendiente', null],
    ['reglamento', 'pendiente', null],
  ]);
});

test('quien aceptó la versión vigente está al día, con su evidencia', () => {
  const [doc] = estadoDeConsentimientos({ vigentes: [fila('reglamento', 2)], aceptados: [aceptacion('reglamento', 2)] });
  assert.equal(doc.estado, 'al_dia');
  assert.equal(doc.version_vigente, 2);
  assert.equal(doc.aceptado.version, 2);
  assert.equal(doc.aceptado.medio, 'mostrador');
  assert.equal(doc.aceptado.evidencia, 'Aceptado en recepción');
  assert.equal(doc.aceptado.registrado_por, 'staff-1');
});

test('quien aceptó una versión anterior queda desactualizado y conserva la que aceptó', () => {
  const [doc] = estadoDeConsentimientos({ vigentes: [fila('reglamento', 3)], aceptados: [aceptacion('reglamento', 1)] });
  assert.equal(doc.estado, 'desactualizado');
  assert.equal(doc.version_vigente, 3);
  assert.equal(doc.aceptado.version, 1);
});

test('de varias aceptaciones manda la de versión más alta', () => {
  const [doc] = estadoDeConsentimientos({
    vigentes: [fila('reglamento', 2)],
    aceptados: [aceptacion('reglamento', 2), aceptacion('reglamento', 1)],
  });
  assert.equal(doc.estado, 'al_dia');
  assert.equal(doc.aceptado.version, 2);
});

test('si aceptó dos veces la misma versión, manda la más reciente', () => {
  const [doc] = estadoDeConsentimientos({
    vigentes: [fila('reglamento', 1)],
    aceptados: [
      aceptacion('reglamento', 1, { aceptado_en: '2026-05-01T10:00:00Z', evidencia: 'La primera' }),
      aceptacion('reglamento', 1, { aceptado_en: '2026-09-01T10:00:00Z', evidencia: 'La última' }),
    ],
  });
  assert.equal(doc.aceptado.evidencia, 'La última');
});

test('el título y la obligatoriedad son los de la versión vigente, y el documento sin vigente no aparece', () => {
  const r = estadoDeConsentimientos({
    vigentes: [fila('fotos', 2, { titulo: 'Uso de imagen', obligatorio: false })],
    aceptados: [aceptacion('retirado', 1)],
  });
  assert.equal(r.length, 1);
  assert.equal(r[0].titulo, 'Uso de imagen');
  assert.equal(r[0].obligatorio, false);
});

// Lo que el dueño escribe al publicar o corregir una versión. Los límites son
// los mismos CHECK de la base: así falla aquí con un mensaje y no allá con un 500.
test('el título es obligatorio y no puede ser solo espacios', () => {
  for (const titulo of ['', '   ', undefined, 42]) {
    assert.equal(leerVersionDocumento({ titulo, texto: 'x' }).ok, false, JSON.stringify(titulo));
  }
});

test('el título no pasa de 120 caracteres', () => {
  assert.equal(leerVersionDocumento({ titulo: 'a'.repeat(121) }).ok, false);
  assert.equal(leerVersionDocumento({ titulo: 'a'.repeat(120) }).ok, true);
});

test('el texto es opcional, pero si viene tiene que ser texto', () => {
  assert.deepEqual(leerVersionDocumento({ titulo: 'Reglamento' }).datos, { titulo: 'Reglamento', texto: '' });
  assert.equal(leerVersionDocumento({ titulo: 'Reglamento', texto: { a: 1 } }).ok, false);
});

test('el título se recorta y el texto se conserva tal cual', () => {
  const { datos } = leerVersionDocumento({ titulo: '  Reglamento interno  ', texto: '  Artículo 1.\n\nArtículo 2.  ' });
  assert.equal(datos.titulo, 'Reglamento interno');
  assert.equal(datos.texto, '  Artículo 1.\n\nArtículo 2.  ');
});

// Quién capturó la aceptación solo se resuelve para quien puede ver cuentas del
// personal (user.read): el correo de un compañero no es parte del expediente
// del socio, igual que en la lista blanca de la bitácora.
test('con el mapa de correos, la aceptación dice quién la registró', () => {
  const [doc] = estadoDeConsentimientos({
    vigentes: [fila('reglamento', 1)],
    aceptados: [aceptacion('reglamento', 1)],
    emails: { 'staff-1': 'recepcion@forja.test' },
  });
  assert.equal(doc.aceptado.registrado_por_email, 'recepcion@forja.test');
});

test('sin el mapa de correos, la aceptación no dice quién la registró', () => {
  const [doc] = estadoDeConsentimientos({ vigentes: [fila('reglamento', 1)], aceptados: [aceptacion('reglamento', 1)] });
  assert.equal(doc.aceptado.registrado_por_email, null);
});

// Para Ajustes: cada documento con su versión vigente y las anteriores, que se
// conservan porque hay socios que aceptaron justo esas.
test('el historial agrupa cada documento con su vigente y sus anteriores', () => {
  const r = agruparVersiones([
    fila('reglamento', 1), fila('reglamento', 3), fila('reglamento', 2), fila('datos_personales', 1),
  ]);
  assert.deepEqual(r.map((d) => d.codigo), ['datos_personales', 'reglamento']);
  assert.equal(r[1].vigente.version, 3);
  assert.deepEqual(r[1].anteriores.map((v) => v.version), [2, 1]);
  assert.deepEqual(r[0].anteriores, []);
});

test('sin documentos publicados, el historial está vacío', () => {
  assert.deepEqual(agruparVersiones([]), []);
  assert.deepEqual(agruparVersiones(null), []);
});

// La versión vigente EN UNA FECHA: quien se inscribió antes de que se publicara
// la v2 aceptó la v1, y su ficha lo sigue diciendo.
test('vigentesAl devuelve la versión que estaba publicada en esa fecha', () => {
  const docs = [
    fila('reglamento', 1, { publicado_en: '2026-01-10T12:00:00Z' }),
    fila('reglamento', 2, { publicado_en: '2026-08-17T12:00:00Z' }),
  ];
  assert.equal(vigentesAl(docs, '2026-05-01T10:00:00-05:00')[0].version, 1);
  assert.equal(vigentesAl(docs, '2026-09-01T10:00:00-05:00')[0].version, 2);
});

test('vigentesAl ignora los documentos que aún no se habían publicado', () => {
  const docs = [fila('fotos', 1, { publicado_en: '2026-08-17T12:00:00Z' })];
  assert.deepEqual(vigentesAl(docs, '2026-01-01T00:00:00Z'), []);
});
