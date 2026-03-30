'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { AlertTriangle, Clock, ChevronRight } from 'lucide-react'

interface StaleDeal {
  id: string
  name: string
  stage: string
  value: number | null
  updated_at: string
  days_stuck: number
  organizations?: { name: string } | null
}

const stageLabels: Record<string, string> = {
  new_lead: 'New Lead', contacted: 'Contacted', qualified: 'Qualified',
  estimating: 'Estimating', proposal_sent: 'Proposal Sent', negotiation: 'Negotiation',
}

export default function StaleDealsWidget() {
  const [deals, setDeals] = useState<StaleDeal[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
      const { data } = await supabase
        .from('deals')
        .select('id, name, stage, value, updated_at, organizations:org_id(name)')
        .not('stage', 'in', '("awarded","lost")')
        .is('deleted_at', null)
        .lt('updated_at', fourteenDaysAgo)
        .order('updated_at', { ascending: true })
        .limit(5)

      const now = Date.now()
      setDeals((data || []).map(d => ({
        ...d,
        organizations: d.organizations as any,
        days_stuck: Math.floor((now - new Date(d.updated_at).getTime()) / (1000 * 60 * 60 * 24)),
      })))
      setLoading(false)
    }
    load()
  }, [])

  if (loading || deals.length === 0) return null

  return (
    <div className="bg-white rounded-lg border border-orange-200 p-5 mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold text-orange-700 flex items-center gap-2">
          <AlertTriangle size={16} /> Stalled Deals ({deals.length})
        </h2>
        <Link href="/deals" className="text-xs text-one70-black hover:underline">View Pipeline →</Link>
      </div>
      <p className="text-xs text-orange-600 mb-3">These deals haven&apos;t moved in 14+ days</p>
      <div className="space-y-2">
        {deals.map(d => (
          <Link key={d.id} href={`/deals/${d.id}`}
            className="flex items-center gap-3 p-2.5 rounded-lg bg-orange-50 hover:bg-orange-100 transition-colors group">
            <div className="flex items-center gap-1 text-orange-500 shrink-0">
              <Clock size={14} />
              <span className="text-xs font-bold">{d.days_stuck}d</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-one70-black truncate">{d.name}</p>
              <p className="text-xs text-one70-mid">
                {stageLabels[d.stage] || d.stage}
                {d.organizations?.name && ` · ${d.organizations.name}`}
                {d.value && ` · $${Number(d.value).toLocaleString()}`}
              </p>
            </div>
            <ChevronRight size={14} className="text-gray-400 group-hover:text-one70-black shrink-0" />
          </Link>
        ))}
      </div>
    </div>
  )
}
