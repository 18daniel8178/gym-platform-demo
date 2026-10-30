const { supabase } = require('../infrastructure/supabase');
const { hoyPanama, sumarDias } = require('../modules/memberships/service');
const { CUENTAS_DEMO } = require('../modules/demo/cuentas');
const { esUrlLocal } = require('../modules/demo/modoDemo');
const { generarGimnasio } = require('./generar/gimnasio');
const { generarCheckinsDeHoy } = require('./generar/puerta');
const { crearAzar } = require('./azar');
const esc = require('./escribir');

// Siembra la base de la demo LOCAL con el gimnasio ficticio.
//   node server/demo/sembrar.js   (lo lanza el orquestador: scripts/demo)
//
// Se niega a correr contra un Supabase que no sea local: el .env del server apunta
// a producción, y sin esta guarda un descuido crearía 151 socios falsos allí.

const SEMILLA = Number(process.env.DEMO_SEMILLA) || 2026;
const CANTIDAD = 150;

async function cargarCatalogos() {
  const planes = await esc.obligatorio(supabase.from('membership_plans').select('id, nombre, periodo, precio'), 'leer planes');
  const roles = await esc.obligatorio(supabase.from('roles').select('id, clave'), 'leer roles');
  const docs = await esc.obligatorio(
    supabase.from('consent_documents').select('id, codigo, version, titulo, texto, obligatorio, publicado_en'),
    'leer documentos de consentimiento'
  );
  return {
    planes: Object.fromEntries(planes.map((p) => [p.periodo, p])),
    roles: Object.fromEntries(roles.map((r) => [r.clave, r])),
    // TODAS las versiones: cada socio aceptó la que regía el día de su alta.
    documentos: docs,
  };
}

const REGLAMENTO_V2 = `1. El uso de toalla sobre los equipos es obligatorio.
2. Las pesas y discos se devuelven a su lugar después de usarlos.
3. El área de pesas libres se desocupa 15 minutos antes del cierre.
4. El casillero es por sesión: lo que quede dentro se retira al cerrar.
5. El carnet es personal e intransferible.`;

// La migración crea las versiones iniciales con la fecha en que se instala, pero
// en la demo el gimnasio lleva meses abierto: se fechan antes del socio más
// antiguo, o nadie habría podido aceptarlas el día de su alta.
async function fecharDocumentosDeApertura(propietario, primeraAlta) {
  const apertura = `${sumarDias(primeraAlta, -30)}T08:00:00-05:00`;
  await esc.obligatorio(
    supabase.from('consent_documents')
      .update({ publicado_en: apertura, publicado_por: propietario.id })
      .eq('version', 1),
    'fechar los documentos de apertura'
  );
  return apertura;
}

// El dueño publicó un reglamento nuevo hace mes y medio: quien se inscribió
// antes aceptó la v1 y su ficha lo muestra pendiente de aceptar la v2. Es lo que
// pasa de verdad cada vez que cambian las reglas del gimnasio.
async function publicarReglamentoNuevo(propietario, hoy) {
  const fecha = `${sumarDias(hoy, -45)}T09:00:00-05:00`;
  const [doc] = await esc.obligatorio(
    supabase.from('consent_documents').insert({
      codigo: 'reglamento',
      version: 2,
      titulo: 'Reglamento interno del gimnasio',
      texto: REGLAMENTO_V2,
      publicado_en: fecha,
      publicado_por: propietario.id,
    }).select('id, codigo, version, titulo, texto, obligatorio, publicado_en'),
    'publicar la versión 2 del reglamento'
  );
  const bitacora = esc.bitacora(propietario, {
    accion: 'consent.publish',
    entidad: 'consent_documents',
    entidadId: doc.id,
    fecha,
    detalle: { despues: { codigo: doc.codigo, version: doc.version, titulo: doc.titulo } },
  });
  return { doc, bitacora };
}

// El propietario entra por app_metadata (el bootstrap real) y el resto con su rol
// en user_roles, igual que los asigna la sección Equipo.
async function sembrarPersonal({ roles }) {
  const personal = {};
  for (const c of CUENTAS_DEMO.filter((x) => x.tipo !== 'socio')) {
    const id = await esc.crearCuenta({ email: c.email, appMetadata: c.tipo === 'propietario' ? { role: 'admin' } : {} });
    if (c.rol) await esc.obligatorio(supabase.from('user_roles').insert({ user_id: id, role_id: roles[c.rol].id }), `rol de ${c.clave}`);
    personal[c.clave] = { id, email: c.email };
  }
  return personal;
}

async function sembrarSocios(socios, ctx) {
  const ids = await esc.crearCuentasDeSocios(socios);
  await esc.insertar('profiles', socios.map((s) => esc.filaPerfil(s, ids.get(s.clave))));
  const expedientes = socios.map((s) => esc.filasDelExpediente(s, ids.get(s.clave), ctx));
  await esc.insertar('member_consents', expedientes.flatMap((e) => e.consentimientos));
  await esc.insertar('member_notes', expedientes.flatMap((e) => e.notas));
  await esc.insertar('memberships', expedientes.flatMap((e) => e.membresias));
  return ids;
}

