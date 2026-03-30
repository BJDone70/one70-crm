'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

export interface OrgRole { name: string; label: string }

const DEFAULTS: OrgRole[] = [
  { name: 'owner_operator', label: 'Owner / Operator' },
  { name: 'developer', label: 'Developer' },
  { name: 'architect_designer', label: 'Architect / Designer' },
  { name: 'gc_contractor', label: 'GC / Contractor' },
  { name: 'procurement_ffe', label: 'Procurement / FF&E' },
  { name: 'capital', label: 'Capital (PE / Lender)' },
  { name: 'advisor', label: 'Advisor (Tax / Broker / Valuation)' },
  { name: 'vendor', label: 'Vendor' },
]

export function useOrgRoles() {
  const [roles, setRoles] = useState<OrgRole[]>(DEFAULTS)

  const load = useCallback(() => {
    const supabase = createClient()
    supabase.from('org_roles').select('name, label').order('sort_order').then(({ data }) => {
      if (data?.length) setRoles(data)
    })
  }, [])

  useEffect(() => { load() }, [load])

  async function addRole(label: string): Promise<string | null> {
    const name = label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
    if (!name) return null
    const supabase = createClient()
    const maxOrder = roles.length
    const { error } = await supabase.from('org_roles').insert({ name, label: label.trim(), sort_order: maxOrder })
    if (error) return null
    load()
    return name
  }

  return { roles, addRole }
}
