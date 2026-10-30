const { test } = require('node:test');
const assert = require('node:assert');
const { escapeCell, toCsv } = require('./csv');

test('neutraliza inyección de fórmulas (= + - @)', () => {
  assert.equal(escapeCell('=HYPERLINK("http://evil")'), `"'=HYPERLINK(""http://evil"")"`);
  assert.equal(escapeCell('+1'), `"'+1"`);
  assert.equal(escapeCell('-2'), `"'-2"`);
  assert.equal(escapeCell('@cmd'), `"'@cmd"`);
});

test('escapa comillas internas y envuelve todo campo', () => {
  assert.equal(escapeCell('Ana "La Roca"'), `"Ana ""La Roca"""`);
  assert.equal(escapeCell('normal'), `"normal"`);
});

test('null/undefined → celda vacía', () => {
  assert.equal(escapeCell(null), '""');
  assert.equal(escapeCell(undefined), '""');
});

test('toCsv arma cabecera + filas separadas por CRLF', () => {
  const csv = toCsv(['Nombre', 'Monto'], [['Ana', 35], ['=x', 4]]);
  assert.equal(csv, `"Nombre","Monto"\r\n"Ana","35"\r\n"'=x","4"`);
});
