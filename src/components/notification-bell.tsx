'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, Check, CheckCheck, Trash2, X } from 'lucide-react'

interface Notification {
  id: string
  type: string
  title: string
  body: string | null
  link: string | null
  is_read: boolean
  created_at: string
}

const typeIcons: Record<string, string> = {
  task_assigned: '📋', task_completed: '✅', task_overdue: '🔴',
  deal_stage: '📊', deal_won: '🎉', deal_lost: '❌',
  email_received: '📬', email_unreplied: '⚠️', contact_stale: '👤',
  mention: '💬', system: '🔔',
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d`
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  async function load() {
    try {
      const res = await fetch('/api/notifications?limit=20')
      if (res.ok) {
        const data = await res.json()
        setNotifications(data.notifications || [])
        setUnreadCount(data.unreadCount || 0)
      }
    } catch {}
  }

  useEffect(() => {
    load()
    // Poll every 60 seconds
    const interval = setInterval(load, 60000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setIsOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function markRead(id: string) {
    await fetch('/api/notifications', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'mark_read', id }),
    })
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
    setUnreadCount(prev => Math.max(0, prev - 1))
  }

  async function markAllRead() {
    setLoading(true)
    await fetch('/api/notifications', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'mark_all_read' }),
    })
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    setUnreadCount(0)
    setLoading(false)
  }

  function handleClick(n: Notification) {
    if (!n.is_read) markRead(n.id)
    if (n.link) { router.push(n.link); setIsOpen(false) }
  }

  return (
    <div ref={containerRef} className="relative">
      <button onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg hover:bg-one70-gray transition-colors"
        aria-label={unreadCount > 0 ? `Notifications (${unreadCount} unread)` : 'Notifications'}>
        <Bell size={20} className="text-one70-mid" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-[59]" onClick={() => setIsOpen(false)} />
          {/* Panel */}
          <div className="fixed left-0 right-0 w-full sm:left-auto sm:right-4 sm:w-96 sm:max-w-[calc(100vw-2rem)] bg-white rounded-b-xl sm:rounded-xl border border-one70-border shadow-2xl z-[60] max-h-[70vh] flex flex-col lg:left-64"
            style={{ top: 'calc(3rem + env(safe-area-inset-top, 0px))' }}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-one70-border">
            <h3 className="text-sm font-bold text-one70-black">Notifications</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button onClick={markAllRead} disabled={loading}
                  className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1">
                  <CheckCheck size={12} /> Mark all read
                </button>
              )}
              <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={16} />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="overflow-y-auto flex-1">
            {notifications.length === 0 ? (
              <div className="text-center py-8 text-one70-mid">
                <Bell size={24} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">No notifications yet</p>
              </div>
            ) : (
              notifications.map(n => (
                <button key={n.id} onClick={() => handleClick(n)}
                  className={`w-full text-left px-4 py-3 border-b border-one70-border last:border-0 hover:bg-one70-gray transition-colors ${!n.is_read ? 'bg-blue-50/50' : ''}`}>
                  <div className="flex gap-3">
                    <span className="text-base mt-0.5 shrink-0">{typeIcons[n.type] || '🔔'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-sm ${!n.is_read ? 'font-semibold text-one70-black' : 'text-one70-dark'}`}>{n.title}</p>
                        {!n.is_read && <div className="w-2 h-2 bg-blue-500 rounded-full shrink-0 mt-1.5" />}
                      </div>
                      {n.body && <p className="text-xs text-one70-mid mt-0.5 line-clamp-2">{n.body}</p>}
                      <p className="text-[10px] text-gray-400 mt-1">{timeAgo(n.created_at)}</p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-4 py-2 border-t border-one70-border">
              <button onClick={() => { router.push('/notifications'); setIsOpen(false) }}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium w-full text-center">
                View all notifications
              </button>
            </div>
          )}
        </div>
        </>
      )}
    </div>
  )
}
