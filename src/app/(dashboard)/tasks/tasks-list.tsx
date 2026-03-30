'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Check, AlertCircle, CalendarDays, Bell, Pencil, Trash2, Lock, User, CornerDownRight, ChevronDown, ChevronRight, Plus, X } from 'lucide-react'
import PillFilter from '@/components/pill-filter'

interface Task {
  id: string; title: string; description: string | null; type: string; priority: string
  status: string; due_date: string | null; due_time: string | null; is_private?: boolean
  assigned_to: string | null; contact_id: string | null; org_id: string | null; deal_id: string | null
  parent_task_id: string | null
  contacts: { id: string; first_name: string; last_name: string } | null
  organizations: { id: string; name: string } | null
  deals: { id: string; name: string } | null
}

interface Reminder {
  id: string; category: string; title: string; note: string | null
  reminder_date: string; reminder_recurring: boolean
  contacts: { id: string; first_name: string; last_name: string } | null; contact_id: string
}

interface Props {
  tasks: Task[]; reminders: Reminder[]; currentStatus: string; currentType: string
  currentAssignee: string; pendingCount: number; completedCount: number
  reps: { id: string; full_name: string }[]; currentUserId: string; isAdmin: boolean
}

const typeIcons: Record<string, string> = { follow_up: '📞', next_step: '➡️', todo: '✅', reminder: '🔔' }
const categoryIcons: Record<string, string> = { birthday: '🎂', anniversary: '💍', holiday: '🎄', preference: '⭐', family: '👨‍👩‍👧‍👦', hobby: '🎯', important_date: '📅', other: '📌' }

