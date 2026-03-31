'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Plus, X } from 'lucide-react'

interface AddActivityFormProps {
  orgId?: string
  contactId?: string
  dealId?: string
}

export default function AddActivityForm({ orgId, contactId, dealId }: AddActivityFormProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [type, setType] = useState('note')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [direction, setDirection] = useState<string>('')
  const router = useRouter()
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error: insertError } = await supabase.from('activities').insert({
      type,
      subject: subject || null,
      body: body || null,
      direction: direction || null,
      org_id: orgId || null,
      contact_id: contactId || null,
      deal_id: dealId || null,
      user_id: user.id,
    })

    if (insertError) {
      setError(insertError.message)
      setLoading(false)
      return
    }

    setType('note')
    setSubject('')
    setBody('')
    setDirection('')
    setError('')
    setOpen(false)
    setLoading(false)
    window.dispatchEvent(new Event('timeline-refresh'))
    router.refresh()
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 text-sm font-medium text-one70-black hover:underline"
      >
        <Plus size={14} /> Log Activity
      </button>
    )
  }

  const inputClass = "w-full px-3 py-1.5 border border-one70-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-one70-yellow focus:border-transparent"

  return (
    <form onSubmit={handleSubmit} className="bg-one70-gray rounded-md p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-one70-mid uppercase">New Activity</span>
        <button type="button" onClick={() => setOpen(false)}><X size={14} className="text-one70-mid" /></button>
      </div>
      <div className="flex gap-2">
        <select value={type} onChange={e => setType(e.target.value)} className={`${inputClass} w-auto`}>
          <option value="note">Note</option>
          <option value="call">Call</option>
          <option value="email">Email</option>
          <option value="meeting">Meeting</option>
          <option value="linkedin">LinkedIn</option>
          <option value="text">Text</option>
          <option value="site_visit">Site Visit</option>
          <option value="other">Other</option>
        </select>
        {['call', 'email', 'text', 'linkedin'].includes(type) && (
          <select value={direction} onChange={e => setDirection(e.target.value)} className={`${inputClass} w-auto`}>
            <option value="">Direction</option>
            <option value="outbound">Outbound</option>
            <option value="inbound">Inbound</option>
          </select>
        )}
      </div>
      <input type="text" value={subject} onChange={e => setSubject(e.target.value)} placeholder="Subject" className={inputClass} />
      <textarea value={body} onChange={e => setBody(e.target.value)} placeholder="Details..." className={inputClass} rows={2} />
      {error && <div className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded">{error}</div>}
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-one70-black text-white py-1.5 rounded-md text-sm font-medium hover:bg-one70-dark transition-colors disabled:opacity-50"
      >
        {loading ? 'Saving...' : 'Save'}
      </button>
    </form>
  )
}
