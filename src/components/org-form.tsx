'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { DEFAULT_VERTICALS, formatVerticalLabel } from '@/lib/verticals'
import { useOrgRoles } from '@/hooks/use-org-roles'
import { useVerticals } from '@/hooks/use-verticals'
import VerticalSelector from '@/components/vertical-selector'

interface OrgFormProps {
  initialData?: any
  mode: 'create' | 'edit'
}

export default function OrgForm({ initialData, mode }: OrgFormProps) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { verticals: verticalOptions, addVertical } = useVerticals()
  const { roles: orgRoles, addRole: addOrgRole } = useOrgRoles()
  const [showAddRole, setShowAddRole] = useState(false)
  const [newRoleName, setNewRoleName] = useState('')

  const [form, setForm] = useState({
    name: initialData?.name || '',
    vertical: initialData?.vertical || 'multifamily',
    verticals: initialData?.verticals?.length ? initialData.verticals : [initialData?.vertical || 'multifamily'],
    org_role: initialData?.org_role || '',
    hq_city: initialData?.hq_city || '',
    hq_state: initialData?.hq_state || '',
    portfolio_size: initialData?.portfolio_size || '',
    annual_spend: initialData?.annual_spend || '',
    website: initialData?.website || '',
    linkedin_url: initialData?.linkedin_url || '',
    phone: initialData?.phone || '',
    priority_rating: initialData?.priority_rating || '',
    source: initialData?.source || '',
    notes: initialData?.notes || '',
  })


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
      ...form,
      vertical: form.verticals[0] || form.vertical,
      portfolio_size: form.portfolio_size ? parseInt(form.portfolio_size) : null,
      priority_rating: form.priority_rating || null,
      org_role: form.org_role || null,
    }

    let result
    if (mode === 'create') {
      result = await supabase.from('organizations').insert(payload).select().single()
    } else {
      result = await supabase.from('organizations').update(payload).eq('id', initialData.id).select().single()
    }

    if (result.error) {
      setError(result.error.message)
      setLoading(false)
      return
    }

    router.push(`/organizations/${result.data.id}`)
    router.refresh()
  }

  const inputClass = "w-full px-3 py-2 border border-one70-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-one70-yellow focus:border-transparent"
  const labelClass = "block text-sm font-medium text-one70-dark mb-1"

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-one70-border p-6 max-w-3xl">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Name */}
        <div className="md:col-span-2">
          <label className={labelClass}>Organization Name *</label>
          <input type="text" value={form.name} onChange={e => update('name', e.target.value)} className={inputClass} required />
        </div>

        {/* Vertical(s) */}
        <div>
          <label className={labelClass}>Verticals *</label>
          <VerticalSelector
            verticals={verticalOptions}
            value={form.verticals}
            onChange={updateVerticals}
            addVertical={addVertical}
            multi
          />
        </div>

        {/* Role */}
        <div>
          <label className={labelClass}>Role</label>
          <div className="flex gap-2">
            <select value={form.org_role} onChange={e => update('org_role', e.target.value)} className={`${inputClass} flex-1`}>
              <option value="">Not Set</option>
              {orgRoles.map(r => <option key={r.name} value={r.name}>{r.label}</option>)}
            </select>
            {!showAddRole ? (
              <button type="button" onClick={() => setShowAddRole(true)}
                className="px-2 border border-one70-border rounded-md text-one70-mid hover:text-one70-black hover:bg-one70-gray transition-colors">
                <Plus size={16} />
              </button>
            ) : (
              <div className="flex gap-1">
                <input type="text" value={newRoleName} onChange={e => setNewRoleName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addOrgRole(newRoleName).then(name => { if (name) update('org_role', name); setNewRoleName(''); setShowAddRole(false) }) } }}
                  placeholder="New role" className="w-32 px-2 py-1 text-xs border border-one70-border rounded" autoFocus />
                <button type="button" onClick={async () => {
                  const name = await addOrgRole(newRoleName)
                  if (name) update('org_role', name)
                  setNewRoleName(''); setShowAddRole(false)
                }} className="px-2 py-1 text-xs bg-one70-black text-white rounded">Add</button>
                <button type="button" onClick={() => { setShowAddRole(false); setNewRoleName('') }} className="px-1 text-xs text-gray-400">✕</button>
              </div>
            )}
          </div>
        </div>

        {/* Priority */}
        <div>
          <label className={labelClass}>Priority Rating</label>
          <select value={form.priority_rating} onChange={e => update('priority_rating', e.target.value)} className={inputClass}>
            <option value="">Not Set</option>
            <option value="high">High</option>
            <option value="medium_high">Medium-High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>

        {/* City */}
        <div>
          <label className={labelClass}>HQ City</label>
          <input type="text" value={form.hq_city} onChange={e => update('hq_city', e.target.value)} className={inputClass} />
        </div>

        {/* State */}
        <div>
          <label className={labelClass}>HQ State</label>
          <input type="text" value={form.hq_state} onChange={e => update('hq_state', e.target.value)} className={inputClass} placeholder="e.g. PA" />
        </div>

        {/* Portfolio Size */}
        <div>
          <label className={labelClass}>Portfolio Size (# properties)</label>
          <input type="number" value={form.portfolio_size} onChange={e => update('portfolio_size', e.target.value)} className={inputClass} />
        </div>

        {/* Annual Spend */}
        <div>
          <label className={labelClass}>Annual Renovation Spend</label>
          <input type="text" value={form.annual_spend} onChange={e => update('annual_spend', e.target.value)} className={inputClass} placeholder="e.g. $2M-$5M" />
        </div>

        {/* Website */}
        <div>
          <label className={labelClass}>Website</label>
          <input type="text" value={form.website} onChange={e => update('website', e.target.value)} className={inputClass} placeholder="https://" />
        </div>
        {/* LinkedIn */}
        <div>
          <label className={labelClass}>LinkedIn</label>
          <input type="text" value={form.linkedin_url} onChange={e => update('linkedin_url', e.target.value)} className={inputClass} placeholder="https://linkedin.com/company/..." />
        </div>

        {/* Phone */}
        <div>
          <label className={labelClass}>Phone</label>
          <input type="text" value={form.phone} onChange={e => update('phone', e.target.value)} className={inputClass} />
        </div>

        {/* Source */}
        <div>
          <label className={labelClass}>Lead Source</label>
          <input type="text" value={form.source} onChange={e => update('source', e.target.value)} className={inputClass} placeholder="e.g. Apollo, Referral, Conference" />
        </div>

        {/* Notes */}
        <div className="md:col-span-2">
          <label className={labelClass}>Notes</label>
          <textarea value={form.notes} onChange={e => update('notes', e.target.value)} className={inputClass} rows={3} />
        </div>
      </div>

      {error && (
        <div className="mt-4 bg-red-50 text-red-700 px-3 py-2 rounded-md text-sm">{error}</div>
      )}

      <div className="mt-6 flex gap-3">
        <button
          type="submit"
          disabled={loading}
          className="bg-one70-black text-white px-6 py-2.5 rounded-md text-sm font-semibold hover:bg-one70-dark transition-colors disabled:opacity-50"
        >
          {loading ? 'Saving...' : mode === 'create' ? 'Create Organization' : 'Save Changes'}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="px-6 py-2.5 rounded-md text-sm font-medium text-one70-mid border border-one70-border hover:bg-one70-gray transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
