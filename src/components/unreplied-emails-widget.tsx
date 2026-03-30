'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { MailWarning, Clock } from 'lucide-react'

interface UnrepliedEmail {
  id: string
  subject: string
  from_email: string
  received_at: string
  contacts: { first_name: string; last_name: string } | null
}

export default function UnrepliedEmailsWidget() {
  const [emails, setEmails] = useState<UnrepliedEmail[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      const { data } = await supabase
        .from('email_interactions')
        .select('id, subject, from_email, received_at, contacts(first_name, last_name)')
        .eq('user_id', user.id)
        .eq('needs_reply', true)
        .is('replied_at', null)
        .order('received_at', { ascending: true })
        .limit(5)
      setEmails((data as any) || [])
      setLoading(false)
    }
    load()
  }, [])

  if (loading || emails.length === 0) return null

  return (
    <div className="bg-white rounded-lg border border-red-200 p-5 mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold text-red-700 flex items-center gap-2">
          <MailWarning size={16} /> Awaiting Reply ({emails.length})
        </h2>
        <Link href="/emails" className="text-xs text-one70-black hover:underline">View All →</Link>
      </div>
      <div className="space-y-2">
        {emails.map(e => {
          const days = Math.floor((Date.now() - new Date(e.received_at).getTime()) / (1000 * 60 * 60 * 24))
          const contact = e.contacts ? `${(e.contacts as any).first_name} ${(e.contacts as any).last_name}` : e.from_email
          return (
            <Link key={e.id} href="/emails"
              className="flex items-center gap-3 p-2 rounded-lg bg-red-50 hover:bg-red-100 transition-colors">
              <div className="flex items-center gap-1 text-red-500 shrink-0">
                <Clock size={12} />
                <span className="text-xs font-bold">{days}d</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-one70-black truncate">{e.subject}</p>
                <p className="text-xs text-one70-mid truncate">{contact}</p>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
