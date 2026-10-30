// Función serverless de Vercel: reexporta la app Express (misma lógica y endpoints /api/*).
// El rewrite de vercel.json enruta /api/(.*) a esta función.
module.exports = require('../server/index.js')
