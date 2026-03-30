'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import ContactImportTools from '@/components/contact-import-tools'
import { useContactTypes } from '@/hooks/use-contact-types'
import { useVerticals } from '@/hooks/use-verticals'
import { Plus } from 'lucide-react'

interface ContactFormProps {
  initialData?: any
  mode: 'create' | 'edit'
  defaultOrgId?: string
  prefill?: Record<string, string>
}

export default function ContactForm({ initialData, mode, defaultOrgId, prefill }: ContactFormProps) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [orgs, setOrgs] = useState<any[]>([])
  const [showNewOrg, setShowNewOrg] = useState(false)
  const [newOrgName, setNewOrgName] = useState('')
  const [newOrgVertical, setNewOrgVertical] = useState('multifamily')
  const [newOrgCity, setNewOrgCity] = useState('')
  const [newOrgState, setNewOrgState] = useState('')
  const [creatingOrg, setCreatingOrg] = useState(false)

  const contactTypes = useContactTypes()
  const { verticals } = useVerticals()
  const [additionalOrgs, setAdditionalOrgs] = useState<{org_id: string; role: string}[]>([])
  const [newTypeName, setNewTypeName] = useState('')
  const [showAddType, setShowAddType] = useState(false)

  const [form, setForm] = useState({
    first_name: initialData?.first_name || '',
    last_name: initialData?.last_name || '',
    title: initialData?.title || '',
    email: initialData?.email || '',
    phone: initialData?.phone || '',
    mobile_phone: initialData?.mobile_phone || '',
    linkedin_url: initialData?.linkedin_url || '',
    org_id: initialData?.org_id || defaultOrgId || '',
    contact_type: initialData?.contact_type || 'prospect',
    rating: initialData?.rating || 'cold',
    avatar_url: initialData?.avatar_url || '',
    is_decision_maker: initialData?.is_decision_maker || false,
    is_prime_contact: initialData?.is_prime_contact || false,
    is_referrer: initialData?.is_referrer || false,
    referred_by: initialData?.referred_by || '',
    referral_notes: initialData?.referral_notes || '',
    preferred_channel: initialData?.preferred_channel || '',
    notes: initialData?.notes || '',
  })
  const [duplicateWarning, setDuplicateWarning] = useState('')
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})

  const [allContacts, setAllContacts] = useState<any[]>([])

  // Apply prefill data ONCE when it first arrives (from phone import)
  const [prefillApplied, setPrefillApplied] = useState(false)
  useEffect(() => {
    if (prefill && Object.keys(prefill).length > 0 && !prefillApplied) {
      setPrefillApplied(true)
      setForm(prev => {
        const updated = { ...prev }
        Object.entries(prefill).forEach(([key, value]) => {
          if (value && key in updated) {
            (updated as any)[key] = value
          }
        })
        return updated
      })
    }
  }, [prefill, prefillApplied])

  useEffect(() => {
    supabase.from('organizations').select('id, name').is('deleted_at', null).order('name').then(({ data }) => {
      if (data) setOrgs(data)
    })
    supabase.from('contacts').select('id, first_name, last_name').is('deleted_at', null).order('last_name').then(({ data }) => {
      if (data) setAllContacts(data.filter(c => c.id !== initialData?.id))
    })
    // Load additional org affiliations
    if (initialData?.id) {
      supabase.from('contact_organizations').select('org_id, role').eq('contact_id', initialData.id).then(({ data }) => {
        if (data) setAdditionalOrgs(data.filter(d => d.org_id !== initialData.org_id).map(d => ({ org_id: d.org_id, role: d.role || '' })))
      })
    }
  }, [supabase, initialData?.id])

  function update(field: string, value: any) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function titleCase(s: string) {
    return s.trim().toLowerCase().replace(/\b\w/g, c => c.toUpperCase()).replace(/\s+/g, ' ')
  }

  function validateForm(): Record<string, string> {
    const errors: Record<string, string> = {}

    // Email validation: simple regex + required check if provided
    if (form.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(form.email)) {
        errors.email = 'Please enter a valid email address'
      }
    }

    // Phone validation: at least 7 digits if provided
    const phoneDigits = (phone: string) => phone.replace(/\D/g, '')
    if (form.phone && phoneDigits(form.phone).length < 7) {
      errors.phone = 'Office phone must be at least 7 digits'
    }
    if (form.mobile_phone && phoneDigits(form.mobile_phone).length < 7) {
      errors.mobile_phone = 'Mobile phone must be at least 7 digits'
    }

    return errors
  }

  function handleFieldChange(field: string, value: any) {
    update(field, value)
    // Clear validation error for this field when user edits it
    if (validationErrors[field]) {
      setValidationErrors(prev => {
        const updated = { ...prev }
        delete updated[field]
        return updated
      })
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setDuplicateWarning('')

    // Validate form before submission
    const errors = validateForm()
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors)
      return
    }

    setLoading(true)

    // Duplicate detection on create
    if (mode === 'create') {
      const dupes: any[] = []
      // Check by email
      if (form.email) {
        const { data } = await supabase.from('contacts').select('id, first_name, last_name, email').ilike('email', form.email).is('deleted_at', null).limit(1)
        if (data?.length) dupes.push(...data)
      }
      // Check by name (only if no email dupe found)
      if (dupes.length === 0 && form.first_name && form.last_name) {
        const { data } = await supabase.from('contacts').select('id, first_name, last_name, email')
          .ilike('first_name', `%${form.first_name.trim()}%`).ilike('last_name', `%${form.last_name.trim()}%`).is('deleted_at', null).limit(1)
        if (data?.length) dupes.push(...data)
      }
      // Check by phone
      if (dupes.length === 0 && (form.phone || form.mobile_phone)) {
        const phone = form.mobile_phone || form.phone
        const { data } = await supabase.from('contacts').select('id, first_name, last_name, phone, mobile_phone')
          .or(`phone.eq.${phone},mobile_phone.eq.${phone}`).is('deleted_at', null).limit(1)
        if (data?.length) dupes.push(...data)
      }
      if (dupes.length > 0) {
        const d = dupes[0]
        const dupeName = `${d.first_name} ${d.last_name}`
        if (!duplicateWarning) {
          setDuplicateWarning(`Possible duplicate: "${dupeName}"${d.email ? ` (${d.email})` : ''}. Click Save again to create anyway.`)
          setLoading(false)
          return
        }
      }
    }

    const payload = {
      ...form,
      first_name: titleCase(form.first_name),
      last_name: titleCase(form.last_name),
      org_id: form.org_id || null,
      preferred_channel: form.preferred_channel || null,
      referred_by: form.referred_by || null,
      referral_notes: form.referral_notes || null,
    }

    let result
    if (mode === 'create') {
      result = await supabase.from('contacts').insert(payload).select().single()
    } else {
      result = await supabase.from('contacts').update(payload).eq('id', initialData.id).select().single()
    }

    if (result.error) { setError(result.error.message); setLoading(false); return }

    // Save additional org affiliations (wrapped in try/catch — table may not exist)
    const contactId = result.data.id
    try {
      await supabase.from('contact_organizations').delete().eq('contact_id', contactId)
      if (form.org_id) {
        await supabase.from('contact_organizations').insert({ contact_id: contactId, org_id: form.org_id, is_primary: true })
      }
      for (const ao of additionalOrgs) {
        if (ao.org_id && ao.org_id !== form.org_id) {
          await supabase.from('contact_organizations').insert({ contact_id: contactId, org_id: ao.org_id, role: ao.role || null, is_primary: false })
        }
      }
    } catch {} // Silently fail if contact_organizations table doesn't exist yet

    router.push(`/contacts/${contactId}`)
    router.refresh()
  }

  async function createOrg() {
    if (!newOrgName.trim()) return
    setCreatingOrg(true)
    const { data, error: orgError } = await supabase.from('organizations').insert({
      name: newOrgName.trim(),
      vertical: newOrgVertical,
      hq_city: newOrgCity.trim() || null,
      hq_state: newOrgState.trim() || null,
    }).select().single()

    if (orgError) {
      setError(orgError.message)
      setCreatingOrg(false)
      return
    }

    // Add to orgs list and select it
    setOrgs(prev => [...prev, { id: data.id, name: data.name }].sort((a, b) => a.name.localeCompare(b.name)))
    update('org_id', data.id)
    setShowNewOrg(false)
    setNewOrgName('')
    setNewOrgCity('')
    setNewOrgState('')
    setCreatingOrg(false)
  }

  const inputClass = "w-full px-3 py-2 border border-one70-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-one70-yellow focus:border-transparent"
  const labelClass = "block text-sm font-medium text-one70-dark mb-1"

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-one70-border p-6 max-w-3xl">
      {mode === 'create' && (
        <ContactImportTools onImport={(data) => {
          setForm(prev => ({
            ...prev,
            first_name: data.first_name || prev.first_name,
            last_name: data.last_name || prev.last_name,
            title: data.title || prev.title,
            email: data.email || prev.email,
            phone: data.phone || prev.phone,
            linkedin_url: data.linkedin_url || prev.linkedin_url,
            notes: data.notes || prev.notes,
          }))
          // If company name returned, try to match to an existing org
          if (data.company) {
            const match = orgs.find(o => o.name.toLowerCase().includes(data.company!.toLowerCase()))
            if (match) setForm(prev => ({ ...prev, org_id: match.id }))
          }
        }} />
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div><label className={labelClass}>First Name *</label><input type="text" value={form.first_name} onChange={e => update('first_name', e.target.value)} className={inputClass} required /></div>
        <div><label className={labelClass}>Last Name *</label><input type="text" value={form.last_name} onChange={e => update('last_name', e.target.value)} className={inputClass} required /></div>
        <div><label className={labelClass}>Title</label><input type="text" value={form.title} onChange={e => update('title', e.target.value)} className={inputClass} placeholder="e.g. VP of Construction" /></div>
        {/* Contact Photo */}
        <div>
          <label className={labelClass}>Photo</label>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-one70-gray flex items-center justify-center overflow-hidden border border-one70-border shrink-0">
              {form.avatar_url ? (
                <img src={form.avatar_url} alt="Contact" className="w-full h-full object-cover" />
              ) : (
                <span className="text-sm font-bold text-one70-mid">{(form.first_name?.[0] || '')}{(form.last_name?.[0] || '')}</span>
              )}
            </div>
            <div className="flex-1">
              <input type="text" value={form.avatar_url} onChange={e => update('avatar_url', e.target.value)}
                className={`${inputClass} text-xs`} placeholder="Photo URL or upload below" />
              <label className="mt-1 flex items-center gap-1 text-xs text-blue-600 cursor-pointer hover:text-blue-800">
                <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  const fileName = `avatars/${Date.now()}-${file.name}`
                  const { data, error } = await supabase.storage.from('documents').upload(fileName, file)
                  if (!error && data) {
                    const { data: urlData } = supabase.storage.from('documents').getPublicUrl(data.path)
                    if (urlData?.publicUrl) update('avatar_url', urlData.publicUrl)
                  }
                }} />
                Upload photo
              </label>
            </div>
          </div>
        </div>
        <div>
          <label className={labelClass}>Contact Type</label>
          <div className="flex gap-2">
            <select value={form.contact_type} onChange={e => update('contact_type', e.target.value)} className={`${inputClass} flex-1`}>
              {contactTypes.map(t => <option key={t.name} value={t.name}>{t.label}</option>)}
            </select>
            {!showAddType ? (
              <button type="button" onClick={() => setShowAddType(true)} className="px-2 py-1 text-xs text-one70-mid hover:text-one70-black"><Plus size={14} /></button>
            ) : (
              <div className="flex gap-1">
                <input type="text" value={newTypeName} onChange={e => setNewTypeName(e.target.value)} placeholder="New type" className="w-24 px-2 py-1 text-xs border border-one70-border rounded" />
                <button type="button" onClick={async () => {
                  if (!newTypeName.trim()) return
                  const name = newTypeName.trim().toLowerCase().replace(/\s+/g, '_')
                  const label = newTypeName.trim().replace(/\b\w/g, c => c.toUpperCase())
                  await supabase.from('contact_types').insert({ name, label }).single()
                  update('contact_type', name)
                  setNewTypeName(''); setShowAddType(false)
                }} className="px-2 py-1 text-xs bg-one70-black text-white rounded">Add</button>
                <button type="button" onClick={() => setShowAddType(false)} className="px-1 text-xs text-gray-400">✕</button>
              </div>
            )}
          </div>
        </div>
        <div>
          <label className={labelClass}>Organization</label>
          {!showNewOrg ? (
            <div className="flex gap-2">
              <select value={form.org_id} onChange={e => update('org_id', e.target.value)} className={`${inputClass} flex-1`}>
                <option value="">No Organization</option>
                {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
              <button type="button" onClick={() => setShowNewOrg(true)}
                className="px-3 py-2 text-xs font-semibold bg-one70-black text-white rounded-md hover:bg-one70-dark transition-colors whitespace-nowrap shrink-0">
                + New
              </button>
            </div>
          ) : (
            <div className="border border-one70-border rounded-md p-3 space-y-2 bg-one70-gray/50">
              <input type="text" value={newOrgName} onChange={e => setNewOrgName(e.target.value)}
                placeholder="Organization name *" className={inputClass} autoFocus />
              <div className="grid grid-cols-3 gap-2">
                <select value={newOrgVertical} onChange={e => setNewOrgVertical(e.target.value)} className={inputClass}>
                  {verticals.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
                </select>
                <input type="text" value={newOrgCity} onChange={e => setNewOrgCity(e.target.value)}
                  placeholder="City" className={inputClass} />
                <input type="text" value={newOrgState} onChange={e => setNewOrgState(e.target.value)}
                  placeholder="State" className={inputClass} />
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={createOrg} disabled={!newOrgName.trim() || creatingOrg}
                  className="px-3 py-1.5 text-xs font-semibold bg-one70-black text-white rounded-md hover:bg-one70-dark disabled:opacity-50 transition-colors">
                  {creatingOrg ? 'Creating...' : 'Create Organization'}
                </button>
                <button type="button" onClick={() => setShowNewOrg(false)}
                  className="px-3 py-1.5 text-xs text-one70-mid hover:text-one70-dark transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
        {/* Rating */}
        <div>
          <label className={labelClass}>Rating</label>
          <div className="flex gap-2">
            {[
              { id: 'cold', label: '❄️ Cold', color: 'bg-blue-50 text-blue-700 border-blue-200' },
              { id: 'warm', label: '🔥 Warm', color: 'bg-amber-50 text-amber-700 border-amber-200' },
              { id: 'active', label: '⚡ Active', color: 'bg-green-50 text-green-700 border-green-200' },
            ].map(r => (
              <button key={r.id} type="button" onClick={() => update('rating', r.id)}
                className={`flex-1 px-3 py-2 rounded-md text-xs font-semibold border transition-colors ${
                  form.rating === r.id ? r.color + ' ring-1 ring-offset-1' : 'bg-gray-50 text-gray-400 border-gray-200'
                }`}>{r.label}</button>
            ))}
          </div>
        </div>
        {/* Additional Organizations */}
        <div className="md:col-span-2">
          <label className={labelClass}>Additional Organizations</label>
          <p className="text-xs text-one70-mid mb-2">Link this contact to additional companies they are affiliated with</p>
          {additionalOrgs.map((ao, i) => (
            <div key={`addorg-${i}`} className="flex gap-2 mb-2">
              <select
                value={ao.org_id}
                onChange={e => {
                  const updated = additionalOrgs.map((item, j) =>
                    j === i ? { ...item, org_id: e.target.value } : item
                  )
                  setAdditionalOrgs(updated)
                }}
                className={`${inputClass} flex-1`}
              >
                <option value="">Select organization...</option>
                {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
              <input
                type="text"
                value={ao.role}
                onChange={e => {
                  const updated = additionalOrgs.map((item, j) =>
                    j === i ? { ...item, role: e.target.value } : item
                  )
                  setAdditionalOrgs(updated)
                }}
                placeholder="Role at this org"
                className={`${inputClass} w-40`}
              />
              <button type="button" onClick={() => setAdditionalOrgs(additionalOrgs.filter((_, j) => j !== i))}
                className="px-2 text-red-500 hover:text-red-700 text-sm shrink-0">✕</button>
            </div>
          ))}
          <button type="button" onClick={() => setAdditionalOrgs([...additionalOrgs, { org_id: '', role: '' }])}
            className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1">
            <Plus size={12} /> Add organization affiliation
          </button>
        </div>
        <div>
          <label className={labelClass}>Email</label>
          <input type="email" value={form.email} onChange={e => handleFieldChange('email', e.target.value)} className={`${inputClass} ${validationErrors.email ? 'border-red-500' : ''}`} />
          {validationErrors.email && <p className="text-xs text-red-600 mt-1">{validationErrors.email}</p>}
        </div>
        <div>
          <label className={labelClass}>Office Phone</label>
          <input type="text" value={form.phone} onChange={e => handleFieldChange('phone', e.target.value)} className={`${inputClass} ${validationErrors.phone ? 'border-red-500' : ''}`} placeholder="Office / landline" />
          {validationErrors.phone && <p className="text-xs text-red-600 mt-1">{validationErrors.phone}</p>}
        </div>
        <div>
          <label className={labelClass}>Mobile Phone</label>
          <input type="text" value={form.mobile_phone} onChange={e => handleFieldChange('mobile_phone', e.target.value)} className={`${inputClass} ${validationErrors.mobile_phone ? 'border-red-500' : ''}`} placeholder="Cell / mobile" />
          {validationErrors.mobile_phone && <p className="text-xs text-red-600 mt-1">{validationErrors.mobile_phone}</p>}
        </div>
        <div><label className={labelClass}>LinkedIn URL</label><input type="text" value={form.linkedin_url} onChange={e => update('linkedin_url', e.target.value)} className={inputClass} /></div>
        <div>
          <label className={labelClass}>Preferred Channel</label>
          <select value={form.preferred_channel} onChange={e => update('preferred_channel', e.target.value)} className={inputClass}>
            <option value="">Not Set</option>
            <option value="email">Email</option>
            <option value="linkedin">LinkedIn</option>
            <option value="phone">Phone</option>
            <option value="text">Text</option>
          </select>
        </div>
        <div className="md:col-span-2 flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.is_decision_maker} onChange={e => update('is_decision_maker', e.target.checked)} className="rounded" />
            <span className="font-medium text-one70-dark">Decision Maker</span>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.is_prime_contact} onChange={e => update('is_prime_contact', e.target.checked)} className="rounded" />
            <span className="font-medium text-one70-dark">Prime Contact</span>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.is_referrer} onChange={e => update('is_referrer', e.target.checked)} className="rounded" />
            <span className="font-medium text-one70-dark">Referral Source</span>
          </label>
        </div>
        <div>
          <label className={labelClass}>Referred By</label>
          <select value={form.referred_by} onChange={e => update('referred_by', e.target.value)} className={inputClass}>
            <option value="">No referrer</option>
            {allContacts.map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>Referral Notes</label>
          <input type="text" value={form.referral_notes} onChange={e => update('referral_notes', e.target.value)} className={inputClass} placeholder="How they connected us" />
        </div>
        <div className="md:col-span-2"><label className={labelClass}>Notes</label><textarea value={form.notes} onChange={e => update('notes', e.target.value)} className={inputClass} rows={3} /></div>
      </div>
      {error && <div className="mt-4 bg-red-50 text-red-700 px-3 py-2 rounded-md text-sm">{error}</div>}
      {duplicateWarning && <div className="mt-4 bg-amber-50 text-amber-700 px-3 py-2 rounded-md text-sm">⚠️ {duplicateWarning}</div>}
      <div className="mt-6 flex gap-3">
        <button type="submit" disabled={loading} className="bg-one70-black text-white px-6 py-2.5 rounded-md text-sm font-semibold hover:bg-one70-dark transition-colors disabled:opacity-50">
          {loading ? 'Saving...' : mode === 'create' ? 'Create Contact' : 'Save Changes'}
        </button>
        <button type="button" onClick={() => router.back()} className="px-6 py-2.5 rounded-md text-sm font-medium text-one70-mid border border-one70-border hover:bg-one70-gray transition-colors">Cancel</button>
      </div>
    </form>
  )
}
