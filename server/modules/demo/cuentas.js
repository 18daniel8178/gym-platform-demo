// Cuentas de la demo local. Lista FIJA y única: el sembrador
// las crea con estos datos y /api/demo/entrar solo abre sesión con ellas —no
// sirve para entrar como cualquier otra cuenta, ni siquiera en local—.
//
// `.test` es un dominio reservado (RFC 2606): ningún correo de la demo puede
// llegar a una persona real.
const DOMINIO_DEMO = 'demo.forja.test';

const CUENTAS_DEMO = Object.freeze([
  { clave: 'propietario', etiqueta: 'Propietario', nombre: 'Andrés Vega', tipo: 'propietario' },
  { clave: 'gerente', etiqueta: 'Gerente', nombre: 'Laura Ríos', tipo: 'personal', rol: 'gerente' },
  { clave: 'recepcion', etiqueta: 'Recepción', nombre: 'Camila Ortega', tipo: 'personal', rol: 'recepcion' },
  { clave: 'cajero', etiqueta: 'Cajero · cafetería', nombre: 'Diego Herrera', tipo: 'personal', rol: 'cajero' },
  { clave: 'contabilidad', etiqueta: 'Contabilidad', nombre: 'Paola Delgado', tipo: 'personal', rol: 'contabilidad' },
  { clave: 'socio', etiqueta: 'Socio', nombre: 'Mateo Solís', tipo: 'socio' },
].map((c) => Object.freeze({ ...c, email: `${c.clave}@${DOMINIO_DEMO}` })));

const cuentaDemo = (clave) => CUENTAS_DEMO.find((c) => c.clave === clave) || null;

module.exports = { CUENTAS_DEMO, DOMINIO_DEMO, cuentaDemo };
