'use client'

import { useState } from 'react'
import { Cloud, Download, Check, Loader2, Search, X } from 'lucide-react'

interface M365Contact {
  first_name: string; last_name: string; email: string
  phone: string; mobile_phone: string; company: string; title: string
  _selected?: boolean
}

export default function ImportM365Contacts() {
  const [isOpen, setIsOpen] = useState(false)
  const [contacts, setContacts] = useState<M365Contact[]>([])
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState('')
  const [search, setSearch] = useState('')

  async function loadContacts() {
    setIsOpen(true); setLoading(true); setResult('')
    const q = search ? `&q=${encodeURIComponent(search)}` : ''
    const res = await fetch(`/api/m365/contacts?action=contacts&limit=50${q}`)
    const data = await res.json()
    if (data.error) { setResult(data.error); setLoading(false); return }
    setContacts((data.contacts || []).map((c: any) => ({ ...c, _selected: true })))
    setLoading(false)
  }

  function toggleAll(selected: boolean) {
    setContacts(contacts.map(c => ({ ...c, _selected: selected })))
  }

  function toggle(i: number) {
    setContacts(contacts.map((c, j) => j === i ? { ...c, _selected: !c._selected } : c))
  }

  async function handleImport() {
    const selected = contacts.filter(c => c._selected)
    if (!selected.length) return
    setImporting(true); setResult('')
    const res = await fetch('/api/m365/contacts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contacts: selected }),
    })
    const data = await res.json()
    setResult(`Imported ${data.imported}, skipped ${data.skipped} duplicates${data.errors?.length ? `, ${data.errors.length} errors` : ''}`)
    setImporting(false)
  }

  const selectedCount = contacts.filter(c => c._selected).length

  if (!isOpen) {
    return (
      <button onClick={() => { setIsOpen(true); loadContacts() }}
        className="flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-100 transition-colors">
        <Cloud size={16} /> Import from M365
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={() => setIsOpen(false)}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-one70-border">
          <h3 className="text-lg font-bold text-one70-black flex items-center gap-2"><Cloud size={20} /> Import M365 Contacts</h3>
          <button onClick={() => setIsOpen(false)}><X size={20} className="text-gray-400" /></button>
        </div>

        <div className="px-5 py-3 border-b border-one70-border flex gap-2">
          <div className="flex-1 relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-one70-mid" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && loadContacts()}
              placeholder="Search contacts..." className="w-full pl-9 pr-3 py-2 text-sm border border-one70-border rounded-md" />
          </div>
          <button onClick={loadContacts} disabled={loading}
            className="px-4 py-2 bg-one70-black text-white rounded-md text-sm font-medium disabled:opacity-50">
            {loading ? <Loader2 size={14} className="animate-spin" /> : 'Search'}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="text-center py-8 text-one70-mid"><Loader2 size={24} className="animate-spin mx-auto mb-2" /><p className="text-sm">Loading M365 contacts...</p></div>
          ) : contacts.length === 0 ? (
            <div className="text-center py-8 text-one70-mid"><p className="text-sm">No contacts found</p></div>
          ) : (
            <>
              <div className="px-5 py-2 flex items-center justify-between bg-one70-gray/50">
                <label className="flex items-center gap-2 text-xs">
                  <input type="checkbox" checked={selectedCount === contacts.length} onChange={e => toggleAll(e.target.checked)} className="rounded" />
                  Select all ({contacts.length})
                </label>
                <span className="text-xs text-one70-mid">{selectedCount} selected</span>
              </div>
              {contacts.map((c, i) => (
                <div key={i} className={`flex items-center gap-3 px-5 py-2.5 border-b border-one70-border hover:bg-one70-gray/30 ${c._selected ? '' : 'opacity-50'}`}>
                  <input type="checkbox" checked={c._selected} onChange={() => toggle(i)} className="rounded shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-one70-black truncate">{c.first_name} {c.last_name}</p>
                    <p className="text-xs text-one70-mid truncate">{[c.title, c.company, c.email].filter(Boolean).join(' · ')}</p>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>

        <div className="px-5 py-3 border-t border-one70-border flex items-center justify-between">
          {result && <p className={`text-xs ${result.includes('error') ? 'text-red-600' : 'text-green-600'}`}>{result}</p>}
          <div className="flex gap-2 ml-auto">
            <button onClick={() => setIsOpen(false)} className="px-4 py-2 text-sm text-one70-mid">Cancel</button>
            <button onClick={handleImport} disabled={importing || selectedCount === 0}
              className="flex items-center gap-2 px-4 py-2 bg-one70-black text-white rounded-md text-sm font-semibold disabled:opacity-30">
              {importing ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              Import {selectedCount} Contact{selectedCount !== 1 ? 's' : ''}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
