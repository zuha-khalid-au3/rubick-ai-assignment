import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

function formatINR(val) {
  return val ? `₹${Number(val).toLocaleString('en-IN')}` : 'N/A'
}

export default function ComparisonBoard() {
  const [searchInput, setSearchInput] = useState('')
  const [selectedIds, setSelectedIds] = useState([])
  const [dedupInput, setDedupInput] = useState({ title1: 'Nike Air Max Black 42', title2: 'Nike Airmax Shoes Size 8 Black', brand: 'Nike' })
  const [dedupResult, setDedupResult] = useState(null)
  const [dedupLoading, setDedupLoading] = useState(false)

  // Search products to add to comparison
  const { data: searchResults } = useQuery({
    queryKey: ['search', searchInput],
    queryFn: () => axios.get(`${API_URL}/api/products`, { params: { q: searchInput, limit: 5 } }).then(r => r.data),
    enabled: searchInput.length > 2
  })

  // Fetch comparison data
  const { data: compareData, isLoading } = useQuery({
    queryKey: ['compare', selectedIds],
    queryFn: () => axios.get(`${API_URL}/api/products/compare`, { params: { ids: selectedIds.join(',') } }).then(r => r.data),
    enabled: selectedIds.length >= 2
  })

  const addProduct = (id) => {
    if (!selectedIds.includes(id) && selectedIds.length < 5) {
      setSelectedIds(prev => [...prev, id])
    }
  }

  const removeProduct = (id) => setSelectedIds(prev => prev.filter(i => i !== id))

  const runDedup = async () => {
    setDedupLoading(true)
    try {
      const res = await axios.post(`${API_URL}/api/dedup/check`, dedupInput)
      setDedupResult(res.data)
    } catch (e) {
      setDedupResult({ error: 'ML service unavailable' })
    } finally {
      setDedupLoading(false)
    }
  }

  const products = compareData?.data || []

  // Find best price per platform
  const getBestPrice = (platform) => {
    const prices = products.map(p => {
      const plat = (p.platforms || []).find(pl => pl.name === platform)
      return plat?.price?.current ? parseFloat(plat.price.current) : null
    }).filter(Boolean)
    return prices.length ? Math.min(...prices) : null
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Comparison Board</h1>
        <p className="text-gray-500 text-sm">Compare up to 5 products side by side across platforms</p>
      </div>

      {/* Product Search */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-800 mb-3">Add Products to Compare</h2>
        <input
          type="text"
          placeholder="Search for a product to add..."
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 mb-3"
        />
        {searchResults?.data?.length > 0 && (
          <div className="space-y-2">
            {searchResults.data.map(p => (
              <div key={p.product_id} className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50">
                <div>
                  <p className="text-sm font-medium">{p.title}</p>
                  <p className="text-xs text-gray-500">{p.brand} · {p.category?.l1}</p>
                </div>
                <button
                  onClick={() => addProduct(p.product_id)}
                  disabled={selectedIds.includes(p.product_id) || selectedIds.length >= 5}
                  className="text-xs px-3 py-1 bg-brand-600 text-white rounded-lg disabled:opacity-40 hover:bg-brand-700 transition-colors"
                >
                  {selectedIds.includes(p.product_id) ? 'Added' : '+ Add'}
                </button>
              </div>
            ))}
          </div>
        )}
        {selectedIds.length > 0 && (
          <div className="flex gap-2 mt-3 flex-wrap">
            {selectedIds.map(id => (
              <span key={id} className="flex items-center gap-1 bg-brand-100 text-brand-700 text-xs px-2 py-1 rounded-full">
                {id.slice(0, 8)}...
                <button onClick={() => removeProduct(id)} className="hover:text-red-500">×</button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Comparison Table */}
      {selectedIds.length >= 2 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="p-4 border-b bg-gray-50">
            <h2 className="font-semibold text-gray-800">Price Comparison</h2>
          </div>
          {isLoading ? (
            <div className="p-8 text-center text-gray-400 animate-pulse">Loading comparison...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="text-left p-3 font-medium text-gray-600">Product</th>
                    {['amazon', 'flipkart', 'myntra'].map(pl => (
                      <th key={pl} className="text-center p-3 font-medium text-gray-600 capitalize">{pl}</th>
                    ))}
                    <th className="text-center p-3 font-medium text-gray-600">Best Price</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map(p => {
                    const prices = ['amazon', 'flipkart', 'myntra'].map(pl => {
                      const plat = (p.platforms || []).find(x => x.name === pl)
                      return plat?.price?.current ? parseFloat(plat.price.current) : null
                    })
                    const validPrices = prices.filter(Boolean)
                    const minPrice = validPrices.length ? Math.min(...validPrices) : null

                    return (
                      <tr key={p.product_id} className="border-b hover:bg-gray-50">
                        <td className="p-3">
                          <p className="font-medium text-gray-900 text-xs leading-tight">{p.title}</p>
                          <p className="text-xs text-gray-500">{p.brand}</p>
                        </td>
                        {prices.map((price, i) => (
                          <td key={i} className={`p-3 text-center font-medium ${
                            price === minPrice ? 'text-green-600 bg-green-50' : 'text-gray-700'
                          }`}>
                            {price ? formatINR(price) : <span className="text-gray-300">—</span>}
                            {price === minPrice && price && (
                              <span className="block text-xs text-green-500">Best ✓</span>
                            )}
                          </td>
                        ))}
                        <td className="p-3 text-center font-bold text-green-700">
                          {minPrice ? formatINR(minPrice) : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {selectedIds.length < 2 && (
        <div className="text-center py-8 text-gray-400 text-sm bg-white rounded-xl border border-dashed border-gray-300">
          Search and add at least 2 products to compare
        </div>
      )}

      {/* Dedup Demo */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-800 mb-1">Deduplication Demo</h2>
        <p className="text-xs text-gray-500 mb-4">Test the 6-stage dedup pipeline — can it match the same product across platforms?</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
          <div>
            <label className="text-xs text-gray-600 mb-1 block">Title 1 (Amazon)</label>
            <input
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              value={dedupInput.title1}
              onChange={e => setDedupInput(p => ({ ...p, title1: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-xs text-gray-600 mb-1 block">Title 2 (Flipkart)</label>
            <input
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              value={dedupInput.title2}
              onChange={e => setDedupInput(p => ({ ...p, title2: e.target.value }))}
            />
          </div>
        </div>
        <input
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 mb-3 w-full md:w-48"
          placeholder="Brand (optional)"
          value={dedupInput.brand}
          onChange={e => setDedupInput(p => ({ ...p, brand: e.target.value }))}
        />
        <button
          onClick={runDedup}
          disabled={dedupLoading}
          className="px-5 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50 transition-colors"
        >
          {dedupLoading ? 'Checking...' : 'Run Dedup Check'}
        </button>

        {dedupResult && !dedupResult.error && (
          <div className={`mt-4 p-4 rounded-lg border ${dedupResult.is_match ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
            <div className="flex items-center gap-2 mb-2">
              <span className={`text-lg font-bold ${dedupResult.is_match ? 'text-green-700' : 'text-red-700'}`}>
                {dedupResult.is_match ? '✓ MATCH' : '✗ NO MATCH'}
              </span>
              <span className="text-sm text-gray-600">Confidence: <strong>{(dedupResult.confidence * 100).toFixed(1)}%</strong></span>
              <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">Method: {dedupResult.method}</span>
              <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">Stage: {dedupResult.stage_reached}/6</span>
            </div>
            {dedupResult.details && (
              <pre className="text-xs text-gray-600 bg-white rounded p-2 overflow-x-auto">
                {JSON.stringify(dedupResult.details, null, 2)}
              </pre>
            )}
          </div>
        )}
        {dedupResult?.error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {dedupResult.error}
          </div>
        )}
      </div>
    </div>
  )
}
