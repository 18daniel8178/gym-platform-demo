const { NOMBRES_F, NOMBRES_M, APELLIDOS, PARENTESCOS_F, PARENTESCOS_M, CONDICIONES_MEDICAS } = require('../catalogos');
const { DOMINIO_DEMO } = require('../../modules/demo/cuentas');
const { sumarDias } = require('../../modules/memberships/service');

// Personas ficticias de la demo: nombre, cédula, teléfono, nacimiento y
// contactos de emergencia con la forma que tienen en un gimnasio panameño.

function nombrePersona(azar) {
  const mujer = azar.probabilidad(0.5);
  const nombre = azar.elegir(mujer ? NOMBRES_F : NOMBRES_M);
  const apellido1 = azar.elegir(APELLIDOS);
  const apellido2 = azar.elegir(APELLIDOS);
  return { nombre, apellido1, apellido2, mujer, completo: `${nombre} ${apellido1} ${apellido2}` };
}

// Cédula provincia-tomo-asiento. Gimnasio ficticio cerca de Panamá Oeste: quien nació antes
// de 2014 figura en la provincia 8 y después en la 13; hay gente del interior,
// panameños nacidos en el extranjero (PE) y extranjeros residentes (E).
function cedula(azar) {
  const tipo = azar.ponderado([['8', 70], ['13', 6], ['interior', 12], ['PE', 4], ['E', 8]]);
  if (tipo === 'PE') return `PE-${azar.entero(1, 20)}-${azar.entero(100, 9999)}`;
  if (tipo === 'E') return `E-8-${azar.entero(10000, 199999)}`;
  const provincia = tipo === 'interior' ? azar.elegir(['2', '3', '4', '6', '7', '9']) : tipo;
  return `${provincia}-${azar.entero(100, 999)}-${azar.entero(100, 2999)}`;
}

// Empieza por 0, que ningún número de Panamá usa: el WhatsApp del panel no llega a nadie.
const telefono = (azar) => `0${azar.entero(100, 999)}-${String(azar.entero(0, 9999)).padStart(4, '0')}`;

function fechaNacimiento(azar, hoy) {
  const dias = azar.entero(17, 61) * 365 + azar.entero(0, 364);
  return sumarDias(hoy, -dias);
}

const PAREJAS = new Set(['esposa', 'esposo', 'pareja']);

// Del sexo del contacto, sin repetir el parentesco del otro contacto ni sumar
// dos parejas; la pareja o el cónyuge es del sexo opuesto al socio, que es lo
// que muestra un padrón típico (a partes iguales la muestra no se vería real).
function parentescosPosibles({ mujer, socio, previo }) {
  const puedeSerPareja = mujer !== socio.mujer;
  const choca = (p) => p === previo || (PAREJAS.has(p) && PAREJAS.has(previo));
  return (mujer ? PARENTESCOS_F : PARENTESCOS_M).filter((p) => (puedeSerPareja || !PAREJAS.has(p)) && !choca(p));
}

// En Panamá el primer apellido viene del padre y el segundo de la madre: papá y
// los hermanos comparten el primero del socio y mamá lleva el segundo.
function apellidoDelContacto(azar, socio, parentesco) {
  if (parentesco === 'mamá') return socio.apellido2;
  if (['papá', 'hermano', 'hermana'].includes(parentesco)) return socio.apellido1;
  return azar.elegir(APELLIDOS);
}

// Como lo escribe recepción: el parentesco entre paréntesis.
function contactoEmergencia(azar, socio, previo) {
  const mujer = azar.probabilidad(0.5);
  const parentesco = azar.elegir(parentescosPosibles({ mujer, socio, previo }));
  const nombre = azar.elegir(mujer ? NOMBRES_F : NOMBRES_M);
  const apellido = apellidoDelContacto(azar, socio, parentesco);
  return { parentesco, nombre: `${nombre} ${apellido} (${parentesco})`, telefono: telefono(azar) };
}

// Sin tildes ni espacios: "De León" → "deleon", "Ábrego" → "abrego".
const paraCorreo = (texto) =>
  texto.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z]/g, '').toLowerCase();

// El índice hace único el correo aunque se repita el nombre.
const correoPara = (persona, indice) =>
  `${paraCorreo(persona.nombre)}.${paraCorreo(persona.apellido1)}${indice}@${DOMINIO_DEMO}`;

// `incompleto`: un socio importado por CSV, que llega solo con los campos
// mínimos (regla de negocio: nacimiento y contactos pueden faltar).
// `persona`: identidad fija (el socio de la demo); si no, se inventa una.
function perfilSocio(azar, { hoy, incompleto = false, persona: fija = null }) {
  const persona = fija ?? nombrePersona(azar);
  const e1 = contactoEmergencia(azar, persona);
  const e2 = contactoEmergencia(azar, persona, e1.parentesco);
  const perfil = {
    nombre_completo: persona.completo,
    fecha_nacimiento: fechaNacimiento(azar, hoy),
    documento: cedula(azar),
    telefono: telefono(azar),
    emergencia1_nombre: e1.nombre,
    emergencia1_telefono: e1.telefono,
    emergencia2_nombre: e2.nombre,
    emergencia2_telefono: e2.telefono,
    entrenado_antes: azar.probabilidad(0.6),
    condiciones_medicas: azar.probabilidad(0.12) ? azar.elegir(CONDICIONES_MEDICAS) : null,
  };
  if (incompleto) {
    for (const campo of ['fecha_nacimiento', 'emergencia1_nombre', 'emergencia1_telefono', 'emergencia2_nombre', 'emergencia2_telefono']) {
      perfil[campo] = null;
    }
  }
  return { persona, perfil };
}

module.exports = { nombrePersona, cedula, telefono, correoPara, perfilSocio };
