'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'
import PillFilter from '@/components/pill-filter'
import TerritoryFilter from '@/components/territory-filter'
import MobileFilterSheet from '@/components/mobile-filter-sheet'
import { useVerticals } from '@/hooks/use-verticals'

interface PipelineFiltersProps {
  currentVertical?: string
  currentRep?: string
  currentTerritory?: string
  reps: { id: string; full_name: string }[]
}

export default function PipelineFilters({ currentVertical, currentRep, currentTerritory, reps }: PipelineFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { verticals: loadedVerticals } = useVerticals()
  const verticals = [{ id: 'all', label: 'All' }, ...loadedVerticals]

  const updateParams = useCallback((key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value && value !== 'all') { params.set(key, value) } else { params.delete(key) }
    router.push(`/deals?${params.toString()}`)
  }, [router, searchParams])

  const updateMultiParams = useCallback((key: string, values: string[]) => {
    const params = new URLSearchParams(searchParams.toString())
    const clean = values.filter(v => v !== 'all')
    if (clean.length > 0) { params.set(key, clean.join(',')) } else { params.delete(key) }
    router.push(`/deals?${params.toString()}`)
  }, [router, searchParams])

  const currentVerticals = currentVertical ? currentVertical.split(',') : ['all']
  const activeCount = [
    currentVertical && currentVertical !== 'all' ? 1 : 0,
    currentRep && currentRep !== 'all' ? 1 : 0,
    currentTerritory ? 1 : 0,
  ].reduce((a, b) => a + b, 0)

  function clearAll() { router.push('/deals') }

  const filterContent = (
    <div className="space-y-4">
      <div>
        <p className="text-[10px] font-semibold text-one70-mid uppercase tracking-wider mb-1.5">Vertical</p>
        <PillFilter options={verticals} value={currentVerticals} onChange={v => updateMultiParams('vertical', v)} allowDeselect={false} multi />
      </div>
      {reps.length > 1 && (
        <div>
          <p className="text-[10px] font-semibold text-one70-mid uppercase tracking-wider mb-1.5">Rep</p>
          <div className="flex flex-wrap gap-1.5">
            <button onClick={() => updateParams('rep', 'all')}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                !currentRep || currentRep === 'all' ? 'bg-one70-black text-white border-one70-black' : 'bg-white text-one70-dark border-one70-border'
              }`}>All</button>
            {reps.map(r => (
              <button key={r.id} onClick={() => updateParams('rep', r.id)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                  currentRep === r.id ? 'bg-one70-black text-white border-one70-black' : 'bg-white text-one70-dark border-one70-border'
                }`}>{r.full_name.split(' ')[0]}</button>
            ))}
          </div>
        </div>
      )}
      <div>
        <p className="text-[10px] font-semibold text-one70-mid uppercase tracking-wider mb-1.5">Territory</p>
        <TerritoryFilter value={currentTerritory || ''} onChange={v => updateParams('territory', v)} />
      </div>
    </div>
  )

  return (
    <div className="mb-4">
      <MobileFilterSheet activeCount={activeCount} onClear={clearAll}>
        {filterContent}
      </MobileFilterSheet>
    </div>
  )
}
