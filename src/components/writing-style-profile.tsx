'use client'

import { useState, useEffect } from 'react'
import { Sparkles, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react'

interface StyleProfile {
  style_instruction: string
  sample_count: number
  analyzed_at: string | null
}

export default function WritingStyleProfile() {
  const [profile, setProfile] = useState<StyleProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [result, setResult] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    const res = await fetch('/api/style-profile')
    if (res.ok) {
      const data = await res.json()
      setProfile(data.profile)
    }
    setLoading(false)
  }

  async function analyze() {
    setAnalyzing(true)
    setResult('')
    const res = await fetch('/api/style-profile', { method: 'POST' })
    const data = await res.json()
    if (data.success) {
      setResult(`Profile generated from ${data.samples} emails`)
      load()
    } else {
      setResult(data.error || 'Analysis failed')
    }
    setAnalyzing(false)
  }

  return (
    <div className="bg-white rounded-lg border border-one70-border p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold text-one70-black flex items-center gap-2">
          <Sparkles size={16} /> Writing Style AI
        </h2>
        <button onClick={analyze} disabled={analyzing}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-one70-black text-white rounded-md text-xs font-medium hover:bg-one70-dark disabled:opacity-50 transition-all">
          {analyzing ? <RefreshCw size={12} className="animate-spin" /> : <RefreshCw size={12} />}
          {analyzing ? 'Analyzing...' : profile ? 'Re-analyze' : 'Analyze My Style'}
        </button>
      </div>

      <p className="text-xs text-one70-mid mb-3">
        The AI analyzes your sent emails to learn your writing voice. When drafting emails or messages, it will match your personal style.
      </p>

      {loading ? (
        <p className="text-xs text-one70-mid py-4 text-center">Loading...</p>
      ) : profile ? (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle size={14} className="text-green-600" />
            <span className="text-xs text-green-700 font-medium">
              Profile active — based on {profile.sample_count} emails
              {profile.analyzed_at && ` (${new Date(profile.analyzed_at).toLocaleDateString()})`}
            </span>
          </div>
          <div className="bg-one70-gray rounded-lg p-3 max-h-48 overflow-y-auto">
            <p className="text-xs text-one70-dark whitespace-pre-wrap leading-relaxed">{profile.style_instruction}</p>
          </div>
        </div>
      ) : (
        <div className="text-center py-4">
          <AlertCircle size={20} className="mx-auto text-one70-mid mb-2" />
          <p className="text-xs text-one70-mid">No style profile yet. Click &quot;Analyze My Style&quot; to get started.</p>
          <p className="text-[10px] text-gray-400 mt-1">Requires Microsoft 365 connected with sent emails.</p>
        </div>
      )}

      {result && (
        <p className={`text-xs mt-2 ${result.includes('fail') || result.includes('error') || result.includes('Not') ? 'text-red-600' : 'text-green-600'}`}>
          {result}
        </p>
      )}
    </div>
  )
}
