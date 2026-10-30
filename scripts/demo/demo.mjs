#!/usr/bin/env node
/**
 * Demo LOCAL de FORJA GYM. Un comando para enseñar el
 * sistema entero con datos ficticios, sin tocar producción ni gastar:
 *
 *   npm run demo         → levanta Supabase local, crea el esquema si falta, siembra
 *                          si está vacía y arranca API (3080) y cliente (5180)
 *   npm run demo:reset   → vuelve al gimnasio del primer día (borra lo hecho en una presentación)
 *   npm run demo:stop    → apaga Supabase local
 *
 * Las claves locales viajan en el ENTORNO de los procesos (dotenv y Vite no pisan
 * una variable que ya existe), así que los .env de producción no se tocan y no
 * queda ninguna clave escrita en disco.
 */
import { spawn, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const CLI = ['--yes', 'supabase@2.117.0']; // versión fija: dos máquinas levantan lo mismo
const CONTENEDOR_DB = 'supabase_db_forja-demo';
const PUERTO_API = '3080';
const PUERTO_CLIENTE = '5180';
const ES_WINDOWS = process.platform === 'win32';

// Los DOS únicos puntos que ejecutan un comando del PATH (npx y docker). Es
// intencional: esta es una herramienta local que hace lo mismo que teclearlos en
// la terminal del desarrollador, y ningún argumento viene de fuera del script.
// Rutas absolutas se romperían entre instalaciones (Docker Desktop, nvm, …).
//
// npx es un .cmd en Windows: necesita shell; los argumentos son constantes.
function supabase(args, { capturar = false } = {}) {
  // eslint-disable-next-line sonarjs/no-os-command-from-path -- herramienta local: npx del PATH del desarrollador, argumentos constantes
  const r = spawnSync('npx', [...CLI, ...args], {
    cwd: RAIZ, shell: ES_WINDOWS, encoding: 'utf8', stdio: capturar ? 'pipe' : 'inherit',
  });
  if (r.status !== 0) throw new Error(`supabase ${args.join(' ')} falló (código ${r.status})`);
  return r.stdout;
}

function docker(args, opciones = {}) {
  // eslint-disable-next-line sonarjs/no-os-command-from-path -- herramienta local: docker del PATH del desarrollador, argumentos constantes
  return spawnSync('docker', args, { encoding: 'utf8', ...opciones });
}

function dockerResponde() {
  const r = docker(['info', '--format', '{{.ServerVersion}}'], { timeout: 20000 });
  return r.status === 0 && Boolean(r.stdout.trim());
}

// `supabase status -o env` → { url, anon, servicio } sin imprimir nada.
function clavesLocales() {
  const env = {};
  for (const linea of supabase(['status', '-o', 'env'], { capturar: true }).split(/\r?\n/)) {
    const m = linea.match(/^([A-Z_]+)="?(.*?)"?$/);
    if (m) env[m[1]] = m[2];
  }
  if (!env.API_URL || !env.ANON_KEY || !env.SERVICE_ROLE_KEY) throw new Error('Supabase local no devolvió sus claves');
  return { url: env.API_URL, anon: env.ANON_KEY, servicio: env.SERVICE_ROLE_KEY, studio: env.STUDIO_URL };
}

function psql(entrada) {
  const r = docker(['exec', '-i', CONTENEDOR_DB, 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q', '-At'], {
    input: entrada,
  });
  if (r.status !== 0) throw new Error(`psql falló: ${(r.stderr || '').trim().split('\n').slice(0, 3).join(' | ')}`);
  return r.stdout.trim();
}

// El esquema sale de server/db, la MISMA fuente que producción: schema.sql,
// seed.sql y la lista única de migraciones que también usan las pruebas.
function crearEsquema() {
  const lista = readFileSync(join(RAIZ, 'server/db/migraciones.txt'), 'utf8')
    .split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
  for (const archivo of ['schema.sql', 'seed.sql', ...lista]) {
    console.log(`  · ${archivo}`);
    psql(readFileSync(join(RAIZ, 'server/db', archivo), 'utf8'));
  }
}

function sembrar(claves) {
  const r = spawnSync(process.execPath, [join(RAIZ, 'server/demo/sembrar.js')], {
    cwd: RAIZ, stdio: 'inherit', env: { ...process.env, SUPABASE_URL: claves.url, SUPABASE_SERVICE_ROLE_KEY: claves.servicio },
  });
  if (r.status !== 0) throw new Error('no se pudo sembrar la demo; prueba npm run demo:reset');
}

function prepararBase(claves) {
  if (psql("select to_regclass('public.profiles') is not null") !== 't') {
    console.log('Creando el esquema desde server/db…');
    crearEsquema();
  }
  if (psql('select count(*) from public.profiles') === '0') {
    console.log('Sembrando el gimnasio ficticio…');
    sembrar(claves);
  }
}

// API y cliente como hijos directos de node (sin shell): así se cierran con la demo.
function arrancarServidores(claves) {
  const api = spawn(process.execPath, [join(RAIZ, 'server/index.js')], {
    cwd: RAIZ, stdio: 'inherit',
    env: { ...process.env, PORT: PUERTO_API, SUPABASE_URL: claves.url, SUPABASE_SERVICE_ROLE_KEY: claves.servicio, DEMO_MODE: 'true' },
  });
  const cliente = spawn(process.execPath, [join(RAIZ, 'client/node_modules/vite/bin/vite.js'), '--port', PUERTO_CLIENTE, '--strictPort'], {
    cwd: join(RAIZ, 'client'), stdio: 'inherit',
    env: { ...process.env, VITE_SUPABASE_URL: claves.url, VITE_SUPABASE_ANON_KEY: claves.anon, VITE_DEMO_MODE: 'true', API_PORT: PUERTO_API },
  });
  const cerrar = (codigo) => {
    api.kill();
    cliente.kill();
    process.exit(codigo);
  };
  process.on('SIGINT', () => cerrar(0));
  process.on('SIGTERM', () => cerrar(0));
  api.on('exit', (c) => cerrar(c ?? 1));
  cliente.on('exit', (c) => cerrar(c ?? 1));
  console.log(`\nDemo de FORJA GYM en http://localhost:${PUERTO_CLIENTE}  ·  Studio: ${claves.studio}  ·  Ctrl+C para salir\n`);
}

function exigirDocker() {
  if (dockerResponde()) return;
  throw new Error('Docker no responde. Abre Docker Desktop y espera a que diga "Engine running" (ver README, "Run the demo locally").');
}

const ACCIONES = {
  levantar() {
    exigirDocker();
    supabase(['start']);
    const claves = clavesLocales();
    prepararBase(claves);
    arrancarServidores(claves);
  },
  reiniciar() {
    exigirDocker();
    supabase(['db', 'reset']);
    const claves = clavesLocales();
    console.log('Creando el esquema desde server/db…');
    crearEsquema();
    sembrar(claves);
    console.log('\nLa demo volvió al primer día. Levántala con: npm run demo\n');
  },
  apagar() {
    supabase(['stop']);
  },
};

const accion = ACCIONES[process.argv[2] || 'levantar'];
if (!accion) {
  console.log('Uso: node scripts/demo/demo.mjs <levantar|reiniciar|apagar>');
  process.exit(1);
}
try {
  accion();
} catch (e) {
  console.error(`\nDemo: ${e.message}\n`);
  process.exit(1);
}
