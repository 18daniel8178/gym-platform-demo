// Datos de contacto del gym — actualiza aquí y se reflejan en toda la web.
// DEMO: todos son ficticios. El número 0000-0000 no existe, así que los enlaces
// de WhatsApp no llegan a nadie, y el dominio .example está reservado (RFC 2606).
export const CONTACT_INFO = {
  telefono: '+507 0000-0000',
  whatsapp: '50700000000',
  instagram: 'forja.gym.demo',
  direccion: 'Av. Demostración 100, Ciudad de Panamá',
  email: 'hola@forja-gym.example',
  // Mapa interactivo (OpenStreetMap, sin API key ni facturación). Para marcar un
  // punto, añade `&marker=lat%2Clng` y ajusta el `bbox` (un recuadro alrededor).
  // DEMO: vista general de la ciudad, sin pin: el gimnasio no existe.
  mapEmbedUrl:
    'https://www.openstreetmap.org/export/embed.html?bbox=-79.5600%2C8.9500%2C-79.4900%2C9.0100&layer=mapnik',
  // Enlace externo para "Abrir en Google Maps"; vacío oculta el botón.
  mapLink: '',
}

// Preguntas frecuentes de la página de contacto — edita aquí para actualizar
export const FAQS = [
  {
    q: '¿Cómo me inscribo?',
    a: 'Crea tu cuenta con el botón Join y completa el formulario de ingreso en línea. Después pasas por recepción a firmar tu formulario y tomarte la foto de socio, y quedas activo.',
  },
  {
    q: '¿Cuánto cuestan las membresías?',
    a: 'Diario $6, 1 mes $45, 3 meses $120, 6 meses $225 y 1 año $420, sin cuota de inscripción. Puedes ver el detalle completo en la sección de Membresías.',
  },
  {
    q: '¿Qué formas de pago aceptan?',
    a: 'Efectivo en recepción, Yappy, transferencia bancaria y tarjeta. También puedes contratar tu plan desde la web.',
  },
  {
    q: '¿Ofrecen entrenamiento personal?',
    a: 'Sí: evaluación inicial, rutinas a tu medida y seguimiento con nuestros entrenadores. Consulta precios y disponibilidad en recepción.',
  },
  {
    q: '¿Puedo llevar un invitado?',
    a: 'Sí. Cada socio puede traer un invitado por mes sin costo. Revisa las promociones vigentes en el inicio.',
  },
]
