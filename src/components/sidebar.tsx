'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Building2, Users, MapPin, Activity, LayoutDashboard,
  Settings, LogOut, Menu, X, Columns3, CalendarCheck, BarChart3, Upload,
  Zap, Send, FolderKanban, Map, Bell, MessageSquare, Database, ClipboardPaste, Mail, Shield, Layers
} from 'lucide-react'
import { useState, useEffect } from 'react'
import GlobalSearch from '@/components/global-search'
import NotificationBell from '@/components/notification-bell'

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/deals', label: 'Pipeline', icon: Columns3 },
  { href: '/sequences', label: 'Sequences', icon: Zap },
  { href: '/outreach', label: 'Outreach Queue', icon: Send },
  { href: '/organizations', label: 'Organizations', icon: Building2 },
  { href: '/contacts', label: 'Contacts', icon: Users },
  { href: '/properties', label: 'Properties', icon: MapPin },
  { href: '/projects', label: 'Projects', icon: FolderKanban },
  { href: '/tasks', label: 'Tasks', icon: CalendarCheck },
  { href: '/activities', label: 'Activities', icon: Activity },
  { href: '/emails', label: 'Communications', icon: Mail },
  { href: '/ingest', label: 'Paste & Process', icon: ClipboardPaste },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/feedback', label: 'Feedback', icon: MessageSquare },
  { href: '/settings/integrations', label: 'Integrations', icon: Zap },
]

const adminItems = [
  { href: '/settings/users', label: 'User Management', icon: Settings },
  { href: '/settings/roles', label: 'Roles & Permissions', icon: Shield },
  { href: '/settings/verticals', label: 'Verticals', icon: Layers },
  { href: '/settings/org-roles', label: 'Org Roles', icon: Building2 },
  { href: '/settings/project-stages', label: 'Project Stages', icon: Layers },
  { href: '/settings/territories', label: 'Territories', icon: Map },
  { href: '/settings/notifications', label: 'Notifications', icon: Bell },
  { href: '/settings/data', label: 'Data & Backups', icon: Database },
  { href: '/import', label: 'Import Data', icon: Upload },
]

interface SidebarProps {
  userRole: string
  userName: string
}

