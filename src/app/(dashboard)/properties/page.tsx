import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { MapPin, Plus } from 'lucide-react'
import PropertyFilters from './property-filters'

interface SearchParams { q?: string; vertical?: string; territory?: string }

export default async function PropertiesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams
  const supabase = await createClient()

  let query = supabase
    .from('properties')
    .select('*, organizations(name, vertical), territories(name, color)')
    .is('deleted_at', null)
    .order('name')

  if (params.q) {
    query = query.or(`name.ilike.%${params.q}%,city.ilike.%${params.q}%,state.ilike.%${params.q}%,brand_flag.ilike.%${params.q}%`)
  }
  if (params.vertical && params.vertical !== 'all') {
    query = query.eq('organizations.vertical', params.vertical)
  }
  if (params.territory) {
    const ids = params.territory.split(',').filter(Boolean)
    if (ids.length === 1) query = query.eq('territory_id', ids[0])
    else if (ids.length > 1) query = query.in('territory_id', ids)
  }

  const { data: properties } = await query

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-one70-black">Properties</h1>
          <p className="text-one70-mid text-sm mt-1">{properties?.length ?? 0} total</p>
        </div>
        <Link href="/properties/new" className="flex items-center justify-center gap-2 bg-one70-black text-white px-4 py-2.5 rounded-md text-sm font-semibold hover:bg-one70-dark transition-colors">
          <Plus size={18} /> Add Property
        </Link>
      </div>

      <PropertyFilters currentSearch={params.q} currentVertical={params.vertical} currentTerritory={params.territory} />

      {/* Desktop Table */}
      <div className="hidden md:block bg-white rounded-lg border border-one70-border overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-one70-black text-white text-sm">
              <th className="text-left px-4 py-3 font-semibold">Property</th>
              <th className="text-left px-4 py-3 font-semibold">Organization</th>
              <th className="text-left px-4 py-3 font-semibold">Location</th>
              <th className="text-left px-4 py-3 font-semibold">Size</th>
              <th className="text-left px-4 py-3 font-semibold">Brand / Type</th>
            </tr>
          </thead>
          <tbody>
            {properties && properties.length > 0 ? (
              properties.map((p, i) => (
                <tr key={p.id} className={`border-t border-one70-border hover:bg-one70-yellow-light transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-one70-gray'}`}>
                  <td className="px-4 py-3">
                    <Link href={`/properties/${p.id}`} className="font-medium text-one70-black hover:underline">{p.name}</Link>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {p.organizations ? (
                      <Link href={`/organizations/${p.org_id}`} className="text-one70-dark hover:underline">{(p.organizations as any).name}</Link>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-one70-dark">{[p.city, p.state].filter(Boolean).join(', ') || '—'}</td>
                  <td className="px-4 py-3 text-sm text-one70-dark">
                    {p.key_count ? `${p.key_count} keys` : p.unit_count ? `${p.unit_count} units` : p.bed_count ? `${p.bed_count} beds` : '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-one70-dark">{p.brand_flag || p.property_type || '—'}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-one70-mid">
                  <MapPin size={32} className="mx-auto mb-2 opacity-40" />
                  <p>No properties found</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-2">
        {properties && properties.length > 0 ? (
          properties.map(p => (
            <Link key={p.id} href={`/properties/${p.id}`}
              className="block bg-white rounded-lg border border-one70-border p-4 active:bg-one70-yellow-light transition-colors">
              <p className="font-semibold text-one70-black">{p.name}</p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-one70-mid">
                {p.organizations && <span>{(p.organizations as any).name}</span>}
                {(p.city || p.state) && <span>{[p.city, p.state].filter(Boolean).join(', ')}</span>}
              </div>
              <div className="flex flex-wrap gap-x-3 mt-2 text-xs text-one70-dark">
                {p.key_count ? <span>{p.key_count} keys</span> : p.unit_count ? <span>{p.unit_count} units</span> : p.bed_count ? <span>{p.bed_count} beds</span> : null}
                {(p.brand_flag || p.property_type) && <span>{p.brand_flag || p.property_type}</span>}
              </div>
            </Link>
          ))
        ) : (
          <div className="text-center py-12 text-one70-mid">
            <MapPin size={32} className="mx-auto mb-2 opacity-40" />
            <p className="text-sm">No properties found</p>
          </div>
        )}
      </div>
    </div>
  )
}
