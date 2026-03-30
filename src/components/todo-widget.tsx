'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Check, AlertCircle, Clock, CalendarDays, Bell } from 'lucide-react'
import Link from 'next/link'

interface Task {
  id: string
  title: string
  description: string | null
  type: string
  priority: string
  status: string
  due_date: string | null
  due_time: string | null
  contact_id: string | null
  org_id: string | null
  deal_id: string | null
  contacts: { first_name: string; last_name: string } | null
  organizations: { name: string } | null
}

interface Reminder {
  id: string
  category: string
  title: string
  note: string | null
  reminder_date: string
  contact_id: string
  contacts: { first_name: string; last_name: string } | null
}

function isOverdue(dueDate: string | null): boolean {
  if (!dueDate) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return new Date(dueDate) < today
}

function isDueToday(dueDate: string | null): boolean {
  if (!dueDate) return false
  return dueDate === new Date().toISOString().split('T')[0]
}

function formatDueDate(dueDate: string | null, dueTime: string | null): string {
  if (!dueDate) return 'No due date'
  const date = new Date(dueDate + 'T00:00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  let label = ''
  if (date.getTime() === today.getTime()) label = 'Today'
  else if (date.getTime() === tomorrow.getTime()) label = 'Tomorrow'
  else label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  if (dueTime) {
    const [h, m] = dueTime.split(':')
    const hour = parseInt(h)
    const ampm = hour >= 12 ? 'PM' : 'AM'
    label += ` ${(hour % 12) || 12}:${m} ${ampm}`
  }
  return label
}

const typeIcons: Record<string, string> = { follow_up: '📞', next_step: '➡️', todo: '✅', reminder: '🔔' }
const categoryIcons: Record<string, string> = { birthday: '🎂', anniversary: '💍', holiday: '🎄', preference: '⭐', family: '👨‍👩‍👧‍👦', hobby: '🎯', important_date: '📅', other: '📌' }
const priorityStyles: Record<string, string> = { high: 'border-l-red-500', normal: 'border-l-blue-400', low: 'border-l-gray-300' }

export default function TodoWidget({ tasks, reminders }: { tasks: Task[]; reminders: Reminder[] }) {
  const supabase = createClient()
  const router = useRouter()

  async function completeTask(e: React.MouseEvent, taskId: string) {
    e.preventDefault()
    e.stopPropagation()
    await supabase.from('tasks').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', taskId)
    router.refresh()
  }

  // Build the task link
  function taskHref(task: Task): string {
    return `/tasks/${task.id}`
  }

  const overdue = tasks.filter(t => isOverdue(t.due_date))
  const dueToday = tasks.filter(t => isDueToday(t.due_date))
  const upcoming = tasks.filter(t => !isOverdue(t.due_date) && !isDueToday(t.due_date))

  function renderTask(task: Task) {
    const overdue_ = isOverdue(task.due_date)
    return (
      <Link
        key={task.id}
        href={taskHref(task)}
        className={`flex items-start gap-3 p-3 rounded-md border-l-4 ${priorityStyles[task.priority]} ${
          overdue_ ? 'bg-red-50' : 'bg-white'
        } hover:shadow-md transition-shadow`}
      >
        <button
          onClick={(e) => completeTask(e, task.id)}
          className="mt-0.5 w-5 h-5 rounded border-2 border-gray-300 flex items-center justify-center hover:bg-green-50 hover:border-green-500 transition-colors shrink-0"
          title="Mark complete"
        >
          <Check size={12} className="text-transparent hover:text-green-500" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900">{task.title}</p>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <span className="text-xs text-gray-400">{typeIcons[task.type]} {task.type.replace('_', ' ')}</span>
            <span className={`text-xs ${overdue_ ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
              {overdue_ && <AlertCircle size={11} className="inline mr-0.5" />}
              {formatDueDate(task.due_date, task.due_time)}
            </span>
          </div>
          {(task.contacts || task.organizations) && (
            <div className="flex flex-wrap gap-1 mt-1 text-xs text-gray-500">
              {task.contacts && <span>{task.contacts.first_name} {task.contacts.last_name}</span>}
              {task.organizations && <span>{task.contacts ? ' | ' : ''}{task.organizations.name}</span>}
            </div>
          )}
        </div>
      </Link>
    )
  }

  const hasContent = tasks.length > 0 || reminders.length > 0

  if (!hasContent) {
    return (
      <div className="text-center py-8 text-gray-400">
        <CalendarDays size={28} className="mx-auto mb-2 opacity-50" />
        <p className="text-sm">No tasks or reminders</p>
        <p className="text-xs mt-1">Add follow-ups from any contact, deal, or the Tasks page</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {overdue.length > 0 && (
        <div>
          <div className="flex items-center gap-1 mb-2">
            <AlertCircle size={14} className="text-red-500" />
            <span className="text-xs font-semibold text-red-600 uppercase">Overdue ({overdue.length})</span>
          </div>
          <div className="space-y-2">{overdue.map(renderTask)}</div>
        </div>
      )}
      {dueToday.length > 0 && (
        <div>
          <div className="flex items-center gap-1 mb-2">
            <Clock size={14} className="text-amber-500" />
            <span className="text-xs font-semibold text-amber-600 uppercase">Due Today ({dueToday.length})</span>
          </div>
          <div className="space-y-2">{dueToday.map(renderTask)}</div>
        </div>
      )}
      {upcoming.length > 0 && (
        <div>
          <div className="flex items-center gap-1 mb-2">
            <CalendarDays size={14} className="text-blue-500" />
            <span className="text-xs font-semibold text-blue-600 uppercase">Upcoming ({upcoming.length})</span>
          </div>
          <div className="space-y-2">{upcoming.map(renderTask)}</div>
        </div>
      )}
      {reminders.length > 0 && (
        <div>
          <div className="flex items-center gap-1 mb-2">
            <Bell size={14} className="text-purple-500" />
            <span className="text-xs font-semibold text-purple-600 uppercase">Reminders ({reminders.length})</span>
          </div>
          <div className="space-y-2">
            {reminders.map(r => (
              <Link
                key={r.id}
                href={`/contacts/${r.contact_id}`}
                className="flex items-start gap-3 p-3 rounded-md border-l-4 border-l-purple-300 bg-white hover:shadow-md transition-shadow"
              >
                <span className="text-sm mt-0.5">{categoryIcons[r.category] || '📌'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{r.title}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-gray-500">{r.contacts?.first_name} {r.contacts?.last_name}</span>
                    <span className="text-xs text-gray-400">
                      {new Date(r.reminder_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
