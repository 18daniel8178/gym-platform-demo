const { crearRouterAdmin } = require('../../middleware/routerAdmin');
const { permisosDe } = require('../../middleware/requirePermission');
const { logAdminAction } = require('../admin/audit');
const { leerTokenDeCarnet } = require('./carnet');
const { evaluarCheckin, MOTIVOS } = require('./decision');
const { aforoActual } = require('./aforo');
const servicio = require('./service');
const { leerSucursal } = require('../branches/service');
const { inicioDelDia } = require('../branches/zona');

// Check-in en recepción (Fase 1 · Bloque 6). La decisión la toma SIEMPRE el
// servidor: el lector del navegador solo aporta el texto del QR.
//
// Cada intento queda registrado, permitido o rechazado. Dos excepciones, y las
// dos son del spec: un QR que no es de nadie no registra nada (no hay a quién
// registrárselo) y volver a escanear dentro de la ventana tampoco (ya está
// dentro: registrar otra vez inflaría el aforo).

const router = crearRouterAdmin();

const MSG_SIN_OVERRIDE = 'Forzar una entrada rechazada lo decide gerencia';

// Quién es el socio: por el token firmado del carnet o por la búsqueda manual.
function socioDelIntento(body) {
  if (typeof body.token === 'string' && body.token.trim()) {
    const leido = leerTokenDeCarnet(body.token);
    return leido.ok ? { userId: leido.userId, metodo: 'qr' } : { error: 'Esa credencial no es válida: busca al socio por su nombre o documento' };
  }
  if (typeof body.user_id === 'string' && body.user_id.trim()) return { userId: body.user_id.trim(), metodo: 'manual' };
  return { error: 'Escanea el carnet o busca al socio' };
}

// Respuesta única de la pantalla: qué se decidió, a quién y cómo quedó el aforo.
async function respuesta({ decision, socio, checkin }) {
  const { aforo } = await aforoActual();
  return {
    decision: decision.decision,
    motivo: decision.motivo,
    mensaje: decision.mensaje,
    socio: {
      user_id: socio.user_id,
      nombre_completo: socio.nombre_completo,
      estado_miembro: socio.estado_miembro,
      etiquetas: socio.etiquetas || [],
      firma_foto_pendiente: socio.firma_foto_pendiente,
    },
    checkin_id: checkin?.id || null,
    forzado: Boolean(checkin?.forzado),
    aforo: aforo || null,
  };
}

// Forzar: exige el permiso y un motivo, y conserva el código del rechazo
// original en `motivo`, que es lo que hay que poder leer después.
async function forzarEntrada({ req, quien, decision }) {
  const { userId, metodo } = quien;
  const permisos = await permisosDe(req);
  if (!permisos.has('checkin.override')) return { rechazo: { status: 403, body: { error: MSG_SIN_OVERRIDE } } };

  const motivo = typeof req.body?.motivo_forzado === 'string' ? req.body.motivo_forzado.trim() : '';
  if (!motivo) return { rechazo: { status: 400, body: { error: 'Para forzar la entrada hay que decir por qué' } } };

  const { checkin, error } = await servicio.registrarIntento({
    userId,
    resultado: 'permitido',
    motivo: decision.motivo,
    metodo,
    actor: req.user,
    forzado: true,
    motivoForzado: motivo,
  });
  if (error) return { rechazo: { status: 500, body: { error: 'No se pudo registrar la entrada' } } };

  await logAdminAction(req.user, {
    accion: 'checkin.override',
    entidad: 'checkins',
    entidadId: checkin.id,
    detalle: { despues: { user_id: userId, motivo_rechazo: decision.motivo, motivo_forzado: motivo } },
  });
  // Entra, pero el registro conserva por qué se le había negado.
  return { checkin, decision: { decision: 'permitir', motivo: decision.motivo, mensaje: `Entrada forzada · ${decision.mensaje}` } };
}

