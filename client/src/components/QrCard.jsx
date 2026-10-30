import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'

// Carnet QR de socio. Fondo blanco constante para que sea escaneable en ambos temas.
// El contenido es el token FIRMADO que entrega el servidor (/api/carnet): un QR
// con solo el id lo fabrica cualquiera que conozca ese id.
export default function QrCard({ token, userId }) {
  const canvasRef = useRef(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!canvasRef.current || !token) return
    QRCode.toCanvas(canvasRef.current, token, {
      width: 172,
      margin: 1,
      color: { dark: '#0a0a0a', light: '#ffffff' },
    }).catch(() => setFailed(true))
  }, [token])

  return (
    <div className="qr-card-inner">
      <h3>Carnet de socio</h3>
      {failed || !token ? (
        <p className="qr-fallback">ID de socio: {userId?.slice(0, 8)}</p>
      ) : (
        <div className="qr-frame">
          <canvas ref={canvasRef} aria-label="Código QR de socio" />
        </div>
      )}
      <p className="qr-hint">Muéstralo en recepción para identificarte.</p>
    </div>
  )
}
