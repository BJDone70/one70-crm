'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { ArrowRight, Check, X } from 'lucide-react'
import { PIPELINE_STAGES, WON_STAGE, LOST_STAGE, ACTIVE_STAGE_IDS, isTerminalStage } from '@/lib/stages'

export default function DealStageChanger({ dealId, currentStage }: { dealId: string; currentStage: string }) {
  const [loading, setLoading] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  const currentIndex = PIPELINE_STAGES.findIndex(s => s.id === currentStage)
  const activeCount = ACTIVE_STAGE_IDS.length
  const nextStage = currentIndex < activeCount - 1 ? PIPELINE_STAGES[currentIndex + 1] : null

  async function changeStage(newStage: string) {
    setLoading(true)
    const oldStage = currentStage
    await supabase.from('deals').update({ stage: newStage, updated_at: new Date().toISOString() }).eq('id', dealId)

    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const stageLabel = PIPELINE_STAGES.find(s => s.id === newStage)?.label || newStage

      // Log activity
      await supabase.from('activities').insert({
        type: 'note',
        subject: `Deal moved to ${stageLabel}`,
        deal_id: dealId,
        user_id: user.id,
      })

      // Log stage history for velocity tracking
      await supabase.from('deal_stage_history').insert({
        deal_id: dealId,
        from_stage: oldStage,
        to_stage: newStage,
        changed_by: user.id,
      })

      // Trigger notifications + workflows (fire and forget)
      fetch('/api/notifications/deal-stage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deal_id: dealId, old_stage: oldStage, new_stage: newStage, user_id: user.id }),
      }).catch(() => {})

      fetch('/api/workflows/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deal_id: dealId, old_stage: oldStage, new_stage: newStage, user_id: user.id }),
      }).catch(() => {})
    }

    setLoading(false)
    router.refresh()
  }

  if (isTerminalStage(currentStage)) {
    return (
      <div className="flex gap-2">
        <button
          onClick={() => changeStage('new_lead')}
          disabled={loading}
          className="text-xs px-3 py-1.5 border border-gray-300 rounded-md hover:bg-gray-50 text-gray-600 transition-colors disabled:opacity-50"
        >
          Reopen Deal
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-wrap gap-2">
      {nextStage && (
        <button
          onClick={() => changeStage(nextStage.id)}
          disabled={loading}
          className="flex items-center gap-1 text-xs px-3 py-1.5 bg-one70-black text-white rounded-md hover:bg-one70-dark transition-colors disabled:opacity-50 font-medium"
        >
          <ArrowRight size={12} /> Move to {nextStage.label}
        </button>
      )}
      <button
        onClick={() => changeStage(WON_STAGE)}
        disabled={loading}
        className="flex items-center gap-1 text-xs px-3 py-1.5 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:opacity-50 font-medium"
      >
        <Check size={12} /> Awarded
      </button>
      <button
        onClick={() => changeStage(LOST_STAGE)}
        disabled={loading}
        className="flex items-center gap-1 text-xs px-3 py-1.5 bg-red-100 text-red-700 rounded-md hover:bg-red-200 transition-colors disabled:opacity-50 font-medium"
      >
        <X size={12} /> Lost / No-Go
      </button>
    </div>
  )
}
