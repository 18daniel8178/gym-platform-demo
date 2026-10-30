// Modo demostración. Existe solo si se cumplen DOS cosas: la
// bandera DEMO_MODE=true y una SUPABASE_URL local. Con la bandera y una base
// remota —un descuido en las variables de Vercel— falla del lado seguro: no se
// activa y lo avisa, porque la entrada de un clic sin contraseña contra la base
// de producción sería una puerta abierta.

// Comparación EXACTA del hostname ya parseado: "localhost.evil.com" o
// "127.0.0.1.nip.io" empiezan como locales y no lo son.
const HOSTS_LOCALES = new Set(['localhost', '127.0.0.1', '[::1]']);

function esUrlLocal(url) {
  try {
    return HOSTS_LOCALES.has(new URL(url).hostname);
  } catch {
    return false; // ausente o malformada: nunca es local
  }
}

function evaluarModoDemo(env) {
  if (env.DEMO_MODE !== 'true') return { activo: false, aviso: null };
  if (esUrlLocal(env.SUPABASE_URL)) return { activo: true, aviso: null };
  return {
    activo: false,
    aviso: 'DEMO_MODE=true ignorado: SUPABASE_URL no es local y el modo demo solo corre contra el Supabase de la máquina',
  };
}

// Monta /api/demo solo si el modo está activo. Devuelve la evaluación para que
// quien arranca el server registre el aviso si lo hay.
function montarDemo(app, { env, router }) {
  const modo = evaluarModoDemo(env);
  if (modo.activo) app.use('/api/demo', router);
  return modo;
}

module.exports = { evaluarModoDemo, montarDemo, esUrlLocal };
