'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { PIPELINE_STAGES, LOST_STAGE } from '@/lib/stages'
import { useVerticals } from '@/hooks/use-verticals'
import VerticalSelector from '@/components/vertical-selector'

interface DealFormProps {
  initialData?: any
  mode: 'create' | 'edit'
  defaultOrgId?: string
  defaultContactId?: string
  defaultPropertyId?: string
}

const STAGES = PIPELINE_STAGES

export default function DealForm({ initialData, mode, defaultOrgId, defaultContactId, defaultPropertyId }: DealFormProps) {
  const router = useRouter()
  const supabase = createClient()
  const { verticals, addVertical } = useVerticals()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [orgs, setOrgs] = useState<any[]>([])
  const [contacts, setContacts] = useState<any[]>([])
  const [properties, setProperties] = useState<any[]>([])
  const [reps, setReps] = useState<any[]>([])

  const [form, setForm] = useState({
    name: initialData?.name || '',
    org_id: initialData?.org_id || defaultOrgId || '',
    contact_id: initialData?.contact_id || defaultContactId || '',
    property_id: initialData?.property_id || defaultPropertyId || '',
    vertical: initialData?.vertical || 'multifamily',
    verticals: initialData?.verticals?.length ? initialData.verticals : [initialData?.vertical || 'multifamily'],
    stage: initialData?.stage || 'new_lead',
    value: initialData?.value || '',
    expected_close: initialData?.expected_close || '',
    assigned_to: initialData?.assigned_to || '',
    services_offered: initialData?.services_offered || '',
    message_theme: initialData?.message_theme || '',
    loss_reason: initialData?.loss_reason || '',
    notes: initialData?.notes || '',
  })

  useEffect(() => {
    const load = async () => {
      const [orgRes, repRes] = await Promise.all([
        supabase.from('organizations').select('id, name, vertical').is('deleted_at', null).order('name'),
        supabase.from('profiles').select('id, full_name').eq('is_active', true).order('full_name'),
      ])
      if (orgRes.data) setOrgs(orgRes.data)
      if (repRes.data) setReps(repRes.data)

      // Set default assigned_to to current user
      if (!form.assigned_to) {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) setForm(prev => ({ ...prev, assigned_to: prev.assigned_to || user.id }))
      }
    }
    load()
  }, [supabase])

  // Load contacts and properties when org changes
  useEffect(() => {
    if (form.org_id) {
      supabase.from('contacts').select('id, first_name, last_name').is('deleted_at', null).eq('org_id', form.org_id).order('last_name').then(({ data }) => {
        setContacts(data || [])
      })
      supabase.from('properties').select('id, name').is('deleted_at', null).eq('org_id', form.org_id).order('name').then(({ data }) => {
        setProperties(data || [])
      })
      // Auto-set vertical from org
      const org = orgs.find(o => o.id === form.org_id)
      if (org && !initialData) {
        const orgVerts = org.verticals?.length ? org.verticals : [org.vertical]
        setForm(prev => ({ ...prev, vertical: orgVerts[0], verticals: orgVerts }))
      }
    } else {
      setContacts([])
      setProperties([])
    }
  }, [form.org_id, orgs, supabase, initialData])

  function update(field: string, value: any) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function updateVerticals(vals: string[]) {
    setForm(prev => ({ ...prev, verticals: vals, vertical: vals[0] || 'multifamily' }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const payload = {
      name: form.name,
      org_id: form.org_id || null,
      contact_id: form.contact_id || null,
      property_id: form.property_id || null,
      vertical: form.verticals[0] || form.vertical,
      verticals: form.verticals,
      stage: form.stage,
      value: form.value ? parseFloat(form.value) : null,
      expected_close: form.expected_close || null,
      assigned_to: form.assigned_to || null,
      services_offered: form.services_offered || null,
      message_theme: form.message_theme || null,
      loss_reason: form.loss_reason || null,
      notes: form.notes || null,
    }

    let result
    if (mode === 'create') {
      result = await supabase.from('deals').insert(payload).select().single()
    } else {
      result = await supabase.from('deals').update(payload).eq('id', initialData.id).select().single()
    }

    if (result.error) {
      setError(result.error.message)
      setLoading(false)
      return
    }

    router.push(`/deals/${result.data.id}`)
    router.refresh()
  }

  const inputClass = "w-full px-3 py-2 border border-one70-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-one70-yellow focus:border-transparent"
  const labelClass = "block text-sm font-medium text-one70-dark mb-1"

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-one70-border p-6 max-w-3xl">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Deal name */}
        <div className="md:col-span-2">
          <label className={labelClass}>Deal Name *</label>
          <input type="text" value={form.name} onChange={e => update('name', e.target.value)} className={inputClass} required
            placeholder="e.g. Morgan Properties - Common Area Renovation Program" />
        </div>

        {/* Organization */}
        <div>
          <label className={labelClass}>Organization</label>
          <select value={form.org_id} onChange={e => update('org_id', e.target.value)} className={inputClass}>
            <option value="">Select Organization</option>
            {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </div>

        {/* Vertical */}
        <div>
          <label className={labelClass}>Vertical *</label>
          <VerticalSelector verticals={verticals} value={form.verticals}
            onChange={updateVerticals} addVertical={addVertical}
            multi />
        </div>

        {/* Contact */}
        <div>
          <label className={labelClass}>Primary Contact</label>
          <select value={form.contact_id} onChange={e => update('contact_id', e.target.value)} className={inputClass}>
            <option value="">Select Contact</option>
            {contacts.map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
          </select>
          {!form.org_id && <p className="text-xs text-gray-400 mt-0.5">Select an organization first</p>}
        </div>

        {/* Property */}
        <div>
          <label className={labelClass}>Property</label>
          <select value={form.property_id} onChange={e => update('property_id', e.target.value)} className={inputClass}>
            <option value="">Select Property (optional)</option>
            {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        {/* Stage */}
        <div>
          <label className={labelClass}>Stage</label>
          <select value={form.stage} onChange={e => update('stage', e.target.value)} className={inputClass}>
            {STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>

        {/* Assigned to */}
        <div>
          <label className={labelClass}>Assigned To</label>
          <select value={form.assigned_to} onChange={e => update('assigned_to', e.target.value)} className={inputClass}>
            <option value="">Unassigned</option>
            {reps.map(r => <option key={r.id} value={r.id}>{r.full_name}</option>)}
          </select>
        </div>

        {/* Value */}
        <div>
          <label className={labelClass}>Deal Value ($)</label>
          <input type="number" value={form.value} onChange={e => update('value', e.target.value)} className={inputClass}
            placeholder="e.g. 250000" step="0.01" />
        </div>

        {/* Expected close */}
        <div>
          <label className={labelClass}>Expected Close Date</label>
          <input type="date" value={form.expected_close} onChange={e => update('expected_close', e.target.value)} className={inputClass} />
        </div>

        {/* Services offered */}
        <div className="md:col-span-2">
          <label className={labelClass}>Services to Lead With</label>
          <input type="text" value={form.services_offered} onChange={e => update('services_offered', e.target.value)} className={inputClass}
            placeholder="e.g. Guestroom PIP, Corridors, Lobby Remodel" />
        </div>

        {/* Message theme */}
        <div className="md:col-span-2">
          <label className={labelClass}>Message Theme</label>
          <input type="text" value={form.message_theme} onChange={e => update('message_theme', e.target.value)} className={inputClass}
            placeholder="e.g. PIP compliance risk, RevPAR protection" />
        </div>

        {/* Loss reason (only show if stage is lost) */}
        {form.stage === 'lost' && (
          <div className="md:col-span-2">
            <label className={labelClass}>Loss Reason</label>
            <input type="text" value={form.loss_reason} onChange={e => update('loss_reason', e.target.value)} className={inputClass}
              placeholder="e.g. Went with competitor, Budget cut, Timing" />
          </div>
        )}

        {/* Notes */}
        <div className="md:col-span-2">
          <label className={labelClass}>Notes</label>
          <textarea value={form.notes} onChange={e => update('notes', e.target.value)} className={inputClass} rows={3} />
        </div>
      </div>

      {error && <div className="mt-4 bg-red-50 text-red-700 px-3 py-2 rounded-md text-sm">{error}</div>}

      <div className="mt-6 flex gap-3">
        <button type="submit" disabled={loading}
          className="bg-one70-black text-white px-6 py-2.5 rounded-md text-sm font-semibold hover:bg-one70-dark transition-colors disabled:opacity-50">
          {loading ? 'Saving...' : mode === 'create' ? 'Create Deal' : 'Save Changes'}
        </button>
        <button type="button" onClick={() => router.back()}
          className="px-6 py-2.5 rounded-md text-sm font-medium text-one70-mid border border-one70-border hover:bg-one70-gray transition-colors">
          Cancel
        </button>
      </div>
    </form>
  )
}
