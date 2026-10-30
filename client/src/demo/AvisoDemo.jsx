// Aviso permanente de la demo local. Solo se monta con
// VITE_DEMO_MODE (ver main.jsx): en el build de producción la condición es falsa
// y este componente no llega al bundle. No intercepta clics: nunca tapa la app.
// En pantallas angostas muestra la versión corta; el nombre accesible es siempre
// el completo.
const AVISO = 'Modo demostración · datos ficticios'

export default function AvisoDemo() {
  return (
    <div className="aviso-demo" role="note" aria-label={AVISO}>
      <span className="aviso-demo-punto" aria-hidden="true" />
      <span className="aviso-demo-largo" aria-hidden="true">{AVISO}</span>
      <span className="aviso-demo-corto" aria-hidden="true">Modo demo</span>
    </div>
  )
}
