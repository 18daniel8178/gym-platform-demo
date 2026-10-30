// Línea de tiempo del expediente (§13.7). Lógica pura: las filas de cada fuente
// entran como argumento y sale la lista de eventos ordenada.
//
// Las fuentes son varias porque el sistema registra en varios sitios: la bitácora
// guarda quién hizo qué (alta, estado, correcciones, membresías), pero los pagos
// se auditan con el id del pago —no con el del socio—, así que esos salen de la
// tabla `payments`; los consentimientos y las notas, de las suyas, que además
// dicen más que la bitácora.
//
// Los textos se arman aquí y no en el panel: la regla de qué puede ver quién es
// del servidor. Las fechas y los importes viajan crudos porque el panel los
// formatea en la zona de la sucursal y con la moneda configurada.

const TOPE_EVENTOS = 60;

const ORIGEN = { mostrador: 'mostrador', web: 'la web', importacion: 'importación CSV', referido: 'un referido' };

const CAMPO = {
  nombre_completo: 'nombre', fecha_nacimiento: 'nacimiento', documento: 'documento', telefono: 'teléfono',
  emergencia1_nombre: 'contacto 1', emergencia1_telefono: 'tel. contacto 1',
  emergencia2_nombre: 'contacto 2', emergencia2_telefono: 'tel. contacto 2',
  entrenado_antes: 'entrenado antes', condiciones_medicas: 'condiciones médicas',
};

const evento = ({ tipo, fecha, titulo, detalle = null, actor = null, monto = null }) =>
  ({ tipo, fecha, titulo, detalle, actor, monto });

// ── Bitácora ─────────────────────────────────────────────────────────────────

// Qué campos cambiaron, no a qué valores: el expediente ya muestra los de ahora,
// y el diff lleva datos personales que no hacen falta para seguir la historia.
function camposCorregidos(detalle) {
  const despues = detalle?.despues || {};
  const nombres = Object.keys(despues).map((c) => CAMPO[c] || c);
  return nombres.length ? `Cambió: ${nombres.join(', ')}` : null;
}

function deMembresia({ accion, detalle }, importes) {
  const d = detalle?.despues || {};
  const fechas = d.fecha_inicio ? `${d.fecha_inicio} → ${d.fecha_fin}` : null;
  if (accion === 'membership.fechas') return { titulo: 'Fechas de membresía ajustadas', detalle: fechas };
  return { titulo: `Membresía activada · ${d.plan || 'plan'}`, detalle: fechas, monto: importes ? d.monto ?? null : null };
}

const TRADUCTORES = {
  'client.create': ({ detalle }) => ({ tipo: 'alta', titulo: 'Alta del socio', detalle: `Llegó por ${ORIGEN[detalle?.despues?.origen] || detalle?.despues?.origen || 'mostrador'}` }),
  'client.update': ({ detalle }) => ({ tipo: 'perfil', titulo: 'Corrección de datos', detalle: camposCorregidos(detalle) }),
  'member.estado': ({ detalle }) => ({
    tipo: 'estado',
    titulo: `Estado: ${detalle?.antes?.estado_miembro} → ${detalle?.despues?.estado_miembro}`,
    detalle: detalle?.despues?.estado_motivo || null,
  }),
  'member.etiquetas': ({ detalle }) => ({
    tipo: 'etiquetas',
    titulo: 'Etiquetas actualizadas',
    detalle: (detalle?.despues?.etiquetas || []).join(', ') || 'sin etiquetas',
  }),
  'profile.firma_foto': () => ({ tipo: 'firma_foto', titulo: 'Firma y foto completadas' }),
  'membership.activate': (fila, importes) => ({ tipo: 'membresia', ...deMembresia(fila, importes) }),
  'membership.fechas': (fila, importes) => ({ tipo: 'membresia', ...deMembresia(fila, importes) }),
};

// Un consentimiento capturado ya viene de member_consents, con más detalle que
// la bitácora: aquí sobraría repetido.
const IGNORADAS = new Set(['member.consent']);

function deAuditoria(filas, importes) {
  return filas
    .filter((f) => !IGNORADAS.has(f.accion))
    .map((fila) => {
      const traducir = TRADUCTORES[fila.accion];
      // Sin traductor propio se muestra la acción tal cual: esconder un evento
      // del expediente sería peor que mostrarlo con su nombre técnico.
      const base = traducir ? traducir(fila, importes) : { tipo: 'otro', titulo: fila.accion };
      return evento({ tipo: base.tipo, fecha: fila.created_at, titulo: base.titulo, detalle: base.detalle, actor: fila.actor_email, monto: base.monto });
    });
}

// ── Resto de fuentes ─────────────────────────────────────────────────────────

function dePagos(filas, importes) {
  return filas.map((p) => {
    const anulado = p.estado === 'anulado';
    const detalle = [`${p.metodo} · ${p.origen}`, anulado && p.motivo_anulacion].filter(Boolean).join(' · ');
    return evento({
      tipo: 'pago',
      fecha: p.created_at,
      titulo: anulado ? 'Pago anulado' : 'Pago registrado',
      detalle,
      monto: importes ? p.monto : null,
    });
  });
}

const deConsentimientos = (filas) => filas.map((c) => evento({
  tipo: 'consentimiento',
  fecha: c.aceptado_en,
  titulo: `Aceptó ${c.documento?.titulo || c.documento?.codigo}`,
  detalle: `Versión ${c.documento?.version} · ${c.medio}`,
}));

const deNotas = (filas) => filas.map((n) => evento({ tipo: 'nota', fecha: n.created_at, titulo: 'Nota', detalle: n.texto, actor: n.autor_email }));

// El alta de un socio importado o sembrado no pasó por la bitácora: sin esto su
// expediente arrancaría en el aire.
function altaDelPerfil(perfil) {
  if (!perfil?.created_at) return [];
  return [evento({ tipo: 'alta', fecha: perfil.created_at, titulo: 'Alta del socio', detalle: `Llegó por ${ORIGEN[perfil.origen] || perfil.origen}` })];
}

// `importes` y `actores` nacen cerrados: el dinero pide payment.read y la
// identidad del personal, user.read, como en el resto del panel.
function lineaDeTiempo({ auditoria = [], pagos = [], consentimientos = [], notas = [], perfil = null }, { importes = false, actores = false } = {}) {
  const hayAltaAuditada = auditoria.some((f) => f.accion === 'client.create');
  const todos = [
    ...deAuditoria(auditoria, importes),
    ...dePagos(pagos, importes),
    ...deConsentimientos(consentimientos),
    ...deNotas(notas),
    ...(hayAltaAuditada ? [] : altaDelPerfil(perfil)),
  ]
    .map((e) => (actores ? e : { ...e, actor: null }))
    .sort((a, b) => Date.parse(b.fecha) - Date.parse(a.fecha));

  return { eventos: todos.slice(0, TOPE_EVENTOS), truncado: todos.length > TOPE_EVENTOS };
}

module.exports = { lineaDeTiempo, TOPE_EVENTOS };
