'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { MapPin, Loader2, X } from 'lucide-react'

interface AddressResult {
  description: string
  place_id: string
  structured?: {
    address: string
    city: string
    state: string
    zip: string
  }
}

interface Props {
  value: string
  onChange: (value: string) => void
  onSelect?: (result: { address: string; city: string; state: string; zip: string }) => void
  placeholder?: string
  className?: string
}

export default function AddressAutocomplete({ value, onChange, onSelect, placeholder, className }: Props) {
  const [suggestions, setSuggestions] = useState<AddressResult[]>([])
  const [loading, setLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const debounceRef = useRef<NodeJS.Timeout>()
  const containerRef = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setIsOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const search = useCallback(async (q: string) => {
    if (q.length < 3) { setSuggestions([]); return }
    setLoading(true)
    try {
      const res = await fetch(`/api/address-search?q=${encodeURIComponent(q)}`)
      if (res.ok) {
        const data = await res.json()
        setSuggestions(data.results || [])
        setIsOpen(true)
      }
    } catch {}
    setLoading(false)
  }, [])

  function handleInputChange(val: string) {
    onChange(val)
    setSelectedIndex(-1)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(val), 300)
  }

  async function handleSelect(result: AddressResult) {
    onChange(result.description)
    setIsOpen(false)
    setSuggestions([])

    // Fetch place details for structured address
    if (result.place_id && onSelect) {
      try {
        const res = await fetch(`/api/address-search?place_id=${result.place_id}`)
        if (res.ok) {
          const data = await res.json()
          if (data.structured) onSelect(data.structured)
          else onSelect({ address: result.description, city: '', state: '', zip: '' })
        }
      } catch {
        onSelect({ address: result.description, city: '', state: '', zip: '' })
      }
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex(prev => Math.min(prev + 1, suggestions.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex(prev => Math.max(prev - 1, -1)) }
    else if (e.key === 'Enter' && selectedIndex >= 0) { e.preventDefault(); handleSelect(suggestions[selectedIndex]) }
    else if (e.key === 'Escape') setIsOpen(false)
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-one70-mid pointer-events-none" />
        <input
          type="text"
          value={value}
          onChange={e => handleInputChange(e.target.value)}
          onFocus={() => suggestions.length > 0 && setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || 'Start typing an address...'}
          className={`w-full pl-9 pr-8 py-2 text-sm border border-one70-border rounded-md focus:outline-none focus:border-one70-black ${className || ''}`}
        />
        {loading && <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-one70-mid" />}
        {value && !loading && (
          <button onClick={() => { onChange(''); setSuggestions([]); setIsOpen(false) }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            <X size={14} />
          </button>
        )}
      </div>

      {isOpen && suggestions.length > 0 && (
        <div className="absolute top-full mt-1 left-0 right-0 bg-white rounded-lg border border-one70-border shadow-xl z-50 max-h-48 overflow-y-auto">
          {suggestions.map((s, i) => (
            <button key={s.place_id} onClick={() => handleSelect(s)}
              className={`w-full flex items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-one70-gray transition-colors ${i === selectedIndex ? 'bg-one70-gray' : ''} ${i > 0 ? 'border-t border-one70-border' : ''}`}>
              <MapPin size={14} className="text-one70-mid shrink-0" />
              <span className="truncate text-one70-dark">{s.description}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
