const { test } = require('node:test');
const assert = require('node:assert/strict');

// Verificación A01 del Documento Maestro: alta presencial + intento de duplicado
// advertido. Lo que las pruebas unitarias no cubrían es el ORDEN de la ruta, que
// es justo lo que A01 promete: el aviso llega ANTES de crear la cuenta, y una
// falla a mitad no deja cuentas huérfanas.
//
// Se sustituye un solo borde —Supabase— por un doble propio. El router real, su
// guard de permisos y la secuencia corren de verdad. El router se carga una vez:
// su registro de rutas es global y recargarlo chocaría consigo mismo.

const DOC_VIGENTE = {
  id: 1, codigo: 'reglamento', version: 1, titulo: 'Reglamento interno',
  texto: '', obligatorio: true, publicado_en: '2026-01-01T00:00:00Z',
};

const ANA_ARCHIVADA = {
  user_id: 'u-ana', nombre_completo: 'Ana Pérez', estado_miembro: 'archivado',
  por_documento: true, por_email: false,
};

// Lo que cada escenario configura y lo que el doble va anotando.
const estado = { rpc: {}, llamadas: [], creadas: [], borradas: [] };

// Doble encadenable: cada método devuelve el mismo objeto y el await lo resuelve
// con la respuesta de esa tabla.
function tablaFalsa(nombre) {
  const q = {};
  for (const m of ['select', 'insert', 'update', 'upsert', 'delete', 'eq', 'in', 'order', 'limit', 'maybeSingle', 'single']) {
    q[m] = (...args) => {
      estado.llamadas.push({ tabla: nombre, metodo: m, args });
      return q;
    };
  }
  const respuestas = {
    consent_documents: { data: [DOC_VIGENTE], error: null },
    admin_audit_log: { data: null, error: null },
  };
  q.then = (resolver) => resolver(respuestas[nombre] ?? { data: null, error: null });
  return q;
}

const supabaseFalso = {
  from: tablaFalsa,
  rpc: async (nombre, args) => {
    estado.llamadas.push({ rpc: nombre, args });
    return estado.rpc[nombre] ?? { data: null, error: null };
  },
  auth: {
    admin: {
      createUser: async (datos) => {
        estado.creadas.push(datos);
        return { data: { user: { id: 'u-nuevo' } }, error: null };
      },
      deleteUser: async (id) => {
        estado.borradas.push(id);
        return { error: null };
      },
      listUsers: async () => ({ data: { users: [] }, error: null }),
    },
  },
};

const RUTA_SUPABASE = require.resolve('../../infrastructure/supabase');
require.cache[RUTA_SUPABASE] = { id: RUTA_SUPABASE, filename: RUTA_SUPABASE, loaded: true, exports: { supabase: supabaseFalso } };
const router = require('./alta.router');

function escenario({ coincidencias = [], altaMiembro = { data: null, error: null } } = {}) {
  estado.rpc = { miembros_coincidentes: { data: coincidencias, error: null }, alta_miembro: altaMiembro };
  estado.llamadas = [];
  estado.creadas = [];
  estado.borradas = [];
}

// Mete una petición por el router real: el guard del permiso corre de verdad, con
// los permisos ya resueltos en req (como los deja permisosDe dentro del request).
function pedirAlta({ body, permisos = ['member.create'] }) {
  return new Promise((resolve) => {
    const req = {
      method: 'POST', url: '/members', headers: {}, body,
      user: { id: 'u-staff', email: 'recepcion@forja.test' },
      permisos: new Set(permisos),
    };
    const res = {
      statusCode: 200,
      status(c) { this.statusCode = c; return this; },
      json(b) { resolve({ status: this.statusCode, body: b }); return this; },
      set() { return this; },
    };
    router(req, res, () => resolve({ status: 404, body: null }));
  });
}

// La ruta solo exige 6+ caracteres: aquí es relleno para pasar esa validación,
// no una credencial, y por eso se construye en vez de escribirse como literal.
const RELLENO_CLAVE = 'x'.repeat(12);

