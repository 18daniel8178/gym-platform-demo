import gymInterior from '../assets/gym-interior.webp'

const FOTOS = [
  { src: gymInterior, alt: 'Interior de FORJA GYM' },
  { src: '/img/coffe1.webp', alt: 'Café para llevar de FORJA COFFEE' },
  { src: '/img/menu2.webp', alt: 'Desayuno fit con pancakes' },
  { src: '/img/merch-Ropa.webp', alt: 'Camisetas FORJAMERCH' },
  { src: '/img/coffe3.webp', alt: 'Smoothie verde de FORJA COFFEE' },
  { src: '/img/menu1.webp', alt: 'Ensalada de pollo' },
  { src: '/img/coffe4.webp', alt: 'Iced matcha de FORJA COFFEE' },
  { src: '/img/menu3.webp', alt: 'Desayuno fit con waffles' },
  { src: '/img/coffe2.webp', alt: 'Vasos de FORJA COFFEE' },
  { src: '/img/Promocion.webp', alt: 'Promoción para socios de FORJA GYM' },
]

export default function Gallery() {
  return (
    <main className="container page">
      <h1 className="page-title">
        Nuestra <span>galería</span>
      </h1>
      <p className="page-subtitle">Un vistazo a FORJA GYM: instalaciones, coffee corner y merch oficial.</p>

      <div className="gallery-grid reveal">
        {FOTOS.map((f) => (
          <img key={f.src} src={f.src} alt={f.alt} loading="lazy" />
        ))}
      </div>
    </main>
  )
}
