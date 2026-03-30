'use client'

import { useState } from 'react'
import { Plus, X } from 'lucide-react'

interface SingleProps {
  verticals: { id: string; label: string }[]
  value: string
  onChange: (value: string) => void
  addVertical: (name: string) => Promise<string | null>
  className?: string
  required?: boolean
  variant?: 'select' | 'pills'
  multi?: false
}

interface MultiProps {
  verticals: { id: string; label: string }[]
  value: string[]
  onChange: (value: string[]) => void
  addVertical: (name: string) => Promise<string | null>
  className?: string
  required?: boolean
  variant?: 'select' | 'pills'
  multi: true
}

type Props = SingleProps | MultiProps

export default function VerticalSelector(props: Props) {
  const { verticals, addVertical, className, required, variant = 'select' } = props
  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)

  const isMulti = props.multi === true
  const selectedArr: string[] = isMulti ? (props.value as string[]) : [(props.value as string)].filter(Boolean)

  function isSelected(id: string) { return selectedArr.includes(id) }

  function toggle(id: string) {
    if (isMulti) {
      const onChange = props.onChange as (v: string[]) => void
      if (selectedArr.includes(id)) {
        const next = selectedArr.filter(v => v !== id)
        if (next.length > 0) onChange(next) // keep at least one
      } else {
        onChange([...selectedArr, id])
      }
    } else {
      (props.onChange as (v: string) => void)(id)
    }
  }

  async function handleAdd() {
    if (!newName.trim()) return
    setAdding(true)
    const id = await addVertical(newName)
    if (id) {
      if (isMulti) {
        (props.onChange as (v: string[]) => void)([...selectedArr, id])
      } else {
        (props.onChange as (v: string) => void)(id)
      }
    }
    setNewName('')
    setShowAdd(false)
    setAdding(false)
  }

  // Pills variant
  if (variant === 'pills') {
    return (
      <div>
        <div className="flex flex-wrap gap-2">
          {verticals.map(v => (
            <button key={v.id} type="button" onClick={() => toggle(v.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                isSelected(v.id) ? 'bg-one70-black text-white' : 'bg-one70-gray text-one70-dark hover:bg-gray-200'
              }`}>{v.label}</button>
          ))}
          {!showAdd && (
            <button type="button" onClick={() => setShowAdd(true)}
              className="px-2 py-1.5 rounded-full text-xs text-one70-mid hover:text-one70-black hover:bg-gray-100 transition-colors">
              <Plus size={12} />
            </button>
          )}
        </div>
        {isMulti && selectedArr.length > 0 && (
          <p className="text-[10px] text-one70-mid mt-1">{selectedArr.length} selected</p>
        )}
        {showAdd && (
          <div className="flex items-center gap-2 mt-2">
            <input type="text" value={newName} onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAdd())}
              placeholder="New vertical name..." className="text-sm border border-one70-border rounded-md px-3 py-1.5 flex-1 focus:outline-none focus:border-one70-black" autoFocus />
            <button type="button" onClick={handleAdd} disabled={adding || !newName.trim()}
              className="px-3 py-1.5 bg-one70-black text-white rounded-md text-xs font-medium disabled:opacity-30">Add</button>
            <button type="button" onClick={() => { setShowAdd(false); setNewName('') }}
              className="p-1 text-gray-400 hover:text-gray-600"><X size={14} /></button>
          </div>
        )}
      </div>
    )
  }

  // Select variant (dropdown) — for multi, use checkbox dropdown
  if (isMulti) {
    return (
      <div>
        <div className="flex flex-wrap gap-1.5 min-h-[38px] p-1.5 border border-one70-border rounded-md bg-white">
          {selectedArr.map(id => {
            const v = verticals.find(x => x.id === id)
            return (
              <span key={id} className="inline-flex items-center gap-1 px-2 py-0.5 bg-one70-gray rounded text-xs font-medium text-one70-dark">
                {v?.label || id}
                <button type="button" onClick={() => toggle(id)} className="text-gray-400 hover:text-red-500">
                  <X size={10} />
                </button>
              </span>
            )
          })}
          <select
            value=""
            onChange={e => { if (e.target.value) toggle(e.target.value) }}
            className="flex-1 min-w-[120px] text-xs border-0 bg-transparent focus:outline-none text-one70-mid"
          >
            <option value="">Add vertical...</option>
            {verticals.filter(v => !isSelected(v.id)).map(v => (
              <option key={v.id} value={v.id}>{v.label}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-1 mt-1">
          {!showAdd ? (
            <button type="button" onClick={() => setShowAdd(true)} className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-0.5">
              <Plus size={10} /> New vertical
            </button>
          ) : (
            <div className="flex gap-1">
              <input type="text" value={newName} onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAdd())}
                placeholder="New vertical" className="w-28 px-2 py-1 text-xs border border-one70-border rounded" autoFocus />
              <button type="button" onClick={handleAdd} disabled={adding || !newName.trim()}
                className="px-2 py-1 text-xs bg-one70-black text-white rounded disabled:opacity-30">Add</button>
              <button type="button" onClick={() => { setShowAdd(false); setNewName('') }}
                className="px-1 text-xs text-gray-400">✕</button>
            </div>
          )}
        </div>
      </div>
    )
  }

  // Single select dropdown
  return (
    <div className="flex gap-2">
      <select value={props.value as string} onChange={e => (props.onChange as (v: string) => void)(e.target.value)} className={`${className || ''} flex-1`} required={required}>
        {verticals.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
      </select>
      {!showAdd ? (
        <button type="button" onClick={() => setShowAdd(true)}
          className="px-2 py-1 text-xs text-one70-mid hover:text-one70-black shrink-0" title="Add vertical">
          <Plus size={14} />
        </button>
      ) : (
        <div className="flex gap-1">
          <input type="text" value={newName} onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAdd())}
            placeholder="New vertical" className="w-28 px-2 py-1 text-xs border border-one70-border rounded" autoFocus />
          <button type="button" onClick={handleAdd} disabled={adding || !newName.trim()}
            className="px-2 py-1 text-xs bg-one70-black text-white rounded disabled:opacity-30">Add</button>
          <button type="button" onClick={() => { setShowAdd(false); setNewName('') }}
            className="px-1 text-xs text-gray-400">✕</button>
        </div>
      )}
    </div>
  )
}
