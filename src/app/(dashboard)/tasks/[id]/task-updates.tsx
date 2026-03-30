'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { MessageSquare, CheckCircle, ClipboardList, Send } from 'lucide-react'

interface Update {
  id: string; body: string; update_type: string; created_at: string
  profiles?: { full_name: string } | null
}

export default function TaskUpdates({ taskId, initialUpdates, userId }: { taskId: string; initialUpdates: Update[]; userId: string }) {
  const [updates, setUpdates] = useState<Update[]>(initialUpdates)
  const [body, setBody] = useState('')
  const [type, setType] = useState('note')
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  async function addUpdate() {
    if (!body.trim()) return
    setSaving(true)
    const { error } = await supabase.from('task_updates').insert({
      task_id: taskId, user_id: userId, body: body.trim(), update_type: type,
    })
    if (!error) {
      // Fetch profile name
      const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', userId).single()
      setUpdates([{
        id: crypto.randomUUID(),
        body: body.trim(),
        update_type: type,
        created_at: new Date().toISOString(),
        profiles: { full_name: profile?.full_name || 'You' },
      }, ...updates])
      setBody('')
      setType('note')
    }
    setSaving(false)
  }

  const typeIcons: Record<string, any> = {
    note: MessageSquare, step_completed: CheckCircle, status_change: ClipboardList,
  }
  const typeLabels: Record<string, string> = {
    note: 'Note', step_completed: 'Step Completed', status_change: 'Status Change', reassigned: 'Reassigned',
  }

  return (
    <div>
      <h2 className="text-lg font-bold text-one70-black mb-3">Updates & Progress</h2>

      {/* Add update form */}
      <div className="bg-white rounded-lg border border-one70-border p-4 mb-4">
        <div className="flex gap-2 mb-2">
          {(['note', 'step_completed'] as const).map(t => (
            <button key={t} onClick={() => setType(t)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${type === t ? 'bg-one70-black text-white border-one70-black' : 'bg-white text-one70-mid border-one70-border hover:bg-one70-gray'}`}>
              {t === 'note' ? <MessageSquare size={12} /> : <CheckCircle size={12} />}
              {t === 'note' ? 'Add Note' : 'Log Step'}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input type="text" value={body} onChange={e => setBody(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addUpdate()}
            placeholder={type === 'note' ? 'Add a note or update...' : 'What step was completed?'}
            className="flex-1 text-sm border border-one70-border rounded-md px-3 py-2.5 focus:outline-none focus:border-one70-black" />
          <button onClick={addUpdate} disabled={saving || !body.trim()}
            className="px-4 py-2.5 bg-one70-black text-white rounded-md text-sm font-semibold disabled:opacity-30 hover:bg-one70-dark active:scale-95 transition-all">
            <Send size={14} />
          </button>
        </div>
      </div>

      {/* Updates list */}
      {updates.length === 0 ? (
        <p className="text-sm text-one70-mid text-center py-6">No updates yet. Add notes or log steps to track progress.</p>
      ) : (
        <div className="space-y-2">
          {updates.map(u => {
            const Icon = typeIcons[u.update_type] || MessageSquare
            return (
              <div key={u.id} className="bg-white rounded-lg border border-one70-border p-3 flex items-start gap-3">
                <div className={`p-1.5 rounded shrink-0 ${u.update_type === 'step_completed' ? 'bg-green-50 text-green-600' : 'bg-blue-50 text-blue-600'}`}>
                  <Icon size={14} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-one70-dark whitespace-pre-wrap">{u.body}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-gray-400">{(u.profiles as any)?.full_name || 'User'}</span>
                    <span className="text-[10px] text-gray-400">{new Date(u.created_at).toLocaleString()}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${u.update_type === 'step_completed' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {typeLabels[u.update_type] || u.update_type}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
