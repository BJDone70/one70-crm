'use client'

import { useState } from 'react'
import { Sparkles, RefreshCw, Target } from 'lucide-react'

export default function DealCoach({ dealId }: { dealId: string }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [coaching, setCoaching] = useState('')
  const [error, setError] = useState('')

  async function generate() {
    setLoading(true)
    setError('')

    const res = await fetch('/api/ai/deal-coach', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dealId }),
    })

    const data = await res.json()
    if (!res.ok) { setError(data.error || 'Failed to generate'); setLoading(false); return }
    setCoaching(data.coaching)
    setLoading(false)
  }

  if (!open) {
    return (
      <button onClick={() => { setOpen(true); generate() }}
        className="flex items-center gap-1.5 text-sm font-medium text-one70-black hover:underline">
        <Target size={14} /> Deal Coach
      </button>
    )
  }

  return (
    <div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-lg border border-orange-200 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-one70-dark uppercase tracking-wider flex items-center gap-1">
          <Target size={12} /> AI Deal Coach
        </span>
        <button onClick={() => { setOpen(false); setCoaching('') }} className="text-xs text-gray-400 hover:text-gray-600">Close</button>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-gray-500 py-4">
          <Sparkles size={16} className="animate-pulse text-orange-500" />
          Analyzing deal...
        </div>
      )}

      {error && <div className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded">{error}</div>}

      {coaching && (
        <div>
          <pre className="bg-white rounded-md p-3 text-sm text-gray-800 whitespace-pre-wrap border border-gray-200 max-h-96 overflow-y-auto font-sans">{coaching}</pre>
          <button onClick={generate} disabled={loading}
            className="flex items-center gap-1 px-3 py-1.5 border border-gray-300 rounded-md text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors mt-2">
            <RefreshCw size={12} /> Refresh Analysis
          </button>
        </div>
      )}
    </div>
  )
}
