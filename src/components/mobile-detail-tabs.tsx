'use client'

import { useState, ReactNode } from 'react'

interface Tab {
  id: string
  label: string
  content: ReactNode
}

interface Props {
  tabs: Tab[]
  defaultTab?: string
}

export default function MobileDetailTabs({ tabs, defaultTab }: Props) {
  const [active, setActive] = useState(defaultTab || tabs[0]?.id || '')

  return (
    <div>
      {/* Tab bar — scrollable on mobile, static on desktop */}
      <div className="flex border-b border-one70-border mb-4 overflow-x-auto -mx-3 px-3 lg:mx-0 lg:px-0" style={{ WebkitOverflowScrolling: 'touch' }}>
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActive(tab.id)}
            className={`shrink-0 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              active === tab.id
                ? 'border-one70-black text-one70-black'
                : 'border-transparent text-one70-mid hover:text-one70-dark'
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tabs.map(tab => (
        <div key={tab.id} className={active === tab.id ? 'block' : 'hidden'}>
          {tab.content}
        </div>
      ))}
    </div>
  )
}
