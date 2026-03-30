'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function InviteUserForm() {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('rep')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [roles, setRoles] = useState<{name: string; label: string}[]>([
    { name: 'admin', label: 'Admin' }, { name: 'rep', label: 'Rep' }, { name: 'viewer', label: 'Viewer' }
  ])
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    supabase.from('custom_roles').select('name, label').order('name').then(({ data }) => {
      if (data?.length) setRoles(data)
    })
  }, [])

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setMessage('')
    setLoading(true)

    try {
      const res = await fetch('/api/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Failed to send invitation')
        setLoading(false)
        return
      }

      setMessage(data.message || `Invitation sent to ${email}`)
      setEmail('')
      setRole('rep')
      setLoading(false)
      router.refresh()
    } catch {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  const inputClass = "w-full px-3 py-2 border border-one70-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-one70-yellow focus:border-transparent"

  return (
    <form onSubmit={handleInvite} className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-one70-dark mb-1">Email Address</label>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="teammate@email.com" className={inputClass} required />
      </div>
      <div className="flex gap-3">
        <div>
          <label className="block text-sm font-medium text-one70-dark mb-1">Role</label>
          <select value={role} onChange={e => setRole(e.target.value)} className={`${inputClass} w-auto`}>
            {roles.map(r => <option key={r.name} value={r.name}>{r.label}</option>)}
          </select>
        </div>
        <div className="flex items-end">
          <button type="submit" disabled={loading}
            className="bg-one70-black text-white px-6 py-2 rounded-md text-sm font-semibold hover:bg-one70-dark transition-colors disabled:opacity-50 whitespace-nowrap">
            {loading ? 'Sending...' : 'Send Invite'}
          </button>
        </div>
      </div>
      {error && <div className="bg-red-50 text-red-700 px-3 py-2 rounded-md text-sm">{error}</div>}
      {message && <div className="bg-green-50 text-green-700 px-3 py-2 rounded-md text-sm">{message}</div>}
    </form>
  )
}
