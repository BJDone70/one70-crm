// Org role utilities - safe for server components (no 'use client')

const DEFAULTS: Record<string, string> = {
  owner_operator: 'Owner / Operator',
  developer: 'Developer',
  architect_designer: 'Architect / Designer',
  gc_contractor: 'GC / Contractor',
  procurement_ffe: 'Procurement / FF&E',
  capital: 'Capital (PE / Lender)',
  advisor: 'Advisor (Tax / Broker / Valuation)',
  vendor: 'Vendor',
}

export function getOrgRoleLabel(name: string | null | undefined): string {
  if (!name) return ''
  return DEFAULTS[name] || name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}
