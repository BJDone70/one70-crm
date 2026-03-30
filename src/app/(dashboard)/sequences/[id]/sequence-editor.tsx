'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Plus, Trash2, Save, Mail, MessageSquare, Linkedin, Phone, Play, Pause, User, Clock } from 'lucide-react'

const channelOptions = [
  { id: 'email', label: 'Email', icon: Mail },
  { id: 'linkedin', label: 'LinkedIn', icon: Linkedin },
  { id: 'text', label: 'Text/SMS', icon: MessageSquare },
  { id: 'call', label: 'Call Task', icon: Phone },
]

const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  paused: 'bg-gray-100 text-gray-600',
  completed: 'bg-blue-100 text-blue-700',
  replied: 'bg-purple-100 text-purple-700',
  bounced: 'bg-red-100 text-red-700',
  unsubscribed: 'bg-red-100 text-red-600',
}

interface Step {
  id?: string
  sequence_id: string
  step_number: number
  channel: string
  delay_days: number
  subject: string
  body: string
}

export default function SequenceEditor({ sequence, steps: initialSteps, enrollments, nameMap }: {
  sequence: any
  steps: any[]
  enrollments: any[]
  nameMap: Record<string, string>
}) {
  const [steps, setSteps] = useState<Step[]>(initialSteps.map(s => ({ ...s })))
  const [seqName, setSeqName] = useState(sequence.name)
  const [seqDesc, setSeqDesc] = useState(sequence.description || '')
  const [isActive, setIsActive] = useState(sequence.is_active)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const supabase = createClient()
  const router = useRouter()

  const inputClass = "w-full px-3 py-1.5 border border-one70-border rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-one70-yellow"

  function addStep() {
    const maxStep = steps.length > 0 ? Math.max(...steps.map(s => s.step_number)) : 0
    const lastDelay = steps.length > 0 ? steps[steps.length - 1].delay_days : 0
    setSteps([...steps, {
      sequence_id: sequence.id,
      step_number: maxStep + 1,
      channel: 'email',
      delay_days: lastDelay + 3,
      subject: '',
      body: '',
    }])
  }

  function removeStep(idx: number) {
    const updated = steps.filter((_, i) => i !== idx).map((s, i) => ({ ...s, step_number: i + 1 }))
    setSteps(updated)
  }

  function updateStep(idx: number, field: string, value: any) {
    const updated = [...steps]
    updated[idx] = { ...updated[idx], [field]: value }
    setSteps(updated)
  }

  async function saveAll() {
    setSaving(true)
    setError('')
    setSuccess('')

    // Update sequence metadata
    const { error: seqErr } = await supabase.from('sequences').update({
      name: seqName, description: seqDesc, is_active: isActive, updated_at: new Date().toISOString(),
    }).eq('id', sequence.id)

    if (seqErr) { setError(seqErr.message); setSaving(false); return }

    // Delete all existing steps and re-insert
    await supabase.from('sequence_steps').delete().eq('sequence_id', sequence.id)

    if (steps.length > 0) {
      const { error: stepErr } = await supabase.from('sequence_steps').insert(
        steps.map((s, i) => ({
          sequence_id: sequence.id,
          step_number: i + 1,
          channel: s.channel,
          delay_days: s.delay_days,
          subject: s.subject || null,
          body: s.body || null,
        }))
      )
      if (stepErr) { setError(stepErr.message); setSaving(false); return }
    }

    setSuccess('Sequence saved')
    setSaving(false)
    router.refresh()
    setTimeout(() => setSuccess(''), 2000)
  }

  async function toggleActive() {
    const newState = !isActive
    setIsActive(newState)
    await supabase.from('sequences').update({ is_active: newState }).eq('id', sequence.id)
    router.refresh()
  }

  const activeEnrollments = enrollments.filter(e => e.status === 'active')
  const completedEnrollments = enrollments.filter(e => e.status !== 'active')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex-1 max-w-lg">
          <input value={seqName} onChange={e => setSeqName(e.target.value)}
            className="text-xl font-bold text-one70-black bg-transparent border-0 border-b-2 border-transparent focus:border-one70-yellow focus:outline-none w-full pb-1" />
          <input value={seqDesc} onChange={e => setSeqDesc(e.target.value)} placeholder="Description..."
            className="text-sm text-one70-mid bg-transparent border-0 border-b border-transparent focus:border-one70-border focus:outline-none w-full mt-1" />
        </div>
        <div className="flex items-center gap-3">
          <button onClick={toggleActive}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${isActive ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
            {isActive ? <><Play size={12} /> Active</> : <><Pause size={12} /> Paused</>}
          </button>
          <button onClick={saveAll} disabled={saving}
            className="flex items-center gap-1.5 bg-one70-black text-white px-4 py-2 rounded-md text-sm font-semibold hover:bg-one70-dark disabled:opacity-50 transition-colors">
            <Save size={14} /> {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {error && <div className="bg-red-50 text-red-700 px-3 py-2 rounded-md text-sm">{error}</div>}
      {success && <div className="bg-green-50 text-green-700 px-3 py-2 rounded-md text-sm">{success}</div>}

      {/* Steps */}
      <div className="bg-white rounded-lg border border-one70-border p-5">
        <h2 className="text-sm font-semibold text-one70-dark mb-4">Steps ({steps.length})</h2>
        <div className="space-y-4">
          {steps.map((step, idx) => {
            const ChIcon = channelOptions.find(c => c.id === step.channel)?.icon || Mail
            return (
              <div key={idx} className="border border-one70-border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-white bg-one70-black w-6 h-6 rounded-full flex items-center justify-center">{idx + 1}</span>
                    <select value={step.channel} onChange={e => updateStep(idx, 'channel', e.target.value)}
                      className="text-sm border border-one70-border rounded-md px-2 py-1 bg-white">
                      {channelOptions.map(ch => <option key={ch.id} value={ch.id}>{ch.label}</option>)}
                    </select>
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      <Clock size={12} />
                      <span>Day</span>
                      <input type="number" min={0} value={step.delay_days}
                        onChange={e => updateStep(idx, 'delay_days', parseInt(e.target.value) || 0)}
                        className="w-14 text-center border border-one70-border rounded px-1 py-0.5 text-sm" />
                    </div>
                  </div>
                  <button onClick={() => removeStep(idx)} className="text-red-400 hover:text-red-600 p-1">
                    <Trash2 size={14} />
                  </button>
                </div>
                {(step.channel === 'email' || step.channel === 'linkedin' || step.channel === 'text') ? (
                  <>
                    {step.channel === 'email' && (
                      <input value={step.subject} onChange={e => updateStep(idx, 'subject', e.target.value)}
                        placeholder="Subject line (use {first_name}, {company}, {property_name} for merge fields)"
                        className={`${inputClass} mb-2`} />
                    )}
                    <textarea value={step.body} onChange={e => updateStep(idx, 'body', e.target.value)}
                      placeholder={`${step.channel === 'email' ? 'Email body' : step.channel === 'linkedin' ? 'LinkedIn message' : 'Text message'}... (use merge fields: {first_name}, {company}, {property_name}, {your_name})`}
                      rows={4} className={inputClass} />
                  </>
                ) : (
                  <input value={step.body} onChange={e => updateStep(idx, 'body', e.target.value)}
                    placeholder="Call task notes / talking points..."
                    className={inputClass} />
                )}
              </div>
            )
          })}
        </div>
        <button onClick={addStep}
          className="mt-4 flex items-center gap-1.5 text-sm font-medium text-one70-mid hover:text-one70-dark transition-colors">
          <Plus size={14} /> Add Step
        </button>
      </div>

      {/* Enrollments */}
      <div className="bg-white rounded-lg border border-one70-border p-5">
        <h2 className="text-sm font-semibold text-one70-dark mb-4">
          Enrollments ({enrollments.length})
          {activeEnrollments.length > 0 && <span className="text-green-600 ml-2">{activeEnrollments.length} active</span>}
        </h2>
        {enrollments.length === 0 ? (
          <p className="text-xs text-gray-400">No contacts enrolled yet. Enroll contacts from the contact detail page or use bulk enrollment.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[500px] text-sm">
              <thead>
                <tr className="text-xs text-one70-mid uppercase tracking-wider border-b border-one70-border">
                  <th className="text-left pb-2 font-semibold">Contact</th>
                  <th className="text-left pb-2 font-semibold">Company</th>
                  <th className="text-center pb-2 font-semibold">Step</th>
                  <th className="text-center pb-2 font-semibold">Status</th>
                  <th className="text-left pb-2 font-semibold">Next Action</th>
                </tr>
              </thead>
              <tbody>
                {enrollments.map((en: any) => (
                  <tr key={en.id} className="border-b border-one70-border last:border-0">
                    <td className="py-2">
                      <Link href={`/contacts/${en.contact_id}`} className="text-sm font-medium text-gray-900 hover:underline">
                        {en.contacts?.first_name} {en.contacts?.last_name}
                      </Link>
                    </td>
                    <td className="py-2 text-xs text-gray-500">{en.contacts?.organizations?.name || '—'}</td>
                    <td className="py-2 text-center text-xs font-medium">{en.current_step} / {steps.length}</td>
                    <td className="py-2 text-center">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusColors[en.status] || 'bg-gray-100 text-gray-600'}`}>
                        {en.status}
                      </span>
                    </td>
                    <td className="py-2 text-xs text-gray-500">
                      {en.next_action_at ? new Date(en.next_action_at).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
