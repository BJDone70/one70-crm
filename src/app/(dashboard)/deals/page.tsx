import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import PipelineBoard from './pipeline-board'
import PipelineFilters from './pipeline-filters'
import { PIPELINE_STAGES, WON_STAGE, LOST_STAGE, ACTIVE_STAGE_IDS } from '@/lib/stages'

interface SearchParams {
  vertical?: string
  rep?: string
  territory?: string
}

export default async function DealsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams
  const supabase = await createClient()

  let query = supabase
    .from('deals')
    .select('*, organizations(name), contacts(first_name, last_name), properties(name)')
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })

  if (params.vertical && params.vertical !== 'all') {
    const verts = params.vertical.split(',').filter(Boolean)
    query = query.overlaps('verticals', verts)
  }
  if (params.rep && params.rep !== 'all') {
    query = query.eq('assigned_to', params.rep)
  }
  if (params.territory) {
    const ids = params.territory.split(',').filter(Boolean)
    if (ids.length === 1) query = query.eq('territory_id', ids[0])
    else if (ids.length > 1) query = query.in('territory_id', ids)
  }

  const { data: deals } = await query

  // Get team members for filter
  const { data: reps } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('is_active', true)
    .order('full_name')

  // Calculate pipeline stats
  const stages = PIPELINE_STAGES.map(s => s.id)
  const activeDeals = (deals || []).filter(d => d.stage !== WON_STAGE && d.stage !== LOST_STAGE)
  const totalPipelineValue = activeDeals.reduce((sum, d) => sum + (Number(d.value) || 0), 0)
  const wonDeals = (deals || []).filter(d => d.stage === WON_STAGE)
  const wonValue = wonDeals.reduce((sum, d) => sum + (Number(d.value) || 0), 0)

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-bold text-one70-black">Pipeline</h1>
          <div className="flex flex-wrap gap-4 mt-1 text-sm">
            <span className="text-one70-mid">
              Active: <span className="font-semibold text-one70-black">{activeDeals.length} deals</span>
              {totalPipelineValue > 0 && <span className="ml-1 font-semibold text-one70-black">(${totalPipelineValue.toLocaleString()})</span>}
            </span>
            <span className="text-one70-mid">
              Won: <span className="font-semibold text-green-700">{wonDeals.length} deals</span>
              {wonValue > 0 && <span className="ml-1 font-semibold text-green-700">(${wonValue.toLocaleString()})</span>}
            </span>
          </div>
        </div>
        <Link
          href="/deals/new"
          className="flex items-center justify-center gap-2 bg-one70-black text-white px-4 py-2.5 rounded-md text-sm font-semibold hover:bg-one70-dark transition-colors"
        >
          <Plus size={18} /> New Deal
        </Link>
      </div>

      {/* Filters */}
      <PipelineFilters
        currentVertical={params.vertical}
        currentRep={params.rep}
        currentTerritory={params.territory}
        reps={reps || []}
      />

      {/* Kanban Board */}
      <PipelineBoard deals={deals || []} reps={reps || []} />
    </div>
  )
}
