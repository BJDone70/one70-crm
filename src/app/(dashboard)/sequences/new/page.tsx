'use client'

import { useVerticals } from '@/hooks/use-verticals'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import PillFilter from '@/components/pill-filter'

export default function NewSequencePage() {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [vertical, setVertical] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const supabase = createClient()
  const router = useRouter()
  const { verticals } = useVerticals()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError('Name is required'); return }
    setSaving(true)
    setError('')

    const { data, error: err } = await supabase.from('sequences').insert({
      name: name.trim(),
      description: description.trim() || null,
      vertical: vertical || null,
    }).select('id').single()

    if (err) { setError(err.message); setSaving(false); return }
    router.push(`/sequences/${data.id}`)
  }

  const inputClass = "w-full px-3 py-2 border border-one70-border rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-one70-yellow"

  return (
    <div>
      <Link href="/sequences" className="flex items-center gap-1 text-sm text-one70-mid hover:text-one70-dark mb-4">
        <ArrowLeft size={16} /> Back to Sequences
      </Link>
      <h1 className="text-2xl font-bold text-one70-black mb-6">New Sequence</h1>
      <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-one70-border p-6 max-w-lg space-y-4">
        <div>
          <label className="block text-sm font-semibold text-one70-dark mb-1">Name *</label>
          <input value={name} onChange={e => setName(e.target.value)} className={inputClass} placeholder="e.g. Hotel PIP Cold Outreach" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-one70-dark mb-1">Description</label>
          <input value={description} onChange={e => setDescription(e.target.value)} className={inputClass} placeholder="What is this sequence for?" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-one70-dark mb-2">Vertical (optional)</label>
          <PillFilter
            options={verticals}
            value={vertical}
            onChange={setVertical}
          />
        </div>
        {error && <div className="bg-red-50 text-red-700 px-3 py-2 rounded-md text-sm">{error}</div>}
        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={saving}
            className="bg-one70-black text-white px-6 py-2.5 rounded-md text-sm font-semibold hover:bg-one70-dark disabled:opacity-50 transition-colors">
            {saving ? 'Creating...' : 'Create Sequence'}
          </button>
          <Link href="/sequences" className="px-4 py-2.5 text-sm text-one70-mid hover:text-one70-dark">Cancel</Link>
        </div>
      </form>
    </div>
  )
}
