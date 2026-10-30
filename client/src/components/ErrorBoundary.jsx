import { Component } from 'react'

// Última red bajo la aplicación. Sin esto, cualquier excepción en un render
// desmonta el árbol entero y el usuario se queda mirando una página en blanco,
// sin saber siquiera que hubo un error. Ya casi pasa una vez: un valor de
// decimales fuera de rango hacía que Intl lanzara al formatear un importe.
//
// Es de clase porque React no expone `componentDidCatch` con hooks; es el único
// componente del proyecto que lo necesita.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { rompio: false }
  }

  static getDerivedStateFromError() {
    return { rompio: true }
  }

  componentDidCatch(error, info) {
    // Al menos queda rastro en la consola del navegador para diagnosticar.
    console.error('[forja] error no controlado en el render', error, info)
  }

  render() {
    if (!this.state.rompio) return this.props.children
    return (
      <main className="container page reveal">
        <h1 className="page-title">
          Algo se <span>rompió</span>
        </h1>
        <p className="page-subtitle">
          No pudimos mostrar esta pantalla. Vuelve a cargarla; si sigue igual, escríbenos y lo revisamos.
        </p>
        <div className="checkout-actions" style={{ justifyContent: 'flex-start' }}>
          <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
            Recargar
          </button>
          <a className="btn btn-outline" href="/">Ir al inicio</a>
        </div>
      </main>
    )
  }
}
