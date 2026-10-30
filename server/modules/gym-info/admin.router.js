const { crearRouterAdmin } = require('../../middleware/routerAdmin');
const { supabase } = require('../../infrastructure/supabase');
const { logAdminAction } = require('../admin/audit');
const { aforoActual, fijarAforo } = require('../checkin/aforo');

const router = crearRouterAdmin();

// Lista blanca de campos de texto con su mensaje si llegan vacíos.
const CAMPOS_TEXTO = [
  { campo: 'frase', mensaje: 'La frase no puede estar vacía' },
  { campo: 'descripcion', mensaje: 'La descripción no puede estar vacía' },
  { campo: 'nombre', mensaje: 'El nombre no puede estar vacío' },
];

// Extrae (con trim) los campos de texto presentes en el body. Devuelve { datos } o { error }.
function extraerCamposTexto(body) {
  const datos = {};
  for (const { campo, mensaje } of CAMPOS_TEXTO) {
    if (!(campo in body)) continue;
    if (typeof body[campo] !== 'string' || !body[campo].trim()) return { error: mensaje };
    datos[campo] = body[campo].trim();
  }
  return { datos };
}

// PATCH gym-info: frase, descripción y nombre. Los HORARIOS ya no se editan
// aquí: viven en la sección `horario` de ajustes (PATCH /settings/horario), que
// además guarda los cierres excepcionales y el día cerrado. Si alguien manda
// horarios en este PATCH se rechaza en vez de guardarlos donde ya nadie los lee.
router.patch('/gym-info', 'settings.update', async (req, res) => {
  const body = req.body || {};
  const { error: errTexto, datos } = extraerCamposTexto(body);
  if (errTexto) return res.status(400).json({ error: errTexto });

  if ('horarios' in body) {
    return res.status(400).json({ error: 'Los horarios se editan en Ajustes → Horarios' });
  }
  if (Object.keys(datos).length === 0) return res.status(400).json({ error: 'No hay campos válidos para actualizar' });

  const { data: antes } = await supabase.from('gym_info').select('*').eq('id', 1).maybeSingle();
  const { data, error } = await supabase.from('gym_info').update(datos).eq('id', 1).select('*').single();
  if (error) return res.status(500).json({ error: 'No se pudo actualizar la información' });

  await logAdminAction(req.user, {
    accion: 'gym_info.update',
    entidad: 'gym_info',
    entidadId: 1,
    detalle: { antes, despues: datos },
  });
  res.json(data);
});

// Toma cada valor del body si viene; si no, conserva el registrado.
function resolverAforo(body, actual) {
  const current = 'current_count' in body ? Number(body.current_count) : actual?.current_count;
  const max = 'max_capacity' in body ? Number(body.max_capacity) : actual?.max_capacity;
  return { current, max };
}

// Valida current>=0, max>0, current<=max. Devuelve el mensaje de error o null.
function validarAforo(current, max) {
  if (!Number.isInteger(current) || current < 0) return 'El aforo actual debe ser un entero ≥ 0';
  if (!Number.isInteger(max) || max <= 0) return 'La capacidad máxima debe ser un entero > 0';
  if (current > max) return 'El aforo actual no puede superar la capacidad máxima';
  return null;
}

// PATCH occupancy: la corrección manual del aforo. El personal dice cuánta gente
// hay AHORA; se guarda la diferencia contra las entradas contadas del día, y esa
// corrección caduca con el día (modules/checkin/aforo.js).
router.patch('/occupancy', 'settings.update', async (req, res) => {
  const body = req.body || {};
  const { aforo: actual, error: e0 } = await aforoActual();
  if (e0) return res.status(500).json({ error: 'No se pudo leer el aforo' });

  const { current, max } = resolverAforo(body, actual);
  const errAforo = validarAforo(current, max);
  if (errAforo) return res.status(400).json({ error: errAforo });

  const { guardado, error } = await fijarAforo({ objetivo: current, maxCapacity: max });
  if (error) return res.status(500).json({ error: 'No se pudo actualizar el aforo' });

  await logAdminAction(req.user, {
    accion: 'occupancy.update',
    entidad: 'occupancy',
    entidadId: 1,
    detalle: {
      antes: { current_count: actual.current_count, max_capacity: actual.max_capacity },
      despues: { current_count: current, max_capacity: max, entradas_hoy: guardado.entradas_hoy },
    },
  });
  res.json(guardado);
});

module.exports = router;
