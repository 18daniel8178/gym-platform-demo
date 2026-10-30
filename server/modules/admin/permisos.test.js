const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { CATALOGO, validarPermiso } = require('./permisos');

// Los permisos viven en tres sitios que tienen que decir lo mismo: el catálogo,
// el seed de la migración y los strings que usan endpoints y cliente. Sin esta
// prueba, una errata no falla en ninguno: el endpoint queda inalcanzable para
// todos o el botón desaparece de la UI sin que nadie se entere.

const RAIZ = path.resolve(__dirname, '../../..');

function archivosDe(dir, extensiones) {
  const salida = [];
  for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entrada.name === 'node_modules' || entrada.name === 'dist') continue;
    const ruta = path.join(dir, entrada.name);
    if (entrada.isDirectory()) salida.push(...archivosDe(ruta, extensiones));
    else if (extensiones.some((e) => entrada.name.endsWith(e))) salida.push(ruta);
  }
  return salida;
}

function extraer(patron, texto) {
  return [...texto.matchAll(patron)].map((m) => m[1]);
}

function permisosEn(archivos, patrones) {
  const encontrados = new Set();
  for (const archivo of archivos) {
    const contenido = fs.readFileSync(archivo, 'utf8');
    for (const patron of patrones) extraer(patron, contenido).forEach((p) => encontrados.add(p));
  }
  return encontrados;
}

const ROLES_ESPERADOS = ['cajero', 'contabilidad', 'gerente', 'inventario', 'recepcion'];

// El seed es una tabla (rol, permiso): se lee entera y se compara.
function seedDeLaMigracion() {
  const sql = fs.readFileSync(path.join(RAIZ, 'server/db/2026_08_rbac.sql'), 'utf8');
  const pares = [...sql.matchAll(/\('([a-z]+)', '([a-z]+\.[a-z_]+)'\)/g)].map((m) => ({ rol: m[1], permiso: m[2] }));
  return {
    roles: [...new Set(pares.map((p) => p.rol))].sort(),
    permisos: new Set(pares.map((p) => p.permiso)),
  };
}

test('el seed siembra exactamente los roles del documento', () => {
  assert.deepEqual(seedDeLaMigracion().roles, ROLES_ESPERADOS);
});

test('el catálogo y el seed de la migración dicen lo mismo', () => {
  const sembrados = seedDeLaMigracion().permisos;

  const sinSembrar = CATALOGO.filter((p) => !sembrados.has(p));
  assert.deepEqual(sinSembrar, [], 'permisos del catálogo que ningún rol tiene sembrado');

  const sinCatalogar = [...sembrados].filter((p) => !CATALOGO.includes(p));
  assert.deepEqual(sinCatalogar, [], 'permisos sembrados que faltan en el catálogo');
});

// (que los endpoints solo exijan permisos del catálogo lo verifica
// rutas.contract.test.js sobre el router real, no por grep)

test('todo permiso que consulta el cliente existe en el catálogo', () => {
  const fuentes = archivosDe(path.join(RAIZ, 'client/src'), ['.js', '.jsx']);
  const usados = permisosEn(fuentes, [
    /(?:puede|tienePermiso)\((?:me, )?'([a-z.]+)'\)/g,
    /permiso: '([a-z.]+)'/g,
  ]);
  assert.ok(usados.size >= 10, `esperaba encontrar las comprobaciones del panel, hallé ${usados.size}`);

  const desconocidos = [...usados].filter((p) => !CATALOGO.includes(p));
  assert.deepEqual(desconocidos, [], 'el cliente comprueba permisos que no existen (ocultaría acciones para siempre)');
});

test('validarPermiso rechaza una errata', () => {
  assert.equal(validarPermiso('user.read'), 'user.read');
  assert.throws(() => validarPermiso('user.reed'), /Permiso desconocido/);
});