async function sembrarPagos(socios, ids, ctx) {
  const filas = socios.flatMap((s) => s.pagos.map((p) => esc.filaPago(p, ids.get(s.clave), ctx)));
  const pagos = await esc.insertar('payments', filas, 'id, user_id, plan_id, metodo, origen, estado, motivo_anulacion, created_at');
  const periodoDe = Object.fromEntries(Object.values(ctx.planes).map((p) => [p.id, p.periodo]));
  const bitacora = pagos.flatMap((p) => esc.bitacoraDePago(p, { periodo: periodoDe[p.plan_id], planes: ctx.planes, personal: ctx.personal }));
  return { pagos: pagos.length, bitacora };
}

// Pase diario a visitantes sin cuenta: pago sin socio, con el nombre como texto.
async function sembrarVisitantes(visitantes, ctx) {
  const diario = ctx.planes.diario;
  const filas = visitantes.map((v) => ({
    user_id: null, nombre_cliente: v.nombre_cliente, plan_id: diario.id, monto: diario.precio, metodo: v.metodo,
    origen: 'recepcion', registrado_por: ctx.recepcion.id, created_at: v.fecha,
  }));
  const pagos = await esc.insertar('payments', filas, 'id, nombre_cliente, metodo, created_at');
  return pagos.map((p) => esc.bitacora(ctx.recepcion, {
    accion: 'payment.create', entidad: 'payments', entidadId: p.id, fecha: p.created_at,
    detalle: { despues: { nombre_cliente: p.nombre_cliente, monto: diario.precio, metodo: p.metodo, origen: 'recepcion', tipo: 'pase_diario' } },
  }));
}

// La puerta de hoy: sin esto, la pantalla de check-in y el aforo se enseñan en
// blanco. La semilla es otra que la del gimnasio para que añadir la puerta no
// mueva a los socios ya sembrados.
async function sembrarPuerta(socios, ids, { ctx, hoy }) {
  const hastaHora = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Panama', hour: '2-digit', hour12: false }).format(new Date()));
  const entradas = generarCheckinsDeHoy(crearAzar(SEMILLA + 1), { socios, hoy, hastaHora });
  const filas = entradas.map((c) => ({
    user_id: ids.get(c.clave),
    resultado: c.resultado,
    motivo: c.motivo,
    metodo: c.metodo,
    ocurrido_en: c.ocurrido_en,
    atendido_por: ctx.recepcion.id,
  }));
  await esc.insertar('checkins', filas);
  return entradas.filter((c) => c.resultado === 'permitido').length;
}

// Detalles que hacen creíble la portada: gente entrenando y la sucursal con dirección.
// El aforo visible es el de un gimnasio a media tarde: los que entraron hoy menos
// los que ya se fueron, que es exactamente lo que guarda la corrección manual.
const AFORO_VISIBLE = 23;

async function ajustesDeDemo(hoy, entradasPermitidas) {
  await esc.obligatorio(
    supabase.from('occupancy')
      .update({ ajuste: AFORO_VISIBLE - entradasPermitidas, ajuste_fecha: hoy, updated_at: new Date().toISOString() })
      .eq('id', 1),
    'aforo'
  );
  await esc.obligatorio(supabase.from('branches').update({ direccion: 'Av. Demostración 100, Ciudad de Panamá' }).eq('codigo', 'principal'), 'sucursal');
}

async function sembrar() {
  if (!esUrlLocal(process.env.SUPABASE_URL)) throw new Error('la demo solo se siembra en un Supabase local (SUPABASE_URL no es local)');
  const hoy = hoyPanama();
  const catalogos = await cargarCatalogos();
  const personal = await sembrarPersonal(catalogos);
  const { socios, socioDemo, visitantes } = generarGimnasio(SEMILLA, { hoy, cantidad: CANTIDAD });
  const todos = [...socios, socioDemo];

  const primeraAlta = todos.map((s) => s.alta).sort()[0];
  const apertura = await fecharDocumentosDeApertura(personal.propietario, primeraAlta);
  const reglamento = await publicarReglamentoNuevo(personal.propietario, hoy);
  const documentos = [
    ...catalogos.documentos.map((d) => ({ ...d, publicado_en: apertura })),
    reglamento.doc,
  ];
  const ctx = {
    ...catalogos,
    documentos,
    personal,
    recepcion: personal.recepcion,
    codigos: [...new Set(documentos.map((d) => d.codigo))],
  };

  const ids = await sembrarSocios(todos, ctx);
  const cobros = await sembrarPagos(todos, ids, ctx);
  const pases = await sembrarVisitantes(visitantes, ctx);
  const bitacora = [
    reglamento.bitacora,
    ...todos.flatMap((s) => esc.bitacoraDeSocio(s, ids.get(s.clave), ctx)),
    ...cobros.bitacora,
    ...pases,
  ];
  await esc.insertar('admin_audit_log', bitacora);
  const entradasHoy = await sembrarPuerta(todos, ids, { ctx, hoy });
  await ajustesDeDemo(hoy, entradasHoy);
  return {
    personal: Object.keys(personal).length,
    socios: todos.length,
    pagos: cobros.pagos,
    pases: pases.length,
    bitacora: bitacora.length,
    entradasHoy,
  };
}

if (require.main === module) {
  sembrar()
    .then((r) => console.log('Demo sembrada:', r))
    .catch((e) => {
      console.error('No se pudo sembrar la demo:', e.message);
      process.exit(1);
    });
}

module.exports = { sembrar };
