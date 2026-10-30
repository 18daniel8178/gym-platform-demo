import { useCallback, useEffect, useState } from 'react'
import { money, MONEDA_POR_DEFECTO } from './money.js'

// Configuración que el sitio y el panel necesitan para pintar: la moneda y los
// métodos de pago activos. Sale del endpoint público de gym-info, así que no
// hace falta un endpoint nuevo ni permisos.
//
// Se pide UNA vez por carga de página y se comparte la misma promesa: si tres
// componentes la piden a la vez, sale una sola petición.

const METODOS_MINIMOS = [{ clave: 'efectivo', nombre: 'Efectivo' }];

let promesa = null;
// Marca del último cambio de ajustes en ESTA sesión. Mientras valga 0 se
// aprovecha la caché del Edge, que es de quien más se beneficia el visitante.
let fresco = 0;

function pedir() {
  if (!promesa) {
    promesa = fetch(fresco ? `/api/gym-info?fresh=${fresco}` : '/api/gym-info', fresco ? { cache: 'no-store' } : undefined)
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
      .then((datos) => {
        // Un fallo no se cachea: el siguiente montaje reintenta en vez de dejar
        // toda la sesión con la lista mínima de métodos.
        if (!datos) promesa = null;
        return datos;
      });
  }
  return promesa;
}

// Tras crear o (des)activar un método de pago: la siguiente lectura sale de la
// base y no de la promesa memoizada ni del caché del Edge.
export function olvidarInfoPublica() {
  promesa = null;
  fresco = Date.now();
}

export function useInfoPublica() {
  // undefined = todavía pidiendo · null = la petición falló.
  const [info, setInfo] = useState(undefined);

  useEffect(() => {
    let vivo = true;
    pedir().then((d) => vivo && setInfo(d));
    return () => {
      vivo = false;
    };
  }, []);

  return {
    moneda: info?.moneda?.simbolo ? info.moneda : MONEDA_POR_DEFECTO,
    // Nunca una lista vacía: dejaría el cobro sin ninguna opción que elegir.
    metodos: info?.metodos_pago?.length ? info.metodos_pago : METODOS_MINIMOS,
    // La dirección la manda la sucursal (se edita en Ajustes); si aún no la han
    // puesto, el sitio cae al texto de contactInfo.js como hasta ahora.
    sucursal: info?.sucursal || null,
    cargando: info === undefined,
    fallo: info === null,
  };
}

// Formatea con la moneda configurada sin que cada componente tenga que acordarse
// de pasarla: dentro del componente se sigue escribiendo `money(monto)`.
export function useMoney() {
  const { moneda } = useInfoPublica();
  return useCallback((monto) => money(monto, moneda), [moneda]);
}
