const { crearAzar } = require('../azar');
const { ETIQUETAS, NOTAS, MOTIVOS_BLOQUEO, MOTIVOS_ARCHIVO, MOTIVOS_INACTIVO } = require('../catalogos');
const { perfilSocio, correoPara, nombrePersona, cedula } = require('./personas');
const { historialSocio, pagosDe, VENTANA_DIAS, hora, marca } = require('./historial');
const { normalizarDocumento } = require('../../modules/members/normalizacion');
const { sumarDias } = require('../../modules/memberships/service');
const { cuentaDemo } = require('../../modules/demo/cuentas');

// El gimnasio ficticio completo de la demo: socios, el socio de demostración y
// los visitantes del pase diario. Puro y determinista: misma semilla y mismo
// día, mismo gimnasio. Lo escribe en la base server/demo/sembrar.js.

const ESTADOS = [['activo', 72], ['inactivo', 10], ['prospecto', 8], ['bloqueado', 3], ['archivado', 7]];
const ORIGENES = [['mostrador', 55], ['web', 30], ['referido', 12], ['importacion', 3]];
const MOTIVO_SEGUN_ESTADO = { bloqueado: MOTIVOS_BLOQUEO, archivado: MOTIVOS_ARCHIVO, inactivo: MOTIVOS_INACTIVO };

const diasEntre = (desde, hasta) => Math.round((Date.parse(hasta) - Date.parse(desde)) / 864e5);
const diaEntre = (azar, desde, hasta) => sumarDias(desde, azar.entero(0, Math.max(0, diasEntre(desde, hasta))));

function etiquetasDe(azar) {
  if (!azar.probabilidad(0.4)) return [];
  const primera = azar.elegir(ETIQUETAS);
  const segunda = azar.elegir(ETIQUETAS);
  return primera === segunda || azar.probabilidad(0.6) ? [primera] : [primera, segunda];
}

// Un importado no aceptó nada ante nadie; un prospecto, a veces; el resto, casi siempre.
function consienteDe(azar, { estado, origen }) {
  if (origen === 'importacion') return false;
  return azar.probabilidad(estado === 'prospecto' ? 0.5 : 0.9);
}

function notasDe(azar, { alta, hoy }) {
  if (!azar.probabilidad(0.18)) return [];
  return [{ texto: azar.elegir(NOTAS), fecha: marca(diaEntre(azar, alta, hoy), hora(azar)) }];
}

// Cuándo pasó el socio a su estado actual: después de vencer su membresía.
function cambioDeEstado(azar, { estado, membresia, hoy }) {
  const motivos = MOTIVO_SEGUN_ESTADO[estado];
  if (!motivos) return { motivo: null, estadoCambiadoEn: null };
  const desde = membresia.fecha_fin < hoy ? membresia.fecha_fin : hoy;
  return { motivo: azar.elegir(motivos), estadoCambiadoEn: marca(diaEntre(azar, desde, hoy), hora(azar)) };
}

// Cédula que no repite la de otro socio (normalizada): si no, la demo dispararía
// avisos de duplicado sin que nadie lo buscara.
function documentoUnico(azar, documento, usados) {
  let actual = documento;
  while (usados.has(normalizarDocumento(actual))) actual = cedula(azar);
  usados.add(normalizarDocumento(actual));
  return actual;
}

function generarSocio(azar, { indice, hoy, usados }) {
  const estado = azar.ponderado(ESTADOS);
  const origen = azar.ponderado(ORIGENES);
  const { persona, perfil } = perfilSocio(azar, { hoy, incompleto: origen === 'importacion' && azar.probabilidad(0.5) });
  perfil.documento = documentoUnico(azar, perfil.documento, usados);
  const historial = historialSocio(azar, { estado, hoy });
  const webReciente = origen === 'web' && historial.alta >= sumarDias(hoy, -30);
  return {
    clave: `socio-${String(indice).padStart(3, '0')}`,
    email: correoPara(persona, indice),
    perfil,
    estado,
    ...cambioDeEstado(azar, { estado, membresia: historial.membresia, hoy }),
    origen,
    etiquetas: etiquetasDe(azar),
    firmaFotoPendiente: webReciente || azar.probabilidad(0.03),
    consiente: consienteDe(azar, { estado, origen }),
    notas: notasDe(azar, { alta: historial.alta, hoy }),
    ...historial,
  };
}

// El socio con el que se entra al área de socio: activo, mensual, al día. Su
// identidad es fija para que sus contactos de emergencia salgan de sus apellidos.
const SOCIO_DEMO = Object.freeze({ nombre: 'Mateo', apellido1: 'Solís', apellido2: 'Rivera', mujer: false, completo: 'Mateo Solís Rivera' });

function generarSocioDemo(azar, { hoy, usados }) {
  const cuenta = cuentaDemo('socio');
  const { perfil } = perfilSocio(azar, { hoy, persona: SOCIO_DEMO });
  perfil.documento = documentoUnico(azar, perfil.documento, usados);
  const fin = sumarDias(hoy, 12);
  const alta = sumarDias(hoy, -210);
  const pagos = pagosDe(azar, { periodo: 'mensual', fin, alta, hoy });
  return {
    clave: cuenta.clave, email: cuenta.email, perfil, estado: 'activo', motivo: null, estadoCambiadoEn: null,
    origen: 'mostrador', etiquetas: ['turno noche'], firmaFotoPendiente: false, consiente: true, notas: [], alta,
    membresia: { periodo: 'mensual', fecha_inicio: pagos[0].fecha.slice(0, 10), fecha_fin: fin }, pagos,
  };
}

// Pase diario a visitantes sin cuenta: pocos al día, más en unos días que en otros.
function generarVisitantes(azar, { hoy }) {
  const visitantes = [];
  for (let d = VENTANA_DIAS - 1; d >= 0; d -= 1) {
    const cuantos = azar.probabilidad(0.35) ? azar.entero(1, 2) : 0;
    for (let i = 0; i < cuantos; i += 1) {
      const metodo = azar.ponderado([['efectivo', 70], ['yappy', 30]]);
      visitantes.push({ nombre_cliente: nombrePersona(azar).completo, metodo, fecha: marca(sumarDias(hoy, -d), hora(azar)) });
    }
  }
  return visitantes;
}

function generarGimnasio(semilla, { hoy, cantidad = 150 }) {
  const azar = crearAzar(semilla);
  const usados = new Set();
  const socios = Array.from({ length: cantidad }, (_, i) => generarSocio(azar, { indice: i + 1, hoy, usados }));
  const socioDemo = generarSocioDemo(azar, { hoy, usados });
  return { socios, socioDemo, visitantes: generarVisitantes(azar, { hoy }) };
}

module.exports = { generarGimnasio };
