'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Bot, X, Send, Mic, ChevronRight, Loader2, Sparkles, Maximize2, Minimize2, Plus, RotateCcw } from 'lucide-react'
import { usePageContext } from '@/contexts/page-context'

interface Message {
  role: 'user' | 'assistant'
  content: string
  links?: { text: string; url: string }[]
  actions?: { tool: string; success: boolean }[]
}

interface Props {
  userName?: string
}

type PanelMode = 'closed' | 'docked' | 'full'

export default function AiAssistant({ userName }: Props) {
  const [mode, setMode] = useState<PanelMode>('closed')
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [listening, setListening] = useState(false)
  const [speechSupported, setSpeechSupported] = useState(false)
  const [greeted, setGreeted] = useState(false)
  const [proactiveGreeting, setProactiveGreeting] = useState(true)
  const recognitionRef = useRef<any>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const pathname = usePathname()
  const { context: pageContext } = usePageContext()

  const isOpen = mode !== 'closed'

  // Load preference from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('one70_ai_proactive')
      if (saved !== null) setProactiveGreeting(saved === 'true')
    } catch {}
  }, [])

  function toggleProactive() {
    const next = !proactiveGreeting
    setProactiveGreeting(next)
    try { localStorage.setItem('one70_ai_proactive', String(next)) } catch {}
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // Speech — detect support. Hide on native apps (WKWebView), test instantiation on browsers
  useEffect(() => {
    const isNative = !!(window as any).Capacitor
    if (isNative) { setSpeechSupported(false); return }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) return
    try { const test = new SR(); test.abort(); setSpeechSupported(true) } catch { setSpeechSupported(false) }
  }, [])

  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 300)
  }, [isOpen])

  // Proactive greeting — only if user opted in
  useEffect(() => {
    if (isOpen && !greeted && messages.length === 0 && proactiveGreeting) {
      setGreeted(true)
      generateGreeting()
    }
  }, [isOpen]) // eslint-disable-line react-hooks/exhaustive-deps

  async function generateGreeting() {
    setLoading(true)
    try {
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: '__greeting__',
          history: [],
          pageContext: { type: pageContext.type, id: pageContext.id, name: pageContext.name, pathname },
          userName,
        }),
      })
      const data = await res.json()
      if (data.response) {
        setMessages([{ role: 'assistant', content: data.response, links: data.links, actions: data.actions }])
      }
    } catch {
      setMessages([{ role: 'assistant', content: `Hey${userName ? ` ${userName.split(' ')[0]}` : ''}! What can I help you with?` }])
    }
    setLoading(false)
  }

  const sendMessage = useCallback(async (text?: string) => {
    const msg = (text || input).trim()
    if (!msg || loading) return
    setMessages(prev => [...prev, { role: 'user', content: msg }])
    setInput('')
    setLoading(true)
    try {
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: msg,
          history: messages.slice(-10).map(m => ({ role: m.role, content: m.content })),
          pageContext: { type: pageContext.type, id: pageContext.id, name: pageContext.name, pathname },
          userName,
        }),
      })
      const data = await res.json()
      setMessages(prev => [...prev, {
        role: 'assistant', content: data.response || 'Done.',
        links: data.links, actions: data.actions,
      }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Connection error. Please try again.' }])
    }
    setLoading(false)
  }, [input, loading, messages, pageContext, pathname, userName])

  // Auto-send after voice
  const wasListeningRef = useRef(false)
  useEffect(() => {
    if (!listening && wasListeningRef.current && input.trim()) {
      const timer = setTimeout(() => { if (input.trim()) sendMessage() }, 600)
      wasListeningRef.current = false
      return () => clearTimeout(timer)
    }
    if (listening) wasListeningRef.current = true
  }, [listening]) // eslint-disable-line react-hooks/exhaustive-deps

  async function toggleVoice() {
    try {
      if (listening && recognitionRef.current) {
        recognitionRef.current.stop()
        setListening(false)
        return
      }
      const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      if (!SR) return

      // Skip getUserMedia on native apps — crashes WKWebView in Capacitor
      const isNativeApp = !!(window as any).Capacitor || /CapacitorHTTP/i.test(navigator.userAgent)
      if (!isNativeApp) {
        try {
          if (typeof navigator !== 'undefined' && navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function') {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
            stream.getTracks().forEach(t => t.stop())
          }
        } catch (micErr: any) {
          if (micErr?.name === 'NotAllowedError' || micErr?.name === 'PermissionDeniedError') {
            alert('Microphone blocked. Check your browser settings to allow microphone access.')
            return
          }
        }
      }

      const recognition = new SR()
      recognition.continuous = false
      recognition.interimResults = true
      recognition.lang = 'en-US'
      let finalTranscript = ''
      recognition.onresult = (event: any) => {
        let interim = ''
        finalTranscript = ''
        for (let i = 0; i < event.results.length; i++) {
          if (event.results[i].isFinal) finalTranscript += event.results[i][0].transcript
          else interim += event.results[i][0].transcript
        }
        setInput(finalTranscript + interim)
      }
      recognition.onerror = () => setListening(false)
      recognition.onend = () => {
        if (finalTranscript.trim()) setInput(finalTranscript.trim())
        setListening(false)
      }
      recognitionRef.current = recognition
      recognition.start()
      setInput('')
      setListening(true)
    } catch (err) {
      console.warn('Voice input failed:', err)
      setListening(false)
      alert('Voice input is not available. Please type your message instead.')
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  function handleOpen() {
    if (window.innerWidth < 1024) {
      router.push('/assistant')
    } else {
      setMode('docked')
    }
  }

  function newConversation() {
    setMessages([])
    setGreeted(false)
    if (proactiveGreeting) {
      setTimeout(() => { setGreeted(true); generateGreeting() }, 100)
    }
  }

  const toolLabels: Record<string, string> = {
    create_task: 'Created task', search_contacts: 'Searched contacts',
    search_deals: 'Searched deals', search_organizations: 'Searched orgs',
    log_activity: 'Logged activity', move_deal_stage: 'Moved deal',
    create_contact: 'Created contact', get_my_tasks: 'Retrieved tasks',
    get_outreach_due: 'Retrieved outreach', get_pipeline_summary: 'Pipeline summary',
    search_projects: 'Searched projects', get_recent_activities: 'Recent activities',
    web_search: 'Web search', search_emails: 'Searched emails',
    search_calendar: 'Searched calendar', send_email: 'Sent email',
  }

  const contextLabel = pageContext.type !== 'other' && pageContext.type !== 'dashboard' && pageContext.name
    ? `Viewing: ${pageContext.name}` : null

  // Shared chat UI — used by both docked and full modes
  function renderChat() {
    return (
      <>
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 bg-one70-black text-white shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-one70-yellow flex items-center justify-center shrink-0">
              <Sparkles size={16} className="text-one70-black" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold leading-tight">ONE70 AI</p>
              {contextLabel && <p className="text-[10px] text-white/60 leading-tight truncate">{contextLabel}</p>}
            </div>
          </div>
          <div className="flex items-center gap-0.5">
            <button onClick={toggleProactive}
              className={`p-2 rounded-md hover:bg-white/10 transition-colors ${proactiveGreeting ? 'text-one70-yellow' : 'text-white/40'}`}
              title={proactiveGreeting ? 'Proactive greeting ON — click to disable' : 'Proactive greeting OFF — click to enable'}>
              <Bot size={15} />
            </button>
            <button onClick={newConversation} className="p-2 rounded-md hover:bg-white/10 text-white/70 hover:text-white transition-colors" title="New conversation">
              <RotateCcw size={15} />
            </button>
            {mode === 'docked' && (
              <button onClick={() => setMode('full')} className="p-2 rounded-md hover:bg-white/10 text-white/70 hover:text-white transition-colors" title="Expand">
                <Maximize2 size={15} />
              </button>
            )}
            {mode === 'full' && (
              <button onClick={() => setMode('docked')} className="p-2 rounded-md hover:bg-white/10 text-white/70 hover:text-white transition-colors" title="Dock to side">
                <Minimize2 size={15} />
              </button>
            )}
            <button onClick={() => setMode('closed')} className="p-2 rounded-md hover:bg-white/10 text-white/70 hover:text-white transition-colors">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-4 space-y-4">
          {messages.length === 0 && !loading && (
            <div className="text-center py-8">
              <Sparkles size={28} className="mx-auto text-gray-300 mb-3" />
              <p className="text-sm text-one70-mid mb-4">What can I help you with?</p>
              <div className="space-y-2 max-w-xs mx-auto">
                {[
                  'What are my tasks for today?',
                  'Show me deals in the pipeline',
                  'Check my email',
                  "Draft a follow-up email",
                ].map(q => (
                  <button key={q} onClick={() => sendMessage(q)}
                    className="block w-full text-left text-xs px-3 py-2 rounded-lg bg-one70-gray text-one70-dark hover:bg-gray-200 transition-colors">
                    &ldquo;{q}&rdquo;
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`${mode === 'full' ? 'max-w-[70%]' : 'max-w-[88%]'} ${msg.role === 'user'
                ? 'bg-one70-black text-white rounded-2xl rounded-br-sm px-4 py-3'
                : 'bg-one70-gray text-one70-dark rounded-2xl rounded-bl-sm px-4 py-3'
              }`}>
                {msg.actions && msg.actions.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {msg.actions.map((a, j) => (
                      <span key={j} className={`text-[10px] px-1.5 py-0.5 rounded-full ${a.success ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {toolLabels[a.tool] || a.tool} {a.success ? '✓' : '✗'}
                      </span>
                    ))}
                  </div>
                )}
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                {msg.links && msg.links.length > 0 && (
                  <div className="mt-2.5 space-y-1 border-t border-gray-200/50 pt-2">
                    {msg.links.map((link, j) => (
                      <button key={j} onClick={() => { router.push(link.url); if (mode === 'docked') setMode('closed') }}
                        className="flex items-center gap-1.5 w-full text-left text-xs hover:underline group">
                        <ChevronRight size={12} className="text-gray-400 group-hover:text-one70-black shrink-0" />
                        <span className="truncate">{link.text}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-one70-gray rounded-2xl rounded-bl-sm px-4 py-3">
                <div className="flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin text-one70-mid" />
                  <span className="text-xs text-one70-mid">Thinking...</span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="shrink-0 border-t border-one70-border bg-white"
          style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom, 8px))' }}>
          {listening && (
            <div className="bg-red-50 px-4 py-3 border-b border-red-100">
              <div className="flex items-center gap-3">
                <div className="flex gap-1 items-center">
                  <span className="w-1.5 h-3 bg-red-500 rounded-full animate-pulse" />
                  <span className="w-1.5 h-4 bg-red-400 rounded-full animate-pulse" style={{ animationDelay: '0.15s' }} />
                  <span className="w-1.5 h-5 bg-red-500 rounded-full animate-pulse" style={{ animationDelay: '0.3s' }} />
                  <span className="w-1.5 h-3 bg-red-400 rounded-full animate-pulse" style={{ animationDelay: '0.45s' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-red-700">Listening...</p>
                  {input && <p className="text-sm text-red-900 truncate mt-0.5">{input}</p>}
                </div>
                <button onClick={toggleVoice} className="px-3 py-1.5 bg-red-500 text-white rounded-full text-xs font-medium">Stop</button>
              </div>
            </div>
          )}
          <div className="px-4 py-3">
            <div className="flex items-center gap-2">
              {speechSupported && !listening && (
                <button onClick={toggleVoice} className="p-2.5 rounded-full shrink-0 bg-one70-gray text-one70-mid hover:bg-gray-200 transition-colors">
                  <Mic size={18} />
                </button>
              )}
              <input ref={inputRef} type="text" value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown}
                placeholder={listening ? 'Speak now...' : 'Ask anything or give a command...'}
                className="flex-1 text-sm border border-one70-border rounded-full px-4 py-2.5 focus:outline-none focus:border-one70-black"
                disabled={loading || listening} />
              <button onClick={() => sendMessage()} disabled={!input.trim() || loading}
                className="p-2.5 rounded-full bg-one70-black text-white disabled:opacity-30 shrink-0 hover:bg-one70-dark transition-colors">
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      {/* Floating button — above tab bar on mobile */}
      {!isOpen && (
        <button onClick={handleOpen}
          className="fixed z-40 w-12 h-12 bg-one70-black text-white rounded-full shadow-lg flex items-center justify-center hover:bg-one70-dark active:scale-95 transition-all group left-4 lg:left-auto lg:right-[88px] lg:bottom-6"
          style={{ bottom: 'calc(4.5rem + env(safe-area-inset-bottom, 0px))' }}
        >
          <Sparkles size={20} />
          <span className="hidden lg:block absolute -top-8 right-0 bg-one70-black text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
            AI Assistant
          </span>
        </button>
      )}

      {/* DOCKED SIDE PANEL — desktop */}
      {mode === 'docked' && (
        <>
          <div className="hidden lg:block fixed inset-0 bg-black/10 z-40" onClick={() => setMode('closed')} />
          <div className="hidden lg:flex fixed top-0 right-0 bottom-0 w-[460px] z-50 flex-col bg-white shadow-2xl border-l border-one70-border"
            style={{ animation: 'slideInRight 0.2s ease-out' }}>
            {renderChat()}
          </div>
        </>
      )}

      {/* FULL SCREEN — desktop */}
      {mode === 'full' && (
        <div className="hidden lg:flex fixed inset-0 z-50 bg-white flex-col">
          <div className="max-w-3xl w-full mx-auto flex flex-col flex-1 min-h-0">
            {renderChat()}
          </div>
        </div>
      )}

      {/* Slide-in animation */}
      <style jsx global>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </>
  )
}