// El camino normal: se registra lo que la decisión dijo, tal cual.
async function registrarDecision({ req, quien, decision }) {
  const { checkin, error } = await servicio.registrarIntento({
    userId: quien.userId,
    resultado: decision.decision === 'permitir' ? 'permitido' : 'rechazado',
    motivo: decision.motivo,
    metodo: quien.metodo,
    actor: req.user,
  });
  if (error) return { rechazo: { status: 500, body: { error: 'No se pudo registrar el intento' } } };
  return { checkin };
}

// POST /checkin — el intento. El cuerpo trae el token del carnet o el user_id de
// la búsqueda manual, y opcionalmente la orden de forzar con su motivo.
router.post('/checkin', 'checkin.perform', async (req, res) => {
  const body = req.body || {};
  const quien = socioDelIntento(body);
  if (quien.error) return res.status(400).json({ error: quien.error });

  const { datos, noExiste, error } = await servicio.datosParaDecidir(quien.userId);
  if (error) return res.status(500).json({ error: 'No se pudo leer el expediente del socio' });
  if (noExiste) return res.status(404).json({ error: 'Esa credencial no corresponde a ningún socio' });

  const decision = evaluarCheckin({ ...datos, ahora: new Date() });

  // Ya está dentro: ni fila nueva ni aforo movido.
  if (decision.decision === 'ya_dentro') return res.json(await respuesta({ decision, socio: datos.socio }));

  const forzar = decision.decision === 'rechazar' && body.forzar === true;
  const salida = forzar
    ? await forzarEntrada({ req, quien, decision })
    : await registrarDecision({ req, quien, decision });
  if (salida.rechazo) return res.status(salida.rechazo.status).json(salida.rechazo.body);

  return res.json(await respuesta({ decision: salida.decision || decision, socio: datos.socio, checkin: salida.checkin }));
});

// GET /checkin/buscar — la alternativa cuando el QR no se puede leer.
router.get('/checkin/buscar', 'checkin.perform', async (req, res) => {
  const { socios, error } = await servicio.buscarSocios(req.query.q);
  if (error) return res.status(500).json({ error: 'No se pudo buscar al socio' });
  return res.json(socios);
});

// GET /checkin/hoy — lo que pasó hoy en la puerta, con el aforo del momento.
router.get('/checkin/hoy', 'checkin.read', async (_req, res) => {
  const { sucursal } = await leerSucursal();
  const zona = sucursal?.zona_horaria || 'America/Panama';
  const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: zona }).format(new Date());

  const [{ entradas, error }, { aforo }] = await Promise.all([
    servicio.entradasDelDia(inicioDelDia(hoy, zona)),
    aforoActual(),
  ]);
  if (error) return res.status(500).json({ error: 'No se pudo leer el historial de entradas' });
  return res.json({ fecha: hoy, entradas, aforo: aforo || null, motivos: MOTIVOS });
});

// POST /checkin/:id/anular — una entrada registrada por error. El registro
// original se conserva: la anulación se pone al lado, con su motivo.
router.post('/checkin/:id/anular', 'checkin.override', async (req, res) => {
  const motivo = typeof req.body?.motivo === 'string' ? req.body.motivo.trim() : '';
  if (!motivo) return res.status(400).json({ error: 'Anular una entrada exige decir por qué' });

  const { checkin, error } = await servicio.anularEntrada({ id: req.params.id, actor: req.user, motivo });
  if (error?.code === '42501') return res.status(409).json({ error: 'Esa entrada ya estaba anulada' });
  if (error) return res.status(500).json({ error: 'No se pudo anular la entrada' });
  if (!checkin) return res.status(404).json({ error: 'Esa entrada no existe' });

  await logAdminAction(req.user, {
    accion: 'checkin.anular',
    entidad: 'checkins',
    entidadId: checkin.id,
    detalle: { antes: { resultado: checkin.resultado, motivo: checkin.motivo }, despues: { anulado: true, motivo } },
  });
  const { aforo } = await aforoActual();
  return res.json({ ok: true, aforo: aforo || null });
});

module.exports = router;
