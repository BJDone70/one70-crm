'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Mail, MessageSquare, Linkedin, Phone, Send, SkipForward, Pause, Clock, AlertCircle, CheckCircle } from 'lucide-react'

const channelIcons: Record<string, any> = { email: Mail, linkedin: Linkedin, text: MessageSquare, call: Phone }
const channelLabels: Record<string, string> = { email: 'Send Email', linkedin: 'Send LinkedIn', text: 'Send Text', call: 'Make Call' }
import { getVerticalColor } from '@/lib/verticals'

export default function OutreachQueue({ dueItems, upcomingItems, nameMap }: {
  dueItems: any[]
  upcomingItems: any[]
  nameMap: Record<string, string>
}) {
  const [processing, setProcessing] = useState<Set<string>>(new Set())
  const [done, setDone] = useState<Set<string>>(new Set())
  const supabase = createClient()
  const router = useRouter()

  async function executeStep(enrollment: any) {
    setProcessing(prev => new Set(prev).add(enrollment.id))

    try {
      const res = await fetch('/api/sequences/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enrollment_id: enrollment.id }),
      })
      if (!res.ok) throw new Error('Failed to execute step')
      setDone(prev => new Set(prev).add(enrollment.id))
      setTimeout(() => router.refresh(), 1500)
    } catch (err) {
      console.error(err)
    } finally {
      setProcessing(prev => { const n = new Set(prev); n.delete(enrollment.id); return n })
    }
  }

  async function skipStep(enrollment: any) {
    setProcessing(prev => new Set(prev).add(enrollment.id))
    const totalSteps = enrollment.totalSteps || 4
    const nextStep = enrollment.current_step + 1

    if (nextStep > totalSteps) {
      await supabase.from('sequence_enrollments').update({
        status: 'completed', completed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      }).eq('id', enrollment.id)
    } else {
      const nextAction = new Date()
      // Find next step's delay from current step sequence steps
      nextAction.setDate(nextAction.getDate() + 3)
      await supabase.from('sequence_enrollments').update({
        current_step: nextStep, next_action_at: nextAction.toISOString(), updated_at: new Date().toISOString(),
      }).eq('id', enrollment.id)
    }

    setDone(prev => new Set(prev).add(enrollment.id))
    setTimeout(() => router.refresh(), 1000)
  }

  async function pauseEnrollment(id: string) {
    await supabase.from('sequence_enrollments').update({
      status: 'paused', updated_at: new Date().toISOString(),
    }).eq('id', id)
    setDone(prev => new Set(prev).add(id))
    setTimeout(() => router.refresh(), 1000)
  }

  async function markReplied(id: string) {
    await supabase.from('sequence_enrollments').update({
      status: 'replied', completed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).eq('id', id)
    setDone(prev => new Set(prev).add(id))
    setTimeout(() => router.refresh(), 1000)
  }

  const overdue = dueItems.filter(e => e.next_action_at && new Date(e.next_action_at) < new Date(new Date().setHours(0,0,0,0)))
  const today = dueItems.filter(e => !overdue.includes(e))

  function renderItem(item: any) {
    const step = item.currentStep
    const ChIcon = channelIcons[step?.channel] || Mail
    const isDone = done.has(item.id)
    const isProcessing = processing.has(item.id)
    const contact = item.contacts
    const orgName = contact?.organizations?.name

    return (
      <div key={item.id} className={`bg-white rounded-lg border border-one70-border p-4 transition-opacity ${isDone ? 'opacity-40' : ''}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <ChIcon size={14} className="text-gray-400 shrink-0" />
              <Link href={`/contacts/${contact?.id}`} className="text-sm font-semibold text-gray-900 hover:underline truncate">
                {contact?.first_name} {contact?.last_name}
              </Link>
              {orgName && <span className="text-xs text-gray-400 truncate">@ {orgName}</span>}
            </div>
            <div className="flex items-center gap-2 mb-2">
              <Link href={`/sequences/${item.sequence_id}`} className="text-xs text-blue-600 hover:underline">{item.sequences?.name}</Link>
              <span className="text-[10px] text-gray-400">Step {item.current_step}/{item.totalSteps}</span>
              {item.sequences?.vertical && (
                <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${getVerticalColor(item.sequences.vertical)}`}>
                  {item.sequences.vertical}
                </span>
              )}
            </div>
            {step?.subject && <p className="text-xs text-gray-600 font-medium mb-1">Subject: {step.subject}</p>}
            {step?.body && <p className="text-xs text-gray-500 line-clamp-2">{step.body.substring(0, 120)}...</p>}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {isDone ? (
              <span className="flex items-center gap-1 text-xs text-green-600 font-medium"><CheckCircle size={14} /> Done</span>
            ) : (
              <>
                <button onClick={() => executeStep(item)} disabled={isProcessing}
                  className="flex items-center gap-1 bg-one70-black text-white px-3 py-1.5 rounded-md text-xs font-semibold hover:bg-one70-dark disabled:opacity-50 transition-colors">
                  <Send size={12} /> {isProcessing ? '...' : channelLabels[step?.channel] || 'Execute'}
                </button>
                <button onClick={() => skipStep(item)} className="p-1.5 text-gray-400 hover:text-gray-600" title="Skip">
                  <SkipForward size={14} />
                </button>
                <button onClick={() => markReplied(item.id)} className="p-1.5 text-green-500 hover:text-green-700" title="Mark replied">
                  <CheckCircle size={14} />
                </button>
                <button onClick={() => pauseEnrollment(item.id)} className="p-1.5 text-gray-400 hover:text-gray-600" title="Pause">
                  <Pause size={14} />
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Overdue */}
      {overdue.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle size={16} className="text-red-500" />
            <h2 className="text-sm font-semibold text-red-600">Overdue ({overdue.length})</h2>
          </div>
          <div className="space-y-3">{overdue.map(renderItem)}</div>
        </div>
      )}

      {/* Due Today */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Clock size={16} className="text-amber-500" />
          <h2 className="text-sm font-semibold text-gray-900">Due Today ({today.length})</h2>
        </div>
        {today.length === 0 && overdue.length === 0 ? (
          <div className="bg-white rounded-lg border border-one70-border p-8 text-center">
            <CheckCircle size={32} className="mx-auto text-green-400 mb-3" />
            <p className="text-sm text-one70-mid">All caught up! No outreach actions due today.</p>
          </div>
        ) : (
          <div className="space-y-3">{today.map(renderItem)}</div>
        )}
      </div>

      {/* Upcoming this week */}
      {upcomingItems.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Coming This Week ({upcomingItems.length})</h2>
          <div className="space-y-2">
            {upcomingItems.map(item => (
              <div key={item.id} className="bg-white rounded-lg border border-one70-border p-3 flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs text-gray-400">{new Date(item.next_action_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                  <Link href={`/contacts/${item.contact_id}`} className="text-sm font-medium text-gray-900 hover:underline truncate">
                    {item.contacts?.first_name} {item.contacts?.last_name}
                  </Link>
                  <span className="text-xs text-gray-400">— {item.sequences?.name} (Step {item.current_step})</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
