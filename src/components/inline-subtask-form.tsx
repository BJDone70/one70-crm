'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Plus, X } from 'lucide-react'

interface Props {
  parentTaskId: string
  contactId?: string | null
  orgId?: string | null
  dealId?: string | null
  reps: { id: string; name: string }[]
  userId: string
}

export default function InlineSubtaskForm({ parentTaskId, contactId, orgId, dealId, reps, userId }: Props) {
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [priority, setPriority] = useState('medium')
  const [assignee, setAssignee] = useState(userId)
  const [dueDate, setDueDate] = useState('')
  const [saving, setSaving] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setSaving(true)
    await supabase.from('tasks').insert({
      title: title.trim(),
      type: 'todo',
      priority,
      status: 'pending',
      parent_task_id: parentTaskId,
      contact_id: contactId || null,
      org_id: orgId || null,
      deal_id: dealId || null,
      assigned_to: assignee || userId,
      due_date: dueDate || null,
      created_by: userId,
    })
    setTitle('')
    setDueDate('')
    setPriority('medium')
    setSaving(false)
    setShowForm(false)
    router.refresh()
  }

  if (!showForm) {
    return (
      <button onClick={() => setShowForm(true)} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium">
        <Plus size={12} /> Add Sub-task
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="border border-blue-200 rounded-lg p-3 bg-blue-50/50 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-blue-700">New Sub-task</p>
        <button type="button" onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
          <X size={14} />
        </button>
      </div>
      <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Sub-task title..."
        className="w-full text-sm border border-one70-border rounded-md px-3 py-2 focus:outline-none focus:border-blue-500" autoFocus />
      <div className="flex flex-wrap gap-2">
        <select value={priority} onChange={e => setPriority(e.target.value)}
          className="text-xs border border-one70-border rounded-md px-2 py-1.5 bg-white">
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
        <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
          className="text-xs border border-one70-border rounded-md px-2 py-1.5 bg-white" />
        <select value={assignee} onChange={e => setAssignee(e.target.value)}
          className="text-xs border border-one70-border rounded-md px-2 py-1.5 bg-white">
          {reps.map(r => (
            <option key={r.id} value={r.id}>{r.name}{r.id === userId ? ' (me)' : ''}</option>
          ))}
        </select>
        <button type="submit" disabled={saving || !title.trim()}
          className="px-3 py-1.5 text-xs bg-one70-black text-white rounded-md font-medium disabled:opacity-30">
          {saving ? 'Adding...' : 'Add'}
        </button>
      </div>
    </form>
  )
}
