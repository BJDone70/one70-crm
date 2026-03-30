'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Building2, Users, Columns3, MapPin, X, CalendarCheck, FolderKanban, Activity, Mail, Zap } from 'lucide-react'

interface SearchResult {
  type: 'organization' | 'contact' | 'deal' | 'property' | 'project' | 'task' | 'activity' | 'email' | 'sequence'
  id: string
  title: string
  subtitle: string
  href: string
}

const typeIcons: Record<string, any> = {
  organization: Building2, contact: Users, deal: Columns3, property: MapPin,
  project: FolderKanban, task: CalendarCheck, activity: Activity, email: Mail, sequence: Zap,
}

const typeLabels: Record<string, string> = {
  organization: 'Org', contact: 'Contact', deal: 'Deal', property: 'Property',
  project: 'Project', task: 'Task', activity: 'Activity', email: 'Email', sequence: 'Sequence',
}

const typeColors: Record<string, string> = {
  organization: 'bg-blue-100 text-blue-700', contact: 'bg-green-100 text-green-700',
  deal: 'bg-amber-100 text-amber-700', property: 'bg-purple-100 text-purple-700',
  project: 'bg-indigo-100 text-indigo-700', task: 'bg-red-100 text-red-700',
  activity: 'bg-orange-100 text-orange-700', email: 'bg-cyan-100 text-cyan-700',
  sequence: 'bg-pink-100 text-pink-700',
}

export default function GlobalSearch() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<NodeJS.Timeout>()
  const router = useRouter()

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); return }
    setLoading(true)
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      if (data.results) setResults(data.results)
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(query), 250)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, search])

  // Close on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Keyboard shortcut: Cmd+K or Ctrl+K
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
        setIsOpen(true)
      }
      if (e.key === 'Escape') {
        setIsOpen(false)
        inputRef.current?.blur()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => Math.min(prev + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => Math.max(prev - 1, -1))
    } else if (e.key === 'Enter' && selectedIndex >= 0 && results[selectedIndex]) {
      e.preventDefault()
      navigateTo(results[selectedIndex])
    }
  }

  function navigateTo(result: SearchResult) {
    setIsOpen(false)
    setQuery('')
    setResults([])
    router.push(result.href)
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-one70-mid pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); setIsOpen(true); setSelectedIndex(-1) }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search... (⌘K)"
          className="w-full pl-9 pr-8 py-2 bg-one70-gray border border-transparent rounded-md text-sm text-one70-black focus:outline-none focus:ring-2 focus:ring-one70-yellow focus:border-transparent focus:bg-white placeholder:text-gray-400" style={{ color: '#1a1a1a' }}
        />
        {query && (
          <button onClick={() => { setQuery(''); setResults([]); setIsOpen(false) }}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600">
            <X size={14} />
          </button>
        )}
      </div>

      {/* Results dropdown */}
      {isOpen && (query.length >= 2) && (
        <div className="absolute top-full mt-1 left-0 right-0 bg-white rounded-lg border border-one70-border shadow-xl z-50 max-h-80 overflow-y-auto">
          {loading && results.length === 0 && (
            <div className="px-4 py-3 text-sm text-gray-400">Searching...</div>
          )}
          {loading && results.length > 0 && (
            <div className="px-4 py-2 text-xs text-gray-400 border-b border-one70-border flex items-center gap-2">
              <div className="w-3 h-3 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
              Updating...
            </div>
          )}
          {!loading && results.length === 0 && query.length >= 2 && (
            <div className="px-4 py-3 text-sm text-gray-400">No results found</div>
          )}
          {results.map((result, i) => {
            const Icon = typeIcons[result.type]
            return (
              <button
                key={`${result.type}-${result.id}`}
                onClick={() => navigateTo(result)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-one70-gray transition-colors ${
                  i === selectedIndex ? 'bg-one70-gray' : ''
                } ${i > 0 ? 'border-t border-one70-border' : ''}`}
              >
                <Icon size={16} className="text-one70-mid shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{result.title}</p>
                  <p className="text-xs text-gray-500 truncate">{result.subtitle}</p>
                </div>
                <span className={`shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded ${typeColors[result.type]}`}>
                  {typeLabels[result.type]}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