const ALTA_VALIDA = {
  email: 'ana.nueva@correo.test',
  password: RELLENO_CLAVE,
  nombre_completo: 'Ana Pérez Ríos',
  fecha_nacimiento: '1990-04-07',
  documento: '8-123-456',
  telefono: '6000-1111',
  emergencia1_nombre: 'María Ríos',
  emergencia1_telefono: '6000-2222',
  emergencia2_nombre: 'Luis Ríos',
  emergencia2_telefono: '6000-3333',
  estado_inicial: 'activo',
  origen: 'mostrador',
  consentimientos: ['reglamento'],
};

const auditoria = () => estado.llamadas
  .filter((l) => l.tabla === 'admin_audit_log' && l.metodo === 'insert')
  .map((l) => l.args[0]);

test('A01 · alta limpia: crea la cuenta, el expediente y lo audita', async () => {
  escenario();
  const r = await pedirAlta({ body: ALTA_VALIDA });

  assert.equal(r.status, 201);
  assert.equal(r.body.email, ALTA_VALIDA.email);
  assert.equal(estado.creadas.length, 1);

  const alta = estado.llamadas.find((l) => l.rpc === 'alta_miembro');
  assert.equal(alta.args.p_origen, 'mostrador');
  assert.equal(alta.args.p_estado, 'activo');
  assert.deepEqual(alta.args.p_consentimientos, ['reglamento']);
  assert.equal(alta.args.p_exigir_obligatorios, true);

  const [registro] = auditoria();
  assert.equal(registro.accion, 'client.create');
  assert.equal(registro.actor_email, 'recepcion@forja.test');
});

test('A01 · un documento repetido avisa y NO llega a crear ninguna cuenta', async () => {
  escenario({ coincidencias: [ANA_ARCHIVADA] });
  const r = await pedirAlta({ body: ALTA_VALIDA });

  assert.equal(r.status, 409);
  assert.equal(r.body.requiere_confirmacion, true);
  assert.deepEqual(r.body.coincidencias.map((c) => c.user_id), ['u-ana']);
  // Lo que A01 promete: el aviso llega antes de tocar Auth.
  assert.deepEqual(estado.creadas, []);
});

test('A01 · confirmado explícitamente, crea y deja constancia de con quién coincidía', async () => {
  escenario({ coincidencias: [ANA_ARCHIVADA] });
  const r = await pedirAlta({ body: { ...ALTA_VALIDA, confirmar_duplicado: true } });

  assert.equal(r.status, 201);
  assert.equal(estado.creadas.length, 1);
  assert.deepEqual(auditoria()[0].detalle.duplicado_confirmado, ['u-ana']);
});

test('A01 · un correo repetido no se puede forzar ni crea cuenta', async () => {
  escenario({ coincidencias: [{ ...ANA_ARCHIVADA, user_id: 'u-beto', por_documento: false, por_email: true }] });
  const r = await pedirAlta({ body: { ...ALTA_VALIDA, confirmar_duplicado: true } });

  assert.equal(r.status, 409);
  assert.equal(r.body.requiere_confirmacion, false);
  assert.match(r.body.error, /correo/i);
  assert.deepEqual(estado.creadas, []);
});

test('A01 · si el expediente falla, la cuenta recién creada se borra', async () => {
  escenario({ altaMiembro: { data: null, error: { code: 'XX000', message: 'falló la transacción' } } });
  const r = await pedirAlta({ body: ALTA_VALIDA });

  assert.equal(r.status, 500);
  assert.equal(estado.creadas.length, 1);
  assert.deepEqual(estado.borradas, ['u-nuevo']);
});

test('A01 · sin permiso para dar de alta, la ruta responde 403 sin tocar nada', async () => {
  escenario();
  const r = await pedirAlta({ body: ALTA_VALIDA, permisos: ['member.read'] });

  assert.equal(r.status, 403);
  assert.deepEqual(estado.creadas, []);
  assert.deepEqual(estado.llamadas, []);
});
