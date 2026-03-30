'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { Pencil, Check, X, Key } from 'lucide-react'

interface User {
  id: string
  email: string
  full_name: string
  role: string
  is_active: boolean
  last_login_at: string | null
  created_at: string
}

interface Role { name: string; label: string }

export default function UserList({ users, currentUserId }: { users: User[]; currentUserId: string }) {
  const supabase = createClient()
  const router = useRouter()
  const [roles, setRoles] = useState<Role[]>([
    { name: 'admin', label: 'Admin' }, { name: 'rep', label: 'Rep' }, { name: 'viewer', label: 'Viewer' }
  ])

  useEffect(() => {
    supabase.from('custom_roles').select('name, label').order('name').then(({ data }) => {
      if (data?.length) setRoles(data)
    })
  }, [])
  const [loading, setLoading] = useState<string | null>(null)
  const [editingName, setEditingName] = useState<string | null>(null)
  const [nameValue, setNameValue] = useState('')
  const [resetUserId, setResetUserId] = useState<string | null>(null)
  const [resetPassword, setResetPassword] = useState('')
  const [resetMsg, setResetMsg] = useState('')

  async function handleResetPassword(userId: string) {
    if (!resetPassword || resetPassword.length < 6) { setResetMsg('Min 6 characters'); return }
    setLoading(userId)
    const res = await fetch('/api/admin/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, new_password: resetPassword }),
    })
    const data = await res.json()
    if (data.success) {
      setResetMsg('Password updated!')
      setTimeout(() => { setResetUserId(null); setResetPassword(''); setResetMsg('') }, 2000)
    } else {
      setResetMsg(data.error || 'Failed')
    }
    setLoading(null)
  }

  async function toggleActive(userId: string, currentlyActive: boolean) {
    setLoading(userId)
    await supabase.from('profiles').update({ is_active: !currentlyActive }).eq('id', userId)
    setLoading(null)
    router.refresh()
  }

  async function changeRole(userId: string, newRole: string) {
    setLoading(userId)
    await supabase.from('profiles').update({ role: newRole }).eq('id', userId)
    setLoading(null)
    router.refresh()
  }

  function startEditingName(user: User) {
    setEditingName(user.id)
    setNameValue(user.full_name)
  }

  function cancelEditingName() {
    setEditingName(null)
    setNameValue('')
  }

  async function saveName(userId: string) {
    if (!nameValue.trim()) return
    setLoading(userId)
    await supabase.from('profiles').update({ full_name: nameValue.trim() }).eq('id', userId)
    setEditingName(null)
    setNameValue('')
    setLoading(null)
    router.refresh()
  }

  const roleColors: Record<string, string> = {
    admin: 'bg-red-100 text-red-800',
    rep: 'bg-blue-100 text-blue-800',
    viewer: 'bg-gray-100 text-gray-600',
  }

  function getRoleColor(role: string) {
    return roleColors[role] || 'bg-purple-100 text-purple-800'
  }

  function getRoleLabel(role: string) {
    const found = roles.find(r => r.name === role)
    return found?.label || role.charAt(0).toUpperCase() + role.slice(1)
  }

  return (
    <div className="space-y-2">
      {users.map(user => (
        <div key={user.id} className={`px-4 py-3 rounded-md ${user.is_active ? 'bg-white' : 'bg-red-50'}`}>
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${user.is_active ? 'bg-one70-black text-white' : 'bg-gray-300 text-gray-600'}`}>
              {user.full_name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              {editingName === user.id ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={nameValue}
                    onChange={e => setNameValue(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') saveName(user.id)
                      if (e.key === 'Escape') cancelEditingName()
                    }}
                    className="px-2 py-1 border border-one70-border rounded text-sm focus:outline-none focus:ring-2 focus:ring-one70-yellow flex-1 min-w-0"
                    autoFocus
                  />
                  <button
                    onClick={() => saveName(user.id)}
                    disabled={loading === user.id}
                    className="p-1 text-green-600 hover:bg-green-50 rounded transition-colors"
                    title="Save"
                  >
                    <Check size={16} />
                  </button>
                  <button
                    onClick={cancelEditingName}
                    className="p-1 text-gray-400 hover:bg-gray-100 rounded transition-colors"
                    title="Cancel"
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-medium text-one70-black truncate">
                    {user.full_name}
                    {user.id === currentUserId && <span className="ml-2 text-xs text-one70-mid">(You)</span>}
                    {!user.is_active && <span className="ml-2 text-xs text-red-600">Deactivated</span>}
                  </p>
                  <button
                    onClick={() => startEditingName(user)}
                    className="p-0.5 text-gray-400 hover:text-one70-black transition-colors shrink-0"
                    title="Edit name"
                  >
                    <Pencil size={12} />
                  </button>
                </div>
              )}
              <p className="text-xs text-one70-mid truncate">{user.email}</p>
            </div>
          </div>
          <div className="mt-2 ml-11 flex flex-wrap items-center gap-2">
            <span className="text-xs text-one70-mid">
              {user.last_login_at
                ? `Last login: ${new Date(user.last_login_at).toLocaleDateString()}`
                : 'Never logged in'
              }
            </span>
            {user.id !== currentUserId ? (
              <>
                <select
                  value={user.role}
                  onChange={e => changeRole(user.id, e.target.value)}
                  disabled={loading === user.id}
                  className="px-2 py-1 border border-one70-border rounded text-xs bg-white"
                >
                  {roles.map(r => <option key={r.name} value={r.name}>{r.label}</option>)}
                </select>
                <button
                  onClick={() => toggleActive(user.id, user.is_active)}
                  disabled={loading === user.id}
                  className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                    user.is_active
                      ? 'bg-red-100 text-red-700 hover:bg-red-200'
                      : 'bg-green-100 text-green-700 hover:bg-green-200'
                  }`}
                >
                  {loading === user.id ? '...' : user.is_active ? 'Deactivate' : 'Reactivate'}
                </button>
                <button onClick={() => { setResetUserId(resetUserId === user.id ? null : user.id); setResetPassword(''); setResetMsg('') }}
                  className="px-3 py-1 rounded text-xs font-medium bg-yellow-100 text-yellow-800 hover:bg-yellow-200 transition-colors flex items-center gap-1">
                  <Key size={10} /> Reset PW
                </button>
              </>
            ) : (
              <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${getRoleColor(user.role)}`}>
                {getRoleLabel(user.role)}
              </span>
            )}
          </div>
          {/* Inline password reset */}
          {resetUserId === user.id && (
            <div className="mt-2 flex items-center gap-2 bg-yellow-50 rounded p-2">
              <input type="text" value={resetPassword} onChange={e => setResetPassword(e.target.value)}
                placeholder="New password (min 6)" className="flex-1 text-xs border border-one70-border rounded px-2 py-1.5 focus:outline-none" />
              <button onClick={() => handleResetPassword(user.id)} disabled={loading === user.id}
                className="px-3 py-1.5 bg-one70-black text-white rounded text-xs font-medium disabled:opacity-50">Set</button>
              <button onClick={() => setResetUserId(null)} className="text-xs text-gray-500">Cancel</button>
              {resetMsg && <span className={`text-xs ${resetMsg.includes('updated') ? 'text-green-600' : 'text-red-600'}`}>{resetMsg}</span>}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
