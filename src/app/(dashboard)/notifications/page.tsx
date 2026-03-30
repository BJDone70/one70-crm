'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Bell, Check, CheckCheck, Trash2, Filter } from 'lucide-react'

interface Notification {
  id: string; type: string; title: string; body: string | null
  link: string | null; is_read: boolean; created_at: string
}

const typeIcons: Record<string, string> = {
  task_assigned: '📋', task_completed: '✅', task_overdue: '🔴',
  deal_stage: '📊', deal_won: '🎉', deal_lost: '❌',
  email_received: '📬', email_unreplied: '⚠️', contact_stale: '👤',
  mention: '💬', system: '🔔',
}

const typeLabels: Record<string, string> = {
  task_assigned: 'Task Assigned', task_completed: 'Task Done', task_overdue: 'Overdue',
  deal_stage: 'Deal Moved', deal_won: 'Deal Won', deal_lost: 'Deal Lost',
  email_received: 'Email', email_unreplied: 'Unreplied', contact_stale: 'Stale Contact',
  mention: 'Mention', system: 'System',
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const router = useRouter()

  useEffect(() => {
    async function load() {
      const res = await fetch('/api/notifications?limit=100')
      if (res.ok) {
        const data = await res.json()
        setNotifications(data.notifications || [])
      }
      setLoading(false)
    }
    load()
  }, [])

  async function markRead(id: string) {
    await fetch('/api/notifications', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'mark_read', id }),
    })
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
  }

  async function markAllRead() {
    await fetch('/api/notifications', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'mark_all_read' }),
    })
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
  }

  async function deleteNotification(id: string) {
    await fetch('/api/notifications', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', id }),
    })
    setNotifications(prev => prev.filter(n => n.id !== id))
  }

  function handleClick(n: Notification) {
    if (!n.is_read) markRead(n.id)
    if (n.link) router.push(n.link)
  }

  const unreadCount = notifications.filter(n => !n.is_read).length
  const filters = [
    { id: 'all', label: 'All' },
    { id: 'unread', label: `Unread (${unreadCount})` },
    { id: 'deals', label: 'Deals' },
    { id: 'tasks', label: 'Tasks' },
    { id: 'emails', label: 'Emails' },
  ]

  const filtered = notifications.filter(n => {
    if (filter === 'unread') return !n.is_read
    if (filter === 'deals') return ['deal_stage', 'deal_won', 'deal_lost'].includes(n.type)
    if (filter === 'tasks') return ['task_assigned', 'task_completed', 'task_overdue'].includes(n.type)
    if (filter === 'emails') return ['email_received', 'email_unreplied'].includes(n.type)
    return true
  })

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-one70-black flex items-center gap-2">
          <Bell size={24} /> Notifications
          {unreadCount > 0 && <span className="text-sm bg-red-500 text-white px-2 py-0.5 rounded-full">{unreadCount}</span>}
        </h1>
        {unreadCount > 0 && (
          <button onClick={markAllRead} className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1">
            <CheckCheck size={14} /> Mark all read
          </button>
        )}
      </div>

      <div className="flex gap-1 mb-4 overflow-x-auto scrollbar-hide">
        {filters.map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
              filter === f.id ? 'bg-one70-black text-white' : 'bg-one70-gray text-one70-mid hover:bg-gray-200'
            }`}>
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-center text-one70-mid py-12">Loading...</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-one70-mid">
          <Bell size={32} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">{filter === 'all' ? 'No notifications yet' : 'No matching notifications'}</p>
        </div>
      ) : (
        <div className="space-y-1">
          {filtered.map(n => (
            <div key={n.id}
              className={`flex items-start gap-3 p-3 rounded-lg border transition-colors cursor-pointer ${
                !n.is_read ? 'bg-blue-50/50 border-blue-100' : 'bg-white border-one70-border hover:bg-one70-gray'
              }`}
              onClick={() => handleClick(n)}>
              <span className="text-lg mt-0.5 shrink-0">{typeIcons[n.type] || '🔔'}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className={`text-sm ${!n.is_read ? 'font-semibold text-one70-black' : 'text-one70-dark'}`}>{n.title}</p>
                  <div className="flex items-center gap-1 shrink-0">
                    {!n.is_read && <div className="w-2 h-2 bg-blue-500 rounded-full" />}
                    <button onClick={e => { e.stopPropagation(); deleteNotification(n.id) }}
                      className="p-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100"><Trash2 size={12} /></button>
                  </div>
                </div>
                {n.body && <p className="text-xs text-one70-mid mt-0.5">{n.body}</p>}
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] text-gray-400">{timeAgo(n.created_at)}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">{typeLabels[n.type] || n.type}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
