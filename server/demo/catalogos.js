// Catálogos de la demo local: nombres comunes en Panamá y
// textos de gestión creíbles para un gimnasio de Panamá. Son INVENTADOS:
// cualquier parecido con una persona real sería coincidencia de nombres comunes.

const NOMBRES_F = Object.freeze([
  'María', 'Ana', 'Yaritza', 'Yariela', 'Katherine', 'Daniela', 'Gabriela', 'Valeria',
  'Lourdes', 'Itzel', 'Yamileth', 'Dayana', 'Nathaly', 'Mariela', 'Arelys', 'Yessenia',
  'Zuleika', 'Anayansi', 'Kristel', 'Milagros', 'Fernanda', 'Isabella', 'Sofía', 'Andrea',
  'Paola', 'Rosa', 'Carmen', 'Lucía', 'Camila', 'Nicole', 'Grisel', 'Yaneth',
]);

const NOMBRES_M = Object.freeze([
  'José', 'Luis', 'Carlos', 'Juan', 'Jorge', 'Kevin', 'Brian', 'Eduardo',
  'Ricardo', 'Omar', 'Abdiel', 'Eliécer', 'Ariel', 'Iván', 'Gabriel', 'Alexis',
  'Moisés', 'Aldo', 'Julio', 'Diego', 'Alberto', 'Ernesto', 'Anel', 'Edwin',
  'Josué', 'Marcos', 'Cristian', 'Rolando', 'Félix', 'Isaac', 'Rubén', 'Óscar',
]);

const APELLIDOS = Object.freeze([
  'González', 'Rodríguez', 'Pérez', 'Sánchez', 'Martínez', 'Castillo', 'Jiménez', 'Batista',
  'Pinzón', 'Caballero', 'Moreno', 'Herrera', 'Vega', 'Ríos', 'Quintero', 'Barría',
  'Solís', 'Samaniego', 'Morales', 'Ortega', 'Chávez', 'Domínguez', 'Guerra', 'Villarreal',
  'Arosemena', 'De León', 'Espinosa', 'Saldaña', 'Castro', 'Montenegro', 'Delgado', 'Rivera',
  'Cedeño', 'Núñez', 'Gutiérrez', 'Araúz', 'Tejada', 'Fuentes', 'Ábrego', 'Bernal',
]);

// Parentesco del contacto de emergencia (va en el nombre, como lo escribe
// recepción), según el sexo del contacto; "pareja" vale para ambos.
const PARENTESCOS_F = Object.freeze(['mamá', 'esposa', 'hermana', 'tía', 'amiga', 'pareja']);
const PARENTESCOS_M = Object.freeze(['papá', 'esposo', 'hermano', 'tío', 'amigo', 'pareja']);

const ETIQUETAS = Object.freeze([
  'corporativo', 'estudiante', 'turno mañana', 'turno noche', 'fin de semana',
  'entrenamiento personal', 'lesión', 'pareja', 'regreso',
]);

const MOTIVOS_BLOQUEO = Object.freeze([
  'Deuda pendiente en recepción',
  'Prestó su carnet a otra persona',
  'Conducta inapropiada con el personal',
]);

const MOTIVOS_ARCHIVO = Object.freeze([
  'Se mudó a otra ciudad',
  'No viene hace más de un año',
  'Registro duplicado',
  'Lo pidió el socio',
]);

const MOTIVOS_INACTIVO = Object.freeze([
  'Dejó de venir tras vencer su plan',
  'Pausa por trabajo',
  'Viaje largo',
]);

const NOTAS = Object.freeze([
  'Prefiere entrenar temprano, antes del trabajo.',
  'Pidió factura a nombre de su empresa.',
  'Lesión de rodilla: evitar sentadilla profunda sin supervisión.',
  'Viene con su pareja; renuevan juntos.',
  'Interesado en entrenamiento personal, pedir precio.',
  'Paga normalmente con Yappy.',
  'Recomendó a dos amigos este mes.',
  'Preguntó por el plan anual con descuento.',
]);

const CONDICIONES_MEDICAS = Object.freeze([
  'Asma leve, trae su inhalador.',
  'Hipertensión controlada con medicamento.',
  'Operación de rodilla hace dos años.',
  'Diabetes tipo 2 controlada.',
]);

// Nombres de visitantes del pase diario (sin cuenta: solo el nombre en el pago).
const VISITANTES = Object.freeze([
  'Turista de paso', 'Visitante de otra ciudad', 'Primo de un socio', 'Prueba de un día',
]);

module.exports = {
  NOMBRES_F,
  NOMBRES_M,
  APELLIDOS,
  PARENTESCOS_F,
  PARENTESCOS_M,
  ETIQUETAS,
  MOTIVOS_BLOQUEO,
  MOTIVOS_ARCHIVO,
  MOTIVOS_INACTIVO,
  NOTAS,
  CONDICIONES_MEDICAS,
  VISITANTES,
};
