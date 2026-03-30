'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Mail, MailWarning, Clock, Check, Plus, X, ArrowUp, ArrowDown, Calendar, Video, MapPin, Send } from 'lucide-react'
import ComposeEmail from '@/components/compose-email'

interface EmailInteraction {
  id: string; direction: string; from_email: string; to_email: string | null
  subject: string; snippet: string | null; received_at: string
  needs_reply: boolean; replied_at: string | null
  follow_up_date: string | null; follow_up_note: string | null
  contact_id: string | null; org_id: string | null
  contacts: { first_name: string; last_name: string } | null
  organizations: { name: string } | null
}

interface Meeting {
  id: string; subject: string; meeting_date: string; location: string | null
  attendees: string | null; notes: string | null; follow_up_created: boolean
  contact_id: string | null; org_id: string | null
  contacts: { first_name: string; last_name: string } | null
  organizations: { name: string } | null
}

export default function EmailsPage() {
  const [tab, setTab] = useState<'emails' | 'meetings'>('emails')
  const [interactions, setInteractions] = useState<EmailInteraction[]>([])
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [loading, setLoading] = useState(true)
  const [emailFilter, setEmailFilter] = useState<'needs_reply' | 'follow_up' | 'all'>('needs_reply')
  const [meetingFilter, setMeetingFilter] = useState<'upcoming' | 'past' | 'all'>('upcoming')
  const [showAddEmail, setShowAddEmail] = useState(false)
  const [showAddMeeting, setShowAddMeeting] = useState(false)
  const [emailForm, setEmailForm] = useState({ from_email: '', to_email: '', subject: '', snippet: '', direction: 'inbound' })
  const [meetingForm, setMeetingForm] = useState({ subject: '', meeting_date: '', location: '', attendees: '', notes: '', contact_name: '' })
  const [saving, setSaving] = useState(false)

  async function loadEmails() {
    setLoading(true)
    const res = await fetch(`/api/emails?filter=${emailFilter}`)
    const data = await res.json()
    setInteractions(data.interactions || [])
    setLoading(false)
  }

  async function loadMeetings() {
    setLoading(true)
    const res = await fetch(`/api/meetings?filter=${meetingFilter}`)
    const data = await res.json()
    setMeetings(data.meetings || [])
    setLoading(false)
  }

  useEffect(() => { if (tab === 'emails') loadEmails() }, [emailFilter, tab])
  useEffect(() => { if (tab === 'meetings') loadMeetings() }, [meetingFilter, tab])

  async function markReplied(id: string) {
    await fetch('/api/emails', { method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, needs_reply: false, replied_at: new Date().toISOString() }) })
    loadEmails()
  }

  async function setFollowUp(id: string, date: string, note: string) {
    await fetch('/api/emails', { method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, follow_up_date: date, follow_up_note: note }) })
    loadEmails()
  }

  async function addEmail() {
    if (!emailForm.from_email || !emailForm.subject) return
    setSaving(true)
    await fetch('/api/emails', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(emailForm) })
    setSaving(false); setShowAddEmail(false)
    setEmailForm({ from_email: '', to_email: '', subject: '', snippet: '', direction: 'inbound' })
    loadEmails()
  }

  async function addMeeting() {
    if (!meetingForm.subject || !meetingForm.meeting_date) return
    setSaving(true)
    await fetch('/api/meetings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(meetingForm) })
    setSaving(false); setShowAddMeeting(false)
    setMeetingForm({ subject: '', meeting_date: '', location: '', attendees: '', notes: '', contact_name: '' })
    loadMeetings()
  }

  function daysSince(date: string) { return Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24)) }
  function urgencyColor(days: number) {
    if (days >= 7) return 'text-red-600 bg-red-50'
    if (days >= 3) return 'text-orange-600 bg-orange-50'
    if (days >= 1) return 'text-yellow-700 bg-yellow-50'
    return 'text-green-600 bg-green-50'
  }

  const inputClass = 'w-full text-sm border border-one70-border rounded-md px-3 py-2 focus:outline-none focus:border-one70-black'

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-one70-black">Communications</h1>
          <p className="text-sm text-one70-mid mt-1">Track emails, meetings, and follow-ups with contacts</p>
        </div>
        <div className="flex gap-2">
          <ComposeEmail compact={false} />
          <button onClick={() => tab === 'emails' ? setShowAddEmail(!showAddEmail) : setShowAddMeeting(!showAddMeeting)}
            className="flex items-center justify-center gap-2 bg-one70-black text-white px-4 py-2.5 rounded-md text-sm font-semibold hover:bg-one70-dark active:scale-95 transition-all">
            <Plus size={18} /> {tab === 'emails' ? 'Log Email' : 'Log Meeting'}
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 mb-4 bg-one70-gray rounded-lg p-1">
        <button onClick={() => setTab('emails')}
          className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${tab === 'emails' ? 'bg-white text-one70-black shadow-sm' : 'text-one70-mid'}`}>
          <Mail size={16} /> Emails
        </button>
        <button onClick={() => setTab('meetings')}
          className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${tab === 'meetings' ? 'bg-white text-one70-black shadow-sm' : 'text-one70-mid'}`}>
          <Calendar size={16} /> Meetings
        </button>
      </div>

      {/* ========== EMAILS TAB ========== */}
      {tab === 'emails' && (
        <>
          {showAddEmail && (
            <div className="bg-white rounded-lg border border-one70-border p-5 mb-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-one70-black">Log Email</h3>
                <button onClick={() => setShowAddEmail(false)} className="text-one70-mid"><X size={16} /></button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                <select value={emailForm.direction} onChange={e => setEmailForm(p => ({ ...p, direction: e.target.value }))} className={inputClass}>
                  <option value="inbound">Received</option><option value="outbound">Sent</option>
                </select>
                <input type="email" value={emailForm.from_email} onChange={e => setEmailForm(p => ({ ...p, from_email: e.target.value }))} className={inputClass} placeholder="From email" />
                <input type="email" value={emailForm.to_email} onChange={e => setEmailForm(p => ({ ...p, to_email: e.target.value }))} className={inputClass} placeholder="To email" />
                <input type="text" value={emailForm.subject} onChange={e => setEmailForm(p => ({ ...p, subject: e.target.value }))} className={inputClass} placeholder="Subject" />
              </div>
              <textarea value={emailForm.snippet} onChange={e => setEmailForm(p => ({ ...p, snippet: e.target.value }))} className={`${inputClass} mb-3`} rows={2} placeholder="Summary..." />
              <button onClick={addEmail} disabled={saving || !emailForm.from_email || !emailForm.subject}
                className="px-4 py-2 bg-one70-black text-white rounded-md text-sm font-semibold disabled:opacity-50 active:scale-95">{saving ? 'Saving...' : 'Log Email'}</button>
            </div>
          )}

          <div className="flex gap-2 mb-4">
            {([['needs_reply', 'Needs Reply', MailWarning], ['follow_up', 'Follow-ups', Clock], ['all', 'All', Mail]] as const).map(([id, label, Icon]) => (
              <button key={id} onClick={() => setEmailFilter(id as any)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium border transition-colors ${emailFilter === id ? 'bg-one70-black text-white border-one70-black' : 'bg-white text-one70-mid border-one70-border hover:bg-one70-gray'}`}>
                <Icon size={14} /> {label}
              </button>
            ))}
          </div>

          {loading ? <p className="text-sm text-one70-mid py-8 text-center">Loading...</p> : interactions.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg border border-one70-border">
              <Mail size={32} className="mx-auto mb-2 text-gray-300" />
              <p className="text-sm text-one70-mid">{emailFilter === 'needs_reply' ? 'No emails awaiting reply' : 'No emails found'}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {interactions.map(e => {
                const days = daysSince(e.received_at)
                const contact = e.contacts ? `${e.contacts.first_name} ${e.contacts.last_name}` : null
                return (
                  <div key={e.id} className="bg-white rounded-lg border border-one70-border p-4">
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg shrink-0 ${e.direction === 'inbound' ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'}`}>
                        {e.direction === 'inbound' ? <ArrowDown size={16} /> : <ArrowUp size={16} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold text-one70-black truncate">{e.subject}</p>
                            <p className="text-xs text-one70-mid mt-0.5">{e.from_email}
                              {contact && <> — <Link href={`/contacts/${e.contact_id}`} className="text-blue-600 hover:underline">{contact}</Link></>}
                            </p>
                          </div>
                          {e.needs_reply && !e.replied_at && (
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 ${urgencyColor(days)}`}>{days === 0 ? 'Today' : `${days}d`}</span>
                          )}
                        </div>
                        {e.snippet && <p className="text-xs text-one70-dark mt-1.5 line-clamp-2">{e.snippet}</p>}
                        {e.follow_up_date && <p className="text-xs text-purple-600 mt-1 flex items-center gap-1"><Clock size={10} /> {e.follow_up_date}</p>}
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-[10px] text-gray-400">{new Date(e.received_at).toLocaleDateString()}</span>
                          {e.needs_reply && !e.replied_at && <button onClick={() => markReplied(e.id)} className="text-[11px] text-green-600 hover:underline flex items-center gap-0.5"><Check size={10} /> Replied</button>}
                          {!e.follow_up_date && <button onClick={() => {
                            const d = prompt('Follow up in how many days?', '3')
                            if (d) { const dt = new Date(Date.now() + parseInt(d) * 86400000).toISOString().split('T')[0]; setFollowUp(e.id, dt, prompt('Note:', '') || '') }
                          }} className="text-[11px] text-purple-600 hover:underline flex items-center gap-0.5"><Clock size={10} /> Follow-up</button>}
                          {e.replied_at && <span className="text-[11px] text-green-600 flex items-center gap-0.5"><Check size={10} /> Replied</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* ========== MEETINGS TAB ========== */}
      {tab === 'meetings' && (
        <>
          {showAddMeeting && (
            <div className="bg-white rounded-lg border border-one70-border p-5 mb-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-one70-black">Log Meeting</h3>
                <button onClick={() => setShowAddMeeting(false)} className="text-one70-mid"><X size={16} /></button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                <input type="text" value={meetingForm.subject} onChange={e => setMeetingForm(p => ({ ...p, subject: e.target.value }))} className={inputClass} placeholder="Meeting subject" />
                <input type="datetime-local" value={meetingForm.meeting_date} onChange={e => setMeetingForm(p => ({ ...p, meeting_date: e.target.value }))} className={inputClass} />
                <input type="text" value={meetingForm.location} onChange={e => setMeetingForm(p => ({ ...p, location: e.target.value }))} className={inputClass} placeholder="Location or Teams/Zoom link" />
                <input type="text" value={meetingForm.contact_name} onChange={e => setMeetingForm(p => ({ ...p, contact_name: e.target.value }))} className={inputClass} placeholder="Contact name (auto-matched)" />
              </div>
              <input type="text" value={meetingForm.attendees} onChange={e => setMeetingForm(p => ({ ...p, attendees: e.target.value }))} className={`${inputClass} mb-3`} placeholder="Attendees (comma separated)" />
              <textarea value={meetingForm.notes} onChange={e => setMeetingForm(p => ({ ...p, notes: e.target.value }))} className={`${inputClass} mb-3`} rows={2} placeholder="Meeting notes / agenda..." />
              <button onClick={addMeeting} disabled={saving || !meetingForm.subject || !meetingForm.meeting_date}
                className="px-4 py-2 bg-one70-black text-white rounded-md text-sm font-semibold disabled:opacity-50 active:scale-95">{saving ? 'Saving...' : 'Log Meeting'}</button>
            </div>
          )}

          <div className="flex gap-2 mb-4">
            {([['upcoming', 'Upcoming'], ['past', 'Past'], ['all', 'All']] as const).map(([id, label]) => (
              <button key={id} onClick={() => setMeetingFilter(id as any)}
                className={`px-3 py-2 rounded-md text-sm font-medium border transition-colors ${meetingFilter === id ? 'bg-one70-black text-white border-one70-black' : 'bg-white text-one70-mid border-one70-border hover:bg-one70-gray'}`}>
                {label}
              </button>
            ))}
          </div>

          {loading ? <p className="text-sm text-one70-mid py-8 text-center">Loading...</p> : meetings.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg border border-one70-border">
              <Calendar size={32} className="mx-auto mb-2 text-gray-300" />
              <p className="text-sm text-one70-mid">{meetingFilter === 'upcoming' ? 'No upcoming meetings' : 'No meetings found'}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {meetings.map(m => {
                const contact = m.contacts ? `${m.contacts.first_name} ${m.contacts.last_name}` : null
                const isPast = new Date(m.meeting_date) < new Date()
                const dateStr = new Date(m.meeting_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
                const timeStr = new Date(m.meeting_date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
                return (
                  <div key={m.id} className={`bg-white rounded-lg border border-one70-border p-4 ${isPast ? 'opacity-75' : ''}`}>
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg shrink-0 ${isPast ? 'bg-gray-100 text-gray-500' : 'bg-purple-50 text-purple-600'}`}>
                        <Video size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-one70-black">{m.subject}</p>
                        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-xs text-one70-mid">
                          <span className="flex items-center gap-1"><Calendar size={10} /> {dateStr} at {timeStr}</span>
                          {m.location && <span className="flex items-center gap-1"><MapPin size={10} /> {m.location}</span>}
                        </div>
                        {contact && <p className="text-xs text-one70-dark mt-1">With: <Link href={`/contacts/${m.contact_id}`} className="text-blue-600 hover:underline">{contact}</Link></p>}
                        {m.organizations && <p className="text-xs text-one70-mid">{m.organizations.name}</p>}
                        {m.attendees && <p className="text-xs text-one70-mid mt-0.5">{m.attendees}</p>}
                        {m.notes && <p className="text-xs text-one70-dark mt-1.5 line-clamp-2 whitespace-pre-wrap">{m.notes}</p>}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* Auto-monitoring info */}
      <div className="mt-8 bg-one70-gray rounded-lg p-4">
        <h3 className="text-sm font-bold text-one70-black mb-2">Automatic Monitoring Active</h3>
        <p className="text-xs text-one70-mid">The CRM automatically monitors your contact interactions 3x daily (8:00 AM, 12:00 PM, 5:00 PM ET):</p>
        <ul className="text-xs text-one70-mid mt-1 space-y-0.5 ml-3 list-disc">
          <li>Contacts with no interaction in 14+ days → auto-creates follow-up task</li>
          <li>Unreplied emails older than 3 days → auto-creates urgent reply task</li>
          <li>Forwarded emails auto-captured as interactions and matched to contacts</li>
        </ul>
        <p className="text-xs text-one70-mid mt-2">Your Microsoft 365 is connected. Use the AI Assistant to search your Outlook inbox and calendar directly — ask things like &quot;Check my email from John Smith&quot; or &quot;What meetings do I have this week?&quot;</p>
      </div>
    </div>
  )
}
