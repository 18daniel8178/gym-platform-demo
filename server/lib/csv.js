// Genera CSV neutralizando la inyección de fórmulas: los nombres/datos los
// escriben los socios y el staff abre el export en Excel. Un valor que empieza
// con = + - @ tab o retorno se prefija con comilla simple para que Excel no lo
// interprete como fórmula. Cada campo se envuelve en comillas y se escapan las
// comillas internas.
function escapeCell(v) {
  if (v == null) return '""';
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

function toCsv(headers, rows) {
  const linea = (arr) => arr.map(escapeCell).join(',');
  return [linea(headers), ...rows.map(linea)].join('\r\n');
}

module.exports = { toCsv, escapeCell };
