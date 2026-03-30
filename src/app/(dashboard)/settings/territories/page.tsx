'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Plus, Pencil, Trash2, Save, X, MapPin, User, Target } from 'lucide-react'

interface Territory {
  id: string; name: string; color: string; states: string[]; assigned_to: string | null
  pipeline_target: number | null; revenue_target: number | null; notes: string | null
  sort_order: number; is_active: boolean
}

const ALL_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DC','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY',
  'LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH',
  'OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'
]

function fmt(n: number): string {
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`
  return `$${n.toLocaleString()}`
}

export default function TerritoriesPage() {
  const [territories, setTerritories] = useState<Territory[]>([])
  const [reps, setReps] = useState<{ id: string; full_name: string }[]>([])
  const [editing, setEditing] = useState<string | null>(null)
  const [form, setForm] = useState<Partial<Territory>>({})
  const [creating, setCreating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [stats, setStats] = useState<Record<string, { orgs: number; deals: number; pipeline: number; won: number }>>({})
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => { load() }, [])

  async function load() {
    const { data: t } = await supabase.from('territories').select('*').eq('is_active', true).order('sort_order')
    setTerritories(t || [])
    const { data: r } = await supabase.from('profiles').select('id, full_name').eq('is_active', true).order('full_name')
    setReps(r || [])

    // Stats per territory
    const { data: orgs } = await supabase.from('organizations').select('id, territory_id').is('deleted_at', null)
    const { data: deals } = await supabase.from('deals').select('id, territory_id, stage, value').is('deleted_at', null)

    const s: Record<string, { orgs: number; deals: number; pipeline: number; won: number }> = {}
    ;(t || []).forEach(terr => {
      const tOrgs = (orgs || []).filter(o => o.territory_id === terr.id)
      const tDeals = (deals || []).filter(d => d.territory_id === terr.id)
      const active = tDeals.filter(d => !['awarded', 'lost'].includes(d.stage))
      const won = tDeals.filter(d => d.stage === 'awarded')
      s[terr.id] = {
        orgs: tOrgs.length, deals: active.length,
        pipeline: active.reduce((sum, d) => sum + (Number(d.value) || 0), 0),
        won: won.reduce((sum, d) => sum + (Number(d.value) || 0), 0),
      }
    })
    setStats(s)
  }

  function startEdit(t: Territory) {
    setEditing(t.id)
    setForm({ ...t })
    setCreating(false)
  }

  function startCreate() {
    setCreating(true)
    setEditing(null)
    setForm({ name: '', color: '#378ADD', states: [], pipeline_target: null, revenue_target: null, notes: '', sort_order: territories.length + 1 })
  }

  function cancel() { setEditing(null); setCreating(false); setForm({}) }

  function toggleState(st: string) {
    const current = form.states || []
    setForm({ ...form, states: current.includes(st) ? current.filter(s => s !== st) : [...current, st] })
  }

  async function save() {
    setSaving(true)
    if (creating) {
      await supabase.from('territories').insert({
        name: form.name, color: form.color, states: form.states || [],
        assigned_to: form.assigned_to || null,
        pipeline_target: form.pipeline_target || null, revenue_target: form.revenue_target || null,
        notes: form.notes || null, sort_order: form.sort_order || 0,
      })
    } else if (editing) {
      await supabase.from('territories').update({
        name: form.name, color: form.color, states: form.states || [],
        assigned_to: form.assigned_to || null,
        pipeline_target: form.pipeline_target || null, revenue_target: form.revenue_target || null,
        notes: form.notes || null, updated_at: new Date().toISOString(),
      }).eq('id', editing)
    }
    setSaving(false)
    cancel()
    load()
  }

  async function remove(id: string) {
    if (!confirm('Remove this territory? Records will be unassigned.')) return
    await supabase.from('territories').update({ is_active: false }).eq('id', id)
    load()
  }

  const inputClass = "w-full px-3 py-1.5 border border-one70-border rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-one70-yellow"
  const isEditing = editing || creating

  return (
    <div>
      <Link href="/settings/users" className="flex items-center gap-1 text-sm text-one70-mid hover:text-one70-dark mb-4">
        <ArrowLeft size={16} /> Back to Settings
      </Link>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-one70-black">Territories</h1>
          <p className="text-one70-mid text-sm mt-1">Define regions, assign reps, and set targets</p>
        </div>
        {!isEditing && (
          <button onClick={startCreate} className="flex items-center gap-2 bg-one70-black text-white px-4 py-2.5 rounded-md text-sm font-semibold hover:bg-one70-dark transition-colors">
            <Plus size={16} /> New Territory
          </button>
        )}
      </div>

      {/* Edit/Create form */}
      {isEditing && (
        <div className="bg-white rounded-lg border border-one70-border p-5 mb-6">
          <h2 className="text-sm font-semibold text-one70-dark mb-4">{creating ? 'New Territory' : 'Edit Territory'}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-semibold text-one70-dark mb-1">Name *</label>
              <input value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-one70-dark mb-1">Color</label>
              <div className="flex gap-2 items-center">
                <input type="color" value={form.color || '#378ADD'} onChange={e => setForm({ ...form, color: e.target.value })} className="w-10 h-8 rounded border border-one70-border cursor-pointer" />
                <span className="text-xs text-gray-500">{form.color}</span>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-one70-dark mb-1">Assigned Rep</label>
              <select value={form.assigned_to || ''} onChange={e => setForm({ ...form, assigned_to: e.target.value || null })} className={inputClass}>
                <option value="">Unassigned</option>
                {reps.map(r => <option key={r.id} value={r.id}>{r.full_name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-one70-dark mb-1">Pipeline Target ($)</label>
                <input type="number" value={form.pipeline_target || ''} onChange={e => setForm({ ...form, pipeline_target: Number(e.target.value) || null })} className={inputClass} placeholder="e.g. 2000000" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-one70-dark mb-1">Revenue Target ($)</label>
                <input type="number" value={form.revenue_target || ''} onChange={e => setForm({ ...form, revenue_target: Number(e.target.value) || null })} className={inputClass} placeholder="e.g. 500000" />
              </div>
            </div>
          </div>
          <div className="mb-4">
            <label className="block text-xs font-semibold text-one70-dark mb-2">States (click to toggle)</label>
            <div className="flex flex-wrap gap-1.5">
              {ALL_STATES.map(st => {
                const active = (form.states || []).includes(st)
                return (
                  <button key={st} onClick={() => toggleState(st)}
                    className={`px-2 py-1 rounded text-xs font-medium transition-colors ${active ? 'text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                    style={active ? { backgroundColor: form.color || '#378ADD' } : undefined}>
                    {st}
                  </button>
                )
              })}
            </div>
          </div>
          <div className="mb-4">
            <label className="block text-xs font-semibold text-one70-dark mb-1">Notes</label>
            <input value={form.notes || ''} onChange={e => setForm({ ...form, notes: e.target.value })} className={inputClass} placeholder="Key markets, strategy notes..." />
          </div>
          <div className="flex gap-3">
            <button onClick={save} disabled={saving || !form.name}
              className="flex items-center gap-1.5 bg-one70-black text-white px-4 py-2 rounded-md text-sm font-semibold hover:bg-one70-dark disabled:opacity-50 transition-colors">
              <Save size={14} /> {saving ? 'Saving...' : 'Save Territory'}
            </button>
            <button onClick={cancel} className="px-4 py-2 text-sm text-one70-mid hover:text-one70-dark">Cancel</button>
          </div>
        </div>
      )}

      {/* Territory cards */}
      <div className="space-y-3">
        {territories.map(t => {
          const s = stats[t.id] || { orgs: 0, deals: 0, pipeline: 0, won: 0 }
          const repName = reps.find(r => r.id === t.assigned_to)?.full_name
          const pipelinePct = t.pipeline_target ? Math.min(Math.round((s.pipeline / Number(t.pipeline_target)) * 100), 100) : 0
          const revPct = t.revenue_target ? Math.min(Math.round((s.won / Number(t.revenue_target)) * 100), 100) : 0

          return (
            <div key={t.id} className="bg-white rounded-lg border border-one70-border p-5" style={{ borderLeftWidth: '4px', borderLeftColor: t.color }}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
                    {t.name}
                  </h3>
                  <p className="text-xs text-gray-500 mt-1">{(t.states || []).join(', ')}</p>
                  {repName && <p className="text-xs text-gray-400 mt-1 flex items-center gap-1"><User size={10} /> {repName}</p>}
                </div>
                <div className="flex gap-1.5">
                  <button onClick={() => startEdit(t)} className="p-1.5 text-gray-400 hover:text-gray-600"><Pencil size={14} /></button>
                  <button onClick={() => remove(t.id)} className="p-1.5 text-gray-400 hover:text-red-500"><Trash2 size={14} /></button>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-3 mb-3">
                <div className="text-center">
                  <p className="text-lg font-bold text-gray-900">{s.orgs}</p>
                  <p className="text-[10px] text-gray-400">Orgs</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-gray-900">{s.deals}</p>
                  <p className="text-[10px] text-gray-400">Active Deals</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-blue-600">{s.pipeline > 0 ? fmt(s.pipeline) : '—'}</p>
                  <p className="text-[10px] text-gray-400">Pipeline</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-green-600">{s.won > 0 ? fmt(s.won) : '—'}</p>
                  <p className="text-[10px] text-gray-400">Won</p>
                </div>
              </div>

              {/* Progress bars for targets */}
              {(t.pipeline_target || t.revenue_target) && (
                <div className="space-y-2 pt-3 border-t border-one70-border">
                  {t.pipeline_target && (
                    <div>
                      <div className="flex items-center justify-between text-[10px] text-gray-500 mb-1">
                        <span>Pipeline target: {fmt(Number(t.pipeline_target))}</span>
                        <span className="font-semibold">{pipelinePct}%</span>
                      </div>
                      <div className="h-2 bg-one70-gray rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${pipelinePct}%`, backgroundColor: t.color }} />
                      </div>
                    </div>
                  )}
                  {t.revenue_target && (
                    <div>
                      <div className="flex items-center justify-between text-[10px] text-gray-500 mb-1">
                        <span>Revenue target: {fmt(Number(t.revenue_target))}</span>
                        <span className="font-semibold">{revPct}%</span>
                      </div>
                      <div className="h-2 bg-one70-gray rounded-full overflow-hidden">
                        <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${revPct}%` }} />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {t.notes && <p className="text-xs text-gray-400 mt-3 pt-2 border-t border-one70-border whitespace-pre-wrap">{t.notes}</p>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
