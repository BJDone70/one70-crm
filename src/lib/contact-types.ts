// Contact type utilities - safe for server components (no 'use client')

const DEFAULTS: Record<string, { label: string; color: string }> = {
  client: { label: 'Client', color: 'bg-green-100 text-green-700' },
  prospect: { label: 'Prospect', color: 'bg-blue-100 text-blue-700' },
  strategic_partner: { label: 'Strategic Partner', color: 'bg-pink-100 text-pink-700' },
  vendor: { label: 'Vendor', color: 'bg-amber-100 text-amber-700' },
  internal: { label: 'Internal', color: 'bg-purple-100 text-purple-700' },
}

export function getContactTypeColor(typeName: string | null | undefined): string {
  if (!typeName) return 'bg-gray-100 text-gray-600'
  return DEFAULTS[typeName]?.color || 'bg-gray-100 text-gray-600'
}

export function getContactTypeLabel(typeName: string | null | undefined): string {
  if (!typeName) return ''
  return DEFAULTS[typeName]?.label || typeName.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}
