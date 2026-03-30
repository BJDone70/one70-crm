'use client'

import { useEffect } from 'react'
import { useSearchParams } from 'next/navigation'

export default function TeamsInit() {
  const searchParams = useSearchParams()
  const isTeams = searchParams.get('teams') === '1'

  useEffect(() => {
    if (!isTeams) return

    async function init() {
      try {
        const { app } = await import('@microsoft/teams-js')
        await app.initialize()

        // Add teams class to body for CSS adjustments
        document.body.classList.add('in-teams')
      } catch {
        // Not in Teams context — silently ignore
      }
    }
    init()
  }, [isTeams])

  // Inject CSS to hide sidebar when in Teams (Teams has its own navigation)
  if (!isTeams) return null

  return (
    <style>{`
      .in-teams .sidebar-container { display: none !important; }
      .in-teams .main-with-sidebar { margin-left: 0 !important; }
      .in-teams .mobile-header { display: none !important; }
    `}</style>
  )
}
