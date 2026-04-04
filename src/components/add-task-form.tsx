'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Plus, X, CalendarDays } from 'lucide-react'

interface AddTaskFormProps {
  contactId?: string
  orgId?: string
  dealId?: string
  compact?: boolean
}

export default function AddTaskForm({ contactId, orgId, dealId, compact }: AddTaskFormProps) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [reps, setReps] = useState<any[]>([])
  const [currentUserId, setCurrentUserId] = useState('')
  const router = useRouter()
  const supabase = createClient()

  const [form, setForm] = useState({
    title: '',
    description: '',
    type: 'follow_up',
    priority: 'normal',
    due_date: '',
    due_time: '',
    assigned_to: '',
  })

  useEffect(() => {
    const load = async () => {
      const [repRes, userRes] = await Promise.all([
        supabase.from('profiles').select('id, full_name').eq('is_active', true).order('full_name'),
        supabase.auth.getUser(),
      ])
      if (repRes.data) setReps(repRes.data)
      if (userRes.data.user) {
        setCurrentUserId(userRes.data.user.id)
        setForm(prev => ({ ...prev, assigned_to: prev.assigned_to || userRes.data.user!.id }))
      }
    }
    load()
  }, [supabase])

  function update(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')

    const { error: insertError } = await supabase.from('tasks').insert({
      title: form.title,
      description: form.description || null,
      type: form.type,
      priority: form.priority,
      due_date: form.due_date || null,
      due_time: form.due_time || null,
      contact_id: contactId || null,
      org_id: orgId || null,
      deal_id: dealId || null,
      assigned_to: form.assigned_to || currentUserId,
      created_by: currentUserId,
    })

    if (insertError) {
      setError(insertError.message)
      setSaving(false)
      return
    }

    // Notify assignee if task was assigned to someone else
    if (form.assigned_to && form.assigned_to !== currentUserId) {
      fetch('/api/notifications/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'task_assigned', assigneeId: form.assigned_to, taskTitle: form.title }),
      }).catch(() => {})
    }

    setForm({ title: '', description: '', type: 'follow_up', priority: 'normal', due_date: '', due_time: '', assigned_to: currentUserId })
    setOpen(false)
    setSaving(false)
    window.dispatchEvent(new Event('timeline-refresh'))
    router.refresh()
  }

  const inputClass = "w-full px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className={`flex items-center gap-1 text-sm font-medium text-one70-black hover:underline ${compact ? '' : 'mt-2'}`}
      >
        <CalendarDays size={14} /> Add Follow-up / Task
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="bg-one70-gray rounded-md p-3 space-y-2 mt-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-500 uppercase">New Task</span>
        <button type="button" onClick={() => setOpen(false)}><X size={14} className="text-gray-400" /></button>
      </div>

      <input
        type="text"
        value={form.title}
        onChange={e => update('title', e.target.value)}
        placeholder="What needs to happen?"
        className={inputClass}
        required
      />

      <div className="flex gap-2">
        <select value={form.type} onChange={e => update('type', e.target.value)} className={`${inputClass} w-auto`}>
          <option value="follow_up">Follow-up</option>
          <option value="next_step">Next Step</option>
          <option value="todo">To-do</option>
          <option value="reminder">Reminder</option>
        </select>
        <select value={form.priority} onChange={e => update('priority', e.target.value)} className={`${inputClass} w-auto`}>
          <option value="high">High</option>
          <option value="normal">Normal</option>
          <option value="low">Low</option>
        </select>
      </div>

      {reps.length > 1 && (
        <div>
          <label className="block text-xs text-gray-500 mb-0.5">Assign to</label>
          <select value={form.assigned_to} onChange={e => update('assigned_to', e.target.value)} className={inputClass}>
            {reps.map(r => <option key={r.id} value={r.id}>{r.full_name}</option>)}
          </select>
        </div>
      )}

      <div className="flex gap-2">
        <div className="flex-1">
          <label className="block text-xs text-gray-500 mb-0.5">Due Date</label>
          <input type="date" value={form.due_date} onChange={e => update('due_date', e.target.value)} className={inputClass} />
        </div>
        <div className="w-28">
          <label className="block text-xs text-gray-500 mb-0.5">Time</label>
          <input type="time" value={form.due_time} onChange={e => update('due_time', e.target.value)} className={inputClass} />
        </div>
      </div>

      <textarea
        value={form.description}
        onChange={e => update('description', e.target.value)}
        placeholder="Details (optional)"
        className={inputClass}
        rows={2}
      />

      {error && <div className="text-xs text-red-600">{error}</div>}

      <button
        type="submit"
        disabled={saving}
        className="w-full bg-one70-black text-white py-1.5 rounded-md text-sm font-medium hover:bg-one70-dark transition-colors disabled:opacity-50"
      >
        {saving ? 'Saving...' : 'Save Task'}
      </button>
    </form>
  )
}
