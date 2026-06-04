import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

const PLATFORM_COLORS = {
  amazon: '#f59e0b',
  flipkart: '#3b82f6',
  myntra: '#ec4899'
}

function formatINR(val) {
  return `₹${Number(val).toLocaleString('en-IN')}`
}

export default function ProductDetail() {
  const { id } = useParams()
  const [livePrice, setLivePrice] = useState(null)
  const [days, setDays] = useState(90)

  const { data: product, isLoading: productLoading } = useQuery({
    queryKey: ['product', id],
    queryFn: () => axios.get(`${API_URL}/api/products/${id}`).then(r => r.data)
  })

  const { data: history, isLoading: historyLoading } = useQuery({
    queryKey: ['price-history', id, days],
    queryFn: () => axios.get(`${API_URL}/api/prices/${id}/history`, { params: { days } }).then(r => r.data),
    enabled: !!product
  })

  // Listen for live price updates via SSE
  useEffect(() => {
    const es = new EventSource(`${API_URL}/api/stream/prices`)
    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data)
        if (data.productId === id) {
          setLivePrice(data)
        }
      } catch {}
    }
    return () => es.close()
  }, [id])

  // Build chart data grouped by date
  const chartData = (() => {
    if (!history?.data) return []
    const byDate = {}
    history.data.forEach(row => {
      const date = new Date(row.recorded_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })
      if (!byDate[date]) byDate[date] = { date }
      byDate[date][row.platform] = parseFloat(row.price)
    })
    return Object.values(byDate).slice(-30) // Last 30 data points
  })()

  const platforms = product?.platforms || []

  if (productLoading) return <div className="animate-pulse h-96 bg-white rounded-xl" />

  if (!product) return <div className="text-center py-12 text-gray-500">Product not found.</div>

  return (
    <div>
      <Link to="/" className="text-sm text-brand-600 hover:underline mb-4 inline-block">← Back to Products</Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Product Info */}
        <div className="lg:col-span-1 bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs font-medium text-brand-600 uppercase tracking-wide mb-1">{product.brand}</p>
          <h1 className="text-xl font-bold text-gray-900 mb-3">{product.title}</h1>

          <div className="text-xs text-gray-500 mb-4">
            {product.category?.l1} › {product.category?.l2} › {product.category?.l3}
          </div>

          {/* Live Price Alert */}
          {livePrice && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4 price-pulse">
              <div className="flex items-center gap-2 text-green-700 text-sm font-medium">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse inline-block"></span>
                Live Price Update!
              </div>
              <p className="text-green-800 text-sm mt-1">
                {livePrice.platform?.toUpperCase()}: {formatINR(livePrice.newPrice)}
              </p>
            </div>
          )}

          {/* Platform Prices */}
          <div className="space-y-3">
            {platforms.map(p => (
              <div key={p.name} className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                <div>
                  <p className="font-medium capitalize text-sm">{p.name}</p>
                  <p className="text-xs text-gray-500">{p.availability?.replace('_', ' ')}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-gray-900">{formatINR(p.price?.current)}</p>
                  {p.price?.discount_pct > 0 && (
                    <p className="text-xs text-green-600">{p.price.discount_pct}% off</p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Attributes */}
          {Object.keys(product.attributes || {}).length > 0 && (
            <div className="mt-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Attributes</h3>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(product.attributes).map(([k, v]) => (
                  <div key={k} className="text-xs">
                    <span className="text-gray-500 capitalize">{k.replace('_', ' ')}: </span>
                    <span className="text-gray-900 font-medium">{String(v)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Price History Chart */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Price History</h2>
            <div className="flex gap-2">
              {[30, 60, 90].map(d => (
                <button
                  key={d}
                  onClick={() => setDays(d)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                    days === d ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {d}d
                </button>
              ))}
            </div>
          </div>

          {historyLoading ? (
            <div className="h-64 bg-gray-50 rounded-lg animate-pulse" />
          ) : chartData.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-gray-400 text-sm">No price history available</div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={v => `₹${(v/1000).toFixed(0)}K`} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(val) => formatINR(val)} />
                <Legend />
                {platforms.map(p => (
                  <Line
                    key={p.name}
                    type="monotone"
                    dataKey={p.name}
                    stroke={PLATFORM_COLORS[p.name] || '#6b7280'}
                    strokeWidth={2}
                    dot={false}
                    name={p.name.charAt(0).toUpperCase() + p.name.slice(1)}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  )
}
