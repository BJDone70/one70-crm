'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Clock, TrendingUp } from 'lucide-react'

interface StageEntry {
  from_stage: string | null
  to_stage: string
  changed_at: string
}

const stageLabels: Record<string, string> = {
  new_lead: 'New Lead', contacted: 'Contacted', qualified: 'Qualified',
  estimating: 'Estimating', proposal_sent: 'Proposal Sent', negotiation: 'Negotiation',
  awarded: 'Awarded', lost: 'Lost',
}

export default function DealVelocity({ dealId, currentStage, createdAt }: { dealId: string; currentStage: string; createdAt: string }) {
  const [history, setHistory] = useState<StageEntry[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    supabase.from('deal_stage_history')
      .select('from_stage, to_stage, changed_at')
      .eq('deal_id', dealId)
      .order('changed_at', { ascending: true })
      .then(({ data }) => { setHistory(data || []); setLoading(false) })
  }, [dealId])

  if (loading) return null

  // Build time-in-stage data
  const stages: { stage: string; days: number; enteredAt: string }[] = []

  if (history.length === 0) {
    // No history — deal has been in current stage since creation
    const days = Math.floor((Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24))
    stages.push({ stage: currentStage, days, enteredAt: createdAt })
  } else {
    // First stage: from creation to first change
    const firstChange = new Date(history[0].changed_at)
    const creationDate = new Date(createdAt)
    const firstDays = Math.max(0, Math.floor((firstChange.getTime() - creationDate.getTime()) / (1000 * 60 * 60 * 24)))
    if (history[0].from_stage) {
      stages.push({ stage: history[0].from_stage, days: firstDays, enteredAt: createdAt })
    }

    // Each subsequent stage
    for (let i = 0; i < history.length; i++) {
      const enteredAt = history[i].changed_at
      const exitedAt = i < history.length - 1 ? history[i + 1].changed_at : new Date().toISOString()
      const days = Math.max(0, Math.floor((new Date(exitedAt).getTime() - new Date(enteredAt).getTime()) / (1000 * 60 * 60 * 24)))
      stages.push({ stage: history[i].to_stage, days, enteredAt })
    }
  }

  const totalDays = stages.reduce((s, st) => s + st.days, 0)
  const maxDays = Math.max(...stages.map(s => s.days), 1)

  if (stages.length <= 1 && stages[0]?.days === 0) return null

  return (
    <div className="bg-white rounded-lg border border-one70-border p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-one70-mid uppercase tracking-wider flex items-center gap-2">
          <TrendingUp size={14} /> Deal Velocity
        </h3>
        <span className="text-xs text-one70-mid">{totalDays} days total</span>
      </div>

      <div className="space-y-2">
        {stages.map((s, i) => {
          const widthPct = Math.max(8, (s.days / maxDays) * 100)
          const isCurrentStage = i === stages.length - 1
          return (
            <div key={i} className="flex items-center gap-3">
              <span className="text-xs text-one70-mid w-24 text-right shrink-0">{stageLabels[s.stage] || s.stage}</span>
              <div className="flex-1 bg-one70-gray rounded-full h-5 overflow-hidden">
                <div className={`h-full rounded-full flex items-center justify-end pr-2 transition-all ${
                  isCurrentStage ? 'bg-one70-yellow' : 'bg-blue-200'
                }`} style={{ width: `${widthPct}%` }}>
                  <span className="text-[10px] font-bold text-one70-black">{s.days}d</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {history.length > 0 && (
        <div className="mt-3 pt-3 border-t border-one70-border">
          <p className="text-[10px] text-gray-400">
            {history.length} stage change{history.length > 1 ? 's' : ''} since {new Date(createdAt).toLocaleDateString()}
          </p>
        </div>
      )}
    </div>
  )
}
