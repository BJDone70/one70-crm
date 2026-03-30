import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Building2, Plus } from 'lucide-react'
import OrgFilters from './org-filters'
import { formatVerticalLabel, getVerticalColor } from '@/lib/verticals'
import { getOrgRoleLabel } from '@/lib/org-roles'

interface SearchParams {
  vertical?: string
  priority?: string
  role?: string
  q?: string
  territory?: string
}

export default async function OrganizationsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams
  const supabase = await createClient()

  let query = supabase
    .from('organizations')
    .select('*, contacts(count)')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (params.vertical && params.vertical !== 'all') {
    const verts = params.vertical.split(',').filter(Boolean)
    if (verts.length === 1) { query = query.overlaps('verticals', verts) }
    else if (verts.length > 1) { query = query.overlaps('verticals', verts) }
  }
  if (params.priority && params.priority !== 'all') {
    query = query.eq('priority_rating', params.priority)
  }
  if (params.role && params.role !== 'all') {
    const roles = params.role.split(',').filter(Boolean)
    if (roles.length === 1) { query = query.eq('org_role', roles[0]) }
    else if (roles.length > 1) { query = query.in('org_role', roles) }
  }
  if (params.territory) {
    const ids = params.territory.split(',').filter(Boolean)
    if (ids.length === 1) { query = query.eq('territory_id', ids[0]) }
    else if (ids.length > 1) { query = query.in('territory_id', ids) }
  }
  if (params.q) {
    query = query.or(`name.ilike.%${params.q}%,hq_city.ilike.%${params.q}%,hq_state.ilike.%${params.q}%`)
  }

  const { data: orgs, error } = await query

  const priorityColors: Record<string, string> = {
    high: 'bg-red-100 text-red-800',
    medium_high: 'bg-orange-100 text-orange-800',
    medium: 'bg-blue-100 text-blue-800',
    low: 'bg-gray-100 text-gray-600',
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-one70-black">Organizations</h1>
          <p className="text-one70-mid text-sm mt-1">{orgs?.length ?? 0} total</p>
        </div>
        <Link
          href="/organizations/new"
          className="flex items-center justify-center gap-2 bg-one70-black text-white px-4 py-2.5 rounded-md text-sm font-semibold hover:bg-one70-dark transition-colors"
        >
          <Plus size={18} />
          Add Organization
        </Link>
      </div>

      {/* Filters */}
      <OrgFilters currentVertical={params.vertical} currentPriority={params.priority} currentSearch={params.q} currentTerritory={params.territory} currentRole={params.role} />

      {/* Desktop Table */}
      <div className="hidden md:block bg-white rounded-lg border border-one70-border overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-one70-black text-white text-sm">
              <th className="text-left px-4 py-3 font-semibold">Organization</th>
              <th className="text-left px-4 py-3 font-semibold">Vertical</th>
              <th className="text-left px-4 py-3 font-semibold">Role</th>
              <th className="text-left px-4 py-3 font-semibold">Location</th>
              <th className="text-left px-4 py-3 font-semibold">Portfolio</th>
              <th className="text-left px-4 py-3 font-semibold">Priority</th>
              <th className="text-left px-4 py-3 font-semibold">Contacts</th>
            </tr>
          </thead>
          <tbody>
            {orgs && orgs.length > 0 ? (
              orgs.map((org, i) => (
                <tr key={org.id} className={`border-t border-one70-border hover:bg-one70-yellow-light transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-one70-gray'}`}>
                  <td className="px-4 py-3">
                    <Link href={`/organizations/${org.id}`} className="font-medium text-one70-black hover:underline">{org.name}</Link>
                    {org.website && <p className="text-xs text-one70-mid mt-0.5">{org.website}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(org.verticals?.length ? org.verticals : [org.vertical]).map((v: string) => (
                        <span key={v} className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${getVerticalColor(v)}`}>{formatVerticalLabel(v)}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-one70-dark">
                    {org.org_role ? (
                      <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">{getOrgRoleLabel(org.org_role)}</span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-one70-dark">{[org.hq_city, org.hq_state].filter(Boolean).join(', ') || '—'}</td>
                  <td className="px-4 py-3 text-sm text-one70-dark">{org.portfolio_size ? `${org.portfolio_size} properties` : '—'}</td>
                  <td className="px-4 py-3">
                    {org.priority_rating ? (
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${priorityColors[org.priority_rating] || ''}`}>{org.priority_rating.replace('_', '-').toUpperCase()}</span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-one70-dark">{(org.contacts as any)?.[0]?.count ?? 0}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-one70-mid">
                  <Building2 size={32} className="mx-auto mb-2 opacity-40" />
                  <p>No organizations found</p>
                  <Link href="/organizations/new" className="text-sm text-one70-black font-medium hover:underline mt-1 inline-block">Add your first organization</Link>
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-2">
        {orgs && orgs.length > 0 ? (
          orgs.map(org => (
            <Link key={org.id} href={`/organizations/${org.id}`}
              className="block bg-white rounded-lg border border-one70-border p-4 active:bg-one70-yellow-light transition-colors">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-one70-black">{org.name}</p>
                  <p className="text-xs text-one70-mid mt-0.5">{[org.hq_city, org.hq_state].filter(Boolean).join(', ') || ''}</p>
                </div>
                <div className="flex flex-wrap gap-1">
                  {(org.verticals?.length ? org.verticals : [org.vertical]).map((v: string) => (
                    <span key={v} className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${getVerticalColor(v)}`}>{formatVerticalLabel(v)}</span>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-one70-mid">
                {org.org_role && <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-100 text-indigo-800">{getOrgRoleLabel(org.org_role)}</span>}
                {org.portfolio_size && <span>{org.portfolio_size} properties</span>}
                {org.priority_rating && <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${priorityColors[org.priority_rating] || ''}`}>{org.priority_rating.toUpperCase()}</span>}
                <span>{(org.contacts as any)?.[0]?.count ?? 0} contacts</span>
              </div>
            </Link>
          ))
        ) : (
          <div className="text-center py-12 text-one70-mid">
            <Building2 size={32} className="mx-auto mb-2 opacity-40" />
            <p className="text-sm">No organizations found</p>
            <Link href="/organizations/new" className="text-sm text-one70-black font-medium hover:underline mt-1 inline-block">Add your first organization</Link>
          </div>
        )}
      </div>
    </div>
  )
}
