const { test } = require('node:test');
const assert = require('node:assert/strict');
const { leerCsv, validarImportacion, reporteDeErrores, LIMITE_FILAS } = require('./importacion');

// El archivo lo exporta el gimnasio desde su hoja de cálculo: Excel en español
// separa con punto y coma, mete BOM y termina las líneas con CRLF. El número de
// fila del reporte es el que el usuario ve en Excel (el encabezado es la 1).

const CABECERA = 'nombre,documento,telefono,correo';
const csv = (...lineas) => [CABECERA, ...lineas].join('\n');
const fila = (n, valores) => ({ numero: n, valores });

test('lee las columnas mínimas y numera las filas como Excel', () => {
  const r = leerCsv(csv('Ana Pérez,8-123-456,6000-1111,ana@correo.com'));
  assert.equal(r.ok, true);
  assert.deepEqual(r.filas, [
    fila(2, { nombre_completo: 'Ana Pérez', documento: '8-123-456', telefono: '6000-1111', correo: 'ana@correo.com' }),
  ]);
});

test('acepta punto y coma como separador', () => {
  const r = leerCsv('nombre;documento;telefono;correo\nAna Pérez;8-123-456;6000-1111;ana@correo.com');
  assert.equal(r.ok, true);
  assert.equal(r.filas[0].valores.documento, '8-123-456');
});

test('respeta comillas con separadores y saltos de línea dentro', () => {
  const r = leerCsv(csv('"Pérez Ríos, Ana",8-123-456,6000-1111,ana@correo.com'));
  assert.equal(r.filas[0].valores.nombre_completo, 'Pérez Ríos, Ana');

  const conSalto = leerCsv(`${CABECERA},condiciones_medicas\nAna,8-1-1,6000-1111,a@b.com,"asma\ny rodilla"`);
  assert.equal(conSalto.filas[0].valores.condiciones_medicas, 'asma\ny rodilla');
  assert.equal(leerCsv(csv('"Ana ""La Flaca"" Pérez",8-1-1,6000-1111,a@b.com')).filas[0].valores.nombre_completo, 'Ana "La Flaca" Pérez');
});

test('tolera BOM, CRLF y filas vacías', () => {
  const r = leerCsv(`\uFEFF${CABECERA}\r\nAna,8-1-1,6000-1111,a@b.com\r\n\r\n`);
  assert.equal(r.ok, true);
  assert.equal(r.filas.length, 1);
  assert.equal(r.filas[0].valores.nombre_completo, 'Ana');
});

test('reconoce los encabezados sin tildes ni mayúsculas, y sus alias', () => {
  const r = leerCsv('Nombre Completo;Cédula;Celular;E-mail\nAna;8-1-1;6000-1111;a@b.com');
  assert.equal(r.ok, true);
  assert.deepEqual(r.filas[0].valores, { nombre_completo: 'Ana', documento: '8-1-1', telefono: '6000-1111', correo: 'a@b.com' });
});

test('ignora las columnas que no son del expediente', () => {
  const r = leerCsv(`${CABECERA},plan,pagado\nAna,8-1-1,6000-1111,a@b.com,Mensual,35`);
  assert.equal(r.ok, true);
  assert.equal('plan' in r.filas[0].valores, false);
});

test('dice qué columnas mínimas faltan', () => {
  const r = leerCsv('nombre,documento\nAna,8-1-1');
  assert.equal(r.ok, false);
  assert.match(r.error, /telefono/);
  assert.match(r.error, /correo/);
});

test('un archivo vacío o con solo encabezado no es una importación', () => {
  assert.equal(leerCsv('').ok, false);
  assert.equal(leerCsv('   ').ok, false);
  assert.equal(leerCsv(CABECERA).ok, false);
});

test('rechaza un archivo más largo que el tope, sin procesarlo', () => {
  const muchas = Array.from({ length: LIMITE_FILAS + 1 }, (_, i) => `Ana ${i},8-1-${i},6000-1111,a${i}@b.com`);
  const r = leerCsv(csv(...muchas));
  assert.equal(r.ok, false);
  assert.match(r.error, new RegExp(String(LIMITE_FILAS)));
});

// ── Validación fila por fila ─────────────────────────────────────────────────

const filas = (texto) => leerCsv(texto).filas;
const sinExistentes = { documentos: new Set() };

