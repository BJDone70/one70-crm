'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import SearchableSelect from '@/components/searchable-select'

interface TaskFormProps {
  initialData?: any
  mode: 'create' | 'edit'
  parentTaskId?: string
}

export default function TaskForm({ initialData, mode, parentTaskId }: TaskFormProps) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [orgs, setOrgs] = useState<any[]>([])
  const [contacts, setContacts] = useState<any[]>([])
  const [deals, setDeals] = useState<any[]>([])

  const [form, setForm] = useState({
    title: initialData?.title || '',
    description: initialData?.description || '',
    type: initialData?.type || 'follow_up',
    priority: initialData?.priority || 'normal',
    due_date: initialData?.due_date || '',
    due_time: initialData?.due_time?.substring(0, 5) || '',
    assigned_to: initialData?.assigned_to || '',
    contact_id: initialData?.contact_id || '',
    org_id: initialData?.org_id || '',
    deal_id: initialData?.deal_id || '',
    is_private: initialData?.is_private || false,
  })

  const [reps, setReps] = useState<any[]>([])

  useEffect(() => {
    const load = async () => {
      const [orgRes, contactRes, dealRes, repRes] = await Promise.all([
        supabase.from('organizations').select('id, name').is('deleted_at', null).order('name'),
        supabase.from('contacts').select('id, first_name, last_name, org_id, organizations(name)').is('deleted_at', null).order('last_name'),
        supabase.from('deals').select('id, name').is('deleted_at', null).order('name'),
        supabase.from('profiles').select('id, full_name').eq('is_active', true).order('full_name'),
      ])
      if (orgRes.data) setOrgs(orgRes.data)
      if (contactRes.data) setContacts(contactRes.data)
      if (dealRes.data) setDeals(dealRes.data)
      if (repRes.data) setReps(repRes.data)

      // Default assigned_to to current user if not set
      if (!form.assigned_to) {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) setForm(prev => ({ ...prev, assigned_to: prev.assigned_to || user.id }))
      }
    }
    load()
  }, [supabase])

  function update(field: string, value: any) {
    setForm(prev => ({ ...prev, [field]: value }))
    // Auto-fill organization when contact is selected
    if (field === 'contact_id' && value) {
      const contact = contacts.find(c => c.id === value) as any
      if (contact?.org_id && !form.org_id) {
        setForm(prev => ({ ...prev, [field]: value, org_id: contact.org_id }))
      }
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const payload: any = {
      title: form.title,
      description: form.description || null,
      type: form.type,
      priority: form.priority,
      due_date: form.due_date || null,
      due_time: form.due_time || null,
      contact_id: form.contact_id || null,
      org_id: form.org_id || null,
      deal_id: form.deal_id || null,
      assigned_to: form.assigned_to || user.id,
      is_private: form.is_private,
      created_by: user.id,
    }
    if (mode === 'create' && parentTaskId) {
      payload.parent_task_id = parentTaskId
    }

    let result
    if (mode === 'create') {
      result = await supabase.from('tasks').insert(payload).select().single()
    } else {
      // Don't overwrite created_by on edit
      const { created_by, ...updatePayload } = payload
      result = await supabase.from('tasks').update(updatePayload).eq('id', initialData.id).select().single()
    }

    if (result.error) {
      setError(result.error.message)
      setLoading(false)
      return
    }

    // Notify assignee if task was assigned to someone else
    if (mode === 'create' && form.assigned_to && form.assigned_to !== user.id) {
      fetch('/api/notifications/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'task_assigned', assigneeId: form.assigned_to, taskTitle: form.title }),
      }).catch(() => {}) // fire and forget
    }

    router.push('/tasks')
    router.refresh()
  }

  async function handleDelete() {
    if (!confirm('Delete this task?')) return
    setLoading(true)
    await supabase.from('tasks').update({ deleted_at: new Date().toISOString() }).eq('id', initialData.id)
    router.push('/tasks')
    router.refresh()
  }

  const inputClass = "w-full px-3 py-2 border border-one70-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-one70-yellow focus:border-transparent"
  const labelClass = "block text-sm font-medium text-one70-dark mb-1"

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-one70-border p-6 max-w-2xl">
      <div className="space-y-4">
        <div>
          <label className={labelClass}>What needs to happen? *</label>
          <input type="text" value={form.title} onChange={e => update('title', e.target.value)} className={inputClass} required
            placeholder="e.g. Follow up with John about PIP timeline" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className={labelClass}>Type</label>
            <select value={form.type} onChange={e => update('type', e.target.value)} className={inputClass}>
              <option value="follow_up">Follow-up</option>
              <option value="next_step">Next Step</option>
              <option value="todo">To-do</option>
              <option value="reminder">Reminder</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Priority</label>
            <select value={form.priority} onChange={e => update('priority', e.target.value)} className={inputClass}>
              <option value="high">High</option>
              <option value="normal">Normal</option>
              <option value="low">Low</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Assigned To</label>
            <select value={form.assigned_to} onChange={e => update('assigned_to', e.target.value)} className={inputClass}>
              {reps.map(r => <option key={r.id} value={r.id}>{r.full_name}</option>)}
            </select>
          </div>
        </div>

        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={form.is_private} onChange={e => update('is_private', e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-one70-black focus:ring-one70-yellow" />
          <span className="text-sm text-gray-700">Private task</span>
          <span className="text-xs text-gray-400">(only visible to you)</span>
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Due Date</label>
            <input type="date" value={form.due_date} onChange={e => update('due_date', e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Due Time</label>
            <input type="time" value={form.due_time} onChange={e => update('due_time', e.target.value)} className={inputClass} />
          </div>
        </div>

        <div>
          <label className={labelClass}>Details</label>
          <textarea value={form.description} onChange={e => update('description', e.target.value)} className={inputClass} rows={3}
            placeholder="Additional context or notes" />
        </div>

        <div className="border-t border-one70-border pt-4 mt-4">
          <p className="text-xs font-semibold text-one70-mid uppercase tracking-wider mb-3">Link to (optional)</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>Contact</label>
              <SearchableSelect
                value={form.contact_id}
                onChange={v => update('contact_id', v)}
                placeholder="Search contacts..."
                options={contacts.map(c => ({
                  id: c.id,
                  label: `${c.first_name} ${c.last_name}`,
                  sub: (c as any).organizations?.name || undefined,
                }))}
              />
            </div>
            <div>
              <label className={labelClass}>Organization</label>
              <SearchableSelect
                value={form.org_id}
                onChange={v => update('org_id', v)}
                placeholder="Search orgs..."
                options={orgs.map(o => ({ id: o.id, label: o.name }))}
              />
            </div>
            <div>
              <label className={labelClass}>Deal</label>
              <SearchableSelect
                value={form.deal_id}
                onChange={v => update('deal_id', v)}
                placeholder="Search deals..."
                options={deals.map(d => ({ id: d.id, label: d.name }))}
              />
            </div>
          </div>
        </div>
      </div>

      {error && <div className="mt-4 bg-red-50 text-red-700 px-3 py-2 rounded-md text-sm">{error}</div>}

      <div className="mt-6 flex gap-3">
        <button type="submit" disabled={loading}
          className="bg-one70-black text-white px-6 py-2.5 rounded-md text-sm font-semibold hover:bg-one70-dark transition-colors disabled:opacity-50">
          {loading ? 'Saving...' : mode === 'create' ? 'Create Task' : 'Save Changes'}
        </button>
        <button type="button" onClick={() => router.back()}
          className="px-6 py-2.5 rounded-md text-sm font-medium text-one70-mid border border-one70-border hover:bg-one70-gray transition-colors">
          Cancel
        </button>
        {mode === 'edit' && (
          <button type="button" onClick={handleDelete}
            className="ml-auto px-4 py-2.5 rounded-md text-sm font-medium text-red-600 hover:bg-red-50 transition-colors">
            Delete
          </button>
        )}
      </div>
    </form>
  )
}
