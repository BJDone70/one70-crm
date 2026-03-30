'use client'

import { useEffect, useState } from 'react'

const PAGES = [
  { id: '/', label: 'Dashboard', desc: 'Overview with tasks, pipeline, and stats' },
  { id: '/deals', label: 'Pipeline', desc: 'Deal pipeline with Kanban board' },
  { id: '/contacts', label: 'Contacts', desc: 'All contacts and decision makers' },
  { id: '/organizations', label: 'Organizations', desc: 'Companies and portfolios' },
  { id: '/projects', label: 'Projects', desc: 'Active construction projects' },
  { id: '/tasks', label: 'Tasks', desc: 'Tasks and follow-ups' },
  { id: '/analytics', label: 'Analytics', desc: 'Pipeline forecasting and reports' },
  { id: '/outreach', label: 'Outreach Queue', desc: 'Sequence actions due today' },
]

export default function TeamsConfigPage() {
  const [selected, setSelected] = useState('/')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    async function init() {
      try {
        const { app, pages } = await import('@microsoft/teams-js')
        await app.initialize()

        pages.config.registerOnSaveHandler((saveEvent) => {
          const baseUrl = window.location.origin
          const page = PAGES.find(p => p.id === selected)

          pages.config.setConfig({
            suggestedDisplayName: `ONE70 — ${page?.label || 'CRM'}`,
            entityId: `one70-${selected.replace(/\//g, '-') || 'dashboard'}`,
            contentUrl: `${baseUrl}${selected}?teams=1`,
            websiteUrl: `${baseUrl}${selected}`,
          })
          saveEvent.notifySuccess()
        })

        pages.config.setValidityState(true)
        setReady(true)
      } catch (err) {
        console.error('Teams SDK init failed:', err)
        setReady(true)
      }
    }
    init()
  }, [selected])

  return (
    <div style={{ padding: 24, fontFamily: 'Arial, sans-serif', maxWidth: 480 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <div style={{ width: 40, height: 40, background: '#1A1A1A', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ color: '#FFE500', fontWeight: 700, fontSize: 14 }}>170</span>
        </div>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: '#1A1A1A', margin: 0 }}>ONE70 CRM</h1>
          <p style={{ fontSize: 12, color: '#666', margin: 0 }}>Choose which page to display in this tab</p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {PAGES.map(page => (
          <button
            key={page.id}
            onClick={() => setSelected(page.id)}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
              padding: '12px 16px', borderRadius: 8, border: '2px solid',
              borderColor: selected === page.id ? '#FFE500' : '#e5e5e5',
              background: selected === page.id ? '#FFFDE7' : '#fff',
              cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
            }}
          >
            <span style={{ fontSize: 14, fontWeight: 600, color: '#1A1A1A' }}>{page.label}</span>
            <span style={{ fontSize: 12, color: '#666', marginTop: 2 }}>{page.desc}</span>
          </button>
        ))}
      </div>

      {!ready && (
        <p style={{ fontSize: 12, color: '#999', marginTop: 16, textAlign: 'center' }}>
          Connecting to Teams...
        </p>
      )}
    </div>
  )
}
