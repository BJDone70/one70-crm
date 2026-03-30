'use client'

import { useState, useRef } from 'react'
import { useVerticals } from '@/hooks/use-verticals'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Upload, ArrowRight, Check, AlertCircle, X, FileSpreadsheet, Loader2 } from 'lucide-react'
import PillFilter from '@/components/pill-filter'

type ImportTarget = 'organizations' | 'contacts'

const ORG_FIELDS = [
  { id: 'name', label: 'Company Name', required: true },
  { id: 'vertical', label: 'Vertical' },
  { id: 'hq_city', label: 'City' },
  { id: 'hq_state', label: 'State' },
  { id: 'portfolio_size', label: 'Portfolio Size' },
  { id: 'priority_rating', label: 'Priority Rating' },
  { id: 'website', label: 'Website' },
  { id: 'phone', label: 'Phone' },
  { id: 'fit_rationale', label: 'Fit Rationale' },
  { id: 'services_to_lead', label: 'Services to Lead With' },
  { id: 'notes', label: 'Notes' },
]

const CONTACT_FIELDS = [
  { id: 'first_name', label: 'First Name', required: true },
  { id: 'last_name', label: 'Last Name', required: true },
  { id: 'title', label: 'Title' },
  { id: 'email', label: 'Email' },
  { id: 'phone', label: 'Phone' },
  { id: 'linkedin_url', label: 'LinkedIn URL' },
  { id: 'org_name', label: 'Company Name (matches to existing org)' },
  { id: 'is_decision_maker', label: 'Decision Maker (true/false)' },
  { id: 'preferred_channel', label: 'Preferred Channel' },
  { id: 'notes', label: 'Notes' },
]

function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  if (lines.length === 0) return { headers: [], rows: [] }

  const parseLine = (line: string): string[] => {
    const result: string[] = []
    let current = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
        else inQuotes = !inQuotes
      } else if (ch === ',' && !inQuotes) {
        result.push(current.trim())
        current = ''
      } else {
        current += ch
      }
    }
    result.push(current.trim())
    return result
  }

  const headers = parseLine(lines[0])
  const rows = lines.slice(1).map(parseLine).filter(r => r.some(cell => cell.trim()))
  return { headers, rows }
}

