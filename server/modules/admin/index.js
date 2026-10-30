const { Router } = require('express');

// Composición del router admin transversal. Los sub-routers se montan con
// requires ESTÁTICOS (nunca fs.readdir): el bundler de Vercel solo traza
// requires estáticos, y uno dinámico rompería el deploy serverless.
const meRouter = require('./me.router');
const statsRouter = require('./stats.router');
const usersRouter = require('./users.router');
const membersRouter = require('../members/admin.router');
const membersAltaRouter = require('../members/alta.router');
const membersGestionRouter = require('../members/gestion.router');
const consentimientosRouter = require('../members/consentimientos.router');
const importacionRouter = require('../members/importacion.router');
const historialRouter = require('../members/historial.router');
const checkinAdminRouter = require('../checkin/admin.router');
const plansAdminRouter = require('../plans/admin.router');
const gymInfoAdminRouter = require('../gym-info/admin.router');
const membershipsAdminRouter = require('../memberships/admin.router');
const paymentsAdminRouter = require('../payments/admin.router');
const settingsAdminRouter = require('../settings/admin.router');
const branchesAdminRouter = require('../branches/admin.router');

const router = Router();

router.use(meRouter);
router.use(statsRouter);
router.use(usersRouter);
router.use(membersRouter);
router.use(membersAltaRouter);
router.use(membersGestionRouter);
router.use(consentimientosRouter);
router.use(importacionRouter);
router.use(historialRouter);
router.use(checkinAdminRouter);
router.use(plansAdminRouter);
router.use(gymInfoAdminRouter);
router.use(membershipsAdminRouter);
router.use(paymentsAdminRouter);
router.use(settingsAdminRouter);
router.use(branchesAdminRouter);
// Fase 3 (mismo patrón): GET /payments (historial con filtros + export CSV)

// Las rutas se declaran con crearRouterAdmin, que exige el permiso en la firma
// y verifica rutas.contract.test.js. No hay parcheo de rutas en el arranque.
module.exports = router;
