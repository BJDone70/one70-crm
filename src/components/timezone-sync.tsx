'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function TimezoneSync() {
  useEffect(() => {
    async function syncTimezone() {
      try {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
        if (!tz) return

        // Check if already synced this session
        const cached = sessionStorage.getItem('one70_tz_synced')
        if (cached === tz) return

        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        // Only update if different
        const { data: profile } = await supabase
          .from('profiles')
          .select('timezone')
          .eq('id', user.id)
          .single()

        if (profile?.timezone !== tz) {
          await supabase
            .from('profiles')
            .update({ timezone: tz })
            .eq('id', user.id)
        }

        sessionStorage.setItem('one70_tz_synced', tz)
      } catch {}
    }

    syncTimezone()
  }, [])

  return null
}
