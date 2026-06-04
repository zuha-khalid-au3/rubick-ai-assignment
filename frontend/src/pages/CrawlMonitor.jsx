import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

const PLATFORMS = [
  { name: 'amazon', color: '#f59e0b', successRate: 97, avgLatency: 1.2 },
  { name: 'flipkart', color: '#3b82f6', successRate: 94, avgLatency: 1.8 },
  { name: 'myntra', color: '#ec4899', successRate: 98, avgLatency: 0.9 }
]

const METRICS = [
  { label: 'Products Crawled Today', value: '482,340', trend: '+12%', positive: true },
  { label: 'Avg Crawl Latency', value: '1.3s', trend: '-8%', positive: true },
  { label: 'Cache Hit Rate', value: '87%', trend: '+3%', positive: true },
  { label: 'Enrichment Queue', value: '1,240', trend: '-15%', positive: true },
  { label: 'Dedup Precision', value: '96.2%', trend: '+0.4%', positive: true },
  { label: 'LLM Token Spend', value: '$42/day', trend: '-60%', positive: true }
]

function StatusBadge({ status }) {
  const colors = {
    running: 'bg-green-100 text-green-700',
    blocked: 'bg-red-100 text-red-700',
    paused: 'bg-yellow-100 text-yellow-700',
    idle: 'bg-gray-100 text-gray-600'
  }
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colors[status] || colors.idle}`}>
      {status}
    </span>
  )
}

export default function CrawlMonitor() {
  const [simulateLoading, setSimulateLoading] = useState(false)
  const [simulateResult, setSimulateResult] = useState(null)
  const [crawlJobs, setCrawlJobs] = useState([
    { id: 'job_001', platform: 'amazon', category: 'Electronics', status: 'running', products: 12450, started: '2 min ago' },
    { id: 'job_002', platform: 'flipkart', category: 'Footwear', status: 'running', products: 8920, started: '5 min ago' },
    { id: 'job_003', platform: 'myntra', category: 'Clothing', status: 'running', products: 15300, started: '1 min ago' },
    { id: 'job_004', platform: 'amazon', category: 'Beauty', status: 'idle', products: 0, started: 'Scheduled' },
    { id: 'job_005', platform: 'flipkart', category: 'Electronics', status: 'paused', products: 3200, started: '12 min ago' }
  ])

  const { data: health } = useQuery({
    queryKey: ['health'],
    queryFn: () => axios.get(`${API_URL}/health`).then(r => r.data),
    refetchInterval: 10000
  })

  const { data: latestPrices } = useQuery({
    queryKey: ['latest-prices'],
    queryFn: () => axios.get(`${API_URL}/api/prices/latest`).then(r => r.data),
    refetchInterval: 15000
  })

  // Simulate a price change for SSE demo
  const simulatePriceChange = async () => {
    setSimulateLoading(true)
    try {
      const productRes = await axios.get(`${API_URL}/api/products`, { params: { limit: 1 } })
      const product = productRes.data?.data?.[0]
      if (!product) throw new Error('No products found')

      const platform = product.platforms?.[0]?.name || 'amazon'
      const currentPrice = parseFloat(product.platforms?.[0]?.price?.current || 1000)
      const newPrice = (currentPrice * (0.85 + Math.random() * 0.3)).toFixed(2)

      const res = await axios.post(`${API_URL}/api/prices/simulate`, {
        productId: product.product_id,
        platform,
        newPrice: parseFloat(newPrice)
      })
      setSimulateResult({ product: product.title, platform, newPrice, success: true })
    } catch (e) {
      setSimulateResult({ error: e.message })
    } finally {
      setSimulateLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Crawl Monitor</h1>
        <p className="text-gray-500 text-sm">Real-time system health, crawl status, and observability metrics</p>
      </div>

      {/* System Health */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className={`bg-white rounded-xl border p-4 ${health?.status === 'ok' ? 'border-green-200' : 'border-red-200'}`}>
          <div className="flex items-center gap-2 mb-2">
            <span className={`w-3 h-3 rounded-full ${health?.status === 'ok' ? 'bg-green-500' : 'bg-red-500'} animate-pulse`}></span>
            <span className="font-semibold text-sm">System Status</span>
          </div>
          <p className={`text-lg font-bold ${health?.status === 'ok' ? 'text-green-700' : 'text-red-700'}`}>
            {health?.status?.toUpperCase() || 'CHECKING...'}
          </p>
          <div className="mt-2 space-y-1 text-xs text-gray-600">
            <div className="flex justify-between">
              <span>PostgreSQL</span>
              <span className={health?.services?.postgres === 'healthy' ? 'text-green-600' : 'text-red-600'}>
                {health?.services?.postgres || '...'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Redis</span>
              <span className={health?.services?.redis === 'healthy' ? 'text-green-600' : 'text-red-600'}>
                {health?.services?.redis || '...'}
              </span>
            </div>
          </div>
        </div>

        {/* Platform Status */}
        {PLATFORMS.map(p => (
          <div key={p.name} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-sm capitalize">{p.name}</span>
              <StatusBadge status="running" />
            </div>
            <div className="space-y-2">
              <div>
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Success Rate</span>
                  <span className="font-medium text-gray-800">{p.successRate}%</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-1.5">
                  <div className="h-1.5 rounded-full" style={{ width: `${p.successRate}%`, backgroundColor: p.color }} />
                </div>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Avg Latency</span>
                <span className="font-medium">{p.avgLatency}s</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {METRICS.map(m => (
          <div key={m.label} className="bg-white rounded-xl border border-gray-200 p-3">
            <p className="text-xs text-gray-500 leading-tight mb-1">{m.label}</p>
            <p className="text-lg font-bold text-gray-900">{m.value}</p>
            <p className={`text-xs font-medium ${m.positive ? 'text-green-600' : 'text-red-600'}`}>{m.trend}</p>
          </div>
        ))}
      </div>

      {/* Active Crawl Jobs */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">Active Crawl Jobs</h2>
          <span className="text-xs text-gray-500">{crawlJobs.filter(j => j.status === 'running').length} running</span>
        </div>
        <div className="divide-y">
          {crawlJobs.map(job => (
            <div key={job.id} className="flex items-center justify-between p-4 hover:bg-gray-50">
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${job.status === 'running' ? 'bg-green-500 animate-pulse' : job.status === 'paused' ? 'bg-yellow-500' : 'bg-gray-300'}`} />
                <div>
                  <p className="text-sm font-medium capitalize">{job.platform} — {job.category}</p>
                  <p className="text-xs text-gray-500">Started {job.started}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-700">{job.products.toLocaleString()} products</span>
                <StatusBadge status={job.status} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* SSE Demo */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-800 mb-1">Live Price Update Demo (SSE)</h2>
        <p className="text-xs text-gray-500 mb-4">
          Click the button to simulate a price change. The green banner at the top of the page will update instantly via Server-Sent Events — no polling required.
        </p>
        <button
          onClick={simulatePriceChange}
          disabled={simulateLoading}
          className="px-5 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
        >
          {simulateLoading ? '⏳ Simulating...' : '⚡ Simulate Price Change'}
        </button>

        {simulateResult && !simulateResult.error && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
            ✓ Price change published! <strong>{simulateResult.platform?.toUpperCase()}</strong> — {simulateResult.product?.slice(0, 40)}...
            → New price: <strong>₹{Number(simulateResult.newPrice).toLocaleString('en-IN')}</strong>
            <p className="text-xs mt-1 text-green-600">Check the green banner at the top of the page for the live SSE update.</p>
          </div>
        )}
        {simulateResult?.error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {simulateResult.error}
          </div>
        )}
      </div>
    </div>
  )
}
