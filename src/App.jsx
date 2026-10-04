import { lazy, Suspense, useEffect } from 'react'
import { Routes, Route, useLocation, Link } from 'react-router-dom'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import Home from './pages/Home'
import Counsel from './pages/Counsel'
import Trades from './pages/Trades'
import TradeDetail from './pages/TradeDetail'
import Simulator from './pages/Simulator'
import Pact from './pages/Pact'
import Counsellor from './pages/Counsellor'
import Path from './pages/Path'
import Numbers from './pages/Numbers'

// Leaflet is only needed on the admin dashboard; keep it out of the family-facing bundle.
const Admin = lazy(() => import('./pages/Admin'))

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

function NotFound() {
  return (
    <div className="page">
      <div className="container narrow confirm">
        <h1>Page not found</h1>
        <Link to="/" className="btn btn-primary">
          Go home
        </Link>
      </div>
    </div>
  )
}

export default function App() {
  const { pathname } = useLocation()
  return (
    <>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <ScrollToTop />
      <Navbar />
      <main id="main" className={pathname === '/' ? 'is-home' : ''}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/counsel" element={<Counsel />} />
          <Route path="/trades" element={<Trades />} />
          <Route path="/trades/:id" element={<TradeDetail />} />
          <Route path="/simulator" element={<Simulator />} />
          <Route path="/path" element={<Path />} />
          <Route path="/numbers" element={<Numbers />} />
          <Route path="/pact" element={<Pact />} />
          <Route path="/counsellor" element={<Counsellor />} />
          <Route
            path="/admin"
            element={
              <Suspense fallback={<div className="container page-loading">Loading dashboard…</div>}>
                <Admin />
              </Suspense>
            }
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
    </>
  )
}
