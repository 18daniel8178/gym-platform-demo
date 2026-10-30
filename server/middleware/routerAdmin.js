const { Router } = require('express');
const { requirePermission } = require('./requirePermission');
const { guardsDeObjetivo } = require('../modules/admin/objetivo');

// Constructor de routers del panel. Registrar una ruta admin sin declarar su
// permiso deja de ser posible: no es una convención que revisar, es la firma.
//
//   router.get('/plans', 'plan.read', handler)
//   router.post('/users/:id/desactivar', 'user.manage',
//     { objetivo: 'staff', prohibirPropietario: true, prohibirSiMismo: 'No puedes…' },
//     handler)
//
// Antes cada ruta encadenaba a mano requirePermission y los guards de objetivo,
// y una auditoría de arranque parcheaba las olvidadas manipulando route.stack.
// Esa auditoría rompía código correcto (un middleware de validación colocado
// antes del guard convertía la ruta en un 403 para cualquiera) y no veía las
// rutas duplicadas entre sub-routers.

const METODOS = ['get', 'post', 'put', 'patch', 'delete'];

// Marca explícita para la única ruta sin permiso: /me solo devuelve la identidad
// de quien pregunta. Es un valor, no un olvido, y el test de contrato lo fija.
const IDENTIDAD_PROPIA = Symbol('identidad propia: sin permiso');

// Registro de cuanto se monta bajo /api/admin. Detecta colisiones entre módulos
// y es la matriz que verifica rutas.contract.test.js.
const rutasRegistradas = [];

function registrar({ metodo, path, permiso, politica }) {
  const yaEstaba = rutasRegistradas.find((r) => r.metodo === metodo && r.path === path);
  if (yaEstaba) {
    throw new Error(`Ruta admin duplicada: ${metodo.toUpperCase()} ${path} (ya declarada con '${yaEstaba.permiso}')`);
  }
  rutasRegistradas.push({ metodo, path, permiso: permiso === IDENTIDAD_PROPIA ? null : permiso, politica });
}

// Separa la política de objetivo (objeto literal opcional) de los handlers.
function partirArgumentos(resto) {
  const esPolitica = resto.length > 0 && typeof resto[0] === 'object' && resto[0] !== null;
  return { politica: esPolitica ? resto[0] : {}, handlers: esPolitica ? resto.slice(1) : resto };
}

function cadenaDeGuards(permiso, politica) {
  // El guard del permiso va SIEMPRE primero: el orden deja de depender de quien
  // escribe la ruta, que era la parte que se podía equivocar en silencio.
  const guards = permiso === IDENTIDAD_PROPIA ? [] : [requirePermission(permiso)];
  return [...guards, ...guardsDeObjetivo(politica)];
}

function declarar(router, original, metodo) {
  return (path, permiso, ...resto) => {
    // Un handler en la posición del permiso es el olvido típico: se rechaza
    // por su tipo, no por ser falsy.
    if (typeof permiso !== 'string' && permiso !== IDENTIDAD_PROPIA) {
      throw new Error(`La ruta admin ${metodo.toUpperCase()} ${path} no declara permiso`);
    }
    const { politica, handlers } = partirArgumentos(resto);
    if (handlers.length === 0) throw new Error(`La ruta admin ${metodo.toUpperCase()} ${path} no tiene handler`);
    registrar({ metodo, path, permiso, politica });
    return original(path, ...cadenaDeGuards(permiso, politica), ...handlers);
  };
}

function crearRouterAdmin() {
  const router = Router();
  for (const metodo of METODOS) {
    const original = router[metodo].bind(router);
    router[metodo] = declarar(router, original, metodo);
  }
  return router;
}

// Matriz de rutas montadas, ordenada, para el test de contrato.
function matrizDeRutas() {
  return rutasRegistradas
    .map((r) => ({ ...r }))
    .sort((a, b) => `${a.path} ${a.metodo}`.localeCompare(`${b.path} ${b.metodo}`));
}

module.exports = { crearRouterAdmin, matrizDeRutas, IDENTIDAD_PROPIA };
