'use client'

import { useState, useRef, useEffect } from 'react'
import { User, X } from 'lucide-react'

interface Person { name: string; email: string; source: string }

interface Props {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export default function RecipientInput({ value, onChange, placeholder }: Props) {
  const [suggestions, setSuggestions] = useState<Person[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef<NodeJS.Timeout>()
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setIsOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function handleChange(val: string) {
    onChange(val)
    const parts = val.split(',')
    const lastPart = parts[parts.length - 1].trim()
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (lastPart.length >= 2 && !lastPart.includes('@')) {
      debounceRef.current = setTimeout(() => search(lastPart), 250)
    } else {
      setSuggestions([])
      setIsOpen(false)
    }
  }

  async function search(q: string) {
    setLoading(true)
    try {
      const res = await fetch(`/api/search-recipients?q=${encodeURIComponent(q)}`)
      if (res.ok) {
        const data = await res.json()
        setSuggestions(data.results || [])
        setIsOpen((data.results || []).length > 0)
      }
    } catch {}
    setLoading(false)
  }

  function selectPerson(person: Person) {
    const parts = value.split(',').map(s => s.trim()).filter(Boolean)
    // Replace the last (incomplete) part with the selected email
    if (parts.length > 0) parts.pop()
    parts.push(person.email)
    onChange(parts.join(', ') + ', ')
    setIsOpen(false)
    setSuggestions([])
  }

  return (
    <div ref={containerRef} className="relative flex-1">
      <input type="text" value={value} onChange={e => handleChange(e.target.value)}
        onFocus={() => suggestions.length > 0 && setIsOpen(true)}
        placeholder={placeholder || 'Type name or email...'}
        className="w-full text-sm border border-one70-border rounded px-2.5 py-1.5 focus:outline-none focus:border-blue-500" />

      {isOpen && suggestions.length > 0 && (
        <div className="absolute top-full mt-1 left-0 right-0 bg-white rounded-lg border border-one70-border shadow-xl z-50 max-h-40 overflow-y-auto">
          {suggestions.map((p, i) => (
            <button key={`${p.email}-${i}`} onClick={() => selectPerson(p)}
              className={`w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-one70-gray text-sm ${i > 0 ? 'border-t border-one70-border' : ''}`}>
              <User size={14} className="text-one70-mid shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-one70-dark truncate">{p.name}</p>
                <p className="text-[10px] text-one70-mid truncate">{p.email}{p.source ? ` · ${p.source}` : ''}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