function isOverdue(d: string | null): boolean {
  if (!d) return false; const t = new Date(); t.setHours(0, 0, 0, 0); return new Date(d) < t
}
function formatDate(d: string): string {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function TasksList({ tasks, reminders, currentStatus, currentType, currentAssignee, pendingCount, completedCount, reps, currentUserId, isAdmin }: Props) {
  const supabase = createClient()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [completing, setCompleting] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  // Follow-up prompt state
  const [followUpTask, setFollowUpTask] = useState<Task | null>(null)
  const [followUpTitle, setFollowUpTitle] = useState('')
  const [followUpType, setFollowUpType] = useState('follow_up')
  const [followUpPriority, setFollowUpPriority] = useState('medium')
  const [followUpDays, setFollowUpDays] = useState('3')
  const [followUpAssignee, setFollowUpAssignee] = useState('')
  const [followUpLoading, setFollowUpLoading] = useState(false)

  const repNameMap = Object.fromEntries(reps.map(r => [r.id, r.full_name]))

  function updateFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value) { params.set(key, value) } else { params.delete(key) }
    router.push(`/tasks?${params.toString()}`)
  }

  async function completeTask(e: React.MouseEvent, task: Task) {
    e.preventDefault(); e.stopPropagation(); setCompleting(task.id)
    await supabase.from('tasks').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', task.id)
    setCompleting(null)
    // Show follow-up prompt
    const linkedName = [
      task.contacts && `${task.contacts.first_name} ${task.contacts.last_name}`,
      task.organizations?.name,
      task.deals && `Deal: ${task.deals.name}`,
    ].filter(Boolean).join(' | ')
    setFollowUpTask(task)
    setFollowUpTitle(`Follow up: ${task.title}`)
    setFollowUpType('follow_up')
    setFollowUpPriority('medium')
    setFollowUpDays('3')
    setFollowUpAssignee(task.assigned_to || currentUserId)
  }

  async function createFollowUp() {
    if (!followUpTask || !followUpTitle.trim()) return
    setFollowUpLoading(true)
    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + parseInt(followUpDays || '3'))
    await supabase.from('tasks').insert({
      title: followUpTitle.trim(),
      type: followUpType,
      priority: followUpPriority,
      due_date: dueDate.toISOString().split('T')[0],
      contact_id: followUpTask.contact_id,
      org_id: followUpTask.org_id,
      deal_id: followUpTask.deal_id,
      assigned_to: followUpAssignee || currentUserId,
      created_by: currentUserId,
      status: 'pending',
    })
    setFollowUpLoading(false)
    setFollowUpTask(null)
    router.refresh()
  }

  function skipFollowUp() {
    setFollowUpTask(null)
    router.refresh()
  }

  async function reopenTask(e: React.MouseEvent, id: string) {
    e.preventDefault(); e.stopPropagation(); setCompleting(id)
    await supabase.from('tasks').update({ status: 'pending', completed_at: null }).eq('id', id)
    setCompleting(null); router.refresh()
  }

  async function deleteTask(e: React.MouseEvent, id: string) {
    e.preventDefault(); e.stopPropagation()
    if (!confirm('Delete this task?')) return; setDeleting(id)
    await supabase.from('tasks').update({ deleted_at: new Date().toISOString() }).eq('id', id)
    setDeleting(null); router.refresh()
  }

  const statusOptions = [
    { id: 'pending', label: `Pending (${pendingCount})` },
    { id: 'completed', label: `Done (${completedCount})` },
    { id: 'all', label: 'All' },
  ]
  const typeOptions = [
    { id: 'all', label: 'All Types' },
    { id: 'follow_up', label: '📞 Follow-ups' },
    { id: 'next_step', label: '➡️ Next Steps' },
    { id: 'todo', label: '✅ To-dos' },
    { id: 'reminder', label: '🔔 Reminders' },
  ]

  const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set())

  // Group tasks: top-level tasks and their sub-tasks
  const topLevelTasks = tasks.filter(t => !t.parent_task_id)
  const subTaskMap = new Map<string, Task[]>()
  tasks.filter(t => t.parent_task_id).forEach(t => {
    const arr = subTaskMap.get(t.parent_task_id!) || []
    arr.push(t)
    subTaskMap.set(t.parent_task_id!, arr)
  })
  // Orphaned sub-tasks (parent not in current view) — show as top-level
  const orphanedSubs = tasks.filter(t => t.parent_task_id && !topLevelTasks.some(p => p.id === t.parent_task_id))

  function toggleExpand(id: string) {
    setExpandedParents(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function renderTask(task: Task, isSubtask = false) {
    const overdue = isOverdue(task.due_date) && task.status === 'pending'
    const isCompleted = task.status === 'completed'
    const isOtherUser = task.assigned_to !== currentUserId
    const subs = subTaskMap.get(task.id) || []
    const subCount = subs.length
    const subDone = subs.filter(s => s.status === 'completed').length
    const isExpanded = expandedParents.has(task.id)

    return (
      <div key={task.id}>
        <Link href={`/tasks/${task.id}`}
          className={`flex items-start gap-3 bg-white rounded-lg border p-4 transition-shadow hover:shadow-md ${
            overdue ? 'border-red-300 bg-red-50' : 'border-one70-border'
          } ${isCompleted ? 'opacity-60' : ''} ${isSubtask ? 'ml-8 border-l-2 border-l-blue-200' : ''}`}>
          <button
            onClick={e => isCompleted ? reopenTask(e, task.id) : completeTask(e, task)}
            disabled={completing === task.id}
            className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
              isCompleted ? 'border-green-500 bg-green-500' : isSubtask ? 'border-blue-300 hover:border-blue-500 hover:bg-blue-50' : 'border-gray-300 hover:border-green-500 hover:bg-green-50'
            }`} title={isCompleted ? 'Reopen' : 'Complete'}>
            {isCompleted && <Check size={12} className="text-white" />}
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-1.5">
                {isSubtask && <CornerDownRight size={12} className="text-blue-400 shrink-0" />}
                <p className={`text-sm font-medium ${isCompleted ? 'line-through text-gray-400' : isSubtask ? 'text-gray-700' : 'text-gray-900'}`}>{task.title}</p>
                {task.is_private && <span title="Private task"><Lock size={11} className="text-gray-400 shrink-0" /></span>}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {/* Sub-task count badge on parent */}
                {!isSubtask && subCount > 0 && (
                  <button onClick={e => { e.preventDefault(); e.stopPropagation(); toggleExpand(task.id) }}
                    className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors mr-1">
                    {isExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                    {subDone}/{subCount}
                  </button>
                )}
                <span className="p-1 text-gray-400"><Pencil size={13} /></span>
                <button onClick={e => deleteTask(e, task.id)} disabled={deleting === task.id}
                  className="p-1 text-gray-400 hover:text-red-500 transition-colors" title="Delete">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
            {task.description && <p className="text-xs text-gray-500 mt-0.5">{task.description}</p>}
            <div className="flex flex-wrap items-center gap-2 mt-1.5">
              {isSubtask && <span className="text-[10px] font-medium px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded">SUB-TASK</span>}
              <span className="text-xs text-gray-400">{typeIcons[task.type]} {task.type.replace('_', ' ')}</span>
              {task.priority === 'high' && <span className="text-[10px] font-medium px-1.5 py-0.5 bg-red-100 text-red-700 rounded">HIGH</span>}
              {task.due_date && (
                <span className={`text-xs ${overdue ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                  {overdue && <AlertCircle size={11} className="inline mr-0.5" />}
                  {formatDate(task.due_date)}{task.due_time && ` ${task.due_time.substring(0, 5)}`}
                </span>
              )}
              {!task.assigned_to && (
                <span className="text-[10px] font-medium px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded">
                  Unassigned
                </span>
              )}
              {isOtherUser && task.assigned_to && (
                <span className="text-[10px] font-medium px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded">
                  {repNameMap[task.assigned_to]?.split(' ')[0] || 'Other'}
                </span>
              )}
            </div>
            {(task.contacts || task.organizations || task.deals) && (
              <div className="flex flex-wrap gap-1.5 mt-1 text-xs text-gray-500">
                {task.contacts && <span>{task.contacts.first_name} {task.contacts.last_name}</span>}
                {task.organizations && <span>{task.contacts ? '| ' : ''}{task.organizations.name}</span>}
                {task.deals && <span>{(task.contacts || task.organizations) ? '| ' : ''}Deal: {task.deals.name}</span>}
              </div>
            )}
          </div>
        </Link>
        {/* Render sub-tasks if expanded */}
        {!isSubtask && isExpanded && subs.length > 0 && (
          <div className="space-y-1.5 mt-1.5">
            {subs.map(sub => renderTask(sub, true))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      {/* Filters */}
      <div className="space-y-2 mb-6">
        <PillFilter options={statusOptions} value={currentStatus} onChange={v => updateFilter('status', v)} allowDeselect={false} />
        <PillFilter options={typeOptions} value={currentType} onChange={v => updateFilter('type', v)} allowDeselect={false} />

        {/* Assignee filter */}
        <div className="flex flex-wrap gap-1.5">
          <button onClick={() => updateFilter('assignee', 'mine')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
              currentAssignee === 'mine' ? 'bg-one70-black text-white border-one70-black' : 'bg-white text-one70-dark border-one70-border hover:border-one70-dark'
            }`}>
            <User size={12} /> My Tasks
          </button>
          <button onClick={() => updateFilter('assignee', 'all')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
              currentAssignee === 'all' ? 'bg-one70-black text-white border-one70-black' : 'bg-white text-one70-dark border-one70-border hover:border-one70-dark'
            }`}>
            All Tasks
          </button>
          {reps.length > 1 && reps.filter(r => r.id !== currentUserId).map(r => (
            <button key={r.id} onClick={() => updateFilter('assignee', r.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                currentAssignee === r.id ? 'bg-one70-black text-white border-one70-black' : 'bg-white text-one70-dark border-one70-border hover:border-one70-dark'
              }`}>
              {r.full_name.split(' ')[0]}
            </button>
          ))}
        </div>
      </div>

      {/* Key note reminders */}
      {currentStatus === 'pending' && currentAssignee === 'mine' && reminders.length > 0 && (
        <div className="mb-6">
          <h2 className="text-xs font-semibold text-one70-mid uppercase tracking-wider mb-3 flex items-center gap-1">
            <Bell size={13} /> Upcoming Reminders
          </h2>
          <div className="space-y-2">
            {reminders.map(r => (
              <Link key={r.id} href={`/contacts/${r.contact_id}`}
                className="flex items-start gap-3 bg-white rounded-lg border border-one70-border p-4 hover:shadow-md transition-shadow">
                <span className="text-lg mt-0.5">{categoryIcons[r.category] || '📌'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{r.title}</p>
                  {r.note && <p className="text-xs text-gray-500 mt-0.5">{r.note}</p>}
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-gray-500">{r.contacts?.first_name} {r.contacts?.last_name}</span>
                    <span className="text-xs text-gray-400">{formatDate(r.reminder_date)}{r.reminder_recurring && ' (yearly)'}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Tasks list — grouped with sub-tasks */}
      <div className="space-y-2">
        {topLevelTasks.length > 0 || orphanedSubs.length > 0 ? (
          <>
            {topLevelTasks.map(task => renderTask(task))}
            {orphanedSubs.map(task => renderTask(task, true))}
          </>
        ) : (
          <div className="text-center py-12 text-gray-400">
            <CalendarDays size={32} className="mx-auto mb-3 opacity-50" />
            <p className="text-sm font-medium">No {currentStatus !== 'all' ? currentStatus : ''} tasks</p>
            <p className="text-xs mt-1">Create tasks from contacts, deals, or the + button</p>
          </div>
        )}
      </div>

      {/* Follow-up prompt modal */}
      {followUpTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={skipFollowUp}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-green-100 rounded-full"><Check size={16} className="text-green-600" /></div>
                <div>
                  <h3 className="text-sm font-bold text-one70-black">Task Complete!</h3>
                  <p className="text-xs text-one70-mid">
                    {[
                      followUpTask.contacts && `${followUpTask.contacts.first_name} ${followUpTask.contacts.last_name}`,
                      followUpTask.organizations?.name,
                    ].filter(Boolean).join(' | ') || 'No linked record'}
                  </p>
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
                  <option value="next_step">Next Step</option>
                  <option value="todo">To-do</option>
                  <option value="reminder">Reminder</option>
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
                    <option key={r.id} value={r.id}>{r.full_name}{r.id === currentUserId ? ' (me)' : ''}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-2 mt-5">
              <button onClick={createFollowUp} disabled={followUpLoading || !followUpTitle.trim()}
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
    </div>
  )
}
