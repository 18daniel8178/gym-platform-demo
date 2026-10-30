import { useEffect, useState } from 'react'
import { useMoney } from '../lib/infoPublica.js'
import { useLocation, useSearchParams } from 'react-router-dom'
import Skeleton from '../components/Skeleton.jsx'

const FILTROS = [
  { id: 'todos', label: 'Todos' },
  { id: 'comida', label: 'Comida' },
  { id: 'suplemento', label: 'Suplementos' },
]

// Carga el catálogo de productos con sus estados de carga y error
function useProducts() {
  const [products, setProducts] = useState([])
  const [status, setStatus] = useState('loading')

  useEffect(() => {
    fetch('/api/products')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => {
        setProducts(data)
        setStatus('ok')
      })
      .catch(() => setStatus('error'))
  }, [])

  return { products, status }
}

// Filtro de categoría sincronizado con ?cat=
function useFiltroDesdeUrl() {
  const [searchParams] = useSearchParams()
  const [filter, setFilter] = useState(() => {
    const cat = searchParams.get('cat')
    return FILTROS.some((f) => f.id === cat) ? cat : 'todos'
  })

  // Preselección del filtro al navegar con ?cat= desde el dropdown de Servicios
  useEffect(() => {
    const cat = searchParams.get('cat')
    if (cat && FILTROS.some((f) => f.id === cat)) setFilter(cat)
  }, [searchParams])

  return [filter, setFilter]
}

// Scroll a las anclas #coffee / #merch. Instantáneo (behavior auto): el scroll suave
// lo cancela el navegador cuando las imágenes cargan y mueven el layout.
function useScrollAlAncla(status) {
  const { hash } = useLocation()

  useEffect(() => {
    if (!hash) return
    const t = setTimeout(() => {
      document.querySelector(hash)?.scrollIntoView({ behavior: 'auto', block: 'start' })
    }, status === 'ok' ? 250 : 50)
    return () => clearTimeout(t)
  }, [hash, status])
}

// FORJA COFFEE: el coffee corner del gym
function CoffeeBanner() {
  return (
    <section id="coffee" className="card coffee-banner reveal">
      <div className="coffee-info">
        <img className="coffee-logo" src="/img/LogoCoffe.webp" alt="Logo FORJA COFFEE" />
        <div>
          <h2>
            FORJA <span>COFFEE</span>
          </h2>
          <p>
            Nuestro coffee corner dentro del gym: café de especialidad, matcha, smoothies y
            desayunos fit para antes o después de entrenar.
          </p>
        </div>
      </div>
      <div className="coffee-gallery">
        <img src="/img/coffe1.webp" alt="Café para llevar FORJA COFFEE" />
        <img src="/img/coffe4.webp" alt="Iced matcha de FORJA COFFEE" />
        <img src="/img/coffe3.webp" alt="Smoothie verde de FORJA COFFEE" />
        <img src="/img/coffe2.webp" alt="Vasos de FORJA COFFEE" />
      </div>
    </section>
  )
}

// Merch oficial
function MerchBanner() {
  return (
    <section id="merch" className="card merch-banner">
      <div className="merch-photos">
        <img src="/img/merch-Ropa.webp" alt="Camisetas FORJAMERCH" />
        <img src="/img/merch-tee.webp" alt="Camiseta básica de la colección" loading="lazy" />
      </div>
      <div className="merch-body">
        <h2>
          FORJA<span>MERCH</span>
        </h2>
        <p>
          Ropa oficial del gym en ediciones limitadas. Camisetas y más, disponibles en
          recepción.
        </p>
      </div>
    </section>
  )
}

function FilterBar({ filter, onFilterChange }) {
  return (
    <div className="filter-bar">
      {FILTROS.map((f) => (
        <button
          key={f.id}
          className={`filter-chip ${filter === f.id ? 'active' : ''}`}
          onClick={() => onFilterChange(f.id)}
        >
          {f.label}
        </button>
      ))}
    </div>
  )
}

function ProductsSkeleton() {
  return (
    <div className="product-grid" aria-hidden="true">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="skeleton-card">
          <Skeleton height={150} style={{ borderRadius: 'var(--r-sm)' }} />
          <Skeleton width="40%" height={12} />
          <Skeleton width="75%" height={18} />
          <Skeleton width="90%" height={12} />
          <Skeleton width="30%" height={20} />
        </div>
      ))}
    </div>
  )
}

// Imagen del producto o, si falta, emoji de respaldo según la categoría
function ProductImage({ producto }) {
  if (producto.imagen_url) return <img src={producto.imagen_url} alt={producto.nombre} />
  return producto.categoria === 'comida' ? '🍽️' : '💊'
}

function ProductCard({ producto }) {
  const money = useMoney()
  return (
    <article className="card product-card">
      <div className="product-img">
        <ProductImage producto={producto} />
      </div>
      <div className="product-body">
        <span className="product-category">{producto.categoria}</span>
        <h3>{producto.nombre}</h3>
        <p>{producto.descripcion}</p>
        <div className="product-price">{money(producto.precio)}</div>
      </div>
    </article>
  )
}

export default function Products() {
  const { products, status } = useProducts()
  const [filter, setFilter] = useFiltroDesdeUrl()
  useScrollAlAncla(status)

  const visible = filter === 'todos' ? products : products.filter((p) => p.categoria === filter)

  return (
    <main className="container page">
      <h1 className="page-title">
        Comida y <span>suplementos</span>
      </h1>
      <p className="page-subtitle">Todo lo que necesitas para rendir al máximo, disponible en el gym.</p>

      <CoffeeBanner />

      <FilterBar filter={filter} onFilterChange={setFilter} />

      {status === 'loading' && <ProductsSkeleton />}

      {status === 'error' && (
        <div className="empty-state">No se pudieron cargar los productos. Intenta más tarde.</div>
      )}

      {status === 'ok' && visible.length === 0 && (
        <div className="empty-state">
          <p>No hay productos en esta categoría por ahora.</p>
          <button className="btn btn-outline" style={{ marginTop: '0.9rem' }} onClick={() => setFilter('todos')}>
            Ver todos los productos
          </button>
        </div>
      )}

      {status === 'ok' && visible.length > 0 && (
        <div className="product-grid">
          {visible.map((p) => (
            <ProductCard key={p.id} producto={p} />
          ))}
        </div>
      )}

      <MerchBanner />
    </main>
  )
}
