'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Phone, Mail, Users, FileText, Calendar, CheckCircle, ArrowUp, ArrowDown, MessageSquare, Columns3, ClipboardList } from 'lucide-react'

interface TimelineItem {
  id: string
  type: 'activity' | 'email' | 'meeting' | 'task' | 'deal_change' | 'note'
  icon: string
  title: string
  body: string | null
  date: string
  direction?: string
  metadata?: Record<string, any>
}

const iconMap: Record<string, any> = {
  call: Phone, email: Mail, meeting: Calendar, note: FileText,
  linkedin: Users, task: CheckCircle, deal: Columns3, step: ClipboardList,
}

const colorMap: Record<string, string> = {
  call: 'bg-green-50 text-green-600',
  email: 'bg-blue-50 text-blue-600',
  meeting: 'bg-purple-50 text-purple-600',
  note: 'bg-gray-100 text-gray-600',
  linkedin: 'bg-indigo-50 text-indigo-600',
  task: 'bg-yellow-50 text-yellow-700',
  deal: 'bg-amber-50 text-amber-600',
  step: 'bg-teal-50 text-teal-600',
}

export default function ContactTimeline({ contactId, orgId }: { contactId: string; orgId?: string | null }) {
  const [items, setItems] = useState<TimelineItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const allItems: TimelineItem[] = []

      // Fetch all data sources in parallel
      const [activitiesRes, emailsRes, meetingsRes, tasksRes] = await Promise.all([
        supabase.from('activities')
          .select('id, type, subject, body, direction, occurred_at')
          .eq('contact_id', contactId)
          .order('occurred_at', { ascending: false })
          .limit(50),
        supabase.from('email_interactions')
          .select('id, subject, snippet, direction, from_email, received_at')
          .eq('contact_id', contactId)
          .order('received_at', { ascending: false })
          .limit(30),
        supabase.from('meeting_tracking')
          .select('id, subject, meeting_date, location, attendees, notes')
          .eq('contact_id', contactId)
          .order('meeting_date', { ascending: false })
          .limit(20),
        supabase.from('tasks')
          .select('id, title, status, type, completed_at, created_at')
          .eq('contact_id', contactId)
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .limit(20),
      ])

      for (const a of activitiesRes.data || []) {
        allItems.push({
          id: `act-${a.id}`, type: 'activity', icon: a.type || 'note',
          title: a.subject, body: a.body, date: a.occurred_at,
          direction: a.direction,
        })
      }

      for (const e of emailsRes.data || []) {
        allItems.push({
          id: `email-${e.id}`, type: 'email', icon: 'email',
          title: `${e.direction === 'inbound' ? '← ' : '→ '}${e.subject}`,
          body: e.snippet, date: e.received_at, direction: e.direction,
          metadata: { from: e.from_email },
        })
      }

      for (const m of meetingsRes.data || []) {
        allItems.push({
          id: `meet-${m.id}`, type: 'meeting', icon: 'meeting',
          title: m.subject, body: [m.location, m.attendees].filter(Boolean).join(' · '),
          date: m.meeting_date,
        })
      }

      for (const t of tasksRes.data || []) {
        allItems.push({
          id: `task-${t.id}`, type: 'task', icon: 'task',
          title: `${t.status === 'completed' ? '✓ ' : '○ '}${t.title}`,
          body: t.type?.replace('_', ' ') || null,
          date: t.completed_at || t.created_at,
          metadata: { taskId: t.id, status: t.status },
        })
      }

      // Sort all by date descending
      allItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      setItems(allItems)
      setLoading(false)
    }
    load()
  }, [contactId])

  const filters = [
    { id: 'all', label: 'All' },
    { id: 'email', label: 'Emails' },
    { id: 'activity', label: 'Calls/Notes' },
    { id: 'meeting', label: 'Meetings' },
    { id: 'task', label: 'Tasks' },
  ]

  const filtered = filter === 'all' ? items : items.filter(i => i.type === filter || i.icon === filter)

  function formatDate(dateStr: string) {
    const d = new Date(dateStr)
    const now = new Date()
    const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))
    if (diffDays === 0) return `Today at ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return d.toLocaleDateString('en-US', { weekday: 'long' })
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-one70-mid uppercase tracking-wider">Timeline</h2>
        <span className="text-xs text-gray-400">{filtered.length} interactions</span>
      </div>

      {/* Filters */}
      <div className="flex gap-1 mb-4 overflow-x-auto scrollbar-hide">
        {filters.map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)}
            className={`px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
              filter === f.id ? 'bg-one70-black text-white' : 'bg-one70-gray text-one70-mid hover:bg-gray-200'
            }`}>
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-one70-mid text-center py-8">Loading timeline...</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-one70-mid text-center py-8">No interactions found</p>
      ) : (
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-[19px] top-2 bottom-2 w-px bg-one70-border" />

          <div className="space-y-0">
            {filtered.map((item, i) => {
              const Icon = iconMap[item.icon] || MessageSquare
              const color = colorMap[item.icon] || colorMap.note

              // Date separator
              const prevDate = i > 0 ? formatDate(filtered[i - 1].date) : null
              const thisDate = formatDate(item.date)
              const showDateHeader = thisDate !== prevDate

              return (
                <div key={item.id}>
                  {showDateHeader && (
                    <div className="flex items-center gap-2 py-2 pl-10">
                      <span className="text-[11px] font-semibold text-one70-mid">{thisDate}</span>
                      <div className="flex-1 h-px bg-one70-border" />
                    </div>
                  )}
                  <div className="flex gap-3 py-1.5 group">
                    <div className={`w-[38px] h-[38px] rounded-full flex items-center justify-center shrink-0 z-10 ${color}`}>
                      {item.direction === 'inbound' ? <ArrowDown size={14} /> : item.direction === 'outbound' ? <ArrowUp size={14} /> : <Icon size={14} />}
                    </div>
                    <div className="flex-1 min-w-0 pb-3">
                      <p className="text-sm text-one70-dark leading-tight">
                        {item.metadata?.taskId ? (
                          <Link href={`/tasks/${item.metadata.taskId}`} className="hover:underline">{item.title}</Link>
                        ) : (
                          item.title
                        )}
                      </p>
                      {item.body && <p className="text-xs text-one70-mid mt-0.5 line-clamp-2 whitespace-pre-wrap">{item.body}</p>}
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        {new Date(item.date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
