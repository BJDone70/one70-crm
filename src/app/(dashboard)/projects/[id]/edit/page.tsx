'use client'

import { useVerticals } from '@/hooks/use-verticals'
import { useProjectStages } from '@/hooks/use-project-stages'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import PillFilter from '@/components/pill-filter'
import VerticalSelector from '@/components/vertical-selector'

export default function EditProjectPage() {
  const { id } = useParams<{ id: string }>()
  const [orgs, setOrgs] = useState<any[]>([])
  const [contacts, setContacts] = useState<any[]>([])
  const [properties, setProperties] = useState<any[]>([])
  const [deals, setDeals] = useState<any[]>([])
  const [reps, setReps] = useState<any[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [loaded, setLoaded] = useState(false)
  const supabase = createClient()
  const router = useRouter()
  const { verticals, addVertical } = useVerticals()
  const { stages: projectStages } = useProjectStages()

  const [form, setForm] = useState({
    name: '', org_id: '', contact_id: '', property_id: '', deal_id: '',
    assigned_to: '', vertical: 'multifamily', verticals: ['multifamily'] as string[], status: 'scoping',
    project_type: 'renovation', contract_value: '', percent_complete: '0',
    start_date: '', target_end_date: '', actual_end_date: '',
    scope_description: '', notes: '',
  })

  // Load project + lookup data
  useEffect(() => {
    async function load() {
      const [{ data: project }, { data: o }, { data: r }] = await Promise.all([
        supabase.from('projects').select('*').eq('id', id).single(),
        supabase.from('organizations').select('id, name, vertical').is('deleted_at', null).order('name'),
        supabase.from('profiles').select('id, full_name').eq('is_active', true).order('full_name'),
      ])
      setOrgs(o || [])
      setReps(r || [])

      if (project) {
        setForm({
          name: project.name || '',
          org_id: project.org_id || '',
          contact_id: project.contact_id || '',
          property_id: project.property_id || '',
          deal_id: project.deal_id || '',
          assigned_to: project.assigned_to || '',
          vertical: project.vertical || 'multifamily',
          verticals: project.verticals?.length ? project.verticals : [project.vertical || 'multifamily'],
          status: project.status || 'scoping',
          project_type: project.project_type || 'renovation',
          contract_value: project.contract_value ? String(project.contract_value) : '',
          percent_complete: project.percent_complete != null ? String(project.percent_complete) : '0',
          start_date: project.start_date || '',
          target_end_date: project.target_end_date || '',
          actual_end_date: project.actual_end_date || '',
          scope_description: project.scope_description || '',
          notes: project.notes || '',
        })

        // Load related records for org
        if (project.org_id) {
          const [{ data: c }, { data: p }, { data: d }] = await Promise.all([
            supabase.from('contacts').select('id, first_name, last_name').is('deleted_at', null).eq('org_id', project.org_id).order('last_name'),
            supabase.from('properties').select('id, name').is('deleted_at', null).eq('org_id', project.org_id).order('name'),
            supabase.from('deals').select('id, name').eq('org_id', project.org_id).is('deleted_at', null).order('name'),
          ])
          setContacts(c || [])
          setProperties(p || [])
          setDeals(d || [])
        }
      }
      setLoaded(true)
    }
    load()
  }, [id])

  // Reload related records when org changes
  useEffect(() => {
    if (!loaded) return
    if (!form.org_id) { setContacts([]); setProperties([]); setDeals([]); return }
    async function loadRelated() {
      const [{ data: c }, { data: p }, { data: d }] = await Promise.all([
        supabase.from('contacts').select('id, first_name, last_name').is('deleted_at', null).eq('org_id', form.org_id).order('last_name'),
        supabase.from('properties').select('id, name').is('deleted_at', null).eq('org_id', form.org_id).order('name'),
        supabase.from('deals').select('id, name').eq('org_id', form.org_id).is('deleted_at', null).order('name'),
      ])
      setContacts(c || [])
      setProperties(p || [])
      setDeals(d || [])
    }
    loadRelated()
  }, [form.org_id, loaded])

  function update(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { setError('Project name is required'); return }
    setSaving(true)
    setError('')

    const { error: err } = await supabase.from('projects').update({
      name: form.name.trim(),
      org_id: form.org_id || null,
      contact_id: form.contact_id || null,
      property_id: form.property_id || null,
      deal_id: form.deal_id || null,
      assigned_to: form.assigned_to || null,
      vertical: form.verticals[0] || form.vertical,
      verticals: form.verticals,
      status: form.status,
      project_type: form.project_type,
      contract_value: form.contract_value ? Number(form.contract_value) : null,
      percent_complete: form.percent_complete ? parseInt(form.percent_complete) : 0,
      start_date: form.start_date || null,
      target_end_date: form.target_end_date || null,
      actual_end_date: form.actual_end_date || null,
      scope_description: form.scope_description || null,
      notes: form.notes || null,
      updated_at: new Date().toISOString(),
    }).eq('id', id)

    if (err) { setError(err.message); setSaving(false); return }
    router.push(`/projects/${id}`)
    router.refresh()
  }

  const inputClass = "w-full px-3 py-2 border border-one70-border rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-one70-yellow"

  if (!loaded) return <div className="text-sm text-one70-mid p-8">Loading project...</div>

  return (
    <div>
      <Link href={`/projects/${id}`} className="flex items-center gap-1 text-sm text-one70-mid hover:text-one70-dark mb-4">
        <ArrowLeft size={16} /> Back to Project
      </Link>
      <h1 className="text-2xl font-bold text-one70-black mb-6">Edit Project</h1>

      <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-one70-border p-6 max-w-2xl space-y-4">
        <div>
          <label className="block text-sm font-semibold text-one70-dark mb-1">Project Name *</label>
          <input value={form.name} onChange={e => update('name', e.target.value)} className={inputClass} />
        </div>

        <div>
          <label className="block text-sm font-semibold text-one70-dark mb-2">Vertical</label>
          <VerticalSelector verticals={verticals} value={form.verticals}
            onChange={(v: string[]) => setForm(prev => ({ ...prev, verticals: v, vertical: v[0] || 'multifamily' }))} addVertical={addVertical} variant="pills" multi />
        </div>

        <div>
          <label className="block text-sm font-semibold text-one70-dark mb-2">Status</label>
          <PillFilter
            options={projectStages.map(s => ({ id: s.id, label: s.label }))}
            value={form.status} onChange={v => update('status', v)} allowDeselect={false}
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-one70-dark mb-2">Project Type</label>
          <PillFilter
            options={[
              { id: 'major_construction', label: 'Major Construction' },
              { id: 'renovation', label: 'Renovation' },
            ]}
            value={form.project_type} onChange={v => update('project_type', v)} allowDeselect={false}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-one70-dark mb-1">Organization</label>
            <select value={form.org_id} onChange={e => update('org_id', e.target.value)} className={inputClass}>
              <option value="">Select organization...</option>
              {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-one70-dark mb-1">Contact</label>
            <select value={form.contact_id} onChange={e => update('contact_id', e.target.value)} className={inputClass} disabled={!form.org_id}>
              <option value="">Select contact...</option>
              {contacts.map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-one70-dark mb-1">Property</label>
            <select value={form.property_id} onChange={e => update('property_id', e.target.value)} className={inputClass} disabled={!form.org_id}>
              <option value="">Select property...</option>
              {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-one70-dark mb-1">From Deal (optional)</label>
            <select value={form.deal_id} onChange={e => update('deal_id', e.target.value)} className={inputClass} disabled={!form.org_id}>
              <option value="">No linked deal</option>
              {deals.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-one70-dark mb-1">Assigned To</label>
            <select value={form.assigned_to} onChange={e => update('assigned_to', e.target.value)} className={inputClass}>
              <option value="">Unassigned</option>
              {reps.map(r => <option key={r.id} value={r.id}>{r.full_name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-one70-dark mb-1">Contract Value ($)</label>
            <input type="number" value={form.contract_value} onChange={e => update('contract_value', e.target.value)}
              className={inputClass} placeholder="e.g. 250000" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-one70-dark mb-1">Percent Complete (%)</label>
            <input type="number" min="0" max="100" value={form.percent_complete} onChange={e => update('percent_complete', e.target.value)}
              className={inputClass} placeholder="0" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-one70-dark mb-1">Start Date</label>
            <input type="date" value={form.start_date} onChange={e => update('start_date', e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-semibold text-one70-dark mb-1">Target End Date</label>
            <input type="date" value={form.target_end_date} onChange={e => update('target_end_date', e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-semibold text-one70-dark mb-1">Actual End Date</label>
            <input type="date" value={form.actual_end_date} onChange={e => update('actual_end_date', e.target.value)} className={inputClass} />
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-one70-dark mb-1">Scope Description</label>
          <textarea value={form.scope_description} onChange={e => update('scope_description', e.target.value)}
            className={inputClass} rows={4} />
        </div>

        <div>
          <label className="block text-sm font-semibold text-one70-dark mb-1">Notes</label>
          <textarea value={form.notes} onChange={e => update('notes', e.target.value)}
            className={inputClass} rows={2} />
        </div>

        {error && <div className="bg-red-50 text-red-700 px-3 py-2 rounded-md text-sm">{error}</div>}

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={saving}
            className="bg-one70-black text-white px-6 py-2.5 rounded-md text-sm font-semibold hover:bg-one70-dark disabled:opacity-50 transition-colors">
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
          <Link href={`/projects/${id}`} className="px-4 py-2.5 text-sm text-one70-mid hover:text-one70-dark">Cancel</Link>
        </div>
      </form>
    </div>
  )
}