export default function Sidebar({ userRole, userName }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [orderedNav, setOrderedNav] = useState(navItems)
  const [editMode, setEditMode] = useState(false)

  function moveItem(idx: number, dir: -1 | 1) {
    const next = [...orderedNav]
    const newIdx = idx + dir
    if (newIdx < 0 || newIdx >= next.length) return
    ;[next[idx], next[newIdx]] = [next[newIdx], next[idx]]
    setOrderedNav(next)
  }

  // Load saved nav order from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('one70_nav_order')
      if (saved) {
        const order: string[] = JSON.parse(saved)
        const reordered = order
          .map(href => navItems.find(n => n.href === href))
          .filter(Boolean) as typeof navItems
        // Add any new items not in saved order
        const missing = navItems.filter(n => !order.includes(n.href))
        setOrderedNav([...reordered, ...missing])
      }
    } catch {}
  }, [])

  // Close mobile nav on route change
  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  // Prevent body scroll when mobile nav is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [mobileOpen])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href)
  }

  const navContent = (
    <>
      {/* Logo */}
      <div className="flex items-center justify-between px-4 h-16 border-b border-white/10 shrink-0">
        <Link href="/" className="flex items-center gap-2">
          <img src="/logo-white.png" alt="ONE70 Group" className="h-9 w-auto" />
          <span className="text-xs text-one70-mid uppercase tracking-wider">CRM</span>
        </Link>
        <button
          onClick={() => setMobileOpen(false)}
          className="lg:hidden p-1 rounded hover:bg-white/10 transition-colors"
          aria-label="Close menu"
        >
          <X size={20} />
        </button>
      </div>

      {/* Search + Notifications */}
      <div className="px-3 py-3 border-b border-white/10 flex items-center gap-2">
        <div className="flex-1"><GlobalSearch /></div>
        <div className="hidden lg:block"><NotificationBell /></div>
      </div>

      {/* Nav items */}
      <nav className="flex-1 py-2 px-2 space-y-0.5 overflow-y-auto">
        <div className="flex items-center justify-between px-2 pb-1">
          <span className="text-[10px] text-one70-mid uppercase tracking-wider">Menu</span>
          <button onClick={() => {
            if (editMode) {
              try { localStorage.setItem('one70_nav_order', JSON.stringify(orderedNav.map(n => n.href))) } catch {}
            }
            setEditMode(!editMode)
          }} className="text-[11px] text-one70-mid hover:text-white active:text-white px-2 py-1 rounded transition-colors">
            {editMode ? '✓ Done' : 'Edit'}
          </button>
        </div>
        {orderedNav.map((item, idx) => {
          const Icon = item.icon
          const active = isActive(item.href)
          return (
            <div key={item.href} className="flex items-center gap-0.5">
              {editMode && (
                <div className="flex shrink-0 gap-0.5">
                  <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); moveItem(idx, -1) }} disabled={idx === 0}
                    className="w-8 h-8 flex items-center justify-center rounded text-gray-400 active:bg-white/20 disabled:opacity-20">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 15l-6-6-6 6"/></svg>
                  </button>
                  <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); moveItem(idx, 1) }} disabled={idx === orderedNav.length - 1}
                    className="w-8 h-8 flex items-center justify-center rounded text-gray-400 active:bg-white/20 disabled:opacity-20">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M6 9l6 6 6-6"/></svg>
                  </button>
                </div>
              )}
              <Link
                href={item.href}
                className={`flex-1 flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[13px] font-medium transition-colors ${
                  active
                    ? 'bg-one70-yellow text-one70-black'
                    : 'text-gray-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon size={16} className="shrink-0" />
                <span>{item.label}</span>
              </Link>
            </div>
          )
        })}

        {userRole === 'admin' && (
          <>
            <div className="pt-3 pb-1 px-2">
              <span className="text-[10px] text-one70-mid uppercase tracking-wider">Admin</span>
            </div>
            {adminItems.map((item) => {
              const Icon = item.icon
              const active = isActive(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[13px] font-medium transition-colors ${
                    active
                      ? 'bg-one70-yellow text-one70-black'
                      : 'text-gray-300 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <Icon size={16} className="shrink-0" />
                  <span>{item.label}</span>
                </Link>
              )
            })}
          </>
        )}
      </nav>

      {/* User info + logout */}
      <div className="border-t border-white/10 p-3 shrink-0">
        <div className="mb-2 px-1">
          <p className="text-sm font-medium text-white truncate">{userName}</p>
          <p className="text-xs text-one70-mid capitalize">{userRole}</p>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-md text-sm text-gray-400 hover:bg-white/10 hover:text-white transition-colors"
        >
          <LogOut size={18} className="shrink-0" />
          <span>Sign Out</span>
        </button>
      </div>
    </>
  )

  return (
    <>
      {/* Mobile top bar — background extends behind status bar, content sits below safe area */}
      <div className="mobile-header lg:hidden fixed top-0 left-0 right-0 bg-one70-black text-white z-50" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="h-12 flex items-center justify-between px-4">
          <a href="/" onClick={(e) => { e.preventDefault(); router.push('/') }} className="flex items-center gap-2">
            <img src="/logo-white.png" alt="ONE70 Group" className="h-7 w-auto" />
            <span className="text-[10px] text-one70-mid uppercase tracking-wider">CRM</span>
          </a>
          <div className="flex items-center gap-1">
            <NotificationBell />
            <button
              onClick={() => setMobileOpen(true)}
              className="p-2 rounded hover:bg-white/10 transition-colors"
              aria-label="Open menu"
            >
              <Menu size={20} />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-50"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar - desktop: fixed left, mobile: slide-out drawer */}
      <aside
        className={`fixed top-0 left-0 h-full bg-one70-black text-white flex flex-col z-50 w-64 transition-transform duration-200 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0`}
      >
        {navContent}
      </aside>
    </>
  )
}
