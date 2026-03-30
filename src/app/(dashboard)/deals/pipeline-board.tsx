'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { GripVertical, DollarSign, Calendar, User } from 'lucide-react'
import { formatVerticalLabel, getVerticalColor } from '@/lib/verticals'

interface Deal {
  id: string
  name: string
  stage: string
  vertical: string
  value: number | null
  expected_close: string | null
  assigned_to: string | null
  organizations: { name: string } | null
  contacts: { first_name: string; last_name: string } | null
  properties: { name: string } | null
}

interface Rep {
  id: string
  full_name: string
}

import { PIPELINE_STAGES_COLORED, WON_STAGE, LOST_STAGE, isTerminalStage } from '@/lib/stages'

const STAGES = PIPELINE_STAGES_COLORED

export default function PipelineBoard({ deals, reps }: { deals: Deal[]; reps: Rep[] }) {
  const [draggedDeal, setDraggedDeal] = useState<string | null>(null)
  const [dragOverStage, setDragOverStage] = useState<string | null>(null)
  const [updating, setUpdating] = useState<string | null>(null)
  const supabase = createClient()
  const router = useRouter()
  const touchStartRef = useRef<{ x: number; y: number; dealId: string } | null>(null)

  async function moveDeal(dealId: string, newStage: string) {
    setUpdating(dealId)
    await supabase
      .from('deals')
      .update({ stage: newStage })
      .eq('id', dealId)
    setUpdating(null)
    router.refresh()
  }

  // Desktop drag handlers
  function handleDragStart(e: React.DragEvent, dealId: string) {
    e.dataTransfer.setData('dealId', dealId)
    e.dataTransfer.effectAllowed = 'move'
    setDraggedDeal(dealId)
  }

  function handleDragEnd() {
    setDraggedDeal(null)
    setDragOverStage(null)
  }

  function handleDragOver(e: React.DragEvent, stageId: string) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverStage(stageId)
  }

  function handleDragLeave() {
    setDragOverStage(null)
  }

  function handleDrop(e: React.DragEvent, stageId: string) {
    e.preventDefault()
    const dealId = e.dataTransfer.getData('dealId')
    if (dealId) {
      moveDeal(dealId, stageId)
    }
    setDragOverStage(null)
    setDraggedDeal(null)
  }

  // Mobile: stage selector dropdown
  function MobileStageSelector({ deal }: { deal: Deal }) {
    return (
      <select
        value={deal.stage}
        onChange={e => moveDeal(deal.id, e.target.value)}
        className="text-xs px-1.5 py-0.5 border border-gray-200 rounded bg-white sm:hidden"
        disabled={updating === deal.id}
      >
        {STAGES.map(s => (
          <option key={s.id} value={s.id}>{s.label}</option>
        ))}
      </select>
    )
  }

  function DealCard({ deal }: { deal: Deal }) {
    const isUpdating = updating === deal.id
    const isDragging = draggedDeal === deal.id

    return (
      <div
        draggable
        onDragStart={e => handleDragStart(e, deal.id)}
        onDragEnd={handleDragEnd}
        className={`bg-white rounded-md border border-gray-200 p-3 shadow-sm hover:shadow-md transition-all cursor-grab active:cursor-grabbing ${
          isDragging ? 'opacity-40 scale-95' : ''
        } ${isUpdating ? 'opacity-60' : ''}`}
      >
        <div className="flex items-start justify-between gap-2">
          <Link href={`/deals/${deal.id}`} className="text-sm font-medium text-gray-900 hover:underline flex-1 min-w-0">
            {deal.name}
          </Link>
          <div className="flex items-center gap-1 shrink-0">
            <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${getVerticalColor(deal.vertical)}`}>
              {formatVerticalLabel(deal.vertical)}
            </span>
            <GripVertical size={14} className="text-gray-300 hidden sm:block" />
          </div>
        </div>

        {deal.organizations && (
          <p className="text-xs text-gray-500 mt-1 truncate">{(deal.organizations as any).name}</p>
        )}

        <div className="flex flex-wrap items-center gap-2 mt-2">
          {deal.value && (
            <span className="flex items-center gap-0.5 text-xs font-semibold text-gray-700">
              <DollarSign size={11} />{Number(deal.value).toLocaleString()}
            </span>
          )}
          {deal.expected_close && (
            <span className="flex items-center gap-0.5 text-xs text-gray-400">
              <Calendar size={11} />{new Date(deal.expected_close + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          )}
          {deal.assigned_to && (
            <span className="flex items-center gap-0.5 text-xs text-gray-400">
              <User size={11} />{reps.find(r => r.id === deal.assigned_to)?.full_name || 'Unassigned'}
            </span>
          )}
        </div>

        {/* Mobile stage selector */}
        <div className="mt-2 sm:hidden">
          <MobileStageSelector deal={deal} />
        </div>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto pb-4 -mx-4 sm:-mx-6 px-4 sm:px-6">
      <div className="flex gap-3 min-w-[1200px]">
        {STAGES.map(stage => {
          const stageDeals = deals.filter(d => d.stage === stage.id)
          const stageValue = stageDeals.reduce((sum, d) => sum + (Number(d.value) || 0), 0)
          const isOver = dragOverStage === stage.id

          return (
            <div
              key={stage.id}
              className={`flex-1 min-w-[180px] rounded-lg border-2 transition-colors ${
                isOver ? 'border-one70-yellow bg-one70-yellow-light' : `${stage.color} border-transparent`
              }`}
              onDragOver={e => handleDragOver(e, stage.id)}
              onDragLeave={handleDragLeave}
              onDrop={e => handleDrop(e, stage.id)}
            >
              {/* Column header */}
              <div className="px-3 py-2.5 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">{stage.label}</h3>
                  <span className="text-xs text-gray-400 font-medium">{stageDeals.length}</span>
                </div>
                {stageValue > 0 && (
                  <p className="text-xs text-gray-500 mt-0.5">${stageValue.toLocaleString()}</p>
                )}
              </div>

              {/* Cards */}
              <div className="p-2 space-y-2 min-h-[100px]">
                {stageDeals.map(deal => (
                  <DealCard key={deal.id} deal={deal} />
                ))}
                {stageDeals.length === 0 && !isOver && (
                  <p className="text-xs text-gray-400 text-center py-6">No deals</p>
                )}
                {isOver && (
                  <div className="border-2 border-dashed border-one70-yellow rounded-md p-4 text-center">
                    <p className="text-xs text-gray-500">Drop here</p>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
