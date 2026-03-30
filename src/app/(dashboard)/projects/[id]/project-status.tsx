'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useProjectStages } from '@/hooks/use-project-stages'

export default function ProjectStatusChanger({ projectId, currentStatus, projectName }: { projectId: string; currentStatus: string; projectName?: string }) {
  const [status, setStatus] = useState(currentStatus)
  const { stages } = useProjectStages()
  const supabase = createClient()
  const router = useRouter()

  async function changeStatus(newStatus: string) {
    setStatus(newStatus)
    const update: any = { status: newStatus, updated_at: new Date().toISOString() }
    const newStage = stages.find(s => s.id === newStatus)
    const oldStage = stages.find(s => s.id === status)
    if (newStage?.is_terminal && newStage.id.includes('complete')) update.actual_end_date = new Date().toISOString().split('T')[0]
    if (!newStage?.is_terminal && oldStage?.sort_order === 0) update.start_date = new Date().toISOString().split('T')[0]
    await supabase.from('projects').update(update).eq('id', projectId)

    fetch('/api/notifications/trigger', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'project_status', projectId, projectName: projectName || 'Project', newStatus }),
    }).catch(() => {})

    router.refresh()
  }

  const currentStage = stages.find(s => s.id === status)
  const isTerminal = currentStage?.is_terminal || false
  const currentIdx = stages.findIndex(s => s.id === status)
  const nextStage = currentIdx >= 0 ? stages.slice(currentIdx + 1).find(s => !s.is_terminal) : null
  const completeStage = stages.find(s => s.is_terminal && (s.id.includes('complete') || s.id.includes('done') || s.id.includes('finish')))
  const holdStage = stages.find(s => s.is_terminal && (s.id.includes('hold') || s.id.includes('pause') || s.id.includes('cancel')))
  const firstActiveStage = stages.find(s => !s.is_terminal && s.sort_order > 0) || stages[0]

  return (
    <div className="flex flex-wrap items-center gap-2">
      {nextStage && !isTerminal && (
        <button onClick={() => changeStatus(nextStage.id)}
          className="bg-one70-black text-white px-3 py-2 rounded-md text-xs sm:text-sm font-semibold hover:bg-one70-dark transition-colors whitespace-nowrap">
          Move to {nextStage.label}
        </button>
      )}
      {completeStage && status !== completeStage.id && (
        <button onClick={() => changeStatus(completeStage.id)}
          className="border border-green-300 text-green-700 px-3 py-2 rounded-md text-xs sm:text-sm font-medium hover:bg-green-50 transition-colors whitespace-nowrap">
          {completeStage.label}
        </button>
      )}
      {holdStage && !isTerminal && (
        <button onClick={() => changeStatus(holdStage.id)}
          className="border border-one70-border text-gray-500 px-3 py-2 rounded-md text-xs sm:text-sm font-medium hover:bg-gray-50 transition-colors whitespace-nowrap">
          {holdStage.label}
        </button>
      )}
      {isTerminal && firstActiveStage && (
        <button onClick={() => changeStatus(firstActiveStage.id)}
          className="border border-blue-300 text-blue-700 px-3 py-2 rounded-md text-xs sm:text-sm font-medium hover:bg-blue-50 transition-colors whitespace-nowrap">
          Reopen
        </button>
      )}
    </div>
  )
}
