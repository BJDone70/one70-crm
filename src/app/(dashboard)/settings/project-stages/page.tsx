'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Layers, Plus, Pencil, Trash2, Save, X, GripVertical, ArrowUp, ArrowDown, Check } from 'lucide-react'

interface Stage {
  id: string; name: string; label: string; color: string; sort_order: number; is_terminal: boolean
}

const COLOR_OPTIONS = [
  { value: 'bg-purple-100 text-purple-700', label: 'Purple', preview: 'bg-purple-100' },
  { value: 'bg-blue-100 text-blue-700', label: 'Blue', preview: 'bg-blue-100' },
  { value: 'bg-green-100 text-green-700', label: 'Green', preview: 'bg-green-100' },
  { value: 'bg-amber-100 text-amber-700', label: 'Amber', preview: 'bg-amber-100' },
  { value: 'bg-red-100 text-red-700', label: 'Red', preview: 'bg-red-100' },
  { value: 'bg-pink-100 text-pink-700', label: 'Pink', preview: 'bg-pink-100' },
  { value: 'bg-cyan-100 text-cyan-700', label: 'Cyan', preview: 'bg-cyan-100' },
  { value: 'bg-gray-100 text-gray-600', label: 'Gray', preview: 'bg-gray-100' },
]

export default function ProjectStagesPage() {
  const [stages, setStages] = useState<Stage[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState('')
  const [editColor, setEditColor] = useState('')
  const [editTerminal, setEditTerminal] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [newName, setNewName] = useState('')
  const [newLabel, setNewLabel] = useState('')
  const [newColor, setNewColor] = useState('bg-blue-100 text-blue-700')
  const [newTerminal, setNewTerminal] = useState(false)
  const supabase = createClient()

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase.from('project_stages').select('*').order('sort_order')
    if (data) setStages(data as Stage[])
    setLoading(false)
  }

  function startEdit(stage: Stage) {
    setEditingId(stage.id)
    setEditLabel(stage.label)
    setEditColor(stage.color)
    setEditTerminal(stage.is_terminal)
  }

  async function saveEdit() {
    if (!editingId || !editLabel.trim()) return
    setSaving(true)
    await supabase.from('project_stages').update({
      label: editLabel.trim(), color: editColor, is_terminal: editTerminal,
    }).eq('id', editingId)
    setEditingId(null)
    setSaving(false)
    load()
  }

  async function addStage() {
    if (!newName.trim() || !newLabel.trim()) return
    setSaving(true)
    const name = newName.trim().toLowerCase().replace(/\s+/g, '_')
    const maxOrder = stages.length > 0 ? Math.max(...stages.map(s => s.sort_order)) + 1 : 0
    await supabase.from('project_stages').insert({
      name, label: newLabel.trim(), color: newColor, sort_order: maxOrder, is_terminal: newTerminal,
    })
    setShowNew(false); setNewName(''); setNewLabel(''); setNewColor('bg-blue-100 text-blue-700'); setNewTerminal(false)
    setSaving(false)
    load()
  }

  async function deleteStage(id: string, label: string) {
    if (!confirm(`Delete stage "${label}"? Projects in this stage will keep their current status but won't appear in the stage list.`)) return
    await supabase.from('project_stages').delete().eq('id', id)
    load()
  }

  async function moveStage(id: string, direction: 'up' | 'down') {
    const idx = stages.findIndex(s => s.id === id)
    if (idx < 0) return
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= stages.length) return

    const a = stages[idx]
    const b = stages[swapIdx]

    await Promise.all([
      supabase.from('project_stages').update({ sort_order: b.sort_order }).eq('id', a.id),
      supabase.from('project_stages').update({ sort_order: a.sort_order }).eq('id', b.id),
    ])
    load()
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-one70-black flex items-center gap-2"><Layers size={24} /> Project Stages</h1>
        <button onClick={() => setShowNew(!showNew)}
          className="flex items-center gap-2 px-4 py-2 bg-one70-black text-white rounded-md text-sm font-semibold hover:bg-one70-dark transition-all">
          <Plus size={14} /> Add Stage
        </button>
      </div>

      <p className="text-sm text-one70-mid mb-4">Configure the stages that projects move through. Drag to reorder. Terminal stages (like Complete or On Hold) indicate a project has stopped active work.</p>

      {showNew && (
        <div className="bg-white rounded-lg border border-one70-border p-5 mb-4">
          <h3 className="text-sm font-bold text-one70-black mb-3">Add New Stage</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs text-one70-mid mb-1">Stage ID (lowercase, no spaces)</label>
              <input value={newName} onChange={e => setNewName(e.target.value.toLowerCase().replace(/\s+/g, '_'))}
                placeholder="e.g. permitting" className="w-full text-sm border border-one70-border rounded-md px-3 py-2" />
            </div>
            <div>
              <label className="block text-xs text-one70-mid mb-1">Display Label</label>
              <input value={newLabel} onChange={e => setNewLabel(e.target.value)}
                placeholder="e.g. Permitting" className="w-full text-sm border border-one70-border rounded-md px-3 py-2" />
            </div>
          </div>
          <div className="flex flex-wrap gap-3 mb-3">
            <div>
              <label className="block text-xs text-one70-mid mb-1">Color</label>
              <div className="flex gap-1.5">
                {COLOR_OPTIONS.map(c => (
                  <button key={c.value} onClick={() => setNewColor(c.value)}
                    className={`w-7 h-7 rounded-full ${c.preview} border-2 ${newColor === c.value ? 'border-one70-black' : 'border-transparent'} transition-all`}
                    title={c.label} />
                ))}
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm mt-4">
              <input type="checkbox" checked={newTerminal} onChange={e => setNewTerminal(e.target.checked)} className="rounded" />
              <span className="text-one70-dark">Terminal stage (project stops here)</span>
            </label>
          </div>
          <div className="flex gap-2">
            <button onClick={addStage} disabled={saving || !newName.trim() || !newLabel.trim()}
              className="px-4 py-2 bg-one70-black text-white rounded-md text-sm font-semibold disabled:opacity-30">Add Stage</button>
            <button onClick={() => setShowNew(false)} className="px-4 py-2 text-sm text-one70-mid">Cancel</button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-center text-one70-mid py-8">Loading stages...</p>
      ) : (
        <div className="space-y-2">
          {stages.map((stage, idx) => {
            const isEditing = editingId === stage.id
            return (
              <div key={stage.id} className="bg-white rounded-lg border border-one70-border p-4 flex items-center gap-3">
                {/* Reorder buttons */}
                <div className="flex flex-col gap-0.5 shrink-0">
                  <button onClick={() => moveStage(stage.id, 'up')} disabled={idx === 0}
                    className="p-0.5 text-gray-300 hover:text-one70-black disabled:opacity-20 transition-colors"><ArrowUp size={14} /></button>
                  <button onClick={() => moveStage(stage.id, 'down')} disabled={idx === stages.length - 1}
                    className="p-0.5 text-gray-300 hover:text-one70-black disabled:opacity-20 transition-colors"><ArrowDown size={14} /></button>
                </div>

                {/* Color badge */}
                <span className={`shrink-0 text-xs font-semibold px-3 py-1 rounded-full ${isEditing ? editColor : stage.color}`}>
                  {isEditing ? editLabel || stage.label : stage.label}
                </span>

                {/* Stage info */}
                <div className="flex-1 min-w-0">
                  {isEditing ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <input value={editLabel} onChange={e => setEditLabel(e.target.value)}
                        className="text-sm font-medium border border-one70-border rounded px-2 py-1 w-36" />
                      <div className="flex gap-1">
                        {COLOR_OPTIONS.map(c => (
                          <button key={c.value} onClick={() => setEditColor(c.value)}
                            className={`w-5 h-5 rounded-full ${c.preview} border-2 ${editColor === c.value ? 'border-one70-black' : 'border-transparent'}`} />
                        ))}
                      </div>
                      <label className="flex items-center gap-1 text-xs">
                        <input type="checkbox" checked={editTerminal} onChange={e => setEditTerminal(e.target.checked)} className="rounded" />
                        Terminal
                      </label>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-one70-mid font-mono">{stage.name}</span>
                      {stage.is_terminal && <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded">Terminal</span>}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  {isEditing ? (
                    <>
                      <button onClick={saveEdit} disabled={saving} className="p-1.5 text-green-600 hover:bg-green-50 rounded"><Save size={14} /></button>
                      <button onClick={() => setEditingId(null)} className="p-1.5 text-gray-400 hover:bg-gray-50 rounded"><X size={14} /></button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => startEdit(stage)} className="p-1.5 text-one70-mid hover:bg-one70-gray rounded"><Pencil size={14} /></button>
                      <button onClick={() => deleteStage(stage.id, stage.label)} className="p-1.5 text-red-400 hover:bg-red-50 rounded"><Trash2 size={14} /></button>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