export default function ImportPage() {
  const [target, setTarget] = useState<ImportTarget>('organizations')
  const [step, setStep] = useState<'upload' | 'map' | 'preview' | 'importing' | 'done'>('upload')
  const [csvData, setCsvData] = useState<{ headers: string[]; rows: string[][] }>({ headers: [], rows: [] })
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [defaultVertical, setDefaultVertical] = useState('multifamily')
  const [error, setError] = useState('')
  const [importResults, setImportResults] = useState({ success: 0, failed: 0, errors: [] as string[] })
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()
  const router = useRouter()
  const { verticals } = useVerticals()

  const fields = target === 'organizations' ? ORG_FIELDS : CONTACT_FIELDS

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')

    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const text = ev.target?.result as string
        const parsed = parseCSV(text)
        if (parsed.headers.length === 0) { setError('File appears empty'); return }
        setCsvData(parsed)

        // Auto-map columns by fuzzy matching
        const autoMap: Record<string, string> = {}
        parsed.headers.forEach(header => {
          const h = header.toLowerCase().replace(/[^a-z0-9]/g, '')
          fields.forEach(f => {
            const fl = f.label.toLowerCase().replace(/[^a-z0-9]/g, '')
            const fi = f.id.toLowerCase().replace(/[^a-z0-9]/g, '')
            if (h === fi || h === fl || h.includes(fi) || fi.includes(h)) {
              if (!autoMap[f.id]) autoMap[f.id] = header
            }
          })
          // Common aliases
          if (h.includes('company') || h.includes('organization') || h === 'org') autoMap['name'] = autoMap['name'] || header
          if (h.includes('company') && target === 'contacts') autoMap['org_name'] = autoMap['org_name'] || header
          if (h.includes('first') && h.includes('name')) autoMap['first_name'] = autoMap['first_name'] || header
          if (h.includes('last') && h.includes('name')) autoMap['last_name'] = autoMap['last_name'] || header
          if (h.includes('linkedin')) autoMap['linkedin_url'] = autoMap['linkedin_url'] || header
          if (h === 'dm' || h.includes('decision')) autoMap['is_decision_maker'] = autoMap['is_decision_maker'] || header
          if (h.includes('hq') && h.includes('city') || h === 'city') autoMap['hq_city'] = autoMap['hq_city'] || header
          if (h.includes('hq') && h.includes('state') || h === 'state') autoMap['hq_state'] = autoMap['hq_state'] || header
          if (h.includes('portfolio') || h.includes('properties')) autoMap['portfolio_size'] = autoMap['portfolio_size'] || header
          if (h.includes('priority')) autoMap['priority_rating'] = autoMap['priority_rating'] || header
        })
        setMapping(autoMap)
        setStep('map')
      } catch {
        setError('Could not parse the file. Make sure it\'s a valid CSV.')
      }
    }
    reader.readAsText(file)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function getMappedValue(row: string[], fieldId: string): string {
    const header = mapping[fieldId]
    if (!header) return ''
    const idx = csvData.headers.indexOf(header)
    return idx >= 0 ? (row[idx] || '').trim() : ''
  }

  function getPreviewRows() {
    return csvData.rows.slice(0, 5)
  }

  async function startImport() {
    setStep('importing')
    const results = { success: 0, failed: 0, errors: [] as string[] }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    if (target === 'organizations') {
      // Preload existing orgs to dedupe
      const { data: existingOrgs } = await supabase.from('organizations').select('id, name').is('deleted_at', null)
      const existingNames = new Set((existingOrgs || []).map(o => o.name.toLowerCase()))

      for (let i = 0; i < csvData.rows.length; i++) {
        const row = csvData.rows[i]
        const name = getMappedValue(row, 'name')
        if (!name) { results.failed++; results.errors.push(`Row ${i + 2}: Missing company name`); continue }
        if (existingNames.has(name.toLowerCase())) { results.failed++; results.errors.push(`Row ${i + 2}: "${name}" already exists`); continue }

        let vertical = getMappedValue(row, 'vertical').toLowerCase().replace(/[\s-]/g, '_')
        const validVerticals = verticals.map(v => v.id)
        if (vertical && !validVerticals.includes(vertical)) vertical = defaultVertical
        if (!vertical) vertical = defaultVertical

        let priority = getMappedValue(row, 'priority_rating').toLowerCase().replace(/[\s-]/g, '_')
        if (!['high', 'medium_high', 'medium', 'low'].includes(priority)) priority = ''

        const { error } = await supabase.from('organizations').insert({
          name,
          vertical,
          hq_city: getMappedValue(row, 'hq_city') || null,
          hq_state: getMappedValue(row, 'hq_state') || null,
          portfolio_size: parseInt(getMappedValue(row, 'portfolio_size')) || null,
          priority_rating: priority || null,
          website: getMappedValue(row, 'website') || null,
          phone: getMappedValue(row, 'phone') || null,
          fit_rationale: getMappedValue(row, 'fit_rationale') || null,
          services_to_lead: getMappedValue(row, 'services_to_lead') || null,
          notes: getMappedValue(row, 'notes') || null,
        })

        if (error) { results.failed++; results.errors.push(`Row ${i + 2}: ${error.message}`) }
        else { results.success++; existingNames.add(name.toLowerCase()) }
      }
    } else {
      // Contacts — match org by name
      const { data: existingOrgs } = await supabase.from('organizations').select('id, name').is('deleted_at', null)
      const orgMap = new Map((existingOrgs || []).map(o => [o.name.toLowerCase(), o.id]))

      for (let i = 0; i < csvData.rows.length; i++) {
        const row = csvData.rows[i]
        const firstName = getMappedValue(row, 'first_name')
        const lastName = getMappedValue(row, 'last_name')
        if (!firstName || !lastName) { results.failed++; results.errors.push(`Row ${i + 2}: Missing first or last name`); continue }

        const orgName = getMappedValue(row, 'org_name')
        let orgId = null
        if (orgName) {
          // Fuzzy match
          for (const [name, id] of orgMap.entries()) {
            if (name === orgName.toLowerCase() || name.includes(orgName.toLowerCase()) || orgName.toLowerCase().includes(name)) {
              orgId = id; break
            }
          }
        }

        const dm = getMappedValue(row, 'is_decision_maker').toLowerCase()
        const isDm = ['true', 'yes', '1', 'dm', 'y'].includes(dm)

        const { error } = await supabase.from('contacts').insert({
          first_name: firstName,
          last_name: lastName,
          title: getMappedValue(row, 'title') || null,
          email: getMappedValue(row, 'email') || null,
          phone: getMappedValue(row, 'phone') || null,
          linkedin_url: getMappedValue(row, 'linkedin_url') || null,
          org_id: orgId,
          is_decision_maker: isDm,
          preferred_channel: getMappedValue(row, 'preferred_channel') || null,
          notes: orgName && !orgId
            ? `Company: ${orgName}${getMappedValue(row, 'notes') ? '\n' + getMappedValue(row, 'notes') : ''}`
            : getMappedValue(row, 'notes') || null,
        })

        if (error) { results.failed++; results.errors.push(`Row ${i + 2}: ${error.message}`) }
        else results.success++
      }
    }

    setImportResults(results)
    setStep('done')
    router.refresh()
  }

  function resetImport() {
    setStep('upload')
    setCsvData({ headers: [], rows: [] })
    setMapping({})
    setImportResults({ success: 0, failed: 0, errors: [] })
    setError('')
  }

  const inputClass = "w-full px-3 py-1.5 border border-one70-border rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-one70-yellow"

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-one70-black">Import Data</h1>
        <p className="text-one70-mid text-sm mt-1">Bulk import organizations or contacts from a CSV file</p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-6">
        {['Upload', 'Map Columns', 'Preview & Import'].map((label, i) => {
          const stepNum = i + 1
          const currentNum = step === 'upload' ? 1 : step === 'map' ? 2 : 3
          const isActive = stepNum === currentNum
          const isDone = stepNum < currentNum || step === 'done'
          return (
            <div key={label} className="flex items-center gap-2">
              {i > 0 && <ArrowRight size={14} className="text-gray-300" />}
              <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
                isDone ? 'bg-green-100 text-green-700' : isActive ? 'bg-one70-black text-white' : 'bg-gray-100 text-gray-400'
              }`}>
                {isDone ? <Check size={12} /> : <span>{stepNum}</span>}
                {label}
              </div>
            </div>
          )
        })}
      </div>

      {/* Step 1: Upload */}
      {step === 'upload' && (
        <div className="bg-white rounded-lg border border-one70-border p-6 max-w-2xl">
          <div className="mb-4">
            <p className="text-sm font-semibold text-one70-dark mb-2">What are you importing?</p>
            <PillFilter
              options={[{ id: 'organizations', label: 'Organizations' }, { id: 'contacts', label: 'Contacts' }]}
              value={target}
              onChange={v => setTarget(v as ImportTarget)}
              allowDeselect={false}
            />
          </div>

          {target === 'organizations' && (
            <div className="mb-4">
              <p className="text-sm font-semibold text-one70-dark mb-2">Default vertical (for rows without one)</p>
              <PillFilter
                options={verticals}
                value={defaultVertical}
                onChange={setDefaultVertical}
                allowDeselect={false}
              />
            </div>
          )}

          <label className="flex flex-col items-center justify-center gap-3 p-8 border-2 border-dashed border-one70-border rounded-lg cursor-pointer hover:border-one70-yellow hover:bg-one70-gray transition-colors">
            <FileSpreadsheet size={32} className="text-one70-mid" />
            <span className="text-sm font-medium text-one70-dark">Choose CSV file</span>
            <span className="text-xs text-gray-400">Supports .csv and .tsv files</span>
            <input ref={fileInputRef} type="file" accept=".csv,.tsv,.txt" onChange={handleFileUpload} className="hidden" />
          </label>

          {error && <div className="mt-3 bg-red-50 text-red-700 px-3 py-2 rounded-md text-sm">{error}</div>}
        </div>
      )}

      {/* Step 2: Map columns */}
      {step === 'map' && (
        <div className="bg-white rounded-lg border border-one70-border p-6 max-w-3xl">
          <p className="text-sm text-one70-mid mb-4">
            Found <span className="font-semibold">{csvData.rows.length} rows</span> with <span className="font-semibold">{csvData.headers.length} columns</span>. Map your CSV columns to CRM fields:
          </p>

          <div className="space-y-3">
            {fields.map(field => (
              <div key={field.id} className="flex items-center gap-3">
                <label className="w-48 text-sm font-medium text-gray-700 shrink-0">
                  {field.label} {field.required && <span className="text-red-500">*</span>}
                </label>
                <select
                  value={mapping[field.id] || ''}
                  onChange={e => setMapping(prev => ({ ...prev, [field.id]: e.target.value }))}
                  className={inputClass}
                >
                  <option value="">— Skip —</option>
                  {csvData.headers.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
            ))}
          </div>

          <div className="flex gap-3 mt-6">
            <button onClick={() => setStep('preview')}
              className="bg-one70-black text-white px-6 py-2.5 rounded-md text-sm font-semibold hover:bg-one70-dark transition-colors">
              Preview & Import
            </button>
            <button onClick={resetImport} className="px-4 py-2.5 text-sm text-one70-mid hover:text-one70-dark">
              Start Over
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Preview */}
      {step === 'preview' && (
        <div className="bg-white rounded-lg border border-one70-border p-6">
          <p className="text-sm text-one70-mid mb-4">
            Preview of first 5 rows. <span className="font-semibold">{csvData.rows.length} total rows</span> will be imported.
          </p>

          <div className="overflow-x-auto mb-4">
            <table className="w-full min-w-[600px] text-sm">
              <thead>
                <tr className="bg-one70-gray">
                  <th className="text-left px-3 py-2 text-xs font-semibold text-gray-600">#</th>
                  {fields.filter(f => mapping[f.id]).map(f => (
                    <th key={f.id} className="text-left px-3 py-2 text-xs font-semibold text-gray-600">{f.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {getPreviewRows().map((row, i) => (
                  <tr key={i} className="border-t border-one70-border">
                    <td className="px-3 py-2 text-xs text-gray-400">{i + 1}</td>
                    {fields.filter(f => mapping[f.id]).map(f => (
                      <td key={f.id} className="px-3 py-2 text-xs text-gray-700 max-w-[200px] truncate">
                        {getMappedValue(row, f.id) || <span className="text-gray-300">—</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex gap-3">
            <button onClick={startImport}
              className="bg-one70-black text-white px-6 py-2.5 rounded-md text-sm font-semibold hover:bg-one70-dark transition-colors flex items-center gap-2">
              <Upload size={16} /> Import {csvData.rows.length} {target === 'organizations' ? 'Organizations' : 'Contacts'}
            </button>
            <button onClick={() => setStep('map')} className="px-4 py-2.5 text-sm text-one70-mid hover:text-one70-dark">
              Back to Mapping
            </button>
          </div>
        </div>
      )}

      {/* Importing */}
      {step === 'importing' && (
        <div className="bg-white rounded-lg border border-one70-border p-8 max-w-md text-center">
          <Loader2 size={32} className="animate-spin mx-auto text-one70-black mb-3" />
          <p className="text-sm font-medium text-gray-900">Importing {csvData.rows.length} records...</p>
          <p className="text-xs text-gray-400 mt-1">This may take a moment</p>
        </div>
      )}

      {/* Done */}
      {step === 'done' && (
        <div className="bg-white rounded-lg border border-one70-border p-6 max-w-lg">
          <div className="text-center mb-4">
            {importResults.failed === 0 ? (
              <Check size={32} className="mx-auto text-green-600 mb-2" />
            ) : (
              <AlertCircle size={32} className="mx-auto text-amber-500 mb-2" />
            )}
            <p className="text-lg font-bold text-gray-900">Import Complete</p>
          </div>

          <div className="flex gap-4 justify-center mb-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">{importResults.success}</p>
              <p className="text-xs text-gray-500">Imported</p>
            </div>
            {importResults.failed > 0 && (
              <div className="text-center">
                <p className="text-2xl font-bold text-red-500">{importResults.failed}</p>
                <p className="text-xs text-gray-500">Skipped</p>
              </div>
            )}
          </div>

          {importResults.errors.length > 0 && (
            <div className="bg-red-50 rounded-md p-3 mb-4 max-h-40 overflow-y-auto">
              {importResults.errors.map((err, i) => (
                <p key={i} className="text-xs text-red-700">{err}</p>
              ))}
            </div>
          )}

          <div className="flex gap-3 justify-center">
            <button onClick={resetImport}
              className="px-4 py-2 bg-one70-black text-white rounded-md text-sm font-medium hover:bg-one70-dark transition-colors">
              Import More
            </button>
            <button onClick={() => router.push(target === 'organizations' ? '/organizations' : '/contacts')}
              className="px-4 py-2 border border-one70-border rounded-md text-sm font-medium text-one70-dark hover:bg-one70-gray transition-colors">
              View {target === 'organizations' ? 'Organizations' : 'Contacts'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
