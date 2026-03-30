'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'

interface Invite {
  id: string
  email: string
  role: string
  expires_at: string
}

export default function PendingInvites({ invites }: { invites: Invite[] }) {
  const [cancelling, setCancelling] = useState<string | null>(null)
  const router = useRouter()

  async function cancelInvite(inviteId: string) {
    if (!confirm('Cancel this invitation? The link will no longer work.')) return
    setCancelling(inviteId)

    const res = await fetch('/api/invite/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inviteId }),
    })

    setCancelling(null)
    if (res.ok) router.refresh()
  }

  return (
    <div className="bg-one70-yellow-light rounded-lg border border-one70-border p-5 mb-6">
      <h2 className="text-sm font-semibold text-one70-mid uppercase tracking-wider mb-3">Pending Invitations</h2>
      <div className="space-y-2">
        {invites.map(inv => (
          <div key={inv.id} className="flex items-center justify-between bg-white px-4 py-2 rounded-md">
            <div>
              <p className="text-sm font-medium text-one70-black">{inv.email}</p>
              <p className="text-xs text-one70-mid capitalize">
                Role: {inv.role} | Expires: {new Date(inv.expires_at).toLocaleDateString()}
              </p>
            </div>
            <button
              onClick={() => cancelInvite(inv.id)}
              disabled={cancelling === inv.id}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-red-600 bg-red-50 rounded-md hover:bg-red-100 transition-colors disabled:opacity-50"
              title="Cancel invitation"
            >
              <X size={12} />
              {cancelling === inv.id ? '...' : 'Cancel'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
