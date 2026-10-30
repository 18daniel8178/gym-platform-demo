// Único punto donde se decide cómo se ve un monto. Lo usan el panel, el sitio
// público y el checkout: antes el panel formateaba con Intl en dólares ("USD
// 45.00") y el sitio escribía "$45.00" a mano en cinco sitios distintos.
//
// El símbolo se antepone al número en vez de delegar en `currency: 'PAB'`: con
// datos de ICU reducidos, Intl degrada el balboa a "PAB 45.00" según el entorno,
// y el documento maestro pide B/. siempre.

// Moneda por defecto: la del seed de ajustes. Si el sitio aún no cargó la
// configuración, un precio se ve igual de bien en vez de quedar en blanco.
export const MONEDA_POR_DEFECTO = Object.freeze({
  codigo: 'PAB',
  simbolo: 'B/.',
  decimales: 2,
  locale: 'es-PA',
});

export function money(monto, moneda = MONEDA_POR_DEFECTO) {
  const { simbolo, decimales, locale } = { ...MONEDA_POR_DEFECTO, ...(moneda || {}) };
  const numero = Number(monto);
  const valor = Number.isFinite(numero) ? numero : 0;
  // `decimales` puede llegar como texto crudo de un <input> mientras se teclea
  // en Ajustes: fuera de 0-4 Intl lanza RangeError y, sin ErrorBoundary, eso
  // tumba el panel entero durante el render.
  const pedidos = Number(decimales);
  const digitos = Number.isFinite(pedidos)
    ? Math.min(4, Math.max(0, Math.trunc(pedidos)))
    : MONEDA_POR_DEFECTO.decimales;
  const formateado = new Intl.NumberFormat(locale, {
    minimumFractionDigits: digitos,
    maximumFractionDigits: digitos,
  }).format(Math.abs(valor));
  // El signo va delante del símbolo: "-B/. 7.00" se lee mejor que "B/. -7.00".
  return `${valor < 0 ? '-' : ''}${simbolo} ${formateado}`;
}
