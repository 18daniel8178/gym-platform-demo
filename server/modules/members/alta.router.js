const { crearRouterAdmin } = require('../../middleware/routerAdmin');
const { supabase } = require('../../infrastructure/supabase');
const { logAdminAction } = require('../admin/audit');
const { validarPerfilCompleto } = require('./perfil');
const { leerDatosAlta } = require('./alta');
const { evaluarDuplicados } = require('./duplicados');
const { buscarCoincidencias, crearMiembro } = require('./service');
const { documentosVigentes } = require('./consentimientos.service');

// POST /members — alta presencial (§13.7). El orden importa:
//   1. lo que se decide ANTES de crear la cuenta (credenciales, perfil, estado,
//      origen, consentimientos y el aviso de duplicados): así un duplicado no
//      deja una cuenta nacida que luego haya que borrar;
//   2. la cuenta en Auth;
//   3. perfil y consentimientos en UNA transacción (alta_miembro). Si falla, se
//      borra la cuenta recién creada, que aún no tiene historial.

const router = crearRouterAdmin();

const rechazo = (status, error) => ({ rechazo: { status, body: { error } } });

// Busca un usuario de Auth por email (para el caso de cuenta ya existente).
async function buscarUsuarioPorEmail(email) {
  const objetivo = email.trim().toLowerCase();
  const { data } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  return (data?.users || []).find((u) => (u.email || '').toLowerCase() === objetivo) || null;
}

// Valida las credenciales del alta. Devuelve el mensaje de error o null.
function validarCredencialesAlta(body) {
  if (typeof body.email !== 'string' || !body.email.includes('@')) return 'Email inválido';
  if (typeof body.password !== 'string' || body.password.length < 6) return 'La contraseña debe tener al menos 6 caracteres';
  return null;
}

async function prepararAlta(body) {
  const credError = validarCredencialesAlta(body);
  if (credError) return rechazo(400, credError);
  const perfil = validarPerfilCompleto(body);
  if (!perfil.valido) return rechazo(400, perfil.error);

  const { data: vigentes, error } = await documentosVigentes();
  if (error) return rechazo(500, 'No se pudieron leer los documentos de consentimiento');
  const alta = leerDatosAlta(body, vigentes);
  if (!alta.ok) return rechazo(alta.status, alta.error);

  const busqueda = await buscarCoincidencias({ documento: perfil.datos.documento, email: body.email });
  if (busqueda.error) return rechazo(500, 'No se pudo comprobar si el socio ya existe');
  const dup = evaluarDuplicados(busqueda.data, { confirmado: body.confirmar_duplicado });
  if (dup.accion === 'rechazar') return { rechazo: { status: dup.status, body: dup.body } };

  return {
    datos: { perfil: perfil.datos, alta: { ...alta.datos, exigirObligatorios: true }, confirmados: dup.confirmados },
  };
}

// Una regla de la base (CHECK o raise check_violation en alta_miembro) trae un
// mensaje para el usuario; cualquier otro error, no.
function errorDeAlta(error) {
  if (error.code === '23514') return { status: 400, body: { error: error.message } };
  console.error('alta: no se pudo guardar el socio', error.message);
  return { status: 500, body: { error: 'No se pudo guardar el socio' } };
}

async function auditarAlta({ actor, userId, email, datos, nota }) {
  const detalle = {
    despues: { ...datos.perfil, email, estado_miembro: datos.alta.estado, origen: datos.alta.origen },
    consentimientos: datos.alta.consentimientos,
  };
  // Crear pese al aviso queda auditado CON la referencia al posible duplicado (§13.7).
  if (datos.confirmados.length) detalle.duplicado_confirmado = datos.confirmados;
  if (nota) detalle.nota = nota;
  await logAdminAction(actor, { accion: 'client.create', entidad: 'profiles', entidadId: userId, detalle });
}

// La cuenta ya existe. Si no tiene perfil (se registró en la web sin completar
// sus datos), el perfil se completa sobre esa cuenta. Si ya lo tiene, error.
async function altaSobreCuentaExistente({ actor, email, datos }) {
  const existente = await buscarUsuarioPorEmail(email);
  if (!existente) return { status: 409, body: { error: 'Ya existe una cuenta con ese email' } };
  const { data: perfilPrevio } = await supabase.from('profiles').select('user_id').eq('user_id', existente.id).maybeSingle();
  if (perfilPrevio) return { status: 409, body: { error: 'Ese email ya tiene un socio registrado' } };

  const { error } = await crearMiembro({ userId: existente.id, perfil: datos.perfil, alta: datos.alta, registradoPor: actor.id });
  if (error) return errorDeAlta(error);
  await auditarAlta({ actor, userId: existente.id, email, datos, nota: 'perfil completado sobre cuenta existente' });
  return { status: 201, body: { user_id: existente.id, email, cuenta_existente: true } };
}

// Rama de error de Auth: si el email ya estaba registrado intenta completar el
// perfil sobre esa cuenta; cualquier otro error es un 400.
async function manejarErrorAuthAlta({ eAuth, actor, email, datos }) {
  if (!/already been registered|already exists|already registered/i.test(eAuth.message || '')) {
    return { status: 400, body: { error: 'No se pudo crear la cuenta' } };
  }
  return altaSobreCuentaExistente({ actor, email, datos });
}

// Compensación: si el perfil falla, elimina la cuenta huérfana recién creada.
async function revertirCuentaHuerfana({ user, userId, email }) {
  const { error: eDel } = await supabase.auth.admin.deleteUser(userId);
  if (!eDel) return;
  console.error('alta: cuenta huérfana sin perfil, no se pudo revertir', userId, eDel.message);
  await logAdminAction(user, {
    accion: 'client.create_orphan',
    entidad: 'auth.users',
    entidadId: userId,
    detalle: { nota: 'cuenta creada sin perfil; la reversión falló, requiere limpieza manual', email },
  });
}

router.post('/members', 'member.create', async (req, res) => {
  const body = req.body || {};
  const { rechazo: r, datos } = await prepararAlta(body);
  if (r) return res.status(r.status).json(r.body);

  const { email, password } = body;
  const { data: creado, error: eAuth } = await supabase.auth.admin.createUser({ email, password, email_confirm: true });
  if (eAuth) {
    const salida = await manejarErrorAuthAlta({ eAuth, actor: req.user, email, datos });
    return res.status(salida.status).json(salida.body);
  }

  const userId = creado.user.id;
  const { error } = await crearMiembro({ userId, perfil: datos.perfil, alta: datos.alta, registradoPor: req.user.id });
  if (error) {
    await revertirCuentaHuerfana({ user: req.user, userId, email });
    const salida = errorDeAlta(error);
    return res.status(salida.status).json(salida.body);
  }

  await auditarAlta({ actor: req.user, userId, email, datos });
  return res.status(201).json({ user_id: userId, email });
});

module.exports = router;
