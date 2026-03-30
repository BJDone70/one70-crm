'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Check, AlertCircle, CalendarDays, Bell, Pencil, Trash2, Lock, User, CornerDownRight, ChevronDown, ChevronRight } from 'lucide-react'
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

  const repNameMap = Object.fromEntries(reps.map(r => [r.id, r.full_name]))

  function updateFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value) { params.set(key, value) } else { params.delete(key) }
    router.push(`/tasks?${params.toString()}`)
  }

  async function completeTask(e: React.MouseEvent, id: string) {
    e.preventDefault(); e.stopPropagation(); setCompleting(id)
    await supabase.from('tasks').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', id)
    setCompleting(null); router.refresh()
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
            onClick={e => isCompleted ? reopenTask(e, task.id) : completeTask(e, task.id)}
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
    </div>
  )
}
