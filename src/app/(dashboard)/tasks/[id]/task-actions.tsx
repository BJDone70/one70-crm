'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Check, RotateCcw, UserCheck, ChevronDown, Plus, X, ArrowRight } from 'lucide-react'

interface Props {
  taskId: string
  taskTitle: string
  currentStatus: string
  currentAssignee: string
  contactId: string | null
  orgId: string | null
  dealId: string | null
  linkedName: string
  reps: { id: string; name: string }[]
  userId: string
}

export default function TaskActions({ taskId, taskTitle, currentStatus, currentAssignee, contactId, orgId, dealId, linkedName, reps, userId }: Props) {
  const [loading, setLoading] = useState(false)
  const [showReassign, setShowReassign] = useState(false)
  const [reassignTo, setReassignTo] = useState('')
  const [reassignNote, setReassignNote] = useState('')
  const [showFollowUp, setShowFollowUp] = useState(false)
  const [followUpTitle, setFollowUpTitle] = useState('')
  const [followUpDays, setFollowUpDays] = useState('3')
  const [followUpAssignee, setFollowUpAssignee] = useState('')
  const [followUpType, setFollowUpType] = useState('follow_up')
  const [followUpPriority, setFollowUpPriority] = useState('medium')
  const supabase = createClient()
  const router = useRouter()

  const hasLinkedRecord = !!(contactId || orgId || dealId)

  async function logUpdate(body: string, type: string) {
    await supabase.from('task_updates').insert({
      task_id: taskId, user_id: userId, body, update_type: type,
    })
  }

  async function completeTask() {
    setLoading(true)
    await supabase.from('tasks').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', taskId)
    await logUpdate('Marked task as complete', 'status_change')
    // Fire notification (fire and forget)
    fetch('/api/notifications/task', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'completed', task_id: taskId, task_title: taskTitle, user_id: userId }),
    }).catch(() => {})
    setLoading(false)

    // Always prompt for follow-up on completion
    setFollowUpTitle(`Follow up: ${taskTitle}`)
    setFollowUpAssignee(currentAssignee || userId)
    setShowFollowUp(true)
  }

  async function reopenTask() {
    setLoading(true)
    await supabase.from('tasks').update({ status: 'pending', completed_at: null }).eq('id', taskId)
    await logUpdate('Reopened task', 'status_change')
    setLoading(false)
    router.refresh()
  }

  async function createFollowUp() {
    if (!followUpTitle.trim()) return
    setLoading(true)
    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + parseInt(followUpDays || '3'))

    const { data } = await supabase.from('tasks').insert({
      title: followUpTitle.trim(),
      type: followUpType,
      priority: followUpPriority,
      due_date: dueDate.toISOString().split('T')[0],
      contact_id: contactId,
      org_id: orgId,
      deal_id: dealId,
      assigned_to: followUpAssignee || userId,
      created_by: userId,
      status: 'pending',
    }).select().single()

    if (data) {
      await logUpdate(`Created follow-up task: "${followUpTitle}"`, 'note')
    }

    setLoading(false)
    setShowFollowUp(false)
    router.refresh()
  }

  function skipFollowUp() {
    setShowFollowUp(false)
    router.refresh()
  }

  async function handleReassign() {
    if (!reassignTo) return
    setLoading(true)
    const newName = reps.find(r => r.id === reassignTo)?.name || 'someone'
    await supabase.from('tasks').update({ assigned_to: reassignTo }).eq('id', taskId)
    await logUpdate(`Reassigned to ${newName}${reassignNote ? `: ${reassignNote}` : ''}`, 'reassigned')
    // Notify the new assignee
    fetch('/api/notifications/task', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'assigned', task_id: taskId, task_title: taskTitle, user_id: userId, assignee_id: reassignTo }),
    }).catch(() => {})
    setShowReassign(false)
    setReassignTo('')
    setReassignNote('')
    setLoading(false)
    router.refresh()
  }

  const isPending = currentStatus !== 'completed'

  return (
    <>
      <div className="bg-white rounded-lg border border-one70-border p-4 mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={isPending ? completeTask : reopenTask} disabled={loading}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold transition-all active:scale-95 ${
              isPending ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
            } disabled:opacity-50`}>
            {isPending ? <><Check size={16} /> Mark Complete</> : <><RotateCcw size={16} /> Reopen Task</>}
          </button>

          <button onClick={() => setShowReassign(!showReassign)}
            className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 transition-all active:scale-95">
            <UserCheck size={16} /> Hand Off <ChevronDown size={12} />
          </button>
        </div>

        {showReassign && (
          <div className="mt-3 pt-3 border-t border-one70-border">
            <p className="text-xs font-semibold text-one70-mid mb-2">Reassign this task</p>
            <div className="flex flex-col sm:flex-row gap-2">
              <select value={reassignTo} onChange={e => setReassignTo(e.target.value)}
                className="text-sm border border-one70-border rounded-md px-3 py-2 bg-white flex-1">
                <option value="">Select team member...</option>
                {reps.filter(r => r.id !== currentAssignee).map(r => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
              <input type="text" value={reassignNote} onChange={e => setReassignNote(e.target.value)}
                placeholder="Hand-off note (optional)..."
                className="text-sm border border-one70-border rounded-md px-3 py-2 flex-1" />
              <button onClick={handleReassign} disabled={!reassignTo || loading}
                className="px-4 py-2 bg-one70-black text-white rounded-md text-sm font-semibold disabled:opacity-30 hover:bg-one70-dark active:scale-95 transition-all shrink-0">
                Reassign
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Follow-up prompt modal */}
      {showFollowUp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={skipFollowUp}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-green-100 rounded-full"><Check size={16} className="text-green-600" /></div>
                <div>
                  <h3 className="text-sm font-bold text-one70-black">Task Complete!</h3>
                  {linkedName && <p className="text-xs text-one70-mid">{linkedName}</p>}
                </div>
              </div>
              <button onClick={skipFollowUp} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>

            <p className="text-sm text-one70-dark mb-4">Is there a next step or follow-up task?</p>

            <div className="space-y-3">
              <input type="text" value={followUpTitle} onChange={e => setFollowUpTitle(e.target.value)}
                placeholder="Follow-up task title..."
                className="w-full text-sm border border-one70-border rounded-md px-3 py-2.5 focus:outline-none focus:border-one70-black" autoFocus />

              <div className="grid grid-cols-2 gap-2">
                <select value={followUpType} onChange={e => setFollowUpType(e.target.value)}
                  className="text-sm border border-one70-border rounded-md px-3 py-2 bg-white">
                  <option value="follow_up">Follow-up</option>
                  <option value="call">Call</option>
                  <option value="meeting">Meeting</option>
                  <option value="proposal">Proposal</option>
                  <option value="site_visit">Site Visit</option>
                  <option value="other">Other</option>
                </select>
                <select value={followUpPriority} onChange={e => setFollowUpPriority(e.target.value)}
                  className="text-sm border border-one70-border rounded-md px-3 py-2 bg-white">
                  <option value="low">Low Priority</option>
                  <option value="medium">Medium Priority</option>
                  <option value="high">High Priority</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <select value={followUpDays} onChange={e => setFollowUpDays(e.target.value)}
                  className="text-sm border border-one70-border rounded-md px-3 py-2 bg-white">
                  <option value="1">Due tomorrow</option>
                  <option value="2">In 2 days</option>
                  <option value="3">In 3 days</option>
                  <option value="5">In 5 days</option>
                  <option value="7">In 1 week</option>
                  <option value="14">In 2 weeks</option>
                  <option value="30">In 1 month</option>
                </select>
                <select value={followUpAssignee} onChange={e => setFollowUpAssignee(e.target.value)}
                  className="text-sm border border-one70-border rounded-md px-3 py-2 bg-white">
                  {reps.map(r => (
                    <option key={r.id} value={r.id}>{r.name}{r.id === userId ? ' (me)' : ''}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-2 mt-5">
              <button onClick={createFollowUp} disabled={loading || !followUpTitle.trim()}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-one70-black text-white rounded-md text-sm font-semibold disabled:opacity-30 hover:bg-one70-dark active:scale-95 transition-all">
                <Plus size={14} /> Create Follow-up
              </button>
              <button onClick={skipFollowUp}
                className="px-4 py-2.5 text-one70-mid border border-one70-border rounded-md text-sm font-medium hover:bg-one70-gray transition-colors">
                No Follow-up
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
