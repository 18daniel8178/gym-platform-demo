const { Router } = require('express');
const { supabase } = require('../../infrastructure/supabase');
const { leerTodo, leerMetodos } = require('../settings/service');
const { leerSucursal } = require('../branches/service');
const { aforoActual } = require('../checkin/aforo');
const { paraSitioPublico, DIAS } = require('../settings/horario');

// Convierte el horario heredado de gym_info ([{dia:'Lunes',…}]) a la forma nueva.
function desdeGymInfo(horarios) {
  const dias = (horarios || [])
    .map((h) => ({ dow: DIAS.indexOf(h.dia) + 1, abre: h.abre, cierra: h.cierra, cerrado: false }))
    .filter((d) => d.dow > 0);
  return { dias, cierres: [] };
}

// Caché en el Edge/CDN para datos públicos (Vercel respeta s-maxage)
const CACHE_PUBLIC = 'public, s-maxage=300, stale-while-revalidate=600';
const CACHE_OCCUPANCY = 'public, s-maxage=30, stale-while-revalidate=60';
// gym-info dejó de ser solo marketing: lleva los métodos de pago activos y los
// cierres excepcionales, contra los que el servidor valida en cada cobro. Con
// cinco minutos de Edge se seguiría ofreciendo un método recién desactivado y el
// cobro moriría con un 400 que el cajero no puede arreglar.
const CACHE_CONFIG = 'public, s-maxage=30, stale-while-revalidate=60';

const router = Router();

// La frase y la descripción son contenido de marketing y siguen en gym_info;
// los horarios y la moneda salen de ajustes, que es donde se editan. El sitio
// recibe la misma forma de siempre ([{dia, abre, cierra}]) para no cambiar.
router.get('/gym-info', async (_req, res) => {
  const [{ data, error }, { ajustes, error: eAjustes }, { metodos }, { sucursal }] = await Promise.all([
    supabase.from('gym_info').select('*').eq('id', 1).single(),
    leerTodo(),
    leerMetodos({ soloActivos: true }),
    leerSucursal(),
  ]);
  if (error || eAjustes) return res.status(500).json({ error: 'No se pudo obtener la información del gym' });

  res.set('Cache-Control', CACHE_CONFIG);
  res.json({
    ...data,
    // Mientras la migración no haya trasladado el horario, se sigue leyendo
    // la columna de gym_info: el sitio nunca se queda sin horarios.
    horarios: paraSitioPublico(ajustes.horario?.dias?.length ? ajustes.horario : desdeGymInfo(data.horarios)),
    moneda: ajustes.moneda,
    // Los métodos activos no son secretos —el checkout público ya los muestra— y
    // así el panel y el sitio ofrecen exactamente los mismos sin duplicar lista.
    metodos_pago: (metodos || []).map(({ clave, nombre }) => ({ clave, nombre })),
    // La dirección del local vive en la sucursal, que es donde se edita. El
    // sitio la usa cuando está puesta y si no cae a su texto de siempre.
    sucursal: sucursal
      ? {
        nombre: sucursal.nombre,
        direccion: sucursal.direccion,
        telefono: sucursal.telefono,
        // Con ella el panel formatea fechas en la hora del negocio y no en la
        // del navegador de quien mira.
        zona_horaria: sucursal.zona_horaria,
      }
      : null,
  });
});

// El aforo ya no es un número guardado: sale de las entradas del día más la
// corrección manual (modules/checkin/aforo.js).
router.get('/occupancy', async (_req, res) => {
  const { aforo, error } = await aforoActual();
  if (error) return res.status(500).json({ error: 'No se pudo obtener el aforo' });
  const percentage = Math.min(100, Math.round((aforo.current_count / aforo.max_capacity) * 100));
  res.set('Cache-Control', CACHE_OCCUPANCY);
  res.json({
    percentage,
    current_count: aforo.current_count,
    max_capacity: aforo.max_capacity,
    updated_at: aforo.updated_at,
  });
});

router.get('/products', async (_req, res) => {
  const { data, error } = await supabase.from('products').select('*').order('categoria').order('nombre');
  if (error) return res.status(500).json({ error: 'No se pudieron obtener los productos' });
  res.set('Cache-Control', CACHE_PUBLIC);
  res.json(data);
});

// GET /plans se movió a modules/plans/ (filtra activo=true).

module.exports = router;
