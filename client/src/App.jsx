import { useEffect, lazy, Suspense } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Header from './components/Header.jsx'
import Footer from './components/Footer.jsx'
import { SECCIONES } from './pages/admin/secciones.js'
import NoEncontrado from './pages/NoEncontrado.jsx'

// Páginas con carga diferida (code splitting por ruta)
const Login = lazy(() => import('./pages/Login.jsx'))
const Join = lazy(() => import('./pages/Join.jsx'))
const Home = lazy(() => import('./pages/Home.jsx'))
const Products = lazy(() => import('./pages/Products.jsx'))
const Subscription = lazy(() => import('./pages/Subscription.jsx'))
const Profile = lazy(() => import('./pages/Profile.jsx'))
const Gallery = lazy(() => import('./pages/Gallery.jsx'))
const Contact = lazy(() => import('./pages/Contact.jsx'))
const PersonalTraining = lazy(() => import('./pages/PersonalTraining.jsx'))
const Checkout = lazy(() => import('./pages/Checkout.jsx'))
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout.jsx'))

export default function App() {
  const { pathname, hash } = useLocation()
  const isAuthPage = pathname === '/login' || pathname === '/join'
  // El panel admin tiene su propio layout: sin el Header/Footer públicos.
  // Por segmento, no por prefijo: '/administracion' no es el panel, y si se le
  // quita el header y el footer el visitante se queda sin por dónde salir.
  const isAdminPage = pathname === '/admin' || pathname.startsWith('/admin/')
  const hideChrome = isAuthPage || isAdminPage

  // Al cambiar de página, subir al inicio (las anclas #coffee/#merch mantienen su scroll propio)
  useEffect(() => {
    if (!hash) window.scrollTo(0, 0)
  }, [pathname, hash])

  return (
    <>
      {!hideChrome && <Header />}
      <Suspense fallback={<div className="route-fallback" aria-live="polite" aria-busy="true" />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/join" element={<Join />} />
          <Route path="/register" element={<Navigate to="/join" replace />} />
          <Route path="/" element={<Home />} />
          <Route path="/productos" element={<Products />} />
          <Route path="/suscripcion" element={<Subscription />} />
          <Route path="/perfil" element={<Profile />} />
          <Route path="/galeria" element={<Gallery />} />
          <Route path="/contacto" element={<Contact />} />
          <Route path="/entrenamiento" element={<PersonalTraining />} />
          <Route path="/pagar" element={<Checkout />} />
          {/* Las secciones del panel salen del registro único: montar una sin
              declarar su permiso deja de ser posible (ver secciones.js). */}
          <Route path="/admin" element={<AdminLayout />}>
            {SECCIONES.map(({ ruta, Pagina }) =>
              ruta ? (
                <Route key={ruta} path={ruta} element={<Pagina />} />
              ) : (
                <Route key="indice" index element={<Pagina />} />
              )
            )}
            {/* Sin esto React Router no monta el layout y la URL desconocida
                queda en blanco; el propio layout decide qué mostrar. */}
            <Route path="*" element={null} />
          </Route>
          {/* Cualquier otra URL pública: 404 propia, no un hueco en blanco. */}
          <Route path="*" element={<NoEncontrado />} />
        </Routes>
      </Suspense>
      {!hideChrome && <Footer />}
    </>
  )
}
