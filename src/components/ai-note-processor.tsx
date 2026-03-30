'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Sparkles, Mic, Save, X, Check, AlertCircle } from 'lucide-react'

interface NoteProcessorProps {
  contactId?: string
  orgId?: string
  dealId?: string
}

export default function NoteProcessor({ contactId, orgId, dealId }: NoteProcessorProps) {
  const [open, setOpen] = useState(false)
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [parsed, setParsed] = useState<any>(null)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  async function processNotes() {
    if (!notes.trim()) return
    setLoading(true)
    setError('')
    setParsed(null)

    const res = await fetch('/api/ai/process-notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes, contactId, orgId, dealId }),
    })

    const data = await res.json()
    if (!res.ok) { setError(data.error || 'Failed to process notes'); setLoading(false); return }
    setParsed(data.parsed)
    setLoading(false)
  }

  async function saveAll() {
    if (!parsed) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Save activity
    if (parsed.activity) {
      await supabase.from('activities').insert({
        type: parsed.activity.type || 'meeting',
        subject: parsed.activity.subject,
        body: parsed.activity.body,
        contact_id: contactId || null,
        org_id: orgId || null,
        deal_id: dealId || null,
        user_id: user.id,
      })
    }

    // Save tasks
    if (parsed.tasks?.length > 0) {
      for (const task of parsed.tasks) {
        const dueDate = task.due_days
          ? new Date(Date.now() + task.due_days * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
          : null
        await supabase.from('tasks').insert({
          title: task.title,
          type: task.type || 'follow_up',
          priority: task.priority || 'normal',
          due_date: dueDate,
          contact_id: contactId || null,
          org_id: orgId || null,
          deal_id: dealId || null,
          assigned_to: user.id,
          created_by: user.id,
        })
      }
    }

    // Save key notes
    if (parsed.key_notes?.length > 0 && contactId) {
      for (const kn of parsed.key_notes) {
        await supabase.from('key_notes').insert({
          contact_id: contactId,
          category: kn.category || 'other',
          title: kn.title,
          note: kn.note || null,
          created_by: user.id,
        })
      }
    }

    // Update deal stage if suggested
    if (parsed.suggested_deal_stage && dealId) {
      await supabase.from('deals').update({ stage: parsed.suggested_deal_stage }).eq('id', dealId)
    }

    setSaving(false)
    setSaved(true)
    router.refresh()
    setTimeout(() => { setOpen(false); setNotes(''); setParsed(null); setSaved(false) }, 1500)
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-sm font-medium text-one70-black hover:underline">
        <Mic size={14} /> Process Meeting Notes
      </button>
    )
  }

  return (
    <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg border border-green-200 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-one70-dark uppercase tracking-wider flex items-center gap-1">
          <Mic size={12} /> Post-Meeting Notes
        </span>
        <button onClick={() => { setOpen(false); setParsed(null); setNotes('') }} className="text-xs text-gray-400 hover:text-gray-600">Close</button>
      </div>

      {!parsed ? (
        <>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Paste or type your raw meeting notes here... e.g. 'Met with John, he's managing 12 properties across FL. PIP deadline is Q3. Wants pricing on 3 hotels. His daughter just started college. Follow up next Tuesday with proposal.'"
            className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-300 min-h-[120px]"
            rows={5}
          />
          <button onClick={processNotes} disabled={loading || !notes.trim()}
            className="w-full bg-one70-black text-white py-2 rounded-md text-sm font-semibold hover:bg-one70-dark transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {loading ? <><Sparkles size={14} className="animate-pulse" /> Processing...</> : <><Sparkles size={14} /> Process Notes</>}
          </button>
        </>
      ) : saved ? (
        <div className="text-center py-4">
          <Check size={28} className="mx-auto text-green-600 mb-2" />
          <p className="text-sm font-medium text-green-800">Saved to CRM!</p>
        </div>
      ) : (
        <>
          {/* Summary */}
          <div className="bg-white rounded-md p-3 border border-gray-200">
            <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Summary</p>
            <p className="text-sm text-gray-800">{parsed.summary}</p>
          </div>

          {/* Activity */}
          {parsed.activity && (
            <div className="bg-white rounded-md p-3 border border-gray-200">
              <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Activity to Log</p>
              <p className="text-sm font-medium text-gray-800">{parsed.activity.subject}</p>
              <p className="text-xs text-gray-500 mt-0.5 capitalize">{parsed.activity.type}</p>
            </div>
          )}

          {/* Tasks */}
          {parsed.tasks?.length > 0 && (
            <div className="bg-white rounded-md p-3 border border-gray-200">
              <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Tasks to Create ({parsed.tasks.length})</p>
              {parsed.tasks.map((t: any, i: number) => (
                <div key={i} className="text-sm text-gray-800 mt-1">
                  • {t.title} <span className="text-xs text-gray-400">({t.type}, {t.priority}, due in {t.due_days}d)</span>
                </div>
              ))}
            </div>
          )}

          {/* Key notes */}
          {parsed.key_notes?.length > 0 && (
            <div className="bg-white rounded-md p-3 border border-gray-200">
              <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Key Notes to Save ({parsed.key_notes.length})</p>
              {parsed.key_notes.map((kn: any, i: number) => (
                <div key={i} className="text-sm text-gray-800 mt-1">• {kn.title}{kn.note ? ` — ${kn.note}` : ''}</div>
              ))}
            </div>
          )}

          {/* Deal stage suggestion */}
          {parsed.suggested_deal_stage && (
            <div className="bg-amber-50 rounded-md p-3 border border-amber-200 flex items-start gap-2">
              <AlertCircle size={14} className="text-amber-600 mt-0.5 shrink-0" />
              <p className="text-sm text-amber-800">Suggests moving deal to <span className="font-semibold">{parsed.suggested_deal_stage}</span></p>
            </div>
          )}

          {/* Pain points */}
          {parsed.pain_points_identified?.length > 0 && (
            <div className="bg-white rounded-md p-3 border border-gray-200">
              <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Pain Points Identified</p>
              {parsed.pain_points_identified.map((p: string, i: number) => (
                <div key={i} className="text-sm text-gray-800 mt-1">• {p}</div>
              ))}
            </div>
          )}

          {/* Next step */}
          {parsed.next_step && (
            <div className="bg-white rounded-md p-3 border border-gray-200">
              <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Agreed Next Step</p>
              <p className="text-sm text-gray-800">{parsed.next_step}</p>
            </div>
          )}

          <button onClick={saveAll} disabled={saving}
            className="w-full bg-green-700 text-white py-2 rounded-md text-sm font-semibold hover:bg-green-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {saving ? 'Saving...' : <><Save size={14} /> Save All to CRM</>}
          </button>

          {error && <div className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded">{error}</div>}
        </>
      )}
    </div>
  )
}
