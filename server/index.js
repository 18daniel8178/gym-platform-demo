require('dotenv').config();
const express = require('express');
const cors = require('cors');

const { requireAuth } = require('./middleware/requireAuth');
const { requireStaff } = require('./middleware/requirePermission');

const gymInfoRouter = require('./modules/gym-info/router');
const plansRouter = require('./modules/plans/router');
const membershipsRouter = require('./modules/memberships/router');
const checkinRouter = require('./modules/checkin/router');
const paymentsRouter = require('./modules/payments/router');
const adminRouter = require('./modules/admin');
const { montarDemo } = require('./modules/demo/modoDemo');
const demoRouter = require('./modules/demo/router');

const PORT = process.env.PORT || 3001;

// CORS restringido por entorno. En producción la SPA y el API comparten origen
// en Vercel (no hace falta CORS): `false` = sin cabeceras CORS = solo same-origin.
// En desarrollo se permite el dev server de Vite. Override con CORS_ORIGIN.
const ORIGENES_DEV = ['http://localhost:5173'];
function resolverCorsOrigin(env) {
  if (env.CORS_ORIGIN) return env.CORS_ORIGIN.split(',').map((s) => s.trim());
  return env.NODE_ENV === 'production' ? false : ORIGENES_DEV;
}
const corsOrigin = resolverCorsOrigin(process.env);

const app = express();
app.disable('x-powered-by'); // no filtrar la versión de Express en las respuestas
app.use(cors({ origin: corsOrigin }));
app.use(express.json());

app.use('/api', gymInfoRouter);
app.use('/api', plansRouter);
app.use('/api', membershipsRouter);
app.use('/api', checkinRouter);
app.use('/api', paymentsRouter);

// Demo local: /api/demo solo existe con DEMO_MODE=true y un
// Supabase local. En producción no se monta; con la bandera y una base remota
// tampoco, y queda el aviso en el log.
const modoDemo = montarDemo(app, { env: process.env, router: demoRouter });
if (modoDemo.aviso) console.warn(modoDemo.aviso);

// Backoffice admin: chokepoint único. noStore corre primero para que cubra
// también los 401/403 de requireAuth/requireStaff. Ningún endpoint /api/admin/*
// puede quedar sin protección; cada endpoint añade su requirePermission propio.
const noStore = (_req, res, next) => {
  res.set('Cache-Control', 'private, no-store');
  next();
};
// El CSV de importación viaja como TEXTO, no envuelto en JSON: un padrón de
// cientos de socios no entra en el límite de express.json y envolverlo no
// aportaría nada. Va antes del router para que el cuerpo llegue ya leído.
app.use('/api/admin/members/importar', express.text({ type: 'text/csv', limit: '2mb' }));
app.use('/api/admin', noStore, requireAuth, requireStaff, adminRouter);

// En local se escucha el puerto; en Vercel se importa la app como función serverless
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`FORJA GYM API escuchando en http://localhost:${PORT}`);
  });
}

module.exports = app;
