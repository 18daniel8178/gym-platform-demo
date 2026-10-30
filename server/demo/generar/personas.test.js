const { test } = require('node:test');
const assert = require('node:assert/strict');
const { crearAzar } = require('../azar');
const { perfilSocio, cedula, telefono, correoPara } = require('./personas');
const { NOMBRES_F, NOMBRES_M, PARENTESCOS_F, PARENTESCOS_M } = require('../catalogos');

const HOY = '2026-09-22';
const muestra = (semilla, n, opciones = {}) => {
  const azar = crearAzar(semilla);
  return Array.from({ length: n }, () => perfilSocio(azar, { hoy: HOY, ...opciones }));
};

test('la misma semilla da las mismas personas', () => {
  assert.deepEqual(muestra(11, 30), muestra(11, 30));
});

test('las cédulas tienen formato panameño', () => {
  const azar = crearAzar(12);
  for (let i = 0; i < 500; i++) {
    const c = cedula(azar);
    assert.match(c, /^(([1-9]|1[0-3])-\d{1,4}-\d{1,5}|PE-\d{1,2}-\d{1,5}|E-8-\d{4,6})$/, c);
  }
});

// Ningún número en Panamá empieza por 0: así el botón de WhatsApp del panel
// nunca abre el chat de una persona real.
test('los teléfonos tienen 8 dígitos y empiezan por 0, que no existe en Panamá', () => {
  const azar = crearAzar(13);
  for (let i = 0; i < 200; i++) assert.match(telefono(azar), /^0\d{3}-\d{4}$/);
});

test('la edad del socio está entre 17 y 62 años', () => {
  for (const { perfil } of muestra(14, 200)) {
    const edad = (Date.parse(HOY) - Date.parse(perfil.fecha_nacimiento)) / (365.25 * 864e5);
    assert.ok(edad >= 17 && edad < 63, `${perfil.fecha_nacimiento} → ${edad}`);
  }
});

test('el correo sale del nombre, sin tildes, y usa el dominio reservado', () => {
  const persona = { nombre: 'Anayansi', apellido1: 'De León', apellido2: 'Ábrego' };
  assert.equal(correoPara(persona, 7), 'anayansi.deleon7@demo.forja.test');
});

test('un perfil completo trae nacimiento y los dos contactos de emergencia', () => {
  for (const { perfil } of muestra(15, 50)) {
    for (const campo of ['fecha_nacimiento', 'emergencia1_nombre', 'emergencia1_telefono', 'emergencia2_nombre', 'emergencia2_telefono']) {
      assert.ok(perfil[campo], `${campo} vacío`);
    }
  }
});

test('un perfil importado puede venir sin nacimiento ni contactos (campos mínimos del CSV)', () => {
  for (const { perfil } of muestra(16, 20, { incompleto: true })) {
    assert.equal(perfil.fecha_nacimiento, null);
    assert.equal(perfil.emergencia1_nombre, null);
    assert.ok(perfil.nombre_completo && perfil.documento && perfil.telefono);
  }
});

test('las condiciones médicas son la excepción, no la regla', () => {
  const conCondicion = muestra(17, 1000).filter(({ perfil }) => perfil.condiciones_medicas).length;
  assert.ok(conCondicion > 60 && conCondicion < 180, `salieron ${conCondicion} de 1000`);
});

// Contactos de emergencia creíbles: "Nombre Apellido (parentesco)", como los anota recepción.
const contactos = (perfil) => [perfil.emergencia1_nombre, perfil.emergencia2_nombre].map((texto) => {
  const [, nombre, apellido, parentesco] = texto.match(/^(\S+) (.+) \(([^)]+)\)$/);
  return { nombre, apellido, parentesco };
});
const FEMENINOS = new Set(PARENTESCOS_F.filter((p) => !PARENTESCOS_M.includes(p)));
const MASCULINOS = new Set(PARENTESCOS_M.filter((p) => !PARENTESCOS_F.includes(p)));
const PAREJAS = new Set(['esposa', 'esposo', 'pareja']);

test('el parentesco concuerda con el nombre del contacto', () => {
  for (const { perfil } of muestra(18, 300)) {
    for (const c of contactos(perfil)) {
      if (FEMENINOS.has(c.parentesco)) assert.ok(NOMBRES_F.includes(c.nombre), `${c.nombre} (${c.parentesco})`);
      if (MASCULINOS.has(c.parentesco)) assert.ok(NOMBRES_M.includes(c.nombre), `${c.nombre} (${c.parentesco})`);
    }
  }
});

test('papá y hermanos llevan el primer apellido del socio y mamá el segundo', () => {
  for (const { persona, perfil } of muestra(19, 300)) {
    for (const c of contactos(perfil)) {
      if (['papá', 'hermano', 'hermana'].includes(c.parentesco)) assert.equal(c.apellido, persona.apellido1);
      if (c.parentesco === 'mamá') assert.equal(c.apellido, persona.apellido2);
    }
  }
});

test('los dos contactos no repiten parentesco ni suman dos parejas', () => {
  for (const { perfil } of muestra(20, 300)) {
    const [a, b] = contactos(perfil).map((c) => c.parentesco);
    assert.notEqual(a, b);
    assert.ok(!(PAREJAS.has(a) && PAREJAS.has(b)), `${a} y ${b}`);
  }
});

const esMujer = (nombre) => NOMBRES_F.includes(nombre);

test('la pareja o el cónyuge es del sexo opuesto al socio (un padrón típico)', () => {
  for (const { persona, perfil } of muestra(21, 300)) {
    for (const c of contactos(perfil)) {
      if (PAREJAS.has(c.parentesco)) assert.notEqual(esMujer(c.nombre), esMujer(persona.nombre), `${persona.nombre} y ${c.nombre} (${c.parentesco})`);
    }
  }
});

test('salen todos los parentescos del catálogo', () => {
  const vistos = new Set(muestra(22, 300).flatMap(({ perfil }) => contactos(perfil).map((c) => c.parentesco)));
  assert.deepEqual([...vistos].sort(), [...new Set([...PARENTESCOS_F, ...PARENTESCOS_M])].sort());
});

test('con una identidad fija (el socio de la demo) sus contactos usan sus apellidos', () => {
  const persona = { nombre: 'Mateo', apellido1: 'Solís', apellido2: 'Rivera', mujer: false, completo: 'Mateo Solís Rivera' };
  const perfiles = muestra(23, 100, { persona });
  for (const { perfil } of perfiles) {
    assert.equal(perfil.nombre_completo, 'Mateo Solís Rivera');
    for (const c of contactos(perfil)) {
      if (c.parentesco === 'papá') assert.equal(c.apellido, 'Solís');
      if (c.parentesco === 'mamá') assert.equal(c.apellido, 'Rivera');
      if (PAREJAS.has(c.parentesco)) assert.ok(esMujer(c.nombre), `${c.nombre} (${c.parentesco})`);
    }
  }
});
