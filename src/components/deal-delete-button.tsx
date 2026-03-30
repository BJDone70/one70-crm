'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'

export default function DealDeleteButton({ dealId, dealName }: { dealId: string; dealName: string }) {
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  async function handleDelete() {
    setDeleting(true)
    await supabase.from('deals').update({ deleted_at: new Date().toISOString() }).eq('id', dealId)
    router.push('/deals')
    router.refresh()
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-red-600">Delete "{dealName}"?</span>
        <button onClick={handleDelete} disabled={deleting}
          className="px-3 py-1.5 text-xs font-semibold bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50">
          {deleting ? 'Deleting...' : 'Yes, Delete'}
        </button>
        <button onClick={() => setConfirming(false)}
          className="px-3 py-1.5 text-xs text-one70-mid hover:text-one70-dark">
          Cancel
        </button>
      </div>
    )
  }

  return (
    <button onClick={() => setConfirming(true)}
      className="flex items-center gap-1.5 px-3 py-2 text-xs text-red-600 border border-red-200 rounded-md hover:bg-red-50 transition-colors">
      <Trash2 size={14} /> Delete Deal
    </button>
  )
}
