'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Pencil, Trash2, Merge, Plus, Check, X } from 'lucide-react'
import { DEFAULT_VERTICALS, formatVerticalLabel } from '@/lib/verticals'

interface Vertical { name: string; count: number }

export default function VerticalsAdminPage() {
  const supabase = createClient()
  const [verticals, setVerticals] = useState<Vertical[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState('')
  const [mergeFrom, setMergeFrom] = useState<string | null>(null)
  const [mergeInto, setMergeInto] = useState('')
  const [newName, setNewName] = useState('')
  const [saving, setSaving] = useState(false)

  async function load() {
    setLoading(true)
    // Get all unique verticals from organizations (primary source)
    const { data: orgs } = await supabase.from('organizations').select('vertical').is('deleted_at', null)
    const { data: deals } = await supabase.from('deals').select('vertical').is('deleted_at', null)
    const { data: projects } = await supabase.from('projects').select('vertical').is('deleted_at', null)

    const counts: Record<string, number> = {}
    ;[...(orgs || []), ...(deals || []), ...(projects || [])].forEach(r => {
      if (r.vertical) counts[r.vertical] = (counts[r.vertical] || 0) + 1
    })
    // Also include defaults and custom_verticals that might have 0 usage
    DEFAULT_VERTICALS.forEach(v => { if (!(v.id in counts)) counts[v.id] = 0 })
    const { data: custom } = await supabase.from('custom_verticals').select('name')
    ;(custom || []).forEach(c => { if (!(c.name in counts)) counts[c.name] = 0 })

    const sorted = Object.entries(counts).map(([name, count]) => ({ name, count })).sort((a, b) => a.name.localeCompare(b.name))
    setVerticals(sorted)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleRename() {
    if (!editing || !editLabel.trim()) return
    setSaving(true)
    const newSlug = editLabel.trim().toLowerCase().replace(/\s+/g, '_')
    // Update all tables
    await supabase.from('organizations').update({ vertical: newSlug }).eq('vertical', editing)
    await supabase.from('deals').update({ vertical: newSlug }).eq('vertical', editing)
    await supabase.from('projects').update({ vertical: newSlug }).eq('vertical', editing)
    // Update arrays
    // Update arrays (best effort - rpc may not exist)
    try { await supabase.rpc('rename_vertical_in_arrays', { old_name: editing, new_name: newSlug }) } catch {}
    // Update custom_verticals
    await supabase.from('custom_verticals').update({ name: newSlug }).eq('name', editing)
    if (!DEFAULT_VERTICALS.some(d => d.id === newSlug)) {
      try { await supabase.from('custom_verticals').upsert({ name: newSlug }) } catch {}
    }
    setEditing(null)
    setEditLabel('')
    setSaving(false)
    load()
  }

  async function handleMerge() {
    if (!mergeFrom || !mergeInto) return
    setSaving(true)
    // Move all records from mergeFrom → mergeInto
    await supabase.from('organizations').update({ vertical: mergeInto }).eq('vertical', mergeFrom)
    await supabase.from('deals').update({ vertical: mergeInto }).eq('vertical', mergeFrom)
    await supabase.from('projects').update({ vertical: mergeInto }).eq('vertical', mergeFrom)
    await supabase.from('custom_verticals').delete().eq('name', mergeFrom)
    setMergeFrom(null)
    setMergeInto('')
    setSaving(false)
    load()
  }

  async function handleDelete(name: string) {
    const v = verticals.find(v => v.name === name)
    if (v && v.count > 0) {
      alert(`Cannot delete "${formatVerticalLabel(name)}" — it's used by ${v.count} records. Merge it into another vertical first.`)
      return
    }
    if (!confirm(`Delete "${formatVerticalLabel(name)}"?`)) return
    await supabase.from('custom_verticals').delete().eq('name', name)
    load()
  }

  async function handleAdd() {
    if (!newName.trim()) return
    const slug = newName.trim().toLowerCase().replace(/\s+/g, '_')
    await supabase.from('custom_verticals').upsert({ name: slug })
    setNewName('')
    load()
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-one70-black mb-2">Manage Verticals</h1>
      <p className="text-sm text-one70-mid mb-6">Edit, rename, merge, or remove verticals used across your organizations, deals, and projects.</p>

      {/* Add new */}
      <div className="flex gap-2 mb-6">
        <input type="text" value={newName} onChange={e => setNewName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          placeholder="New vertical name..." className="flex-1 text-sm border border-one70-border rounded-md px-3 py-2 focus:outline-none focus:border-one70-black" />
        <button onClick={handleAdd} disabled={!newName.trim()}
          className="px-4 py-2 bg-one70-black text-white rounded-md text-sm font-medium disabled:opacity-30">
          <Plus size={14} className="inline mr-1" /> Add
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-one70-mid">Loading...</p>
      ) : (
        <div className="bg-white rounded-lg border border-one70-border divide-y divide-one70-border">
          {verticals.map(v => (
            <div key={v.name} className="flex items-center gap-3 px-4 py-3">
              {editing === v.name ? (
                <div className="flex-1 flex gap-2">
                  <input type="text" value={editLabel} onChange={e => setEditLabel(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleRename()}
                    className="flex-1 text-sm border border-blue-300 rounded px-2 py-1 focus:outline-none" autoFocus />
                  <button onClick={handleRename} disabled={saving} className="text-green-600 hover:text-green-800"><Check size={16} /></button>
                  <button onClick={() => setEditing(null)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
                </div>
              ) : mergeFrom === v.name ? (
                <div className="flex-1 flex items-center gap-2">
                  <span className="text-sm text-one70-dark">Merge into:</span>
                  <select value={mergeInto} onChange={e => setMergeInto(e.target.value)}
                    className="text-sm border border-one70-border rounded px-2 py-1">
                    <option value="">Select target...</option>
                    {verticals.filter(t => t.name !== v.name).map(t => (
                      <option key={t.name} value={t.name}>{formatVerticalLabel(t.name)}</option>
                    ))}
                  </select>
                  <button onClick={handleMerge} disabled={!mergeInto || saving}
                    className="px-2 py-1 bg-blue-600 text-white rounded text-xs disabled:opacity-30">Merge</button>
                  <button onClick={() => setMergeFrom(null)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
                </div>
              ) : (
                <>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-one70-dark">{formatVerticalLabel(v.name)}</p>
                    <p className="text-[10px] text-one70-mid">{v.name} · {v.count} record{v.count !== 1 ? 's' : ''}</p>
                  </div>
                  <button onClick={() => { setEditing(v.name); setEditLabel(formatVerticalLabel(v.name)) }}
                    className="p-1.5 text-gray-400 hover:text-blue-600" title="Rename">
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => { setMergeFrom(v.name); setMergeInto('') }}
                    className="p-1.5 text-gray-400 hover:text-purple-600" title="Merge into another">
                    <Merge size={14} />
                  </button>
                  <button onClick={() => handleDelete(v.name)}
                    className="p-1.5 text-gray-400 hover:text-red-600" title="Delete">
                    <Trash2 size={14} />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
