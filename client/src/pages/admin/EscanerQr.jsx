import { useCallback, useEffect, useRef, useState } from 'react'

// Lector de QR con la cámara del dispositivo. Usa BarcodeDetector, que traen
// Chrome, Edge y Android; donde no existe (Safari/iOS hoy) esta tarjeta lo dice
// y la pantalla sigue funcionando con la búsqueda manual, que nunca se esconde.
//
// El lector NO decide nada: solo entrega el texto del QR. Quien autoriza la
// entrada es el servidor.

const HAY_LECTOR = typeof window !== 'undefined' && 'BarcodeDetector' in window
const CADA_MS = 400
// El mismo carnet delante de la cámara dispara muchas lecturas por segundo.
const ESPERA_MISMO_CODIGO = 4000

function useCamara({ onLeer, encendida }) {
  const videoRef = useRef(null)
  const ultima = useRef({ texto: null, momento: 0 })
  const [error, setError] = useState('')

  const leer = useCallback((texto) => {
    const ahora = Date.now()
    const repetido = texto === ultima.current.texto && ahora - ultima.current.momento < ESPERA_MISMO_CODIGO
    if (repetido) return
    ultima.current = { texto, momento: ahora }
    onLeer(texto)
  }, [onLeer])

  useEffect(() => {
    if (!encendida || !HAY_LECTOR) return undefined
    let stream = null
    let timer = null
    let vivo = true
    const detector = new window.BarcodeDetector({ formats: ['qr_code'] })

    const arrancar = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        if (!vivo) return stream.getTracks().forEach((t) => t.stop())
        videoRef.current.srcObject = stream
        await videoRef.current.play()
        timer = setInterval(async () => {
          try {
            const [codigo] = await detector.detect(videoRef.current)
            if (codigo?.rawValue) leer(codigo.rawValue)
          } catch { /* un fotograma ilegible no es un error que mostrar */ }
        }, CADA_MS)
        return undefined
      } catch {
        return setError('No se pudo abrir la cámara. Revisa el permiso del navegador o usa la búsqueda.')
      }
    }
    arrancar()

    return () => {
      vivo = false
      if (timer) clearInterval(timer)
      if (stream) stream.getTracks().forEach((t) => t.stop())
    }
  }, [encendida, leer])

  return { videoRef, error }
}

export default function EscanerQr({ onLeer }) {
  const [encendida, setEncendida] = useState(false)
  const { videoRef, error } = useCamara({ onLeer, encendida })

  if (!HAY_LECTOR) {
    return (
      <p className="admin-muted">
        Este navegador no lee códigos QR con la cámara. Busca al socio por su nombre o documento;
        en Chrome, Edge o Android el lector aparece aquí.
      </p>
    )
  }

  return (
    <div className="escaner">
      {encendida ? (
        <>
          {/* El video muestra lo que la cámara ve; el marco guía dónde poner el carnet. */}
          <div className="escaner-marco">
            <video ref={videoRef} muted playsInline aria-label="Cámara para leer el carnet" />
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEncendida(false)}>
            Apagar cámara
          </button>
        </>
      ) : (
        <button type="button" className="btn btn-primary" onClick={() => setEncendida(true)}>
          Encender cámara
        </button>
      )}
      {error && <p className="admin-aviso">{error}</p>}
    </div>
  )
}
