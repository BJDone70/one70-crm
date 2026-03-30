'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Search } from 'lucide-react'
import { useState, useCallback } from 'react'
import PillFilter from '@/components/pill-filter'
import TerritoryFilter from '@/components/territory-filter'
import { useVerticals } from '@/hooks/use-verticals'

export default function PropertyFilters({ currentSearch, currentVertical, currentTerritory }: { currentSearch?: string; currentVertical?: string; currentTerritory?: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [searchValue, setSearchValue] = useState(currentSearch || '')
  const { verticals: loadedVerticals } = useVerticals()
  const verticals = [{ id: 'all', label: 'All' }, ...loadedVerticals]

  const updateParams = useCallback((key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value && value !== 'all') { params.set(key, value) } else { params.delete(key) }
    router.push(`/properties?${params.toString()}`)
  }, [router, searchParams])

  return (
    <div className="space-y-3 mb-4">
      <form onSubmit={e => { e.preventDefault(); updateParams('q', searchValue) }}>
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-one70-mid" />
          <input type="text" value={searchValue} onChange={e => setSearchValue(e.target.value)} placeholder="Search properties..."
            className="w-full pl-9 pr-3 py-2 border border-one70-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-one70-yellow focus:border-transparent" />
        </div>
      </form>
      <div>
        <p className="text-[10px] font-semibold text-one70-mid uppercase tracking-wider mb-1">Vertical</p>
        <PillFilter options={verticals} value={currentVertical || 'all'} onChange={v => updateParams('vertical', v)} allowDeselect={false} />
      </div>
      <div>
        <p className="text-[10px] font-semibold text-one70-mid uppercase tracking-wider mb-1">Territory</p>
        <TerritoryFilter value={currentTerritory || ''} onChange={v => updateParams('territory', v)} />
      </div>
    </div>
  )
}
