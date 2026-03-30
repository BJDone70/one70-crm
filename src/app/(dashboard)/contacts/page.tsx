'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Users, Plus, Search, ArrowUpDown, ArrowUp, ArrowDown, Star, Filter, X } from 'lucide-react'
import { useVerticals } from '@/hooks/use-verticals'
import { formatVerticalLabel } from '@/lib/verticals'
import ImportM365Contacts from '@/components/import-m365-contacts'

interface Contact {
  id: string
  first_name: string
  last_name: string
  title: string | null
  email: string | null
  phone: string | null
  mobile_phone: string | null
  org_id: string | null
  contact_type: string | null
  is_decision_maker: boolean
  is_prime_contact: boolean
  is_referrer: boolean
  organizations: { name: string; vertical: string } | null
}

type SortField = 'name' | 'title' | 'organization' | 'email' | 'phone'
type SortDir = 'asc' | 'desc'

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sortField, setSortField] = useState<SortField>('name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [filterVertical, setFilterVertical] = useState('')
  const [filterRole, setFilterRole] = useState('')
  const [filterType, setFilterType] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const { verticals } = useVerticals()
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('contacts')
        .select('id, first_name, last_name, title, email, phone, mobile_phone, org_id, contact_type, is_decision_maker, is_prime_contact, is_referrer, organizations(name, vertical)')
        .is('deleted_at', null)
        .order('last_name')
      setContacts((data as any) || [])
      setLoading(false)
    }
    load()
  }, [])

  const filtered = useMemo(() => {
    let list = [...contacts]
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(c =>
        `${c.first_name} ${c.last_name}`.toLowerCase().includes(q) ||
        (c.email || '').toLowerCase().includes(q) ||
        (c.title || '').toLowerCase().includes(q) ||
        (c.organizations?.name || '').toLowerCase().includes(q)
      )
    }
    if (filterVertical) list = list.filter(c => c.organizations?.vertical === filterVertical)
    if (filterType) list = list.filter(c => c.contact_type === filterType)
    if (filterRole === 'decision_maker') list = list.filter(c => c.is_decision_maker)
    if (filterRole === 'prime_contact') list = list.filter(c => c.is_prime_contact)
    if (filterRole === 'referrer') list = list.filter(c => c.is_referrer)

    list.sort((a, b) => {
      let aVal = '', bVal = ''
      switch (sortField) {
        case 'name': aVal = `${a.last_name} ${a.first_name}`.toLowerCase(); bVal = `${b.last_name} ${b.first_name}`.toLowerCase(); break
        case 'title': aVal = (a.title || '').toLowerCase(); bVal = (b.title || '').toLowerCase(); break
        case 'organization': aVal = (a.organizations?.name || '').toLowerCase(); bVal = (b.organizations?.name || '').toLowerCase(); break
        case 'email': aVal = (a.email || '').toLowerCase(); bVal = (b.email || '').toLowerCase(); break
        case 'phone': aVal = (a.phone || '').toLowerCase(); bVal = (b.phone || '').toLowerCase(); break
      }
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1
      return 0
    })
    return list
  }, [contacts, search, sortField, sortDir, filterVertical, filterRole, filterType])

  function toggleSort(field: SortField) {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('asc') }
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return <ArrowUpDown size={12} className="text-white/40" />
    return sortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
  }

  const hasFilters = filterVertical || filterRole || filterType

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-one70-black">Contacts</h1>
          <p className="text-one70-mid text-sm mt-1">{filtered.length} of {contacts.length} contacts</p>
        </div>
        <ImportM365Contacts />
        <Link href="/contacts/new" className="flex items-center justify-center gap-2 bg-one70-black text-white px-4 py-2.5 rounded-md text-sm font-semibold hover:bg-one70-dark transition-colors">
          <Plus size={18} /> Add Contact
        </Link>
      </div>

      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search contacts..."
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-one70-border rounded-md focus:outline-none focus:border-one70-black" />
        </div>
        <button onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-1.5 px-3 py-2.5 text-sm rounded-md border transition-colors ${hasFilters ? 'bg-one70-yellow border-one70-yellow text-one70-black font-semibold' : 'border-one70-border text-one70-mid hover:bg-one70-gray'}`}>
          <Filter size={14} /> Filters {hasFilters && `(${[filterVertical, filterRole, filterType].filter(Boolean).length})`}
        </button>
      </div>

      {showFilters && (
        <div className="flex flex-wrap gap-3 mb-4 p-3 bg-one70-gray rounded-lg">
          <select value={filterVertical} onChange={e => setFilterVertical(e.target.value)} className="text-sm border border-one70-border rounded-md px-3 py-2 bg-white">
            <option value="">All Verticals</option>
            {verticals.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
          </select>
          <select value={filterRole} onChange={e => setFilterRole(e.target.value)} className="text-sm border border-one70-border rounded-md px-3 py-2 bg-white">
            <option value="">All Roles</option>
            <option value="decision_maker">Decision Makers</option>
            <option value="prime_contact">Prime Contacts</option>
            <option value="referrer">Referrers</option>
          </select>
          <select value={filterType} onChange={e => setFilterType(e.target.value)} className="text-sm border border-one70-border rounded-md px-3 py-2 bg-white">
            <option value="">All Types</option>
            <option value="client">Client</option>
            <option value="prospect">Prospect</option>
            <option value="strategic_partner">Strategic Partner</option>
            <option value="vendor">Vendor</option>
            <option value="internal">Internal</option>
          </select>
          {hasFilters && (
            <button onClick={() => { setFilterVertical(''); setFilterRole(''); setFilterType('') }} className="flex items-center gap-1 text-xs text-red-600 hover:underline">
              <X size={12} /> Clear
            </button>
          )}
        </div>
      )}

      {/* Desktop table view */}
      <div className="hidden md:block bg-white rounded-lg border border-one70-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-one70-black text-white text-sm">
                {([['name', 'Name'], ['title', 'Title'], ['organization', 'Organization'], ['email', 'Email'], ['phone', 'Phone']] as [SortField, string][]).map(([field, label]) => (
                  <th key={field} className="text-left px-4 py-3 font-semibold">
                    <button onClick={() => toggleSort(field)} className="flex items-center gap-1.5 hover:text-one70-yellow transition-colors">
                      {label} <SortIcon field={field} />
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="px-4 py-12 text-center text-one70-mid">Loading...</td></tr>
              ) : filtered.length > 0 ? (
                filtered.map((c, i) => (
                  <tr key={c.id} className={`border-t border-one70-border hover:bg-one70-yellow-light transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-one70-gray'}`}>
                    <td className="px-4 py-3">
                      <Link href={`/contacts/${c.id}`} className="font-medium text-one70-black hover:underline">
                        {c.first_name} {c.last_name}
                      </Link>
                      <span className="inline-flex gap-1 ml-2">
                        {c.is_decision_maker && <span className="text-[10px] bg-one70-yellow text-one70-black px-1.5 py-0.5 rounded font-medium">DM</span>}
                        {c.is_prime_contact && <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium flex items-center gap-0.5"><Star size={8} />Prime</span>}
                        {c.is_referrer && <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-medium">Ref</span>}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-one70-dark">{c.title || '—'}</td>
                    <td className="px-4 py-3 text-sm">
                      {c.organizations ? (
                        <Link href={`/organizations/${c.org_id}`} className="text-one70-dark hover:underline">{c.organizations.name}</Link>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-one70-dark">{c.email || '—'}</td>
                    <td className="px-4 py-3 text-sm text-one70-dark">
                      {c.mobile_phone && <div>{c.mobile_phone} <span className="text-[10px] text-one70-mid">M</span></div>}
                      {c.phone && <div>{c.phone} <span className="text-[10px] text-one70-mid">O</span></div>}
                      {!c.phone && !c.mobile_phone && '—'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-one70-mid">
                    <Users size={32} className="mx-auto mb-2 opacity-40" />
                    <p>{search || hasFilters ? 'No contacts match your filters' : 'No contacts found'}</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile card view */}
      <div className="md:hidden space-y-2">
        {/* Sort controls for mobile */}
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs text-one70-mid">Sort:</span>
          <select value={sortField} onChange={e => setSortField(e.target.value as SortField)}
            className="text-xs border border-one70-border rounded px-2 py-1.5 bg-white">
            <option value="name">Name</option>
            <option value="organization">Organization</option>
            <option value="title">Title</option>
          </select>
          <button onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
            className="p-1.5 border border-one70-border rounded text-one70-mid">
            {sortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-one70-mid text-center py-8">Loading...</p>
        ) : filtered.length > 0 ? (
          filtered.map(c => (
            <Link key={c.id} href={`/contacts/${c.id}`}
              className="block bg-white rounded-lg border border-one70-border p-4 active:bg-one70-yellow-light transition-colors">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-one70-black">
                    {c.first_name} {c.last_name}
                  </p>
                  {c.title && <p className="text-xs text-one70-mid mt-0.5">{c.title}</p>}
                  {c.organizations && <p className="text-xs text-one70-dark mt-0.5">{c.organizations.name}</p>}
                </div>
                <span className="inline-flex gap-1">
                  {c.is_decision_maker && <span className="text-[10px] bg-one70-yellow text-one70-black px-1.5 py-0.5 rounded font-medium">DM</span>}
                  {c.is_prime_contact && <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium">Prime</span>}
                </span>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-one70-mid">
                {c.email && <span>{c.email}</span>}
                {c.mobile_phone && <span>{c.mobile_phone} (M)</span>}
                {c.phone && <span>{c.phone} (O)</span>}
              </div>
            </Link>
          ))
        ) : (
          <div className="text-center py-12 text-one70-mid">
            <Users size={32} className="mx-auto mb-2 opacity-40" />
            <p className="text-sm">{search || hasFilters ? 'No contacts match your filters' : 'No contacts found'}</p>
          </div>
        )}
      </div>
    </div>
  )
}
