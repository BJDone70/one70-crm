import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus, Mail, MessageSquare, Linkedin, Phone, Zap } from 'lucide-react'

const channelIcons: Record<string, any> = { email: Mail, linkedin: Linkedin, text: MessageSquare, call: Phone }
import { formatVerticalLabel, getVerticalColor } from '@/lib/verticals'

export default async function SequencesPage() {
  const supabase = await createClient()

  const { data: sequences } = await supabase
    .from('sequences')
    .select('*, sequence_steps(id, channel, step_number)')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  // Count active enrollments per sequence
  const { data: enrollments } = await supabase
    .from('sequence_enrollments')
    .select('sequence_id, status')
    .eq('status', 'active')

  const activeCountMap = new Map<string, number>()
  enrollments?.forEach(e => {
    activeCountMap.set(e.sequence_id, (activeCountMap.get(e.sequence_id) || 0) + 1)
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-one70-black">Sequences</h1>
          <p className="text-one70-mid text-sm mt-1">Multi-step outreach flows for each vertical</p>
        </div>
        <Link href="/sequences/new" className="flex items-center gap-2 bg-one70-black text-white px-4 py-2.5 rounded-md text-sm font-semibold hover:bg-one70-dark transition-colors">
          <Plus size={16} /> New Sequence
        </Link>
      </div>

      {(!sequences || sequences.length === 0) ? (
        <div className="bg-white rounded-lg border border-one70-border p-8 text-center">
          <Zap size={32} className="mx-auto text-one70-mid mb-3" />
          <p className="text-sm text-one70-mid">No sequences yet. Create your first outreach sequence or seed the playbook sequences.</p>
          <div className="flex gap-3 justify-center mt-4">
            <Link href="/sequences/new" className="bg-one70-black text-white px-4 py-2 rounded-md text-sm font-medium">Create Sequence</Link>
            <form action="/api/sequences/seed" method="POST">
              <button type="submit" className="border border-one70-border px-4 py-2 rounded-md text-sm font-medium text-one70-dark hover:bg-one70-gray transition-colors">
                Load ONE70 Playbooks
              </button>
            </form>
          </div>
        </div>
      ) : (
        <div className="grid gap-4">
          {sequences.map(seq => {
            const steps = seq.sequence_steps || []
            const activeCount = activeCountMap.get(seq.id) || 0
            const channels = [...new Set(steps.map((s: any) => s.channel))] as string[]
            return (
              <Link key={seq.id} href={`/sequences/${seq.id}`}
                className="bg-white rounded-lg border border-one70-border p-5 hover:border-one70-yellow transition-colors block">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-semibold text-gray-900">{seq.name}</h3>
                      {seq.is_system && <span className="text-[10px] font-semibold bg-one70-yellow/20 text-one70-dark px-2 py-0.5 rounded-full">PLAYBOOK</span>}
                      {!seq.is_active && <span className="text-[10px] font-semibold bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">PAUSED</span>}
                    </div>
                    {seq.description && <p className="text-xs text-gray-500 mt-1">{seq.description}</p>}
                    {seq.vertical && (
                      <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full mt-2 ${getVerticalColor(seq.vertical)}`}>
                        {formatVerticalLabel(seq.vertical)}
                      </span>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-lg font-bold text-one70-black">{steps.length}</p>
                    <p className="text-[10px] text-gray-400 uppercase">steps</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 mt-3 pt-3 border-t border-one70-border">
                  <div className="flex gap-1.5">
                    {channels.map(ch => {
                      const Icon = channelIcons[ch] || Mail
                      return <Icon key={ch} size={14} className="text-gray-400" />
                    })}
                  </div>
                  {activeCount > 0 && (
                    <span className="text-xs text-green-600 font-medium">{activeCount} active enrollment{activeCount !== 1 ? 's' : ''}</span>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
