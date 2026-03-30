'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Pencil, Trash2, Plus, Check, X, ArrowUp, ArrowDown } from 'lucide-react'

interface OrgRole { id: string; name: string; label: string; sort_order: number; count: number }

export default function OrgRolesAdminPage() {
  const supabase = createClient()
  const [roles, setRoles] = useState<OrgRole[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState('')
  const [newLabel, setNewLabel] = useState('')
  const [saving, setSaving] = useState(false)

  async function load() {
    setLoading(true)
    const { data: roleData } = await supabase.from('org_roles').select('*').order('sort_order')
    const { data: orgs } = await supabase.from('organizations').select('org_role').is('deleted_at', null)
    const counts: Record<string, number> = {}
    ;(orgs || []).forEach(o => { if (o.org_role) counts[o.org_role] = (counts[o.org_role] || 0) + 1 })
    setRoles((roleData || []).map(r => ({ ...r, count: counts[r.name] || 0 })))
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleRename() {
    if (!editing || !editLabel.trim()) return
    setSaving(true)
    await supabase.from('org_roles').update({ label: editLabel.trim() }).eq('name', editing)
    setEditing(null)
    setEditLabel('')
    setSaving(false)
    load()
  }

  async function handleDelete(role: OrgRole) {
    if (role.count > 0) {
      alert(`Cannot delete "${role.label}" — it's assigned to ${role.count} organization(s). Remove it from those orgs first.`)
      return
    }
    if (!confirm(`Delete "${role.label}"?`)) return
    await supabase.from('org_roles').delete().eq('name', role.name)
    load()
  }

  async function handleAdd() {
    if (!newLabel.trim()) return
    const name = newLabel.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
    await supabase.from('org_roles').insert({ name, label: newLabel.trim(), sort_order: roles.length })
    setNewLabel('')
    load()
  }

  async function moveRole(idx: number, dir: -1 | 1) {
    const newIdx = idx + dir
    if (newIdx < 0 || newIdx >= roles.length) return
    const updated = [...roles]
    ;[updated[idx], updated[newIdx]] = [updated[newIdx], updated[idx]]
    setRoles(updated)
    // Save new sort orders
    for (let i = 0; i < updated.length; i++) {
      await supabase.from('org_roles').update({ sort_order: i }).eq('name', updated[i].name)
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-one70-black mb-2">Manage Organization Roles</h1>
      <p className="text-sm text-one70-mid mb-6">Add, edit, reorder, or remove roles that describe what an organization does in your projects.</p>

      {/* Add new */}
      <div className="flex gap-2 mb-6">
        <input type="text" value={newLabel} onChange={e => setNewLabel(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          placeholder="New role label..." className="flex-1 text-sm border border-one70-border rounded-md px-3 py-2 focus:outline-none focus:border-one70-black" />
        <button onClick={handleAdd} disabled={!newLabel.trim()}
          className="px-4 py-2 bg-one70-black text-white rounded-md text-sm font-medium disabled:opacity-30">
          <Plus size={14} className="inline mr-1" /> Add
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-one70-mid">Loading...</p>
      ) : (
        <div className="bg-white rounded-lg border border-one70-border divide-y divide-one70-border">
          {roles.map((r, idx) => (
            <div key={r.name} className="flex items-center gap-2 px-4 py-3">
              {/* Reorder arrows */}
              <div className="flex flex-col shrink-0">
                <button onClick={() => moveRole(idx, -1)} disabled={idx === 0}
                  className="text-gray-400 hover:text-one70-black disabled:opacity-20 p-0.5">
                  <ArrowUp size={12} />
                </button>
                <button onClick={() => moveRole(idx, 1)} disabled={idx === roles.length - 1}
                  className="text-gray-400 hover:text-one70-black disabled:opacity-20 p-0.5">
                  <ArrowDown size={12} />
                </button>
              </div>

              {editing === r.name ? (
                <div className="flex-1 flex gap-2">
                  <input type="text" value={editLabel} onChange={e => setEditLabel(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleRename()}
                    className="flex-1 text-sm border border-blue-300 rounded px-2 py-1 focus:outline-none" autoFocus />
                  <button onClick={handleRename} disabled={saving} className="text-green-600 hover:text-green-800"><Check size={16} /></button>
                  <button onClick={() => setEditing(null)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
                </div>
              ) : (
                <>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-one70-dark">{r.label}</p>
                    <p className="text-[10px] text-one70-mid">{r.name} · {r.count} org{r.count !== 1 ? 's' : ''}</p>
                  </div>
                  <button onClick={() => { setEditing(r.name); setEditLabel(r.label) }}
                    className="p-1.5 text-gray-400 hover:text-blue-600" title="Edit label">
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => handleDelete(r)}
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
