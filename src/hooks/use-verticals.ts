'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { buildVerticalOptions } from '@/lib/verticals'

export function useVerticals() {
  const [verticals, setVerticals] = useState(buildVerticalOptions([]))
  const [loaded, setLoaded] = useState(false)

  const load = useCallback(() => {
    const supabase = createClient()
    supabase.from('custom_verticals').select('name').order('name').then(({ data }) => {
      const custom = (data || []).map(v => v.name)
      setVerticals(buildVerticalOptions(custom))
      setLoaded(true)
    })
  }, [])

  useEffect(() => { load() }, [load])

  async function addVertical(name: string): Promise<string | null> {
    const clean = name.trim().toLowerCase().replace(/\s+/g, '_')
    if (!clean) return null
    const supabase = createClient()
    const { error } = await supabase.from('custom_verticals').insert({ name: clean })
    if (error) return null
    load() // refresh the list
    return clean
  }

  return { verticals, loaded, addVertical }
}
