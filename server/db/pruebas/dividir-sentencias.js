// Parte un archivo .sql en sentencias sueltas, respetando los cuerpos de función
// ($$ … $$), las cadenas y los comentarios.
//
// Sirve para probar una migración como la ejecuta el SQL Editor de Supabase: una
// sentencia por conexión, cada una con su propio commit. Correrla con `psql -f`
// NO reproduce ese escenario —mantiene sesión y transacción— y por eso se coló
// una migración que dependía de una tabla temporal.
//
//   node dividir-sentencias.js migracion.sql carpeta-destino   → imprime cuántas
const fs = require('node:fs');
const path = require('node:path');

const ETIQUETA_DOLAR = /^\$[a-z_]*\$/i;

// Fin de una cadena 'que empieza en i', contando las comillas escapadas ('').
function finDeCadena(sql, i) {
  let j = i + 1;
  while (j < sql.length) {
    if (sql[j] !== "'") j += 1;
    else if (sql[j + 1] === "'") j += 2;
    else return j + 1;
  }
  return sql.length;
}

// Fin del cuerpo delimitado por la etiqueta ($$, $func$…) que empieza en i.
function finDeDolar(sql, i, etiqueta) {
  const cierre = sql.indexOf(etiqueta, i + etiqueta.length);
  return cierre === -1 ? sql.length : cierre + etiqueta.length;
}

// Si en `i` empieza un tramo donde un ';' NO separa sentencias (comentario,
// cadena o cuerpo de función), devuelve dónde termina. Si no, devuelve `i`.
function finDeTramoLiteral(sql, i) {
  const dolar = sql.slice(i, i + 32).match(ETIQUETA_DOLAR);
  if (dolar) return finDeDolar(sql, i, dolar[0]);
  if (sql[i] === '-' && sql[i + 1] === '-') {
    const salto = sql.indexOf('\n', i);
    return salto === -1 ? sql.length : salto + 1;
  }
  if (sql[i] === "'") return finDeCadena(sql, i);
  return i;
}

// Descarta los tramos que solo son comentarios o espacios.
function tieneCodigo(sentencia) {
  return sentencia.split('\n').some((linea) => {
    const l = linea.trim();
    return l !== '' && !l.startsWith('--');
  });
}

function dividir(sql) {
  const sentencias = [];
  let actual = '';
  let i = 0;

  while (i < sql.length) {
    const fin = finDeTramoLiteral(sql, i);
    if (fin > i) {
      actual += sql.slice(i, fin);
      i = fin;
    } else if (sql[i] === ';') {
      sentencias.push(actual + ';');
      actual = '';
      i += 1;
    } else {
      actual += sql[i];
      i += 1;
    }
  }
  if (actual.trim()) sentencias.push(actual);

  return sentencias.map((s) => s.trim()).filter(tieneCodigo);
}

function principal() {
  const [origen, destino] = process.argv.slice(2);
  if (!origen || !destino) {
    console.error('uso: node dividir-sentencias.js <archivo.sql> <carpeta-destino>');
    process.exit(1);
  }
  fs.rmSync(destino, { recursive: true, force: true });
  fs.mkdirSync(destino, { recursive: true });

  const sentencias = dividir(fs.readFileSync(origen, 'utf8'));
  sentencias.forEach((s, n) => {
    fs.writeFileSync(path.join(destino, `${String(n + 1).padStart(3, '0')}.sql`), `${s}\n`);
  });
  console.log(sentencias.length);
}

if (require.main === module) principal();

module.exports = { dividir };
