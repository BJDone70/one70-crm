'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import AddressAutocomplete from '@/components/address-autocomplete'

interface PropertyFormProps {
  initialData?: any
  mode: 'create' | 'edit'
  defaultOrgId?: string
}

export default function PropertyForm({ initialData, mode, defaultOrgId }: PropertyFormProps) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [orgs, setOrgs] = useState<any[]>([])
  const [selectedVertical, setSelectedVertical] = useState('')

  const [form, setForm] = useState({
    name: initialData?.name || '',
    address: initialData?.address || '',
    city: initialData?.city || '',
    state: initialData?.state || '',
    org_id: initialData?.org_id || defaultOrgId || '',
    property_type: initialData?.property_type || '',
    unit_count: initialData?.unit_count || '',
    common_area_scope: initialData?.common_area_scope || '',
    key_count: initialData?.key_count || '',
    brand_flag: initialData?.brand_flag || '',
    pip_status: initialData?.pip_status || '',
    pip_deadline: initialData?.pip_deadline || '',
    bed_count: initialData?.bed_count || '',
    acuity_level: initialData?.acuity_level || '',
    notes: initialData?.notes || '',
  })

  useEffect(() => {
    supabase.from('organizations').select('id, name, vertical').is('deleted_at', null).order('name').then(({ data }) => {
      if (data) {
        setOrgs(data)
        if (form.org_id) {
          const org = data.find(o => o.id === form.org_id)
          if (org) setSelectedVertical(org.vertical)
        }
      }
    })
  }, [supabase, form.org_id])

  function update(field: string, value: any) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function handleOrgChange(orgId: string) {
    update('org_id', orgId)
    const org = orgs.find(o => o.id === orgId)
    setSelectedVertical(org?.vertical || '')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const payload = {
      name: form.name,
      address: form.address || null,
      city: form.city || null,
      state: form.state || null,
      org_id: form.org_id,
      property_type: form.property_type || null,
      unit_count: form.unit_count ? parseInt(form.unit_count) : null,
      common_area_scope: form.common_area_scope || null,
      key_count: form.key_count ? parseInt(form.key_count) : null,
      brand_flag: form.brand_flag || null,
      pip_status: form.pip_status || null,
      pip_deadline: form.pip_deadline || null,
      bed_count: form.bed_count ? parseInt(form.bed_count) : null,
      acuity_level: form.acuity_level || null,
      notes: form.notes || null,
    }

    let result
    if (mode === 'create') {
      result = await supabase.from('properties').insert(payload).select().single()
    } else {
      result = await supabase.from('properties').update(payload).eq('id', initialData.id).select().single()
    }

    if (result.error) { setError(result.error.message); setLoading(false); return }
    router.push(`/properties/${result.data.id}`)
    router.refresh()
  }

  const inputClass = "w-full px-3 py-2 border border-one70-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-one70-yellow focus:border-transparent"
  const labelClass = "block text-sm font-medium text-one70-dark mb-1"

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-one70-border p-6 max-w-3xl">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label className={labelClass}>Property Name *</label>
          <input type="text" value={form.name} onChange={e => update('name', e.target.value)} className={inputClass} required placeholder="e.g. Marriott Courtyard - King of Prussia" />
        </div>

        <div className="md:col-span-2">
          <label className={labelClass}>Organization *</label>
          <select value={form.org_id} onChange={e => handleOrgChange(e.target.value)} className={inputClass} required>
            <option value="">Select Organization</option>
            {orgs.map(o => <option key={o.id} value={o.id}>{o.name} ({o.vertical})</option>)}
          </select>
        </div>

        <div className="md:col-span-2">
          <label className={labelClass}>Address</label>
          <AddressAutocomplete
            value={form.address}
            onChange={val => update('address', val)}
            onSelect={result => {
              update('address', result.address || form.address)
              if (result.city) update('city', result.city)
              if (result.state) update('state', result.state)
              if (result.zip) update('zip', result.zip)
            }}
          />
        </div>

        <div>
          <label className={labelClass}>City</label>
          <input type="text" value={form.city} onChange={e => update('city', e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>State</label>
          <input type="text" value={form.state} onChange={e => update('state', e.target.value)} className={inputClass} placeholder="e.g. PA" />
        </div>

        <div>
          <label className={labelClass}>Property Type</label>
          <input type="text" value={form.property_type} onChange={e => update('property_type', e.target.value)} className={inputClass} placeholder="e.g. Garden, Mid-Rise, High-Rise" />
        </div>

        {/* Hotel-specific fields */}
        {(selectedVertical === 'hotel' || selectedVertical === 'hospitality') && (
          <>
            <div>
              <label className={labelClass}>Key Count</label>
              <input type="number" value={form.key_count} onChange={e => update('key_count', e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Brand Flag</label>
              <input type="text" value={form.brand_flag} onChange={e => update('brand_flag', e.target.value)} className={inputClass} placeholder="e.g. Marriott, Hilton, IHG" />
            </div>
            <div>
              <label className={labelClass}>PIP Status</label>
              <select value={form.pip_status} onChange={e => update('pip_status', e.target.value)} className={inputClass}>
                <option value="">Not Set</option>
                <option value="active">Active</option>
                <option value="upcoming">Upcoming</option>
                <option value="completed">Completed</option>
                <option value="none">None</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>PIP Deadline</label>
              <input type="date" value={form.pip_deadline} onChange={e => update('pip_deadline', e.target.value)} className={inputClass} />
            </div>
          </>
        )}

        {/* Multifamily-specific fields */}
        {selectedVertical === 'multifamily' && (
          <>
            <div>
              <label className={labelClass}>Unit Count</label>
              <input type="number" value={form.unit_count} onChange={e => update('unit_count', e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Common Area Scope</label>
              <input type="text" value={form.common_area_scope} onChange={e => update('common_area_scope', e.target.value)} className={inputClass} placeholder="e.g. Lobbies, hallways, fitness center" />
            </div>
          </>
        )}

        {/* Senior Living-specific fields */}
        {selectedVertical === 'senior_living' && (
          <>
            <div>
              <label className={labelClass}>Bed Count</label>
              <input type="number" value={form.bed_count} onChange={e => update('bed_count', e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Acuity Level</label>
              <select value={form.acuity_level} onChange={e => update('acuity_level', e.target.value)} className={inputClass}>
                <option value="">Not Set</option>
                <option value="independent">Independent Living</option>
                <option value="assisted">Assisted Living</option>
                <option value="memory_care">Memory Care</option>
                <option value="skilled_nursing">Skilled Nursing</option>
                <option value="mixed">Mixed / CCRC</option>
              </select>
            </div>
          </>
        )}

        <div className="md:col-span-2">
          <label className={labelClass}>Notes</label>
          <textarea value={form.notes} onChange={e => update('notes', e.target.value)} className={inputClass} rows={3} />
        </div>
      </div>

      {error && <div className="mt-4 bg-red-50 text-red-700 px-3 py-2 rounded-md text-sm">{error}</div>}
      <div className="mt-6 flex gap-3">
        <button type="submit" disabled={loading} className="bg-one70-black text-white px-6 py-2.5 rounded-md text-sm font-semibold hover:bg-one70-dark transition-colors disabled:opacity-50">
          {loading ? 'Saving...' : mode === 'create' ? 'Create Property' : 'Save Changes'}
        </button>
        <button type="button" onClick={() => router.back()} className="px-6 py-2.5 rounded-md text-sm font-medium text-one70-mid border border-one70-border hover:bg-one70-gray transition-colors">Cancel</button>
      </div>
    </form>
  )
}
