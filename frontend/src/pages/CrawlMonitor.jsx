import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

const PLATFORM_COLORS = {
  amazon: '#f59e0b',
  flipkart: '#3b82f6',
  myntra: '#ec4899'
}

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
  const queryClient = useQueryClient()
  const [actionLoading, setActionLoading] = useState(null)
  const [actionResult, setActionResult] = useState(null)

  const { data: health } = useQuery({
    queryKey: ['health'],
    queryFn: () => axios.get(`${API_URL}/health`).then(r => r.data),
    refetchInterval: 10000
  })

  const { data: crawler } = useQuery({
    queryKey: ['crawler-status'],
    queryFn: () => axios.get(`${API_URL}/api/crawler/status`).then(r => r.data),
    refetchInterval: 5000
  })

  const { data: latestPrices } = useQuery({
    queryKey: ['latest-prices'],
    queryFn: () => axios.get(`${API_URL}/api/prices/latest`).then(r => r.data),
    refetchInterval: 15000
  })

  const runAction = async (action) => {
    setActionLoading(action)
    setActionResult(null)
    try {
      if (action === 'pause') await axios.post(`${API_URL}/api/crawler/pause`)
      if (action === 'resume') await axios.post(`${API_URL}/api/crawler/resume`)
      if (action === 'tick') await axios.post(`${API_URL}/api/crawler/tick`)
      if (action === 'simulate') await axios.post(`${API_URL}/api/crawler/tick`)
      await queryClient.invalidateQueries({ queryKey: ['crawler-status'] })
      setActionResult({ success: true, action })
    } catch (e) {
      setActionResult({ error: e.message })
    } finally {
      setActionLoading(null)
    }
  }

  const metrics = crawler?.metrics
  const jobs = crawler?.jobs || []
  const platforms = crawler?.platforms || []
  const recentEvents = metrics?.recentEvents || []

  const metricCards = [
    {
      label: 'Products Crawled Today',
      value: metrics?.productsCrawledToday?.toLocaleString() ?? '0',
      sub: `Every ${metrics?.crawlIntervalSec ?? '—'}s`
    },
    {
      label: 'Avg Crawl Latency',
      value: metrics?.avgCrawlLatencySec ? `${metrics.avgCrawlLatencySec}s` : '—',
      sub: `${metrics?.batchSize ?? 0} products/tick`
    },
    {
      label: 'Crawler Uptime',
      value: metrics?.uptimeSec ? `${Math.floor(metrics.uptimeSec / 60)}m` : '—',
      sub: crawler?.paused ? 'Paused' : 'Running'
    },
    {
      label: 'Active Jobs',
      value: jobs.filter(j => j.status === 'running').length.toString(),
      sub: `${jobs.length} total`
    },
    {
      label: 'Last Tick',
      value: metrics?.lastTickAt
        ? new Date(metrics.lastTickAt).toLocaleTimeString('en-IN')
        : '—',
      sub: metrics?.lastError ? 'Last error' : 'Live'
    },
    {
      label: 'HTTP Fetches OK',
      value: metrics?.httpStats?.success?.toLocaleString() ?? '0',
      sub: `${metrics?.httpStats?.fallback ?? 0} simulated fallback`
    },
    {
      label: 'HTTP Failed',
      value: metrics?.httpStats?.failed?.toLocaleString() ?? '0',
      sub: metrics?.httpEnabled ? 'Real HTTP on' : 'HTTP disabled'
    }
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Crawl Monitor</h1>
          <p className="text-gray-500 text-sm">
            Live background crawler — updates prices every {metrics?.crawlIntervalSec ?? 15}s and pushes SSE alerts automatically
          </p>
        </div>
        <div className="flex gap-2">
          {crawler?.paused ? (
            <button
              onClick={() => runAction('resume')}
              disabled={!!actionLoading}
              className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
            >
              {actionLoading === 'resume' ? 'Resuming...' : '▶ Resume Crawler'}
            </button>
          ) : (
            <button
              onClick={() => runAction('pause')}
              disabled={!!actionLoading}
              className="px-4 py-2 bg-yellow-500 text-white rounded-lg text-sm font-medium hover:bg-yellow-600 disabled:opacity-50"
            >
              {actionLoading === 'pause' ? 'Pausing...' : '⏸ Pause Crawler'}
            </button>
          )}
          <button
            onClick={() => runAction('tick')}
            disabled={!!actionLoading}
            className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
          >
            {actionLoading === 'tick' ? 'Crawling...' : '⚡ Run Tick Now'}
          </button>
        </div>
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
            <div className="flex justify-between">
              <span>Crawler</span>
              <span className={
                health?.services?.crawler === 'healthy' ? 'text-green-600'
                  : health?.services?.crawler === 'paused' ? 'text-yellow-600'
                  : 'text-gray-600'
              }>
                {health?.services?.crawler || '...'}
              </span>
            </div>
          </div>
        </div>

        {platforms.map(p => (
          <div key={p.name} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-sm capitalize">{p.name}</span>
              <StatusBadge status={p.status} />
            </div>
            <div className="space-y-2">
              <div>
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Success Rate</span>
                  <span className="font-medium text-gray-800">{p.successRate}%</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-1.5">
                  <div
                    className="h-1.5 rounded-full"
                    style={{ width: `${p.successRate}%`, backgroundColor: PLATFORM_COLORS[p.name] }}
                  />
                </div>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Avg Latency</span>
                <span className="font-medium">{p.avgLatency}s</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Total Crawls</span>
                <span className="font-medium">{p.crawlsTotal}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {metricCards.map(m => (
          <div key={m.label} className="bg-white rounded-xl border border-gray-200 p-3">
            <p className="text-xs text-gray-500 leading-tight mb-1">{m.label}</p>
            <p className="text-lg font-bold text-gray-900">{m.value}</p>
            <p className="text-xs font-medium text-green-600">{m.sub}</p>
          </div>
        ))}
      </div>

      {/* Active Crawl Jobs */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">Active Crawl Jobs</h2>
          <span className="text-xs text-gray-500">{jobs.filter(j => j.status === 'running').length} running</span>
        </div>
        <div className="divide-y">
          {jobs.length === 0 ? (
            <div className="p-6 text-center text-sm text-gray-400">Loading crawler jobs...</div>
          ) : jobs.map(job => (
            <div key={job.id} className="flex items-center justify-between p-4 hover:bg-gray-50">
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${
                  job.status === 'running' ? 'bg-green-500 animate-pulse'
                    : job.status === 'paused' ? 'bg-yellow-500'
                    : 'bg-gray-300'
                }`} />
                <div>
                  <p className="text-sm font-medium capitalize">{job.platform} — {job.category}</p>
                  <p className="text-xs text-gray-500">Started {job.started}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-700">{job.productsCrawled.toLocaleString()} crawled</span>
                <StatusBadge status={job.status} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent crawl events */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-800 mb-1">Recent Crawl Events (Live SSE)</h2>
        <p className="text-xs text-gray-500 mb-4">
          The crawler runs automatically in the background. Each price update is written to PostgreSQL and pushed via Server-Sent Events — watch the green banner at the top of the page.
        </p>

        {metrics?.lastError && (
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
            Last crawl error: {metrics.lastError}
          </div>
        )}

        {recentEvents.length === 0 ? (
          <div className="text-sm text-gray-400 py-4 text-center">
            Waiting for first crawl tick (starts ~3s after backend boot)...
          </div>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {recentEvents.map((ev, i) => (
              <div key={`${ev.productId}-${ev.timestamp}-${i}`} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg text-sm">
                <div>
                  <span className="font-medium capitalize text-brand-700">{ev.platform}</span>
                  <span className="text-gray-600 ml-2">{ev.title?.slice(0, 45)}...</span>
                </div>
                <div className="text-right flex-shrink-0 ml-4">
                  <p className="font-bold text-gray-900">₹{Number(ev.newPrice).toLocaleString('en-IN')}</p>
                  <p className="text-xs text-gray-400">{ev.latencyMs}ms · {ev.source}/{ev.fetchMethod} · {new Date(ev.timestamp).toLocaleTimeString('en-IN')}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {actionResult?.success && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
            Crawler action completed: {actionResult.action}
          </div>
        )}
        {actionResult?.error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {actionResult.error}
          </div>
        )}
      </div>
    </div>
  )
}
