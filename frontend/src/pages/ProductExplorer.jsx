import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

const CATEGORIES = ['All', 'Footwear', 'Electronics', 'Clothing', 'Beauty']
const PLATFORMS = ['All', 'amazon', 'flipkart', 'myntra']

function ProductCard({ product }) {
  const platforms = product.platforms || []
  const firstPlatform = platforms[0] || {}
  const price = firstPlatform?.price?.current

  return (
    <Link to={`/products/${product.product_id}`} className="block">
      <div className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md hover:border-brand-300 transition-all">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div>
            <p className="text-xs font-medium text-brand-600 uppercase tracking-wide">{product.brand}</p>
            <h3 className="font-semibold text-gray-900 text-sm leading-tight mt-0.5 line-clamp-2">{product.title}</h3>
          </div>
          <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${
            product.enrichment_status === 'complete'
              ? 'bg-green-100 text-green-700'
              : 'bg-yellow-100 text-yellow-700'
          }`}>
            {product.enrichment_status}
          </span>
        </div>

        <div className="flex items-center gap-2 mt-3">
          <span className="text-lg font-bold text-gray-900">
            {price ? `₹${Number(price).toLocaleString('en-IN')}` : 'N/A'}
          </span>
          {firstPlatform?.price?.discount_pct > 0 && (
            <span className="text-xs text-green-600 font-medium">{firstPlatform.price.discount_pct}% off</span>
          )}
        </div>

        <div className="flex gap-1 mt-2 flex-wrap">
          {platforms.map(p => (
            <span key={p.name} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded capitalize">{p.name}</span>
          ))}
        </div>

        <div className="mt-2 text-xs text-gray-500">
          {product.category?.l1} › {product.category?.l2}
        </div>
      </div>
    </Link>
  )
}

export default function ProductExplorer() {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [cursor, setCursor] = useState(null)
  const [history, setHistory] = useState([null])

  const params = {
    limit: 12,
    ...(search && { q: search }),
    ...(category !== 'All' && { category }),
    ...(cursor && { cursor })
  }

  const { data, isLoading, isError } = useQuery({
    queryKey: ['products', params],
    queryFn: () => axios.get(`${API_URL}/api/products`, { params }).then(r => r.data),
    keepPreviousData: true
  })

  const handleSearch = (e) => {
    setSearch(e.target.value)
    setCursor(null)
    setHistory([null])
  }

  const handleNext = () => {
    if (data?.pagination?.nextCursor) {
      setHistory(h => [...h, data.pagination.nextCursor])
      setCursor(data.pagination.nextCursor)
    }
  }

  const handlePrev = () => {
    const newHistory = history.slice(0, -1)
    setHistory(newHistory)
    setCursor(newHistory[newHistory.length - 1])
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Product Explorer</h1>
        <p className="text-gray-500 text-sm">Browse and search across Amazon, Flipkart & Myntra</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <input
          type="text"
          placeholder="Search products, brands..."
          value={search}
          onChange={handleSearch}
          className="flex-1 min-w-[200px] border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        <div className="flex gap-2 flex-wrap">
          {CATEGORIES.map(c => (
            <button
              key={c}
              onClick={() => { setCategory(c); setCursor(null); setHistory([null]) }}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                category === c
                  ? 'bg-brand-600 text-white'
                  : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse h-40" />
          ))}
        </div>
      )}

      {isError && (
        <div className="text-center py-12 text-red-500">
          Failed to load products. Make sure the backend is running.
        </div>
      )}

      {data && (
        <>
          <div className="text-xs text-gray-500 mb-3">
            Showing {data.data?.length || 0} products
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {data.data?.map(product => (
              <ProductCard key={product.product_id} product={product} />
            ))}
          </div>

          {/* Pagination */}
          <div className="flex justify-between items-center mt-6">
            <button
              onClick={handlePrev}
              disabled={history.length <= 1}
              className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium disabled:opacity-40 hover:bg-gray-50 transition-colors"
            >
              ← Previous
            </button>
            <span className="text-sm text-gray-500">Page {history.length}</span>
            <button
              onClick={handleNext}
              disabled={!data?.pagination?.hasMore}
              className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium disabled:opacity-40 hover:bg-gray-50 transition-colors"
            >
              Next →
            </button>
          </div>
        </>
      )}
    </div>
  )
}
