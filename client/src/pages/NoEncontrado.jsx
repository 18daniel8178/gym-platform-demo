import { Link } from 'react-router-dom'

// Una URL que no existe. Antes el área de contenido quedaba en blanco entre el
// header y el footer, que se lee como "la web está rota" y no como "esa página
// no existe". Sin ilustración ni humor: el visitante quería llegar a otro sitio.
export default function NoEncontrado() {
  return (
    <main className="container page reveal">
      <h1 className="page-title">
        Página <span>no encontrada</span>
      </h1>
      <p className="page-subtitle">
        El enlace que seguiste no lleva a ninguna parte, o la página cambió de sitio.
      </p>
      <div className="checkout-actions" style={{ justifyContent: 'flex-start' }}>
        <Link className="btn btn-primary" to="/">Ir al inicio</Link>
        <Link className="btn btn-outline" to="/contacto">Contáctanos</Link>
      </div>
    </main>
  )
}
