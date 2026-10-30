const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  validarNegocio, validarImpuestos, validarMoneda, validarHorario, validarPoliticas, validarSerie, claveDesde,
} = require('./validadores');
const { filtrarClaves } = require('./catalogo');

// El panel es una comodidad; la validación de verdad es esta. Cada caso viene de
// un escenario de la spec de admin-settings.

test('negocio: el nombre comercial no puede quedar vacío', () => {
  assert.match(validarNegocio({ nombre_comercial: '   ' }), /nombre comercial/i);
  assert.equal(validarNegocio({ nombre_comercial: 'FORJA GYM' }), null);
});

test('negocio: el correo de contacto se valida', () => {
  assert.match(validarNegocio({ correo: 'no-es-un-correo' }), /correo/i);
  assert.equal(validarNegocio({ correo: 'hola@forja-gym.example' }), null);
  assert.equal(validarNegocio({ correo: '' }), null, 'vacío es válido: es opcional');
});

test('impuestos: la tasa es un porcentaje entre 0 y 100', () => {
  assert.equal(validarImpuestos({ productos: 7 }), null);
  assert.equal(validarImpuestos({ membresias: 0 }), null);
  assert.match(validarImpuestos({ productos: -1 }), /entre 0 y 100/);
  assert.match(validarImpuestos({ productos: 101 }), /entre 0 y 100/);
  assert.match(validarImpuestos({ servicios: 'siete' }), /entre 0 y 100/);
});

test('moneda: símbolo obligatorio y USD como sí/no', () => {
  assert.equal(validarMoneda({ simbolo: 'B/.', decimales: 2 }), null);
  assert.match(validarMoneda({ simbolo: '' }), /símbolo/i);
  assert.match(validarMoneda({ decimales: 9 }), /decimales/i);
  assert.match(validarMoneda({ usd_habilitado: 'sí' }), /sí o no/);
});

// La semana se guarda entera, así que los casos de un día se prueban sobre una
// semana completa en la que ese día es el distinto.
const SEMANA = [1, 2, 3, 4, 5, 6, 7].map((dow) => ({ dow, abre: '05:00', cierra: '22:00', cerrado: false }));
const semanaSalvo = (dia) => ({ dias: [dia, ...SEMANA.filter((d) => d.dow !== Number(dia.dow))] });

test('horario: formato de hora y cierre posterior a la apertura', () => {
  assert.equal(validarHorario({ dias: SEMANA }), null);
  assert.match(validarHorario(semanaSalvo({ dow: 1, abre: '25:00', cierra: '22:00' })), /HH:MM/);
  assert.match(validarHorario(semanaSalvo({ dow: 1, abre: '05:00', cierra: '05:00' })), /posterior/);
  assert.equal(validarHorario(semanaSalvo({ dow: 7, cerrado: true })), null, 'un día cerrado no necesita horas');
});

// El servidor solo cae al horario por defecto cuando la lista está VACÍA: si
// aceptara media semana, guardar dos días borraría los otros cinco del sitio.
test('horario: la semana tiene que venir completa', () => {
  assert.match(validarHorario({ dias: SEMANA.slice(0, 3) }), /siete días/);
  assert.equal(validarHorario({ cierres: [] }), null, 'sin la clave `dias` no se toca el horario');
});

test('horario: no se puede configurar dos veces el mismo día', () => {
  const dos = { dias: [{ dow: 1, abre: '05:00', cierra: '22:00' }, { dow: 1, abre: '06:00', cierra: '20:00' }] };
  assert.match(validarHorario(dos), /repetido/);
});

test('horario: un cierre excepcional necesita fecha y motivo', () => {
  assert.equal(validarHorario({ cierres: [{ fecha: '2026-12-25', motivo: 'Navidad' }] }), null);
  assert.match(validarHorario({ cierres: [{ fecha: '25-12-2026', motivo: 'Navidad' }] }), /AAAA-MM-DD/);
  assert.match(validarHorario({ cierres: [{ fecha: '2026-12-25', motivo: '' }] }), /motivo/);
});