test('una fila con los campos mínimos queda lista para crearse', () => {
  const { listas, errores } = validarImportacion(filas(csv('Ana Pérez,8-123-456,6000-1111,Ana@Correo.com ')), sinExistentes);
  assert.deepEqual(errores, []);
  assert.equal(listas.length, 1);
  assert.equal(listas[0].email, 'ana@correo.com'); // normalizado: Auth exige correo único
  assert.deepEqual(listas[0].perfil, {
    nombre_completo: 'Ana Pérez',
    documento: '8-123-456',
    telefono: '6000-1111',
    fecha_nacimiento: null,
    emergencia1_nombre: null,
    emergencia1_telefono: null,
    emergencia2_nombre: null,
    emergencia2_telefono: null,
    condiciones_medicas: null,
  });
});

test('a una fila le falta un campo mínimo: queda en el reporte con su fila y su causa', () => {
  const { listas, errores } = validarImportacion(filas(csv('Ana,8-1-1,,a@b.com')), sinExistentes);
  assert.deepEqual(listas, []);
  assert.equal(errores[0].fila, 2);
  assert.equal(errores[0].nombre, 'Ana');
  assert.match(errores[0].causa, /tel[eé]fono/i);
});

test('el correo tiene que parecer un correo', () => {
  const { errores } = validarImportacion(filas(csv('Ana,8-1-1,6000-1111,ana(arroba)correo.com')), sinExistentes);
  assert.match(errores[0].causa, /correo/i);
});

test('la fecha de nacimiento acepta los dos formatos que exporta una hoja de cálculo', () => {
  const texto = `${CABECERA},nacimiento\nAna,8-1-1,6000-1111,a@b.com,1990-04-07\nLuis,8-2-2,6000-2222,l@b.com,07/04/1990\nEva,8-3-3,6000-3333,e@b.com,abril`;
  const { listas, errores } = validarImportacion(filas(texto), sinExistentes);
  assert.equal(listas[0].perfil.fecha_nacimiento, '1990-04-07');
  assert.equal(listas[1].perfil.fecha_nacimiento, '1990-04-07');
  assert.equal(errores.length, 1);
  assert.match(errores[0].causa, /nacimiento/i);
});

test('un contacto de emergencia va completo o no va', () => {
  const texto = `${CABECERA},emergencia1_nombre,emergencia1_telefono\nAna,8-1-1,6000-1111,a@b.com,María,\nLuis,8-2-2,6000-2222,l@b.com,,`;
  const { listas, errores } = validarImportacion(filas(texto), sinExistentes);
  assert.equal(errores.length, 1);
  assert.match(errores[0].causa, /emergencia/i);
  assert.equal(listas.length, 1);
  assert.equal(listas[0].perfil.emergencia1_nombre, null);
});

test('un documento repetido dentro del archivo rechaza la segunda fila y nombra la primera', () => {
  const { listas, errores } = validarImportacion(filas(csv('Ana,8-123-456,6000-1111,a@b.com', 'Luis,8 123 456,6000-2222,l@b.com')), sinExistentes);
  assert.equal(listas.length, 1);
  assert.equal(errores[0].fila, 3);
  assert.match(errores[0].causa, /fila 2/);
});

test('un correo repetido dentro del archivo también se rechaza', () => {
  const { listas, errores } = validarImportacion(filas(csv('Ana,8-1-1,6000-1111,a@b.com', 'Luis,8-2-2,6000-2222,A@B.com')), sinExistentes);
  assert.equal(listas.length, 1);
  assert.match(errores[0].causa, /fila 2/);
});

test('un documento que ya está en la base se marca como posible duplicado', () => {
  const { listas, errores } = validarImportacion(filas(csv('Ana,8-123-456,6000-1111,a@b.com')), {
    documentos: new Set(['8123456']),
  });
  assert.deepEqual(listas, []);
  assert.match(errores[0].causa, /ya (existe|está)/i);
});

test('el reporte de errores es un CSV con fila, nombre y causa', () => {
  const reporte = reporteDeErrores([{ fila: 7, nombre: 'Ana =SUM(A1)', causa: 'Falta el teléfono' }]);
  const [cabecera, primera] = reporte.split('\r\n');
  assert.deepEqual(cabecera, '"fila","nombre","causa"');
  assert.equal(primera, '"7","Ana =SUM(A1)","Falta el teléfono"');
});
