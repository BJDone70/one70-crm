'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Star, Plus, X, Trash2, Bell } from 'lucide-react'

interface KeyNote {
  id: string
  category: string
  title: string
  note: string | null
  reminder_date: string | null
  reminder_recurring: boolean
}

interface KeyNotesProps {
  contactId: string
  notes: KeyNote[]
}

const categoryIcons: Record<string, string> = {
  birthday: '🎂', anniversary: '💍', holiday: '🎄', preference: '⭐',
  family: '👨‍👩‍👧‍👦', hobby: '🎯', important_date: '📅', other: '📌',
}

const categoryLabels: Record<string, string> = {
  birthday: 'Birthday', anniversary: 'Anniversary', holiday: 'Holiday', preference: 'Preference',
  family: 'Family', hobby: 'Hobby/Interest', important_date: 'Important Date', other: 'Other',
}

export default function KeyNotes({ contactId, notes }: KeyNotesProps) {
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const supabase = createClient()
  const router = useRouter()

  const [form, setForm] = useState({
    category: 'preference',
    title: '',
    note: '',
    reminder_date: '',
    reminder_recurring: false,
  })

  function update(field: string, value: any) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase.from('key_notes').insert({
      contact_id: contactId,
      category: form.category,
      title: form.title,
      note: form.note || null,
      reminder_date: form.reminder_date || null,
      reminder_recurring: form.reminder_recurring,
      created_by: user.id,
    })

    setForm({ category: 'preference', title: '', note: '', reminder_date: '', reminder_recurring: false })
    setAdding(false)
    setSaving(false)
    router.refresh()
  }

  async function handleDelete(id: string) {
    setDeleting(id)
    await supabase.from('key_notes').delete().eq('id', id)
    setDeleting(null)
    router.refresh()
  }

  const inputClass = "w-full px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"

  return (
    <div className="bg-white rounded-lg border border-one70-border p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-one70-mid uppercase tracking-wider flex items-center gap-1">
          <Star size={14} /> Key Notes
        </h2>
        <button onClick={() => setAdding(!adding)} className="text-sm font-medium text-one70-black hover:underline">
          {adding ? 'Cancel' : '+ Add'}
        </button>
      </div>

      {adding && (
        <form onSubmit={handleSave} className="bg-one70-gray rounded-md p-3 space-y-2 mb-3">
          <div className="flex gap-2">
            <select value={form.category} onChange={e => update('category', e.target.value)} className={`${inputClass} w-auto`}>
              {Object.entries(categoryLabels).map(([k, v]) => (
                <option key={k} value={k}>{categoryIcons[k]} {v}</option>
              ))}
            </select>
          </div>
          <input
            type="text"
            value={form.title}
            onChange={e => update('title', e.target.value)}
            placeholder="e.g. Loves fishing, Daughter named Emma, Allergic to shellfish"
            className={inputClass}
            required
          />
          <textarea
            value={form.note}
            onChange={e => update('note', e.target.value)}
            placeholder="Additional details (optional)"
            className={inputClass}
            rows={2}
          />
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-0.5">Reminder Date</label>
              <input type="date" value={form.reminder_date} onChange={e => update('reminder_date', e.target.value)} className={inputClass} />
            </div>
            <label className="flex items-center gap-1.5 px-2 py-1.5 text-xs cursor-pointer">
              <input type="checkbox" checked={form.reminder_recurring} onChange={e => update('reminder_recurring', e.target.checked)} className="rounded" />
              Yearly
            </label>
          </div>
          <button type="submit" disabled={saving}
            className="w-full bg-one70-black text-white py-1.5 rounded-md text-sm font-medium hover:bg-one70-dark transition-colors disabled:opacity-50">
            {saving ? 'Saving...' : 'Save Note'}
          </button>
        </form>
      )}

      {notes.length > 0 ? (
        <div className="space-y-2">
          {notes.map(n => (
            <div key={n.id} className="flex items-start gap-2 p-2 rounded-md hover:bg-one70-gray transition-colors group">
              <span className="text-sm mt-0.5">{categoryIcons[n.category] || '📌'}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">{n.title}</p>
                {n.note && <p className="text-xs text-gray-500 mt-0.5 whitespace-pre-wrap">{n.note}</p>}
                {n.reminder_date && (
                  <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                    <Bell size={10} />
                    {new Date(n.reminder_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    {n.reminder_recurring && ' (yearly)'}
                  </p>
                )}
              </div>
              <button
                onClick={() => handleDelete(n.id)}
                disabled={deleting === n.id}
                className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-all"
                title="Delete"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      ) : !adding ? (
        <p className="text-sm text-gray-400 py-3 text-center">No key notes yet. Add birthdays, preferences, and personal details.</p>
      ) : null}
    </div>
  )
}
