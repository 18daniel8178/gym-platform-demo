const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validarSucursal } = require('./validadores');

// La sucursal manda sobre operaciones (cobros, cajas, numeración) y su dirección
// sale en el sitio público, así que se valida en el server: el panel es una
// comodidad, no una barrera.

test('la sucursal necesita un nombre', () => {
  assert.deepEqual(validarSucursal({ nombre: 'FORJA GYM Centro' }).datos, {
    nombre: 'FORJA GYM Centro',
  });
  assert.match(validarSucursal({ nombre: '   ' }).error, /nombre/i);
  assert.match(validarSucursal({ nombre: 42 }).error, /nombre/i);
});

test('dirección y teléfono son opcionales pero acotados', () => {
  assert.equal(validarSucursal({ direccion: '', telefono: '' }).error, undefined);
  assert.deepEqual(validarSucursal({ direccion: 'Vía Principal, Ciudad Demo' }).datos, {
    direccion: 'Vía Principal, Ciudad Demo',
  });
  assert.match(validarSucursal({ direccion: 'x'.repeat(201) }).error, /dirección/i);
  assert.match(validarSucursal({ telefono: 'x'.repeat(41) }).error, /teléfono/i);
});

// Una zona horaria inventada haría que el check-in del Bloque 6 decidiera con
// una hora que no existe; se comprueba contra Intl, que es quien la usará.
test('la zona horaria tiene que existir de verdad', () => {
  assert.equal(validarSucursal({ zona_horaria: 'America/Panama' }).error, undefined);
  assert.equal(validarSucursal({ zona_horaria: 'Europe/Madrid' }).error, undefined);
  assert.match(validarSucursal({ zona_horaria: 'Marte/Olympus' }).error, /zona horaria/i);
  assert.match(validarSucursal({ zona_horaria: '' }).error, /zona horaria/i);
});

// Misma lista blanca que en los ajustes: lo que no está declarado no llega a la
// base, así que no hay asignación masiva posible (ni activar/desactivar la única
// sucursal desde el panel, que dejaría el gimnasio sin dónde operar).
test('solo pasan las claves declaradas', () => {
  assert.match(validarSucursal({ id: 99 }).error, /no admite: id/);
  assert.match(validarSucursal({ codigo: 'otra' }).error, /no admite: codigo/);
  assert.match(validarSucursal({ activa: false }).error, /no admite: activa/);
  assert.match(validarSucursal({}).error, /nada que guardar/);
});
