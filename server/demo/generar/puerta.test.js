const { test } = require('node:test');
const assert = require('node:assert/strict');
const { crearAzar } = require('../azar');
const { generarCheckinsDeHoy } = require('./puerta');
const { MOTIVOS } = require('../../modules/checkin/decision');

// El día de hoy en la puerta: lo que la demo necesita para que la pantalla de
// check-in y el aforo no estén en blanco cuando se presenta la demo.

const HOY = '2026-10-13';

const socios = [
  ...Array.from({ length: 40 }, (_, i) => ({ clave: `al-dia-${i}`, estado: 'activo', membresia: { fecha_fin: '2026-12-01' } })),
  ...Array.from({ length: 6 }, (_, i) => ({ clave: `vencido-${i}`, estado: 'activo', membresia: { fecha_fin: '2026-09-01' } })),
  { clave: 'bloqueado-1', estado: 'bloqueado', membresia: { fecha_fin: '2026-12-01' } },
  { clave: 'prospecto-1', estado: 'prospecto', membresia: null },
];

const generar = (semilla = 7) => generarCheckinsDeHoy(crearAzar(semilla), { socios, hoy: HOY, hastaHora: 18 });

test('la misma semilla da la misma puerta', () => {
  assert.deepEqual(generar(), generar());
});

test('todas las entradas son de hoy, desde la apertura y hasta la hora de la siembra', () => {
  for (const c of generar()) {
    assert.ok(c.ocurrido_en.startsWith(HOY), c.ocurrido_en);
    const hora = Number(c.ocurrido_en.slice(11, 13));
    assert.ok(hora >= 5 && hora <= 18, c.ocurrido_en);
  }
});

test('vienen en orden, como pasaron', () => {
  const entradas = generar();
  const ordenadas = [...entradas].sort((a, b) => a.ocurrido_en.localeCompare(b.ocurrido_en));
  assert.deepEqual(entradas, ordenadas);
});

test('la mayoría entra, y los rechazos traen un motivo del catálogo', () => {
  const entradas = generar();
  const permitidas = entradas.filter((c) => c.resultado === 'permitido');
  const rechazos = entradas.filter((c) => c.resultado === 'rechazado');

  assert.ok(permitidas.length > rechazos.length * 3, `${permitidas.length} permitidas vs ${rechazos.length} rechazos`);
  assert.ok(rechazos.length > 0, 'un día real tiene algún rechazo');
  for (const r of rechazos) assert.ok(MOTIVOS[r.motivo], r.motivo);
});

test('cada rechazo le pasa a quien le corresponde, no a cualquiera', () => {
  for (const c of generar()) {
    if (c.motivo === 'membresia_vencida') assert.match(c.clave, /^vencido-/);
    if (c.motivo === 'socio_bloqueado') assert.match(c.clave, /^bloqueado-/);
    if (c.resultado === 'permitido') assert.match(c.clave, /^al-dia-/);
  }
});

test('nadie entra dos veces el mismo día', () => {
  const permitidas = generar().filter((c) => c.resultado === 'permitido').map((c) => c.clave);
  assert.equal(new Set(permitidas).size, permitidas.length);
});

test('casi todos escanean su carnet; alguno se busca a mano', () => {
  const metodos = new Set(generar().map((c) => c.metodo));
  assert.deepEqual([...metodos].sort(), ['manual', 'qr']);
});
