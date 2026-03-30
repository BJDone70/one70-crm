'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Search } from 'lucide-react'
import { useState, useCallback } from 'react'
import PillFilter from '@/components/pill-filter'
import TerritoryFilter from '@/components/territory-filter'
import MobileFilterSheet from '@/components/mobile-filter-sheet'
import { useVerticals } from '@/hooks/use-verticals'
import { useOrgRoles } from '@/hooks/use-org-roles'

const priorities = [
  { id: 'all', label: 'All' },
  { id: 'high', label: 'High' },
  { id: 'medium_high', label: 'Med-High' },
  { id: 'medium', label: 'Medium' },
  { id: 'low', label: 'Low' },
]

export default function OrgFilters({ currentVertical, currentPriority, currentSearch, currentTerritory, currentRole }: {
  currentVertical?: string; currentPriority?: string; currentSearch?: string; currentTerritory?: string; currentRole?: string
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [searchValue, setSearchValue] = useState(currentSearch || '')
  const { verticals: loadedVerticals } = useVerticals()
  const { roles: orgRoles } = useOrgRoles()
  const verticals = [{ id: 'all', label: 'All' }, ...loadedVerticals]
  const roleOptions = [{ id: 'all', label: 'All' }, ...orgRoles.map(r => ({ id: r.name, label: r.label }))]

  const updateParams = useCallback((key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value && value !== 'all') { params.set(key, value) } else { params.delete(key) }
    router.push(`/organizations?${params.toString()}`)
  }, [router, searchParams])

  const updateMultiParams = useCallback((key: string, values: string[]) => {
    const params = new URLSearchParams(searchParams.toString())
    const clean = values.filter(v => v !== 'all')
    if (clean.length > 0) { params.set(key, clean.join(',')) } else { params.delete(key) }
    router.push(`/organizations?${params.toString()}`)
  }, [router, searchParams])

  const currentVerticals = currentVertical ? currentVertical.split(',') : ['all']
  const currentRoles = currentRole ? currentRole.split(',') : ['all']

  const activeFilterCount = [
    currentVertical && currentVertical !== 'all' ? 1 : 0,
    currentPriority && currentPriority !== 'all' ? 1 : 0,
    currentRole && currentRole !== 'all' ? 1 : 0,
    currentTerritory ? 1 : 0,
  ].reduce((a, b) => a + b, 0)

  function clearAll() {
    router.push('/organizations' + (currentSearch ? `?q=${currentSearch}` : ''))
  }

  const filterContent = (
    <div className="space-y-4">
      <div>
        <p className="text-[10px] font-semibold text-one70-mid uppercase tracking-wider mb-1.5">Vertical</p>
        <PillFilter options={verticals} value={currentVerticals} onChange={v => updateMultiParams('vertical', v)} allowDeselect={false} multi />
      </div>
      <div>
        <p className="text-[10px] font-semibold text-one70-mid uppercase tracking-wider mb-1.5">Priority</p>
        <PillFilter options={priorities} value={currentPriority || 'all'} onChange={v => updateParams('priority', v)} allowDeselect={false} />
      </div>
      <div>
        <p className="text-[10px] font-semibold text-one70-mid uppercase tracking-wider mb-1.5">Role</p>
        <PillFilter options={roleOptions} value={currentRoles} onChange={v => updateMultiParams('role', v)} allowDeselect={false} multi />
      </div>
      <div>
        <p className="text-[10px] font-semibold text-one70-mid uppercase tracking-wider mb-1.5">Territory</p>
        <TerritoryFilter value={currentTerritory || ''} onChange={v => updateParams('territory', v)} />
      </div>
    </div>
  )

  return (
    <div className="space-y-3 mb-4">
      <form onSubmit={e => { e.preventDefault(); updateParams('q', searchValue) }}>
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-one70-mid" />
          <input type="text" value={searchValue} onChange={e => setSearchValue(e.target.value)} placeholder="Search organizations..."
            className="w-full pl-9 pr-3 py-2.5 border border-one70-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-one70-yellow focus:border-transparent" />
        </div>
      </form>
      <MobileFilterSheet activeCount={activeFilterCount} onClear={clearAll}>
        {filterContent}
      </MobileFilterSheet>
    </div>
  )
}
