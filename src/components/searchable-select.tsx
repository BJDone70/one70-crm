'use client'

import { useState, useRef, useEffect } from 'react'
import { Search, X, ChevronDown } from 'lucide-react'

interface Option {
  id: string
  label: string
  sub?: string
}

interface Props {
  options: Option[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

export default function SearchableSelect({ options, value, onChange, placeholder = 'Search...', className = '' }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const selected = options.find(o => o.id === value)
  const filtered = query
    ? options.filter(o => o.label.toLowerCase().includes(query.toLowerCase()) || o.sub?.toLowerCase().includes(query.toLowerCase()))
    : options

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50)
  }, [open])

  function select(id: string) {
    onChange(id)
    setOpen(false)
    setQuery('')
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Display button */}
      <button type="button" onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 border border-one70-border rounded-md text-sm text-left focus:outline-none focus:ring-2 focus:ring-one70-yellow focus:border-transparent bg-white">
        <span className={selected ? 'text-one70-dark truncate' : 'text-gray-400 truncate'}>
          {selected ? selected.label : 'None'}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          {value && (
            <span onClick={(e) => { e.stopPropagation(); onChange(''); setOpen(false) }}
              className="p-0.5 hover:bg-gray-100 rounded">
              <X size={12} className="text-gray-400" />
            </span>
          )}
          <ChevronDown size={14} className="text-gray-400" />
        </div>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-white border border-one70-border rounded-lg shadow-xl max-h-60 flex flex-col">
          {/* Search input */}
          <div className="p-2 border-b border-one70-border shrink-0">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input ref={inputRef} type="text" value={query} onChange={e => setQuery(e.target.value)}
                placeholder={placeholder}
                className="w-full pl-8 pr-2 py-1.5 text-sm border border-one70-border rounded-md focus:outline-none focus:border-one70-black text-gray-900" style={{ color: '#1a1a1a' }} />
            </div>
          </div>
          {/* Options list */}
          <div className="overflow-y-auto overscroll-contain flex-1">
            <button type="button" onClick={() => select('')}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-one70-gray transition-colors ${!value ? 'bg-one70-gray font-medium' : ''}`}>
              None
            </button>
            {filtered.length === 0 && (
              <p className="px-3 py-3 text-xs text-gray-400 text-center">No results</p>
            )}
            {filtered.slice(0, 50).map(o => (
              <button type="button" key={o.id} onClick={() => select(o.id)}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-one70-gray transition-colors ${value === o.id ? 'bg-one70-yellow/20 font-medium' : ''}`}>
                <span className="text-one70-dark">{o.label}</span>
                {o.sub && <span className="text-gray-400 ml-1.5 text-xs">{o.sub}</span>}
              </button>
            ))}
            {filtered.length > 50 && (
              <p className="px-3 py-2 text-xs text-gray-400 text-center">Type to narrow results...</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
