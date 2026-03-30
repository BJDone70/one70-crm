'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Bug, Lightbulb, Wrench, Send, CheckCircle, Image, MessageSquare, Pencil, X, ChevronDown, ChevronUp } from 'lucide-react'

interface FeedbackItem {
  id: string
  user_id: string
  type: string
  subject: string
  description: string | null
  status: string
  priority: string
  urgency: string
  category: string
  admin_notes: string | null
  image_urls: string[]
  created_at: string
  profiles?: { full_name: string }
}

interface Comment {
  id: string
  feedback_id: string
  user_id: string
  body: string
  created_at: string
  profiles?: { full_name: string }
}

const typeOptions = [
  { id: 'bug', label: 'Bug Report', icon: Bug, desc: 'Something isn\'t working' },
  { id: 'feature', label: 'Feature Request', icon: Lightbulb, desc: 'Suggest a new capability' },
  { id: 'improvement', label: 'Improvement', icon: Wrench, desc: 'Make something better' },
]

const statusLabels: Record<string, { label: string; color: string }> = {
  new: { label: 'New', color: 'bg-blue-100 text-blue-700' },
  reviewed: { label: 'Reviewed', color: 'bg-yellow-100 text-yellow-700' },
  planned: { label: 'Planned', color: 'bg-purple-100 text-purple-700' },
  done: { label: 'Done', color: 'bg-green-100 text-green-700' },
  wont_fix: { label: 'Won\'t Fix', color: 'bg-gray-100 text-gray-500' },
}

const priorityOptions = [
  { id: 'low', label: 'Low', color: 'bg-gray-100 text-gray-600' },
  { id: 'medium', label: 'Medium', color: 'bg-blue-100 text-blue-600' },
  { id: 'high', label: 'High', color: 'bg-orange-100 text-orange-600' },
  { id: 'critical', label: 'Critical', color: 'bg-red-100 text-red-700' },
]

const urgencyOptions = [
  { id: 'low', label: 'Low' },
  { id: 'normal', label: 'Normal' },
  { id: 'urgent', label: 'Urgent' },
]

const categoryOptions = [
  { id: 'system', label: 'System' },
  { id: 'process', label: 'Process' },
  { id: 'ui', label: 'UI/Design' },
  { id: 'data', label: 'Data' },
  { id: 'integration', label: 'Integration' },
  { id: 'other', label: 'Other' },
]

