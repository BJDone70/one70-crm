'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Shield, Plus, Pencil, Save, X, Check } from 'lucide-react'

interface Role {
  id: string; name: string; label: string; description: string | null
  is_system: boolean; permissions: Record<string, boolean>
}

const ALL_PERMISSIONS = [
  { key: 'contacts', label: 'Contacts', description: 'View and manage contacts' },
  { key: 'organizations', label: 'Organizations', description: 'View and manage organizations' },
  { key: 'deals', label: 'Pipeline / Deals', description: 'View and manage deals' },
  { key: 'tasks', label: 'Tasks', description: 'View and manage tasks' },
  { key: 'properties', label: 'Properties', description: 'View and manage properties' },
  { key: 'projects', label: 'Projects', description: 'View and manage projects' },
  { key: 'sequences', label: 'Sequences', description: 'Create and manage outreach sequences' },
  { key: 'outreach', label: 'Outreach Queue', description: 'Execute outreach actions' },
  { key: 'analytics', label: 'Analytics', description: 'View reports and analytics' },
  { key: 'activities', label: 'Activities', description: 'View and log activities' },
  { key: 'emails', label: 'Communications', description: 'View emails and meetings' },
  { key: 'feedback', label: 'Feedback', description: 'Submit and view feedback' },
  { key: 'integrations', label: 'Integrations', description: 'Connect email, calendar, and other services' },
  { key: 'import', label: 'Import Data', description: 'Import CSV data' },
  { key: 'workflows', label: 'Workflows', description: 'Create and manage automated workflows' },
  { key: 'settings', label: 'Settings', description: 'Access general settings' },
  { key: 'users', label: 'User Management', description: 'Manage users, roles, and invitations' },
  { key: 'data', label: 'Data & Backups', description: 'Export data and manage backups' },
  { key: 'territories', label: 'Territories', description: 'Manage sales territories' },
]

export default function RolesPermissionsPage() {
  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editPerms, setEditPerms] = useState<Record<string, boolean>>({})
  const [editLabel, setEditLabel] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [saving, setSaving] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [newName, setNewName] = useState('')
  const [newLabel, setNewLabel] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const supabase = createClient()

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase.from('custom_roles').select('*').order('is_system', { ascending: false }).order('name')
    setRoles((data || []) as Role[])
    setLoading(false)
  }

  function startEdit(role: Role) {
    setEditingId(role.id)
    setEditPerms({ ...role.permissions })
    setEditLabel(role.label)
    setEditDesc(role.description || '')
  }

  async function saveEdit() {
    if (!editingId) return
    setSaving(true)
    await supabase.from('custom_roles').update({
      permissions: editPerms, label: editLabel, description: editDesc,
    }).eq('id', editingId)
    setSaving(false)
    setEditingId(null)
    load()
  }

  async function createRole() {
    if (!newName.trim() || !newLabel.trim()) return
    setSaving(true)
    const name = newName.trim().toLowerCase().replace(/\s+/g, '_')
    const perms: Record<string, boolean> = {}
    ALL_PERMISSIONS.forEach(p => { perms[p.key] = false })
    await supabase.from('custom_roles').insert({
      name, label: newLabel.trim(), description: newDesc || null,
      is_system: false, permissions: perms,
    })
    setShowNew(false); setNewName(''); setNewLabel(''); setNewDesc('')
    setSaving(false)
    load()
  }

  async function deleteRole(id: string, name: string) {
    if (!confirm(`Delete role "${name}"? Users with this role will need to be reassigned.`)) return
    await supabase.from('custom_roles').delete().eq('id', id)
    load()
  }

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-one70-black flex items-center gap-2"><Shield size={24} /> Roles & Permissions</h1>
        <button onClick={() => setShowNew(!showNew)}
          className="flex items-center gap-2 px-4 py-2 bg-one70-black text-white rounded-md text-sm font-semibold hover:bg-one70-dark transition-all">
          <Plus size={14} /> New Role
        </button>
      </div>

      {showNew && (
        <div className="bg-white rounded-lg border border-one70-border p-5 mb-4">
          <h3 className="text-sm font-bold text-one70-black mb-3">Create New Role</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Role name (e.g. manager)" className="text-sm border border-one70-border rounded-md px-3 py-2" />
            <input value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="Display label (e.g. Manager)" className="text-sm border border-one70-border rounded-md px-3 py-2" />
            <input value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Description (optional)" className="text-sm border border-one70-border rounded-md px-3 py-2" />
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={createRole} disabled={saving || !newName.trim() || !newLabel.trim()}
              className="px-4 py-2 bg-one70-black text-white rounded-md text-sm font-semibold disabled:opacity-30">Create</button>
            <button onClick={() => setShowNew(false)} className="px-4 py-2 text-sm text-one70-mid">Cancel</button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-center text-one70-mid py-8">Loading roles...</p>
      ) : (
        <div className="space-y-4">
          {roles.map(role => {
            const isEditing = editingId === role.id
            return (
              <div key={role.id} className="bg-white rounded-lg border border-one70-border p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    {isEditing ? (
                      <div className="flex gap-2 mb-1">
                        <input value={editLabel} onChange={e => setEditLabel(e.target.value)} className="text-lg font-bold border border-one70-border rounded px-2 py-1" />
                        <input value={editDesc} onChange={e => setEditDesc(e.target.value)} placeholder="Description" className="text-sm border border-one70-border rounded px-2 py-1 flex-1" />
                      </div>
                    ) : (
                      <>
                        <h3 className="text-lg font-bold text-one70-black">
                          {role.label}
                          {role.is_system && <span className="ml-2 text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded">System</span>}
                        </h3>
                        {role.description && <p className="text-xs text-one70-mid">{role.description}</p>}
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {isEditing ? (
                      <>
                        <button onClick={saveEdit} disabled={saving} className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded text-xs font-medium"><Save size={12} /> Save</button>
                        <button onClick={() => setEditingId(null)} className="px-3 py-1.5 text-xs text-one70-mid">Cancel</button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => startEdit(role)} className="flex items-center gap-1 px-3 py-1.5 border border-one70-border rounded text-xs font-medium hover:bg-one70-gray"><Pencil size={12} /> Edit</button>
                        {!role.is_system && (
                          <button onClick={() => deleteRole(role.id, role.label)} className="text-xs text-red-600 hover:text-red-800">Delete</button>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Permissions grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                  {ALL_PERMISSIONS.map(perm => {
                    const enabled = isEditing ? editPerms[perm.key] : role.permissions?.[perm.key]
                    return (
                      <button key={perm.key}
                        onClick={() => isEditing && setEditPerms(prev => ({ ...prev, [perm.key]: !prev[perm.key] }))}
                        disabled={!isEditing}
                        className={`flex items-center gap-2 p-2 rounded-md text-xs transition-colors ${
                          enabled
                            ? 'bg-green-50 text-green-700 border border-green-200'
                            : 'bg-gray-50 text-gray-400 border border-gray-100'
                        } ${isEditing ? 'cursor-pointer hover:opacity-80' : ''}`}
                        title={perm.description}>
                        <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                          enabled ? 'bg-green-500 border-green-500' : 'border-gray-300'
                        }`}>
                          {enabled && <Check size={10} className="text-white" />}
                        </div>
                        {perm.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
