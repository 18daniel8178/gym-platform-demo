const { test } = require('node:test');
const assert = require('node:assert/strict');
const { evaluarModoDemo, montarDemo } = require('./modoDemo');

const LOCAL = 'http://127.0.0.1:54321';
const PRODUCCION = 'https://proyecto-ficticio.supabase.co';

test('sin DEMO_MODE no hay demo, ni siquiera con una base local', () => {
  assert.deepEqual(evaluarModoDemo({ SUPABASE_URL: LOCAL }), { activo: false, aviso: null });
});

test('DEMO_MODE con una base local activa la demo', () => {
  assert.equal(evaluarModoDemo({ DEMO_MODE: 'true', SUPABASE_URL: LOCAL }).activo, true);
  assert.equal(evaluarModoDemo({ DEMO_MODE: 'true', SUPABASE_URL: 'http://localhost:54321' }).activo, true);
  assert.equal(evaluarModoDemo({ DEMO_MODE: 'true', SUPABASE_URL: 'http://[::1]:54321' }).activo, true);
});

test('DEMO_MODE con la base de producción NO activa la demo, y lo avisa', () => {
  const r = evaluarModoDemo({ DEMO_MODE: 'true', SUPABASE_URL: PRODUCCION });
  assert.equal(r.activo, false);
  assert.match(r.aviso, /no es local/);
});

test('una URL ausente o malformada tampoco la activa', () => {
  assert.equal(evaluarModoDemo({ DEMO_MODE: 'true' }).activo, false);
  assert.equal(evaluarModoDemo({ DEMO_MODE: 'true', SUPABASE_URL: 'no es una url' }).activo, false);
});

test('solo el texto exacto "true" enciende la bandera', () => {
  for (const valor of ['1', 'yes', 'TRUE', 'true ', 'si']) {
    assert.equal(evaluarModoDemo({ DEMO_MODE: valor, SUPABASE_URL: LOCAL }).activo, false, JSON.stringify(valor));
  }
});

test('un host que solo PARECE local no engaña a la guarda', () => {
  // La guarda mira el host, no el protocolo: basta con https.
  for (const url of ['https://localhost.evil.com', 'https://127.0.0.1.nip.io', 'https://evil.com/localhost']) {
    assert.equal(evaluarModoDemo({ DEMO_MODE: 'true', SUPABASE_URL: url }).activo, false, url);
  }
});

test('sin modo demo la ruta no se monta; con él, en /api/demo', () => {
  const montadas = [];
  const app = { use: (ruta) => montadas.push(ruta) };
  const router = () => {};

  montarDemo(app, { env: { SUPABASE_URL: LOCAL }, router });
  montarDemo(app, { env: { DEMO_MODE: 'true', SUPABASE_URL: PRODUCCION }, router });
  assert.deepEqual(montadas, []);

  montarDemo(app, { env: { DEMO_MODE: 'true', SUPABASE_URL: LOCAL }, router });
  assert.deepEqual(montadas, ['/api/demo']);
});
