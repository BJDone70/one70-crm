'use client'

import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, Columns3, Users, CalendarCheck, MoreHorizontal, X } from 'lucide-react'
import { useState } from 'react'
import Link from 'next/link'
import {
  Building2, MapPin, Activity, Zap, Send, FolderKanban, BarChart3,
  Upload, Mail, ClipboardPaste, MessageSquare, Settings, Shield, Layers, Map, Bell, Database
} from 'lucide-react'

const primaryTabs = [
  { href: '/', label: 'Home', icon: LayoutDashboard },
  { href: '/deals', label: 'Pipeline', icon: Columns3 },
  { href: '/contacts', label: 'Contacts', icon: Users },
  { href: '/tasks', label: 'Tasks', icon: CalendarCheck },
]

const moreItems = [
  { href: '/organizations', label: 'Organizations', icon: Building2 },
  { href: '/projects', label: 'Projects', icon: FolderKanban },
  { href: '/properties', label: 'Properties', icon: MapPin },
  { href: '/sequences', label: 'Sequences', icon: Zap },
  { href: '/outreach', label: 'Outreach', icon: Send },
  { href: '/activities', label: 'Activities', icon: Activity },
  { href: '/emails', label: 'Communications', icon: Mail },
  { href: '/ingest', label: 'Paste & Process', icon: ClipboardPaste },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/feedback', label: 'Feedback', icon: MessageSquare },
  { href: '/settings/integrations', label: 'Integrations', icon: Zap },
]

const adminMoreItems = [
  { href: '/settings/users', label: 'Users', icon: Settings },
  { href: '/settings/roles', label: 'Roles', icon: Shield },
  { href: '/settings/verticals', label: 'Verticals', icon: Layers },
  { href: '/settings/org-roles', label: 'Org Roles', icon: Building2 },
  { href: '/settings/project-stages', label: 'Stages', icon: Layers },
  { href: '/settings/territories', label: 'Territories', icon: Map },
  { href: '/settings/notifications', label: 'Notifications', icon: Bell },
  { href: '/settings/data', label: 'Backups', icon: Database },
  { href: '/import', label: 'Import', icon: Upload },
]

export default function BottomTabBar({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname()
  const router = useRouter()
  const [showMore, setShowMore] = useState(false)

  function isActive(href: string) {
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href)
  }

  // Check if current page is in the "more" section
  const isMoreActive = [...moreItems, ...adminMoreItems].some(i => isActive(i.href))

  return (
    <>
      {/* More menu overlay */}
      {showMore && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/40" onClick={() => setShowMore(false)}>
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl max-h-[70vh] overflow-y-auto overscroll-contain"
            style={{ paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))' }}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 pt-4 pb-2 sticky top-0 bg-white z-10">
              <h3 className="text-base font-bold text-one70-black">More</h3>
              <button onClick={() => setShowMore(false)} className="p-2 -mr-2 rounded-full active:bg-gray-100">
                <X size={20} className="text-gray-500" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-1 px-3 pb-3">
              {moreItems.map(item => {
                const Icon = item.icon
                const active = isActive(item.href)
                return (
                  <Link key={item.href} href={item.href} onClick={() => setShowMore(false)}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl text-center active:bg-gray-100 transition-colors ${
                      active ? 'bg-one70-yellow/20 text-one70-black' : 'text-gray-600'
                    }`}>
                    <Icon size={22} />
                    <span className="text-[11px] font-medium leading-tight">{item.label}</span>
                  </Link>
                )
              })}
            </div>
            {isAdmin && (
              <>
                <div className="px-5 pt-2 pb-1">
                  <span className="text-[10px] font-semibold text-one70-mid uppercase tracking-wider">Admin</span>
                </div>
                <div className="grid grid-cols-3 gap-1 px-3 pb-4">
                  {adminMoreItems.map(item => {
                    const Icon = item.icon
                    const active = isActive(item.href)
                    return (
                      <Link key={item.href} href={item.href} onClick={() => setShowMore(false)}
                        className={`flex flex-col items-center gap-1.5 p-3 rounded-xl text-center active:bg-gray-100 transition-colors ${
                          active ? 'bg-one70-yellow/20 text-one70-black' : 'text-gray-600'
                        }`}>
                        <Icon size={22} />
                        <span className="text-[11px] font-medium leading-tight">{item.label}</span>
                      </Link>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Tab bar */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-one70-border"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <div className="flex items-stretch">
          {primaryTabs.map(tab => {
            const Icon = tab.icon
            const active = isActive(tab.href)
            return (
              <Link key={tab.href} href={tab.href}
                className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors ${
                  active ? 'text-one70-black' : 'text-gray-400'
                }`}>
                <Icon size={22} strokeWidth={active ? 2.5 : 1.5} />
                <span className={`text-[10px] ${active ? 'font-bold' : 'font-medium'}`}>{tab.label}</span>
                {active && <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-one70-yellow rounded-full" />}
              </Link>
            )
          })}
          <button onClick={() => setShowMore(!showMore)}
            className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors relative ${
              isMoreActive || showMore ? 'text-one70-black' : 'text-gray-400'
            }`}>
            <MoreHorizontal size={22} strokeWidth={isMoreActive || showMore ? 2.5 : 1.5} />
            <span className={`text-[10px] ${isMoreActive || showMore ? 'font-bold' : 'font-medium'}`}>More</span>
            {(isMoreActive || showMore) && <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-one70-yellow rounded-full" />}
          </button>
        </div>
      </nav>
    </>
  )
}
