// El día del negocio empieza y acaba en la hora de la SUCURSAL, no en un
// desfase escrito a mano.
//
// La bitácora filtraba con '-05:00' fijo mientras su propia columna de fecha ya
// se pinta con la zona de la sucursal: en cuanto esa zona deja de ser UTC-5, el
// listado y su filtro se contradicen —una fila fechada el día D no aparece al
// filtrar por D—. Estas funciones son puras a propósito: son la clase de regla
// que hay que poder probar sin base de datos.

const POR_DEFECTO = '-05:00';

// Desfase de la zona ESE día (así el horario de verano no lo desplaza mal).
function desfaseDe(zona, ymd) {
  // Sin zona NO se delega en Intl: con `timeZone: undefined` usaría la del
  // servidor, que en Vercel y en el CI es UTC. Sería el mismo error de fondo que
  // este módulo viene a corregir, pero más difícil de ver — lo destapó el CI,
  // donde la prueba pasaba en local (Panamá) y fallaba allí (UTC).
  if (typeof zona !== 'string' || zona.trim() === '') return POR_DEFECTO;
  try {
    const nombre = new Intl.DateTimeFormat('en-US', { timeZone: zona, timeZoneName: 'longOffset' })
      .formatToParts(new Date(`${ymd}T12:00:00Z`))
      .find((p) => p.type === 'timeZoneName')?.value;
    if (!nombre) return POR_DEFECTO;
    // 'GMT-05:00' → '-05:00'; UTC llega como 'GMT' a secas.
    const desfase = nombre.replace('GMT', '');
    return desfase === '' ? '+00:00' : desfase;
  } catch {
    return POR_DEFECTO;
  }
}

const inicioDelDia = (ymd, zona) => `${ymd}T00:00:00${desfaseDe(zona, ymd)}`;
const finDelDia = (ymd, zona) => `${ymd}T23:59:59${desfaseDe(zona, ymd)}`;

module.exports = { desfaseDe, inicioDelDia, finDelDia, POR_DEFECTO };
