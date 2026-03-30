'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { LayoutList, Columns3, Building2, MapPin, DollarSign, Calendar, User } from 'lucide-react'
import PillFilter from '@/components/pill-filter'
import TerritoryFilter from '@/components/territory-filter'
import { formatVerticalLabel, getVerticalBarColor } from '@/lib/verticals'
import { useVerticals } from '@/hooks/use-verticals'
import { useProjectStages } from '@/hooks/use-project-stages'

function formatCurrency(n: number): string {
  if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `$${(n / 1000).toFixed(0)}K`
  return `$${n.toLocaleString()}`
}

export default function ProjectsView({ projects, nameMap }: { projects: any[]; nameMap: Record<string, string> }) {
  const { stages: projectStages } = useProjectStages()
  const STATUSES = projectStages.map(s => ({ id: s.id, label: s.label, color: s.color }))
  const [view, setView] = useState<'board' | 'list'>('board')
  const [verticalFilter, setVerticalFilter] = useState('')
  const [territoryFilter, setTerritoryFilter] = useState('')
  const [dragId, setDragId] = useState<string | null>(null)
  const { verticals } = useVerticals()
  const supabase = createClient()
  const router = useRouter()

  const filtered = projects.filter(p => {
    if (verticalFilter && p.vertical !== verticalFilter) return false
    if (territoryFilter) {
      const ids = new Set(territoryFilter.split(',').filter(Boolean))
      if (!ids.has(p.territory_id)) return false
    }
    return true
  })

  async function moveProject(projectId: string, newStatus: string) {
    const update: any = { status: newStatus, updated_at: new Date().toISOString() }
    if (newStatus === 'complete') update.actual_end_date = new Date().toISOString().split('T')[0]
    await supabase.from('projects').update(update).eq('id', projectId)
    router.refresh()
  }

  function handleDragStart(e: React.DragEvent, id: string) {
    setDragId(id)
    e.dataTransfer.effectAllowed = 'move'
  }

  function handleDrop(e: React.DragEvent, status: string) {
    e.preventDefault()
    if (dragId) { moveProject(dragId, status); setDragId(null) }
  }

  function renderCard(p: any) {
    return (
      <Link key={p.id} href={`/projects/${p.id}`}
        draggable onDragStart={e => handleDragStart(e, p.id)}
        className="block bg-white rounded-lg border border-one70-border p-3 hover:border-one70-yellow transition-colors cursor-grab active:cursor-grabbing">
        <div className="flex items-start justify-between mb-1">
          <h4 className="text-sm font-semibold text-gray-900 line-clamp-1">{p.name}</h4>
          {p.vertical && (
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${getVerticalBarColor(p.vertical)}`}>
              {formatVerticalLabel(p.vertical)}
            </span>
          )}
        </div>
        {p.organizations && <p className="text-xs text-gray-500 flex items-center gap-1"><Building2 size={10} /> {p.organizations.name}</p>}
        {p.properties && <p className="text-xs text-gray-400 flex items-center gap-1"><MapPin size={10} /> {p.properties.name}</p>}
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-one70-border">
          {p.contract_value && <span className="text-xs font-semibold text-gray-700">{formatCurrency(Number(p.contract_value))}</span>}
          {p.assigned_to && <span className="text-[10px] text-gray-400">{nameMap[p.assigned_to]}</span>}
        </div>
      </Link>
    )
  }

  return (
    <div>
      {/* Controls */}
      <div className="flex flex-col gap-3 mb-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <PillFilter
            options={verticals}
            value={verticalFilter} onChange={setVerticalFilter}
          />
          <div className="flex border border-one70-border rounded-md overflow-hidden">
            <button onClick={() => setView('board')}
              className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium ${view === 'board' ? 'bg-one70-black text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
              <Columns3 size={14} /> Board
            </button>
            <button onClick={() => setView('list')}
              className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium ${view === 'list' ? 'bg-one70-black text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
              <LayoutList size={14} /> List
            </button>
          </div>
        </div>
        <div>
          <p className="text-[10px] font-semibold text-one70-mid uppercase tracking-wider mb-1">Territory</p>
          <TerritoryFilter value={territoryFilter} onChange={setTerritoryFilter} />
        </div>
      </div>

      {/* Board View */}
      {view === 'board' && (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {STATUSES.map(status => {
            const colProjects = filtered.filter(p => p.status === status.id)
            return (
              <div key={status.id} className="flex-shrink-0 w-64"
                onDragOver={e => e.preventDefault()} onDrop={e => handleDrop(e, status.id)}>
                <div className={`flex items-center justify-between mb-3 px-2 py-1.5 rounded-lg border ${status.color}`}>
                  <span className="text-xs font-semibold">{status.label}</span>
                  <span className="text-xs font-bold">{colProjects.length}</span>
                </div>
                <div className="space-y-2 min-h-[100px]">
                  {colProjects.map(renderCard)}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* List View */}
      {view === 'list' && (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block bg-white rounded-lg border border-one70-border overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-one70-gray text-xs text-one70-mid uppercase tracking-wider">
                  <th className="text-left px-4 py-2.5 font-semibold">Project</th>
                  <th className="text-left px-4 py-2.5 font-semibold">Organization</th>
                  <th className="text-center px-4 py-2.5 font-semibold">Status</th>
                  <th className="text-center px-4 py-2.5 font-semibold">Vertical</th>
                  <th className="text-right px-4 py-2.5 font-semibold">Value</th>
                  <th className="text-left px-4 py-2.5 font-semibold">Assigned</th>
                  <th className="text-left px-4 py-2.5 font-semibold">Target End</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => {
                  const statusObj = STATUSES.find(s => s.id === p.status)
                  return (
                    <tr key={p.id} className="border-t border-one70-border hover:bg-one70-gray/50">
                      <td className="px-4 py-2.5">
                        <Link href={`/projects/${p.id}`} className="text-sm font-medium text-gray-900 hover:underline">{p.name}</Link>
                      </td>
                      <td className="px-4 py-2.5 text-sm text-gray-600">{p.organizations?.name || '—'}</td>
                      <td className="px-4 py-2.5 text-center">
                        <select value={p.status} onChange={e => moveProject(p.id, e.target.value)}
                          className={`text-[10px] font-semibold px-2 py-1 rounded-full border ${statusObj?.color || 'bg-gray-100'}`}>
                          {STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        {p.vertical && <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${getVerticalBarColor(p.vertical)}`}>{formatVerticalLabel(p.vertical)}</span>}
                      </td>
                      <td className="px-4 py-2.5 text-right text-sm font-medium text-gray-700">{p.contract_value ? formatCurrency(Number(p.contract_value)) : '—'}</td>
                      <td className="px-4 py-2.5 text-sm text-gray-600">{p.assigned_to ? nameMap[p.assigned_to] : '—'}</td>
                      <td className="px-4 py-2.5 text-sm text-gray-500">{p.target_end_date || '—'}</td>
                    </tr>
                  )
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-one70-mid">No projects found</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-2">
            {filtered.length > 0 ? filtered.map(p => {
              const statusObj = STATUSES.find(s => s.id === p.status)
              return (
                <Link key={p.id} href={`/projects/${p.id}`}
                  className="block bg-white rounded-lg border border-one70-border p-4 active:bg-one70-yellow-light transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-one70-black truncate">{p.name}</p>
                      {p.organizations?.name && <p className="text-xs text-one70-mid mt-0.5">{p.organizations.name}</p>}
                    </div>
                    {statusObj && <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ml-2 ${statusObj.color}`}>{statusObj.label}</span>}
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-xs text-one70-mid">
                    {p.vertical && <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${getVerticalBarColor(p.vertical)}`}>{formatVerticalLabel(p.vertical)}</span>}
                    {p.contract_value && <span className="font-medium text-one70-dark">{formatCurrency(Number(p.contract_value))}</span>}
                    {p.percent_complete != null && (
                      <div className="flex items-center gap-1.5">
                        <div className="w-12 bg-gray-100 rounded-full h-1.5">
                          <div className={`h-1.5 rounded-full ${p.percent_complete === 100 ? 'bg-green-500' : 'bg-one70-black'}`} style={{ width: `${p.percent_complete}%` }} />
                        </div>
                        <span>{p.percent_complete}%</span>
                      </div>
                    )}
                    {p.target_end_date && <span>Due {p.target_end_date}</span>}
                  </div>
                </Link>
              )
            }) : (
              <div className="text-center py-8 text-sm text-one70-mid">No projects found</div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
