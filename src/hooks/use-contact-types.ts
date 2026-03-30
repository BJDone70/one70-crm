'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export interface ContactType {
  name: string
  label: string
  color: string
}

const DEFAULTS: ContactType[] = [
  { name: 'client', label: 'Client', color: 'bg-green-100 text-green-700' },
  { name: 'prospect', label: 'Prospect', color: 'bg-blue-100 text-blue-700' },
  { name: 'strategic_partner', label: 'Strategic Partner', color: 'bg-pink-100 text-pink-700' },
  { name: 'vendor', label: 'Vendor', color: 'bg-amber-100 text-amber-700' },
  { name: 'internal', label: 'Internal', color: 'bg-purple-100 text-purple-700' },
]

export function useContactTypes() {
  const [types, setTypes] = useState<ContactType[]>(DEFAULTS)

  useEffect(() => {
    const supabase = createClient()
    supabase.from('contact_types').select('name, label, color').order('created_at').then(({ data }) => {
      if (data?.length) setTypes(data)
    })
  }, [])

  return types
}

export function getContactTypeColor(typeName: string): string {
  const found = DEFAULTS.find(t => t.name === typeName)
  if (found) return found.color
  return 'bg-gray-100 text-gray-600'
}

export function getContactTypeLabel(typeName: string): string {
  const found = DEFAULTS.find(t => t.name === typeName)
  if (found) return found.label
  return typeName.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}
