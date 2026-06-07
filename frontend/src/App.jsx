import { Routes, Route, NavLink } from 'react-router-dom'
import { useState, useEffect } from 'react'
import ProductExplorer from './pages/ProductExplorer'
import ProductDetail from './pages/ProductDetail'
import ComparisonBoard from './pages/ComparisonBoard'
import CrawlMonitor from './pages/CrawlMonitor'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

function App() {
  const [liveAlerts, setLiveAlerts] = useState([])

  // Connect to SSE for live price updates
  useEffect(() => {
    const es = new EventSource(`${API_URL}/api/stream/prices`)
    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data)
        setLiveAlerts(prev => [data, ...prev].slice(0, 5))
      } catch {}
    }
    es.onerror = () => es.close()
    return () => es.close()
  }, [])

  return (
    <div className="min-h-screen flex flex-col">
      {/* Navbar */}
      <nav className="bg-brand-900 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-brand-500 rounded-lg flex items-center justify-center font-bold text-sm">R</div>
            <span className="font-semibold text-lg">Rubick AI — Catalog Intelligence</span>
          </div>
          <div className="flex gap-6 text-sm">
            {[
              { to: '/', label: 'Products' },
              { to: '/compare', label: 'Compare' },
              { to: '/monitor', label: 'Crawl Monitor' }
            ].map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `hover:text-brand-300 transition-colors ${isActive ? 'text-brand-300 font-semibold' : ''}`
                }
              >
                {label}
              </NavLink>
            ))}
          </div>
        </div>
      </nav>

      {/* Live Price Alert Banner */}
      {liveAlerts.length > 0 && (
        <div className="bg-green-50 border-b border-green-200 px-4 py-2">
          <div className="max-w-7xl mx-auto flex items-center gap-3 text-sm">
            <span className="flex items-center gap-1 text-green-700 font-medium">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse inline-block"></span>
              Live Price Update:
            </span>
            <span className="text-green-800">
              {liveAlerts[0].platform?.toUpperCase()} — {liveAlerts[0].title || `Product ${liveAlerts[0].productId?.slice(0, 8)}`}
              {' '}→ ₹{Number(liveAlerts[0].newPrice).toLocaleString('en-IN')}
              {liveAlerts[0].fetchMethod === 'http_myntra' || liveAlerts[0].source?.includes('http') ? (
                <span className="ml-2 text-xs text-green-600 font-normal">(live fetch)</span>
              ) : (
                <span className="ml-2 text-xs text-yellow-700 font-normal">(simulated)</span>
              )}
            </span>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6">
        <Routes>
          <Route path="/" element={<ProductExplorer />} />
          <Route path="/products/:id" element={<ProductDetail />} />
          <Route path="/compare" element={<ComparisonBoard />} />
          <Route path="/monitor" element={<CrawlMonitor />} />
        </Routes>
      </main>

      <footer className="bg-gray-100 border-t text-center text-xs text-gray-500 py-3">
        Rubick AI — Multi-Platform Catalog Intelligence Engine · V1 Prototype
      </footer>
    </div>
  )
}

export default App
