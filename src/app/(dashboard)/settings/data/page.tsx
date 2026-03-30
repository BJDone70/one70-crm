'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Download, Database, Shield, Clock, FileJson, FileSpreadsheet, Loader2, CheckCircle, RefreshCw, Calendar } from 'lucide-react'

export default function DataBackupsPage() {
  const [exporting, setExporting] = useState(false)
  const [exportFormat, setExportFormat] = useState<'json' | 'csv'>('json')
  const [lastExport, setLastExport] = useState<string | null>(
    typeof window !== 'undefined' ? localStorage.getItem('one70_last_export') : null
  )
  const [error, setError] = useState('')
  const [backups, setBackups] = useState<any[]>([])
  const [loadingBackups, setLoadingBackups] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    loadBackups()
  }, [])

  async function loadBackups() {
    setLoadingBackups(true)
    try {
      const { data, error } = await supabase.storage.from('backups').list('', {
        sortBy: { column: 'created_at', order: 'desc' },
        limit: 10,
      })
      if (!error && data) setBackups(data)
    } catch {}
    setLoadingBackups(false)
  }

  async function downloadBackup(filename: string) {
    const { data, error } = await supabase.storage.from('backups').download(filename)
    if (error || !data) return
    const url = URL.createObjectURL(data)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  async function handleExport() {
    setExporting(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/export?format=${exportFormat}`)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || 'Export failed')
        setExporting(false)
        return
      }

      // Get filename from header
      const disposition = res.headers.get('Content-Disposition') || ''
      const filenameMatch = disposition.match(/filename="(.+)"/)
      const filename = filenameMatch ? filenameMatch[1] : `one70-crm-backup.${exportFormat}`

      // Download
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      const now = new Date().toISOString()
      setLastExport(now)
      localStorage.setItem('one70_last_export', now)
    } catch {
      setError('Failed to download export')
    }
    setExporting(false)
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-one70-black mb-1">Data & Backups</h1>
      <p className="text-sm text-one70-mid mb-6">Export your CRM data and manage backups.</p>

      {/* Export section */}
      <div className="bg-white rounded-lg border border-one70-border p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Download size={20} className="text-one70-black" />
          <h2 className="text-lg font-semibold text-one70-black">Export All Data</h2>
        </div>
        <p className="text-sm text-one70-mid mb-4">
          Download a complete backup of your CRM data including organizations, contacts, deals, tasks, projects, activities, sequences, and all related records.
        </p>

        {/* Format selector */}
        <div className="flex gap-3 mb-4">
          <button onClick={() => setExportFormat('json')}
            className={`flex items-center gap-2 px-4 py-3 rounded-lg border text-sm font-medium transition-all ${
              exportFormat === 'json'
                ? 'border-one70-black bg-one70-black text-white'
                : 'border-one70-border bg-white text-one70-dark hover:bg-one70-gray'
            }`}>
            <FileJson size={18} />
            <div className="text-left">
              <p className="font-semibold">JSON</p>
              <p className={`text-[11px] ${exportFormat === 'json' ? 'text-gray-300' : 'text-one70-mid'}`}>Full backup with all relationships</p>
            </div>
          </button>
          <button onClick={() => setExportFormat('csv')}
            className={`flex items-center gap-2 px-4 py-3 rounded-lg border text-sm font-medium transition-all ${
              exportFormat === 'csv'
                ? 'border-one70-black bg-one70-black text-white'
                : 'border-one70-border bg-white text-one70-dark hover:bg-one70-gray'
            }`}>
            <FileSpreadsheet size={18} />
            <div className="text-left">
              <p className="font-semibold">CSV</p>
              <p className={`text-[11px] ${exportFormat === 'csv' ? 'text-gray-300' : 'text-one70-mid'}`}>Spreadsheet-friendly format</p>
            </div>
          </button>
        </div>

        <button onClick={handleExport} disabled={exporting}
          className="flex items-center gap-2 px-6 py-2.5 bg-one70-black text-white rounded-md text-sm font-semibold hover:bg-one70-dark disabled:opacity-50 transition-colors">
          {exporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
          {exporting ? 'Exporting...' : `Download ${exportFormat.toUpperCase()} Backup`}
        </button>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        {lastExport && (
          <p className="mt-3 text-xs text-one70-mid flex items-center gap-1">
            <CheckCircle size={12} className="text-green-500" />
            Last export: {new Date(lastExport).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
          </p>
        )}
      </div>

      {/* Auto backups */}
      <div className="bg-white rounded-lg border border-one70-border p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Calendar size={20} className="text-one70-black" />
            <h2 className="text-lg font-semibold text-one70-black">Automatic Weekly Backups</h2>
          </div>
          <button onClick={loadBackups} className="p-1.5 rounded-md hover:bg-one70-gray text-one70-mid">
            <RefreshCw size={14} />
          </button>
        </div>
        <p className="text-sm text-one70-mid mb-4">
          A full backup runs automatically every Monday at 6:00 AM ET. The last 8 backups are retained (approximately 2 months). You receive an email confirmation after each backup.
        </p>

        {loadingBackups ? (
          <div className="py-4 text-center text-sm text-one70-mid">Loading backups...</div>
        ) : backups.length === 0 ? (
          <div className="py-4 text-center text-sm text-one70-mid">No automated backups yet. The first one will run next Monday.</div>
        ) : (
          <div className="border border-one70-border rounded-md overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-one70-gray">
                  <th className="text-left px-4 py-2 text-xs font-semibold text-one70-mid">Backup</th>
                  <th className="text-right px-4 py-2 text-xs font-semibold text-one70-mid">Size</th>
                  <th className="text-right px-4 py-2 text-xs font-semibold text-one70-mid">Date</th>
                  <th className="text-right px-4 py-2 text-xs font-semibold text-one70-mid"></th>
                </tr>
              </thead>
              <tbody>
                {backups.map(b => (
                  <tr key={b.name} className="border-t border-one70-border hover:bg-one70-gray/50">
                    <td className="px-4 py-2.5 text-one70-dark font-mono text-xs">{b.name}</td>
                    <td className="px-4 py-2.5 text-right text-one70-mid text-xs">
                      {b.metadata?.size ? `${(b.metadata.size / 1024).toFixed(0)} KB` : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right text-one70-mid text-xs">
                      {b.created_at ? new Date(b.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button onClick={() => downloadBackup(b.name)}
                        className="text-xs text-blue-600 hover:underline">Download</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Protection info */}
      <div className="bg-white rounded-lg border border-one70-border p-6">
        <div className="flex items-center gap-2 mb-4">
          <Shield size={20} className="text-one70-black" />
          <h2 className="text-lg font-semibold text-one70-black">Data Protection</h2>
        </div>

        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <Database size={16} className="text-green-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-one70-dark">Automatic Backups</p>
              <p className="text-xs text-one70-mid">Supabase runs daily automatic backups of your database with 7-day retention.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Clock size={16} className="text-green-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-one70-dark">Point-in-Time Recovery</p>
              <p className="text-xs text-one70-mid">With Supabase Pro, restore your database to any second within the last 7 days. Protects against accidental deletions and bad migrations.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Shield size={16} className="text-green-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-one70-dark">Row-Level Security</p>
              <p className="text-xs text-one70-mid">All 22+ tables have RLS policies ensuring users can only access authorized data. Service role key is server-side only.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Database size={16} className="text-green-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-one70-dark">Soft Deletes</p>
              <p className="text-xs text-one70-mid">Records deleted in the app are soft-deleted (timestamped, not removed). They can be recovered from the database if needed.</p>
            </div>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-one70-border">
          <p className="text-xs text-one70-mid">
            Recommendation: Export a JSON backup weekly and store it somewhere safe (Google Drive, Dropbox, or email it to yourself). This gives you an independent copy outside of Supabase.
          </p>
        </div>
      </div>
    </div>
  )
}
