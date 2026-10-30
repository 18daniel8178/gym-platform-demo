const { supabase } = require('../infrastructure/supabase');
const { vigentesAl } = require('../modules/members/consentimientos');
const { sumarDias, DIAS_POR_PERIODO } = require('../modules/memberships/service');

// Escribe en la base el gimnasio ficticio que genera generar/gimnasio.js. Las
// filas de la bitácora llevan la MISMA forma que las que escribe el código real
// (client.create, membership.activate, payment.create, payment.void,
// member.estado), para que la Actividad y la línea de tiempo las lean igual.

const EVIDENCIA = 'Firma del formulario de ingreso en recepción';
const LOTE = 500;
const CONCURRENCIA = 8;

async function obligatorio(promesa, que) {
  const { data, error } = await promesa;
  if (error) throw new Error(`${que}: ${error.message}`);
  return data;
}

async function insertar(tabla, filas, columnas = null) {
  const devueltas = [];
  for (let i = 0; i < filas.length; i += LOTE) {
    const consulta = supabase.from(tabla).insert(filas.slice(i, i + LOTE));
    const data = await obligatorio(columnas ? consulta.select(columnas) : consulta, `insertar en ${tabla}`);
    if (columnas) devueltas.push(...data);
  }
  return devueltas;
}

// Cuenta de Auth SIN contraseña: en la demo se entra con un clic (enlace mágico).
async function crearCuenta({ email, appMetadata = {} }) {
  const data = await obligatorio(
    supabase.auth.admin.createUser({ email, email_confirm: true, app_metadata: appMetadata }),
    `crear la cuenta ${email}`
  );
  return data.user.id;
}

// Crea las cuentas en tandas pequeñas: rápido, sin saturar el Auth local.
async function crearCuentasDeSocios(socios) {
  const ids = new Map();
  for (let i = 0; i < socios.length; i += CONCURRENCIA) {
    const tanda = socios.slice(i, i + CONCURRENCIA);
    const creados = await Promise.all(tanda.map((s) => crearCuenta({ email: s.email })));
    tanda.forEach((s, j) => ids.set(s.clave, creados[j]));
  }
  return ids;
}

const marcaAlta = (dia) => `${dia}T10:00:00-05:00`;
const masMinutos = (marca, minutos) => new Date(Date.parse(marca) + minutos * 60000).toISOString();

function filaPerfil(socio, userId) {
  return {
    user_id: userId,
    ...socio.perfil,
    created_at: marcaAlta(socio.alta),
    firma_foto_pendiente: socio.firmaFotoPendiente,
    estado_miembro: socio.estado,
    estado_motivo: socio.motivo,
    estado_cambiado_en: socio.estadoCambiadoEn,
    origen: socio.origen,
    etiquetas: socio.etiquetas,
  };
}

function filasDelExpediente(socio, userId, { documentos, recepcion, planes }) {
  // La versión que regía el día de su alta, no la de hoy: por eso los socios
  // antiguos quedan con una versión por aceptar cuando se publica una nueva.
  const consentimientos = socio.consiente
    ? vigentesAl(documentos, marcaAlta(socio.alta)).map((d) => ({ user_id: userId, documento_id: d.id, aceptado_en: marcaAlta(socio.alta), medio: 'mostrador', evidencia: EVIDENCIA, registrado_por: recepcion.id }))
    : [];
  const notas = socio.notas.map((n) => ({ user_id: userId, texto: n.texto, autor_id: recepcion.id, autor_email: recepcion.email, created_at: n.fecha }));
  const m = socio.membresia;
  const membresias = m ? [{ user_id: userId, plan_id: planes[m.periodo].id, fecha_inicio: m.fecha_inicio, fecha_fin: m.fecha_fin }] : [];
  return { consentimientos, notas, membresias };
}

function filaPago(pago, userId, { planes, recepcion }) {
  const plan = planes[pago.periodo];
  return {
    user_id: userId, plan_id: plan.id, monto: plan.precio, metodo: pago.metodo, origen: pago.origen, estado: pago.estado,
    motivo_anulacion: pago.motivo_anulacion || null, registrado_por: pago.origen === 'recepcion' ? recepcion.id : null, created_at: pago.fecha,
  };
}

const bitacora = (actor, { accion, entidad, entidadId, detalle, fecha }) => ({
  actor_id: actor.id, actor_email: actor.email, accion, entidad, entidad_id: String(entidadId), detalle, created_at: fecha,
});

// Alta presencial y cambios de estado, como los audita el panel (sin datos de salud).
function bitacoraDeSocio(socio, userId, { personal, codigos }) {
  const filas = [];
  if (['mostrador', 'referido'].includes(socio.origen)) {
    const { nombre_completo, documento, telefono } = socio.perfil;
    filas.push(bitacora(personal.recepcion, {
      accion: 'client.create', entidad: 'profiles', entidadId: userId, fecha: marcaAlta(socio.alta),
      detalle: { despues: { nombre_completo, documento, telefono, email: socio.email, estado_miembro: socio.estado === 'prospecto' ? 'prospecto' : 'activo', origen: socio.origen }, consentimientos: socio.consiente ? codigos : [] },
    }));
  }
  if (socio.motivo) {
    filas.push(bitacora(personal.gerente, {
      accion: 'member.estado', entidad: 'profiles', entidadId: userId, fecha: socio.estadoCambiadoEn,
      detalle: { antes: { estado_miembro: 'activo', estado_motivo: null }, despues: { estado_miembro: socio.estado, estado_motivo: socio.motivo } },
    }));
  }
  return filas;
}

// Cobro en recepción (activa o renueva) y, si se anuló, su anulación.
function bitacoraDePago(pago, { periodo, planes, personal }) {
  if (pago.origen !== 'recepcion') return [];
  const plan = planes[periodo];
  const dia = pago.created_at.slice(0, 10);
  if (pago.estado === 'anulado') {
    return [bitacora(personal.gerente, {
      accion: 'payment.void', entidad: 'payments', entidadId: pago.id, fecha: masMinutos(pago.created_at, 12),
      detalle: { antes: { estado: 'aprobado' }, despues: { estado: 'anulado', motivo: pago.motivo_anulacion } },
    })];
  }
  return [bitacora(personal.recepcion, {
    accion: 'membership.activate', entidad: 'memberships', entidadId: pago.user_id, fecha: pago.created_at,
    detalle: { despues: { plan: plan.nombre, monto: plan.precio, metodo: pago.metodo, fecha_inicio: dia, fecha_fin: sumarDias(dia, DIAS_POR_PERIODO[periodo]), origen: 'recepcion' } },
  })];
}

module.exports = {
  obligatorio,
  insertar,
  crearCuenta,
  crearCuentasDeSocios,
  filaPerfil,
  filasDelExpediente,
  filaPago,
  bitacora,
  bitacoraDeSocio,
  bitacoraDePago,
};
