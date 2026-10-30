// Azar DETERMINISTA para los datos de la demo: la misma
// semilla da el mismo gimnasio en cada reinicio, así la demo se puede ensayar y
// un fallo se reproduce. mulberry32: pequeño, rápido y suficiente para datos
// ficticios. No es criptográfico ni necesita serlo.

function mulberry32(semilla) {
  let a = semilla >>> 0;
  return function siguiente() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Un valor según pesos: [['activo', 70], ['inactivo', 10], …].
function ponderadoCon(siguiente, pares) {
  const total = pares.reduce((suma, [, peso]) => suma + peso, 0);
  // Un peso ausente deja la suma en NaN, y NaN <= 0 es falso: hay que nombrarlo.
  if (!Number.isFinite(total) || total <= 0) throw new Error('Los pesos deben sumar más de cero');
  let resto = siguiente() * total;
  for (const [valor, peso] of pares) {
    resto -= peso;
    if (resto < 0) return valor;
  }
  return pares[pares.length - 1][0]; // redondeo en el último céntimo
}

function crearAzar(semilla) {
  const siguiente = mulberry32(semilla);
  const entero = (min, max) => min + Math.floor(siguiente() * (max - min + 1));
  const elegir = (lista) => {
    if (!lista.length) throw new Error('No se puede elegir de una lista vacía');
    return lista[entero(0, lista.length - 1)];
  };
  return {
    siguiente,
    entero,
    elegir,
    ponderado: (pares) => ponderadoCon(siguiente, pares),
    probabilidad: (p) => siguiente() < p,
  };
}

module.exports = { crearAzar };