export default function FeedbackPage() {
  const [type, setType] = useState('bug')
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState('medium')
  const [urgency, setUrgency] = useState('normal')
  const [category, setCategory] = useState('system')
  const [imageFiles, setImageFiles] = useState<File[]>([])
  const [imagePreviews, setImagePreviews] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [history, setHistory] = useState<FeedbackItem[]>([])
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [userId, setUserId] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [comments, setComments] = useState<Record<string, Comment[]>>({})
  const [commentText, setCommentText] = useState('')
  const [sendingComment, setSendingComment] = useState(false)
  const [filterStatus, setFilterStatus] = useState('')
  const [hideDone, setHideDone] = useState(true)
  const fileRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  // Global paste handler — capture screenshot pastes anywhere on the page
  useEffect(() => {
    function handleGlobalPaste(e: ClipboardEvent) {
      const items = Array.from(e.clipboardData?.items || [])
      const imageItems = items.filter(item => item.type.startsWith('image/'))
      if (imageItems.length === 0) return
      e.preventDefault()
      setImageFiles(prev => {
        const remaining = 3 - prev.length
        if (remaining <= 0) { setError('Max 3 images'); return prev }
        const newFiles: File[] = []
        imageItems.slice(0, remaining).forEach(item => {
          const file = item.getAsFile()
          if (file) newFiles.push(file)
        })
        newFiles.forEach(f => {
          const reader = new FileReader()
          reader.onload = () => setImagePreviews(p => [...p, reader.result as string])
          reader.readAsDataURL(f)
        })
        return [...prev, ...newFiles]
      })
    }
    document.addEventListener('paste', handleGlobalPaste)
    return () => document.removeEventListener('paste', handleGlobalPaste)
  }, [])

  async function loadHistory() {
    const { data, error: queryErr } = await supabase
      .from('feedback')
      .select('*')
      .order('created_at', { ascending: false })
    if (queryErr) console.error('Feedback query error:', queryErr)
    
    // Load profile names separately for admin view
    if (data && data.length > 0) {
      const userIds = [...new Set(data.map(f => f.user_id).filter(Boolean))]
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds)
      const nameMap: Record<string, string> = {}
      profiles?.forEach(p => { nameMap[p.id] = p.full_name })
      setHistory(data.map(f => ({ ...f, profiles: { full_name: nameMap[f.user_id] || 'Unknown' } })) as any)
    } else {
      setHistory(data || [])
    }
    setLoading(false)
  }

  useEffect(() => {
    loadHistory()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUserId(user.id)
        supabase.from('profiles').select('role').eq('id', user.id).single().then(({ data }) => {
          if (data?.role === 'admin') setIsAdmin(true)
        })
      }
    })
  }, [])

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    if (files.length + imageFiles.length > 3) { setError('Max 3 images'); return }
    setImageFiles(prev => [...prev, ...files])
    files.forEach(f => {
      const reader = new FileReader()
      reader.onload = () => setImagePreviews(prev => [...prev, reader.result as string])
      reader.readAsDataURL(f)
    })
  }

  function handlePaste(e: React.ClipboardEvent) {
    const items = Array.from(e.clipboardData?.items || [])
    const imageItems = items.filter(item => item.type.startsWith('image/'))
    if (imageItems.length === 0) return // Let normal text paste through
    e.preventDefault()
    if (imageItems.length + imageFiles.length > 3) { setError('Max 3 images'); return }
    imageItems.forEach(item => {
      const file = item.getAsFile()
      if (!file) return
      setImageFiles(prev => [...prev, file])
      const reader = new FileReader()
      reader.onload = () => setImagePreviews(prev => [...prev, reader.result as string])
      reader.readAsDataURL(file)
    })
  }

  function removeImage(idx: number) {
    setImageFiles(prev => prev.filter((_, i) => i !== idx))
    setImagePreviews(prev => prev.filter((_, i) => i !== idx))
  }

  async function uploadImages(): Promise<string[]> {
    const urls: string[] = []
    for (const file of imageFiles) {
      const ext = file.name.split('.').pop()
      const path = `feedback/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`
      const { error } = await supabase.storage.from('feedback-images').upload(path, file)
      if (!error) {
        const { data } = supabase.storage.from('feedback-images').getPublicUrl(path)
        urls.push(data.publicUrl)
      }
    }
    return urls
  }

  async function handleSubmit() {
    if (!subject.trim()) return
    setSubmitting(true)
    setError('')

    let imageUrls: string[] = []
    if (imageFiles.length > 0) {
      imageUrls = await uploadImages()
    }

    if (editingId) {
      const { error: err } = await supabase.from('feedback').update({
        type, subject, description, priority, urgency, category, image_urls: imageUrls.length > 0 ? imageUrls : undefined,
      }).eq('id', editingId)
      if (err) { setError(err.message); setSubmitting(false); return }
      setEditingId(null)
    } else {
      const { data: { user } } = await supabase.auth.getUser()
      const { error: err } = await supabase.from('feedback').insert({
        user_id: user!.id, type, subject, description, priority, urgency, category,
        image_urls: imageUrls, page_url: window.location.href,
      })
      if (err) { setError(err.message); setSubmitting(false); return }

      // Send email notification
      fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, subject, description }),
      }).catch(() => {})
    }

    setSubmitted(true)
    setType('bug'); setSubject(''); setDescription(''); setPriority('medium'); setUrgency('normal'); setCategory('system')
    setImageFiles([]); setImagePreviews([])
    setTimeout(() => setSubmitted(false), 3000)
    setSubmitting(false)
    loadHistory()
  }

  function startEdit(item: FeedbackItem) {
    setEditingId(item.id)
    setType(item.type)
    setSubject(item.subject)
    setDescription(item.description || '')
    setPriority(item.priority || 'medium')
    setUrgency(item.urgency || 'normal')
    setCategory(item.category || 'system')
    setImageFiles([]); setImagePreviews([])
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelEdit() {
    setEditingId(null)
    setType('bug'); setSubject(''); setDescription(''); setPriority('medium'); setUrgency('normal'); setCategory('system')
    setImageFiles([]); setImagePreviews([])
  }

  async function loadComments(feedbackId: string) {
    const { data } = await supabase
      .from('feedback_comments')
      .select('*')
      .eq('feedback_id', feedbackId)
      .order('created_at', { ascending: true })
    
    // Load names
    if (data && data.length > 0) {
      const userIds = [...new Set(data.map(c => c.user_id))]
      const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', userIds)
      const nameMap: Record<string, string> = {}
      profiles?.forEach(p => { nameMap[p.id] = p.full_name })
      setComments(prev => ({ ...prev, [feedbackId]: data.map(c => ({ ...c, profiles: { full_name: nameMap[c.user_id] || 'Unknown' } })) as any }))
    } else {
      setComments(prev => ({ ...prev, [feedbackId]: [] }))
    }
  }

  async function toggleExpand(id: string) {
    if (expandedId === id) { setExpandedId(null); return }
    setExpandedId(id)
    setCommentText('')
    if (!comments[id]) await loadComments(id)
  }

  async function sendComment(feedbackId: string) {
    if (!commentText.trim()) return
    setSendingComment(true)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('feedback_comments').insert({
      feedback_id: feedbackId, user_id: user!.id, body: commentText.trim(),
    })

    // Notify the feedback creator
    const item = history.find(h => h.id === feedbackId)
    if (item && item.user_id !== user!.id) {
      fetch('/api/notifications/feedback', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'comment', feedback_id: feedbackId, subject: item.subject, user_id: user!.id, notify_user_id: item.user_id }),
      }).catch(() => {})
    }

    setCommentText('')
    setSendingComment(false)
    await loadComments(feedbackId)
  }

  async function updateStatus(id: string, status: string) {
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('feedback').update({ status }).eq('id', id)

    // Notify the feedback creator about status change
    const item = history.find(h => h.id === id)
    if (item && item.user_id !== user!.id) {
      fetch('/api/notifications/feedback', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'status', feedback_id: id, subject: item.subject, status, user_id: user!.id, notify_user_id: item.user_id }),
      }).catch(() => {})
    }

    loadHistory()
  }

  async function updateAdminNotes(id: string, notes: string) {
    await supabase.from('feedback').update({ admin_notes: notes }).eq('id', id)
    loadHistory()
  }

  async function updatePriority(id: string, p: string) {
    await supabase.from('feedback').update({ priority: p }).eq('id', id)
    loadHistory()
  }

  const inputClass = 'w-full border border-one70-border rounded-md px-3 py-2.5 text-sm focus:outline-none focus:border-one70-black'
  const selectClass = 'border border-one70-border rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:border-one70-black'

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-one70-black mb-1">Bug Reports & Ideas</h1>
      <p className="text-sm text-one70-mid mb-6">Help us make ONE70 CRM better. Report bugs, suggest features, or propose improvements.</p>

      {/* Submit / Edit Form */}
      <div className="bg-white rounded-lg border border-one70-border p-5 mb-8">
        {editingId && (
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-one70-border">
            <span className="text-sm font-semibold text-one70-black">Editing Submission</span>
            <button onClick={cancelEdit} className="text-xs text-red-600 hover:underline flex items-center gap-1"><X size={12} /> Cancel</button>
          </div>
        )}

        {/* Type selector */}
        <div className="flex gap-2 mb-4">
          {typeOptions.map(t => {
            const Icon = t.icon
            return (
              <button key={t.id} onClick={() => setType(t.id)}
                className={`flex-1 flex items-center gap-2 px-3 py-2.5 rounded-md text-sm font-medium border transition-colors ${
                  type === t.id ? 'bg-one70-black text-white border-one70-black' : 'bg-white text-one70-mid border-one70-border hover:bg-one70-gray'
                }`}>
                <Icon size={16} /> {t.label}
              </button>
            )
          })}
        </div>

        <input type="text" value={subject} onChange={e => setSubject(e.target.value)} placeholder="Brief title..."
          className={`${inputClass} mb-3`} />

        <textarea value={description} onChange={e => setDescription(e.target.value)} onPaste={handlePaste}
          placeholder="Describe in detail... (you can paste screenshots here)"
          className={`${inputClass} mb-3`} rows={4} />

        {/* Category, Priority, Urgency */}
        <div className="grid grid-cols-3 gap-3 mb-3">
          <select value={category} onChange={e => setCategory(e.target.value)} className={selectClass}>
            {categoryOptions.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
          <select value={priority} onChange={e => setPriority(e.target.value)} className={selectClass}>
            {priorityOptions.map(p => <option key={p.id} value={p.id}>{p.label} Priority</option>)}
          </select>
          <select value={urgency} onChange={e => setUrgency(e.target.value)} className={selectClass}>
            {urgencyOptions.map(u => <option key={u.id} value={u.id}>{u.label} Urgency</option>)}
          </select>
        </div>

        {/* Image upload + paste */}
        <div className="mb-4">
          <div className="flex flex-wrap items-center gap-3 mb-2">
            <button onClick={() => fileRef.current?.click()} className="flex items-center gap-1.5 text-sm text-one70-mid hover:text-one70-black transition-colors">
              <Image size={16} /> Attach image {imageFiles.length > 0 && `(${imageFiles.length}/3)`}
            </button>
            <span className="text-xs text-gray-400 border border-dashed border-gray-300 rounded px-2 py-1">
              📋 Paste screenshot anywhere — Ctrl+V / ⌘V
            </span>
            <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImageSelect} />
          </div>
          {imagePreviews.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {imagePreviews.map((src, i) => (
                <div key={i} className="relative w-16 h-16">
                  <img src={src} className="w-16 h-16 object-cover rounded border" alt="" />
                  <button onClick={() => removeImage(i)} className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center text-[8px]">×</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

        <button onClick={handleSubmit} disabled={submitting || !subject.trim()}
          className="flex items-center gap-2 px-5 py-2.5 bg-one70-black text-white rounded-md text-sm font-semibold hover:bg-one70-dark disabled:opacity-50 transition-colors">
          {submitted ? <><CheckCircle size={16} /> Submitted!</> : submitting ? 'Submitting...' : editingId ? <><Pencil size={14} /> Update</> : <><Send size={14} /> Submit</>}
        </button>
      </div>

      {/* History */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-bold text-one70-black">{isAdmin ? 'All Submissions' : 'Your Submissions'}</h2>
        <div className="flex items-center gap-3">
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="text-xs border border-one70-border rounded-md px-2 py-1.5 bg-white">
            <option value="">All Statuses</option>
            {Object.entries(statusLabels).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <label className="flex items-center gap-1.5 text-xs text-one70-mid cursor-pointer">
            <input type="checkbox" checked={hideDone} onChange={e => setHideDone(e.target.checked)} className="rounded" />
            Hide done
          </label>
        </div>
      </div>
      {loading ? <p className="text-sm text-one70-mid">Loading...</p> : history.length === 0 ? <p className="text-sm text-one70-mid">No submissions yet.</p> : (
        <div className="space-y-3">
          {history
            .filter(item => !filterStatus || item.status === filterStatus)
            .filter(item => !hideDone || (item.status !== 'done' && item.status !== 'wont_fix'))
            .map(item => {
            const st = statusLabels[item.status] || statusLabels.new
            const pr = priorityOptions.find(p => p.id === item.priority)
            const isExpanded = expandedId === item.id
            const isOwner = item.user_id === userId

            return (
              <div key={item.id} className="bg-white rounded-lg border border-one70-border overflow-hidden">
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${st.color}`}>{st.label}</span>
                        {pr && <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${pr.color}`}>{pr.label}</span>}
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 capitalize">{item.type}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 capitalize">{item.category || 'system'}</span>
                      </div>
                      <p className="text-sm font-semibold text-one70-black">{item.subject}</p>
                      {item.description && <p className="text-xs text-one70-mid mt-1 line-clamp-2">{item.description}</p>}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {isOwner && (
                        <button onClick={() => startEdit(item)} className="p-1.5 text-one70-mid hover:text-one70-black rounded transition-colors">
                          <Pencil size={13} />
                        </button>
                      )}
                      <button onClick={() => toggleExpand(item.id)} className="p-1.5 text-one70-mid hover:text-one70-black rounded transition-colors">
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>
                    </div>
                  </div>

                  {/* Images */}
                  {item.image_urls && item.image_urls.length > 0 && (
                    <div className="flex gap-2 mt-2">
                      {item.image_urls.map((url, i) => (
                        <a key={i} href={url} target="_blank" rel="noopener"><img src={url} className="w-16 h-16 object-cover rounded border" alt="" /></a>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-[11px] text-gray-400">{new Date(item.created_at).toLocaleDateString()}</span>
                    {isAdmin && item.profiles && <span className="text-[11px] text-gray-400">by {(item.profiles as any).full_name}</span>}
                  </div>

                  {/* Admin controls */}
                  {isAdmin && (
                    <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
                      <select value={item.status} onChange={e => updateStatus(item.id, e.target.value)}
                        className="text-xs border border-gray-200 rounded px-2 py-1 bg-white">
                        {Object.entries(statusLabels).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                      </select>
                      <select value={item.priority || 'medium'} onChange={e => updatePriority(item.id, e.target.value)}
                        className="text-xs border border-gray-200 rounded px-2 py-1 bg-white">
                        {priorityOptions.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                      </select>
                    </div>
                  )}
                </div>

                {/* Expanded: admin notes + dialogue */}
                {isExpanded && (
                  <div className="border-t border-one70-border bg-one70-gray px-4 py-3">
                    {/* Admin notes */}
                    {isAdmin && (
                      <div className="mb-3">
                        <label className="text-[11px] font-semibold text-one70-mid uppercase tracking-wide">Admin Notes</label>
                        <textarea
                          defaultValue={item.admin_notes || ''}
                          onBlur={e => updateAdminNotes(item.id, e.target.value)}
                          className="w-full mt-1 text-xs border border-one70-border rounded px-2 py-1.5 bg-white focus:outline-none"
                          rows={2} placeholder="Internal notes..."
                        />
                      </div>
                    )}
                    {!isAdmin && item.admin_notes && (
                      <div className="mb-3 bg-white rounded p-2 border border-one70-border">
                        <p className="text-[11px] font-semibold text-one70-mid mb-1">Admin Response</p>
                        <p className="text-xs text-one70-dark">{item.admin_notes}</p>
                      </div>
                    )}

                    {/* Comments / Dialogue */}
                    <div>
                      <p className="text-[11px] font-semibold text-one70-mid uppercase tracking-wide mb-2 flex items-center gap-1">
                        <MessageSquare size={11} /> Discussion
                      </p>
                      {(comments[item.id] || []).map(c => (
                        <div key={c.id} className="mb-2 bg-white rounded p-2 border border-one70-border">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-[11px] font-semibold text-one70-dark">{(c.profiles as any)?.full_name || 'User'}</span>
                            <span className="text-[10px] text-gray-400">{new Date(c.created_at).toLocaleDateString()}</span>
                          </div>
                          <p className="text-xs text-one70-dark">{c.body}</p>
                        </div>
                      ))}
                      <div className="flex gap-2 mt-2">
                        <input type="text" value={commentText} onChange={e => setCommentText(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && sendComment(item.id)}
                          placeholder="Add a comment..." className="flex-1 text-xs border border-one70-border rounded px-2.5 py-1.5 bg-white focus:outline-none focus:border-one70-black" />
                        <button onClick={() => sendComment(item.id)} disabled={!commentText.trim() || sendingComment}
                          className="px-3 py-1.5 bg-one70-black text-white rounded text-xs font-medium disabled:opacity-30">
                          Send
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
