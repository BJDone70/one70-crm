'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'

interface Props {
  table: string
  recordId: string
  recordLabel: string
  redirectTo: string
}

export default function AdminDeleteButton({ table, recordId, recordLabel, redirectTo }: Props) {
  const [isAdmin, setIsAdmin] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    async function checkRole() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if (profile?.role === 'admin') setIsAdmin(true)
    }
    checkRole()
  }, [])

  if (!isAdmin) return null

  async function handleDelete() {
    setDeleting(true)
    await supabase.from(table).update({ deleted_at: new Date().toISOString() }).eq('id', recordId)
    router.push(redirectTo)
    router.refresh()
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-md px-3 py-2">
        <span className="text-xs text-red-700">Delete {recordLabel}?</span>
        <button onClick={handleDelete} disabled={deleting}
          className="text-xs font-semibold text-white bg-red-600 px-3 py-1 rounded hover:bg-red-700 disabled:opacity-50 transition-colors">
          {deleting ? 'Deleting...' : 'Yes, delete'}
        </button>
        <button onClick={() => setConfirming(false)}
          className="text-xs text-gray-500 hover:text-gray-700">
          Cancel
        </button>
      </div>
    )
  }

  return (
    <button onClick={() => setConfirming(true)}
      className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-red-600 transition-colors">
      <Trash2 size={14} /> Delete
    </button>
  )
}
