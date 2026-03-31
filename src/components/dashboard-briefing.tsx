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

// Returns the most recent update window boundary (7am, 12pm, 4pm)
function getCurrentWindow(): number {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const windows = [7, 12, 16] // 7am, 12pm, 4pm
  let latestWindow = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1, 16).getTime() // yesterday 4pm
  for (const hour of windows) {
    const windowTime = new Date(today.getFullYear(), today.getMonth(), today.getDate(), hour).getTime()
    if (now.getTime() >= windowTime) latestWindow = windowTime
  }
  return latestWindow
}

export default function DashboardBriefing() {
  const [items, setItems] = useState<BriefingItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)
  const router = useRouter()

  async function loadBriefing(force?: boolean) {
    const currentWindow = getCurrentWindow()

    if (!force) {
      try {
        const cached = localStorage.getItem('one70_briefing')
        const cachedWindow = localStorage.getItem('one70_briefing_window')
        const cachedTime = localStorage.getItem('one70_briefing_updated')
        if (cached && cachedWindow && parseInt(cachedWindow) === currentWindow) {
          const parsedItems = JSON.parse(cached) as BriefingItem[]
          setItems(parsedItems)
          if (cachedTime) setLastUpdated(cachedTime)
          setLoading(false)
          return
        }
      } catch {}
    }

    try {
      const res = await fetch('/api/briefing')
      if (res.ok) {
        const data = await res.json()
        const now = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
        setItems(data.items || [])
        setLastUpdated(now)
        localStorage.setItem('one70_briefing', JSON.stringify(data.items || []))
        localStorage.setItem('one70_briefing_window', currentWindow.toString())
        localStorage.setItem('one70_briefing_updated', now)
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
          <span className="text-[10px] text-gray-400 ml-1">{lastUpdated ? `Updated ${lastUpdated}` : 'Updated 3x daily'}</span>
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
