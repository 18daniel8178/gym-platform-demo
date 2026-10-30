const { crearRouterAdmin } = require('../../middleware/routerAdmin');
const { supabase } = require('../../infrastructure/supabase');
const { logAdminAction } = require('../admin/audit');
const { leerCsv, validarImportacion, reporteDeErrores } = require('./importacion');
const { normalizarDocumento } = require('./normalizacion');
const { crearMiembro } = require('./service');

// Importación CSV del padrón del gimnasio (§13.7). El archivo llega como texto
// plano y se responde con el resumen y el reporte de las filas rechazadas.
//
// Un socio importado nace como lo que es: su expediente existe, pero nadie le vio
// firmar nada. Por eso entra sin consentimientos (la ficha los muestra
// pendientes), con la firma/foto pendiente y con una cuenta SIN contraseña
// (decisión 38): el personal lo gestiona, y él entrará a la web cuando el sitio
// tenga "recuperar contraseña".
const ALTA_IMPORTACION = Object.freeze({
  estado: 'activo',
  origen: 'importacion',
  consentimientos: [],
  exigirObligatorios: false,
});

const TANDA = 5;

const router = crearRouterAdmin();

// Los documentos ya registrados, en una sola consulta: preguntarlo fila por fila
// serían 500 viajes a la base.
async function documentosRegistrados(normalizados) {
  if (!normalizados.length) return { documentos: new Set() };
  const { data, error } = await supabase
    .from('profiles')
    .select('documento_normalizado')
    .in('documento_normalizado', normalizados);
  if (error) return { error };
  return { documentos: new Set((data || []).map((p) => p.documento_normalizado)) };
}

function causaDeAuth(mensaje) {
  if (/registered|already|exists/i.test(mensaje)) return 'Ya existe una cuenta con ese correo';
  return `No se pudo crear la cuenta: ${mensaje}`;
}

// Cuenta primero, expediente después. Si el expediente falla, la cuenta recién
// creada se borra: todavía no tiene historial, así que la base la deja ir.
async function importarFila(fila, actor) {
  const { data: creado, error: eAuth } = await supabase.auth.admin.createUser({
    email: fila.email,
    email_confirm: true,
  });
  if (eAuth) return { causa: causaDeAuth(eAuth.message) };

  const userId = creado.user.id;
  const { error } = await crearMiembro({ userId, perfil: fila.perfil, alta: ALTA_IMPORTACION, registradoPor: actor.id });
  if (!error) return { userId };

  await supabase.auth.admin.deleteUser(userId);
  return { causa: `No se pudo guardar el expediente: ${error.message}` };
}

// De a pocas a la vez: en serie una importación grande tarda demasiado para una
// sola petición, y todas a la vez ahogan a Auth. Si la petición se corta a mitad,
// reimportar el mismo archivo no duplica a nadie: las ya creadas vuelven
// rechazadas por documento repetido.
async function importarTodas(listas, actor) {
  const creadas = [];
  const errores = [];
  for (let i = 0; i < listas.length; i += TANDA) {
    const tanda = listas.slice(i, i + TANDA);
    const hechas = await Promise.all(tanda.map((fila) => importarFila(fila, actor)));
    hechas.forEach((r, j) => {
      if (r.causa) errores.push({ fila: tanda[j].numero, nombre: tanda[j].perfil.nombre_completo, causa: r.causa });
      else creadas.push(r.userId);
    });
  }
  return { creadas, errores };
}

// POST /members/importar — el cuerpo es el CSV tal cual (text/csv).
router.post('/members/importar', 'member.import', async (req, res) => {
  const leido = leerCsv(typeof req.body === 'string' ? req.body : '');
  if (!leido.ok) return res.status(400).json({ error: leido.error });

  const normalizados = leido.filas.map((f) => normalizarDocumento(f.valores.documento)).filter(Boolean);
  const { documentos, error } = await documentosRegistrados(normalizados);
  if (error) return res.status(500).json({ error: 'No se pudieron comprobar los documentos ya registrados' });

  const { listas, errores } = validarImportacion(leido.filas, { documentos });
  const hecho = await importarTodas(listas, req.user);
  const rechazadas = [...errores, ...hecho.errores].sort((a, b) => a.fila - b.fila);

  await logAdminAction(req.user, {
    accion: 'member.import',
    entidad: 'profiles',
    detalle: { filas: leido.filas.length, creadas: hecho.creadas.length, omitidas: rechazadas.length },
  });

  return res.json({
    filas: leido.filas.length,
    creadas: hecho.creadas.length,
    omitidas: rechazadas.length,
    errores: rechazadas,
    reporte: rechazadas.length ? reporteDeErrores(rechazadas) : null,
  });
});

module.exports = router;
