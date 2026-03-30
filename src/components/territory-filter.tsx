'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Territory { id: string; name: string; color: string }

export default function TerritoryFilter({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [territories, setTerritories] = useState<Territory[]>([])
  const supabase = createClient()

  useEffect(() => {
    supabase.from('territories').select('id, name, color').eq('is_active', true).order('sort_order')
      .then(({ data }) => setTerritories(data || []))
  }, [])

  if (territories.length === 0) return null

  const selected = new Set(value.split(',').filter(Boolean))

  function toggle(id: string) {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onChange(Array.from(next).join(','))
  }

  function clearAll() { onChange('') }

  return (
    <div className="flex flex-wrap gap-1.5 items-center">
      {selected.size > 0 && (
        <button onClick={clearAll}
          className="px-2.5 py-1.5 rounded-full text-xs font-medium bg-gray-200 text-gray-600 hover:bg-gray-300 transition-colors">
          Clear
        </button>
      )}
      {territories.map(t => {
        const active = selected.has(t.id)
        return (
          <button key={t.id} onClick={() => toggle(t.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              active ? 'text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
            style={active ? { backgroundColor: t.color } : undefined}>
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: t.color, opacity: active ? 1 : 0.6 }} />
            {t.name}
          </button>
        )
      })}
    </div>
  )
}