test('políticas: los números tienen rango y el resto son sí/no', () => {
  assert.equal(validarPoliticas({ pase_diario_entradas_dia: 1, stock_negativo: false }), null);
  assert.match(validarPoliticas({ pase_diario_entradas_dia: 0 }), /entre 1 y 10/);
  assert.match(validarPoliticas({ umbral_caja: 5000 }), /entre 0 y 1000/);
  assert.match(validarPoliticas({ stock_negativo: 'no' }), /sí o no/);
});

test('numeración: el correlativo nunca retrocede', () => {
  const actual = { prefijo: 'REC-', proximo: 120, relleno: 4 };
  assert.equal(validarSerie({ proximo: 130 }, actual), null);
  assert.equal(validarSerie({ proximo: 120 }, actual), null);
  assert.match(validarSerie({ proximo: 90 }, actual), /no puede retroceder/);
  assert.match(validarSerie({ proximo: 0 }, actual), /mayor que cero/);
  assert.match(validarSerie({ relleno: 20 }, actual), /entre 0 y 12/);
});

// El prefijo va a una columna NOT NULL: dejarlo pasar sin ser texto terminaba en
// un 500 de la base en vez de en un 400 con su motivo.
test('numeración: el prefijo tiene que ser texto imprimible', () => {
  const actual = { prefijo: 'REC-', proximo: 120, relleno: 4 };
  assert.equal(validarSerie({ prefijo: '' }, actual), null, 'sin prefijo es válido');
  assert.equal(validarSerie({ prefijo: 'FAC-2026/' }, actual), null);
  assert.match(validarSerie({ prefijo: null }, actual), /debe ser texto/);
  assert.match(validarSerie({ prefijo: 'REC ñ' }, actual), /letras, números/);
  assert.match(validarSerie({ prefijo: 'DEMASIADO-LARGO' }, actual), /10 caracteres/);
});

// Number('') es 0: vaciar el campo del ITBMS en el panel se guardaba como
// "exento" sin que nadie lo pidiera.
test('un campo numérico vacío no es cero', () => {
  assert.match(validarImpuestos({ productos: '' }), /entre 0 y 100/);
  assert.match(validarMoneda({ decimales: '  ' }), /decimales/i);
  assert.match(validarPoliticas({ umbral_caja: null }), /sí o no|entre 0 y 1000/);
  assert.equal(validarImpuestos({ productos: '7' }), null, 'el texto de un <input> sigue valiendo');
});

// La clave viaja en la URL del PATCH: "Tarjeta Débito" no puede acabar en
// "tarjeta_d_bito" solo porque normalize('NFD') separe la tilde sin quitarla.
test('métodos de pago: la clave se genera sin acentos ni espacios', () => {
  assert.equal(claveDesde('Tarjeta Débito'), 'tarjeta_debito');
  assert.equal(claveDesde('Crédito'), 'credito');
  assert.equal(claveDesde('Yappy Business'), 'yappy_business');
  assert.equal(claveDesde('  ¿Ñango?  '), 'nango');
  assert.equal(claveDesde('€€€'), '', 'sin letras ni números no hay clave');
});

test('la lista blanca descarta claves ajenas a la sección', () => {
  assert.deepEqual(filtrarClaves('impuestos', { productos: 10 }), { datos: { productos: 10 } });
  assert.match(filtrarClaves('impuestos', { productos: 10, es_admin: true }).error, /no admite: es_admin/);
  assert.match(filtrarClaves('negocio', {}).error, /nada que guardar/);
});

// Lo que se valida tiene que ser lo que se guarda: un <input> manda texto y en
// jsonb eso deja la sección con unas tasas número y otras texto.
test('los campos numéricos se guardan como números, no como el texto del input', () => {
  assert.deepEqual(filtrarClaves('impuestos', { productos: '10.5' }), { datos: { productos: 10.5 } });
  assert.deepEqual(filtrarClaves('moneda', { decimales: '2', simbolo: 'B/.' }), { datos: { decimales: 2, simbolo: 'B/.' } });
  assert.deepEqual(
    filtrarClaves('politicas', { umbral_caja: '5', stock_negativo: false }),
    { datos: { umbral_caja: 5, stock_negativo: false } },
    'los sí/no no se tocan'
  );
  assert.deepEqual(filtrarClaves('impuestos', { productos: 'siete' }), { datos: { productos: 'siete' } },
    'lo que no es número se deja intacto para que el validador dé el mensaje bueno');
});
