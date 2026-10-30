// Estado del miembro (la PERSONA, no su membresía) y sus transiciones válidas.
//
// El documento maestro (§10, §13.7) separa los dos estados: alguien activo puede
// tener la membresía vencida. Por eso esta máquina no mira membresías: solo dice
// a qué estado se puede pasar desde cada uno, qué permiso hace falta y cuándo el
// motivo es obligatorio. La base repite la regla del motivo como CHECK.

const ESTADOS_MIEMBRO = Object.freeze(['prospecto', 'activo', 'inactivo', 'bloqueado', 'archivado']);

// A dónde se puede ir desde cada estado. Nadie vuelve a 'prospecto' (se es
// prospecto hasta el primer paso, no después) y un archivado no se bloquea:
// primero se restaura, que es la decisión que de verdad hay que tomar.
const TRANSICIONES = Object.freeze({
  prospecto: ['activo', 'inactivo', 'bloqueado', 'archivado'],
  activo: ['inactivo', 'bloqueado', 'archivado'],
  inactivo: ['activo', 'bloqueado', 'archivado'],
  bloqueado: ['activo', 'inactivo', 'archivado'],
  archivado: ['activo', 'inactivo'],
});

// Entrar o salir de estos estados cambia quién puede entrar al gimnasio o quién
// aparece en la operación: es decisión de gerencia, no de recepción.
const SENSIBLES = new Set(['bloqueado', 'archivado']);
const EXIGEN_MOTIVO = SENSIBLES;
const MOTIVO_MAX = 300;

const error = (mensaje) => ({ ok: false, status: 400, error: mensaje });

const permisoDe = (de, a) => (SENSIBLES.has(a) || SENSIBLES.has(de) ? 'member.archive' : 'member.update');

// Salidas posibles desde un estado, para que la ficha ofrezca exactamente lo que
// el server aceptará (la UI no copia esta tabla: la recibe).
function transicionesDesde(de) {
  return (TRANSICIONES[de] || []).map((a) => ({ estado: a, permiso: permisoDe(de, a), exigeMotivo: EXIGEN_MOTIVO.has(a) }));
}

function leerMotivo(motivo) {
  if (motivo == null) return { motivo: null };
  if (typeof motivo !== 'string') return { error: 'El motivo debe ser texto' };
  const limpio = motivo.trim();
  if (limpio.length > MOTIVO_MAX) return { error: `El motivo admite hasta ${MOTIVO_MAX} caracteres` };
  return { motivo: limpio || null };
}

// ¿Se puede pasar de `de` a `a`? Devuelve el permiso que exige y el motivo limpio.
function validarTransicion({ de, a, motivo }) {
  if (!ESTADOS_MIEMBRO.includes(a)) return error('Estado de socio no válido');
  if (de === a) return error(`El socio ya está en estado ${a}`);
  if (!(TRANSICIONES[de] || []).includes(a)) return error(`Un socio ${de} no puede pasar a ${a}`);

  const leido = leerMotivo(motivo);
  if (leido.error) return error(leido.error);
  if (EXIGEN_MOTIVO.has(a) && !leido.motivo) return error(`Indica el motivo para pasar al socio a ${a}`);

  return { ok: true, permiso: permisoDe(de, a), motivo: leido.motivo };
}

module.exports = { ESTADOS_MIEMBRO, validarTransicion, transicionesDesde };
