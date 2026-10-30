// Qué hacer con las coincidencias que devuelve miembros_coincidentes() (SQL).
//
// Documento repetido: se AVISA y solo se sigue con confirmación explícita, porque
// hay casos legítimos (§13.7). Correo repetido: se RECHAZA siempre, porque cada
// socio es una cuenta de Auth y Auth no admite dos cuentas con el mismo correo;
// ofrecer "crear de todos modos" sería ofrecer un botón que no puede funcionar.

const CAMPOS_PUBLICOS = ['user_id', 'nombre_completo', 'estado_miembro', 'por_documento', 'por_email'];

const proyectar = (c) => Object.fromEntries(CAMPOS_PUBLICOS.map((campo) => [campo, c[campo]]));

function rechazo(coincidencias, { error, requiereConfirmacion }) {
  return {
    accion: 'rechazar',
    status: 409,
    body: { error, requiere_confirmacion: requiereConfirmacion, coincidencias: coincidencias.map(proyectar) },
  };
}

function evaluarDuplicados(coincidencias, { confirmado = false } = {}) {
  const lista = coincidencias || [];
  if (lista.length === 0) return { accion: 'seguir', confirmados: [] };

  if (lista.some((c) => c.por_email)) {
    return rechazo(lista, {
      error: 'Ese correo ya es de otro socio: cada socio necesita su propio correo para su cuenta',
      requiereConfirmacion: false,
    });
  }
  if (confirmado !== true) {
    return rechazo(lista, {
      error: 'Posible duplicado: ya hay un socio con ese documento',
      requiereConfirmacion: true,
    });
  }
  return { accion: 'seguir', confirmados: lista.map((c) => c.user_id) };
}

module.exports = { evaluarDuplicados };
