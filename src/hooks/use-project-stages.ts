'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ProjectStage, DEFAULT_PROJECT_STAGES } from '@/lib/project-stages'

export function useProjectStages() {
  const [stages, setStages] = useState<ProjectStage[]>(DEFAULT_PROJECT_STAGES)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase.from('project_stages').select('*').order('sort_order').then(({ data, error }) => {
      if (data?.length) {
        setStages(data.map(s => ({
          id: s.name,
          label: s.label,
          color: s.color || 'bg-gray-100 text-gray-600',
          sort_order: s.sort_order,
          is_terminal: s.is_terminal || false,
        })))
      }
      setLoading(false)
    })
  }, [])

  return { stages, loading }
}
