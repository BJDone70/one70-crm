'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles, ChevronRight, RefreshCw } from 'lucide-react'

interface BriefingItem {
  text: string
  link: string
  priority: 'high' | 'medium' | 'low'
  icon: string
}

export default function DashboardBriefing() {
  const [items, setItems] = useState<BriefingItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const router = useRouter()

  async function loadBriefing(force?: boolean) {
    // Check cache (30 min TTL)
    if (!force) {
      const cached = sessionStorage.getItem('one70_briefing')
      const cachedAt = sessionStorage.getItem('one70_briefing_at')
      if (cached && cachedAt) {
        const age = Date.now() - parseInt(cachedAt)
        if (age < 30 * 60 * 1000) {
          try {
            const parsedItems = JSON.parse(cached) as BriefingItem[]
            setItems(parsedItems)
            setLoading(false)
            return
          } catch {}
        }
      }
    }

    try {
      const res = await fetch('/api/briefing')
      if (res.ok) {
        const data = await res.json()
        setItems(data.items || [])
        sessionStorage.setItem('one70_briefing', JSON.stringify(data.items || []))
        sessionStorage.setItem('one70_briefing_at', Date.now().toString())
      }
    } catch {}
    setLoading(false)
    setRefreshing(false)
  }

  useEffect(() => { loadBriefing() }, [])

  function handleRefresh() {
    setRefreshing(true)
    loadBriefing(true)
  }

  const priorityStyles: Record<string, string> = {
    high: 'border-l-red-500 bg-red-50/50',
    medium: 'border-l-amber-400 bg-amber-50/30',
    low: 'border-l-gray-300 bg-white',
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-one70-border p-5 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles size={16} className="text-one70-yellow" />
          <span className="text-sm font-bold text-one70-black">Today's Briefing</span>
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-10 bg-one70-gray rounded-md animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (items.length === 0) return null

  return (
    <div className="bg-white rounded-lg border border-one70-border p-5 mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-one70-yellow" />
          <span className="text-sm font-bold text-one70-black">Today's Briefing</span>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="p-1.5 rounded-md hover:bg-one70-gray text-one70-mid transition-colors disabled:opacity-50"
          title="Refresh briefing"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="space-y-1.5">
        {items.map((item, i) => (
          <button
            key={i}
            onClick={() => router.push(item.link)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md border-l-[3px] text-left hover:shadow-sm transition-all ${priorityStyles[item.priority] || priorityStyles.low}`}
          >
            <span className="text-base shrink-0">{item.icon}</span>
            <span className="text-sm text-one70-dark flex-1">{item.text}</span>
            <ChevronRight size={14} className="text-gray-300 shrink-0" />
          </button>
        ))}
      </div>
    </div>
  )
}
