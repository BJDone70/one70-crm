'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Zap, Check, Loader2 } from 'lucide-react'

export default function EnrollInSequence({ contactId, dealId }: { contactId: string; dealId?: string }) {
  const [sequences, setSequences] = useState<any[]>([])
  const [enrollments, setEnrollments] = useState<any[]>([])
  const [selectedSeq, setSelectedSeq] = useState('')
  const [enrolling, setEnrolling] = useState(false)
  const [showPicker, setShowPicker] = useState(false)
  const [result, setResult] = useState('')
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    async function load() {
      const { data: seqs } = await supabase
        .from('sequences')
        .select('id, name, vertical')
        .is('deleted_at', null)
        .eq('is_active', true)
        .order('name')
      setSequences(seqs || [])

      const { data: enrs } = await supabase
        .from('sequence_enrollments')
        .select('id, sequence_id, status, current_step, sequences(name)')
        .eq('contact_id', contactId)
        .order('created_at', { ascending: false })
      setEnrollments(enrs || [])
    }
    load()
  }, [contactId])

  async function handleEnroll() {
    if (!selectedSeq) return
    setEnrolling(true)
    setResult('')
    try {
      const res = await fetch('/api/sequences/enroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sequence_id: selectedSeq, contact_ids: [contactId], deal_id: dealId }),
      })
      const data = await res.json()
      if (data.enrolled > 0) {
        setResult('Enrolled!')
        setShowPicker(false)
        setSelectedSeq('')
        router.refresh()
        // Reload enrollments
        const { data: enrs } = await supabase
          .from('sequence_enrollments')
          .select('id, sequence_id, status, current_step, sequences(name)')
          .eq('contact_id', contactId)
          .order('created_at', { ascending: false })
        setEnrollments(enrs || [])
      } else {
        setResult(data.message || 'Already enrolled')
      }
    } catch {
      setResult('Error enrolling')
    }
    setEnrolling(false)
    setTimeout(() => setResult(''), 2000)
  }

  const statusColors: Record<string, string> = {
    active: 'text-green-600', completed: 'text-blue-600', paused: 'text-gray-500', replied: 'text-purple-600',
  }

  return (
    <div className="bg-white rounded-lg border border-one70-border p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold text-one70-mid uppercase tracking-wider">Sequences</h3>
        <button onClick={() => setShowPicker(!showPicker)}
          className="text-xs font-medium text-blue-600 hover:text-blue-800 flex items-center gap-1">
          <Zap size={12} /> Enroll
        </button>
      </div>

      {showPicker && (
        <div className="mb-3 flex gap-2">
          <select value={selectedSeq} onChange={e => setSelectedSeq(e.target.value)}
            className="flex-1 text-sm border border-one70-border rounded-md px-2 py-1.5 bg-white">
            <option value="">Select sequence...</option>
            {sequences.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <button onClick={handleEnroll} disabled={!selectedSeq || enrolling}
            className="bg-one70-black text-white px-3 py-1.5 rounded-md text-xs font-semibold hover:bg-one70-dark disabled:opacity-50">
            {enrolling ? <Loader2 size={12} className="animate-spin" /> : 'Go'}
          </button>
        </div>
      )}

      {result && <p className="text-xs text-green-600 mb-2">{result}</p>}

      {enrollments.length > 0 ? (
        <div className="space-y-1.5">
          {enrollments.map(e => (
            <div key={e.id} className="flex items-center justify-between text-xs">
              <span className="text-gray-700">{(e.sequences as any)?.name}</span>
              <span className={`font-medium ${statusColors[e.status] || 'text-gray-500'}`}>
                {e.status === 'active' ? `Step ${e.current_step}` : e.status}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-gray-400">Not enrolled in any sequences</p>
      )}
    </div>
  )
}
