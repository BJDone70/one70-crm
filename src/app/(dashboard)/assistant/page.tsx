'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Send, Mic, ChevronRight, Loader2, Sparkles, RotateCcw } from 'lucide-react'
import { SpeechRecognition as NativeSpeech } from '@capacitor-community/speech-recognition'

interface Message {
  role: 'user' | 'assistant'
  content: string
  links?: { text: string; url: string }[]
  actions?: { tool: string; success: boolean }[]
}

export default function MobileAssistantPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [listening, setListening] = useState(false)
  const [speechSupported, setSpeechSupported] = useState(false)
  const recognitionRef = useRef<any>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const isNativeRef = useRef(false)

  useEffect(() => {
    async function checkSpeechSupport() {
      const isNative = !!(window as any).Capacitor
      isNativeRef.current = isNative

      if (isNative) {
        // Try native Capacitor plugin first; fall back to web speech if plugin not yet registered
        try {
          const { available } = await NativeSpeech.available()
          if (available) {
            isNativeRef.current = true
            setSpeechSupported(true)
            return
          }
        } catch {
          // Native plugin not registered yet (needs Codemagic rebuild + cap sync)
        }
        // Fall back to web speech API (works in WKWebView on iOS 15+)
        isNativeRef.current = false
      }
      {
        // Web Speech API for browser
        const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
        if (!SR) { setSpeechSupported(false); return }
        try { const test = new SR(); test.abort(); setSpeechSupported(true) } catch { setSpeechSupported(false) }
      }
    }
    checkSpeechSupport()
  }, [])

  useEffect(() => { generateGreeting() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function generateGreeting() {
    setLoading(true)
    try {
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: '__greeting__', history: [], pageContext: { type: 'dashboard', pathname: '/assistant' } }),
      })
      const data = await res.json()
      if (data.response) setMessages([{ role: 'assistant', content: data.response, links: data.links, actions: data.actions }])
    } catch {
      setMessages([{ role: 'assistant', content: "Hey! What can I help you with?" }])
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
          pageContext: { type: 'dashboard', pathname: '/assistant' },
        }),
      })
      const data = await res.json()
      setMessages(prev => [...prev, { role: 'assistant', content: data.response || 'Done.', links: data.links, actions: data.actions }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Connection error. Please try again.' }])
    }
    setLoading(false)
  }, [input, loading, messages])

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
    // ── NATIVE (Capacitor iOS/Android) ──────────────────────────────────────
    if (isNativeRef.current) {
      try {
        if (listening) {
          await NativeSpeech.stop()
          await NativeSpeech.removeAllListeners()
          setListening(false)
          return
        }

        // Request OS-level permission (shows iOS prompt on first use)
        const perms = await NativeSpeech.requestPermissions()
        if (perms.speechRecognition !== 'granted') {
          alert('Microphone access denied.\n\nTo fix: open iPhone Settings → ONE70 CRM → turn on Microphone and Speech Recognition.')
          return
        }

        setInput('')
        setListening(true)

        // Stream partial results into the input field
        await NativeSpeech.addListener('partialResults', (data: any) => {
          if (data.matches && data.matches.length > 0) {
            setInput(data.matches[0])
          }
        })

        await NativeSpeech.start({
          language: 'en-US',
          maxResults: 1,
          partialResults: true,
          popup: false,
        })

        // When recognition ends, finalize and auto-send
        setListening(false)
        await NativeSpeech.removeAllListeners()
      } catch (err: any) {
        console.warn('Native speech error:', err)
        setListening(false)
        await NativeSpeech.removeAllListeners().catch(() => {})
        alert('Voice input could not start. Please check microphone permissions in iPhone Settings → ONE70 CRM.')
      }
      return
    }

    // ── WEB BROWSER (Chrome / Safari) ───────────────────────────────────────
    try {
      if (listening && recognitionRef.current) { recognitionRef.current.stop(); setListening(false); return }
      const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      if (!SR) { alert('Voice input is not supported on this browser. Try Chrome or Safari.'); return }

      const recognition = new SR()
      recognition.continuous = false
      recognition.interimResults = true
      recognition.lang = 'en-US'
      let finalTranscript = ''
      recognition.onresult = (event: any) => {
        let interim = ''; finalTranscript = ''
        for (let i = 0; i < event.results.length; i++) {
          if (event.results[i].isFinal) finalTranscript += event.results[i][0].transcript
          else interim += event.results[i][0].transcript
        }
        setInput(finalTranscript + interim)
      }
      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error)
        setListening(false)
        if (event.error === 'not-allowed') {
          alert('Microphone blocked.\n\nFix: click the 🔒 lock icon in the address bar → Microphone → Allow, then reload.')
        } else if (event.error === 'network') {
          alert('Network error with voice recognition. Please check your connection and try again.')
        }
        // no-speech: silently reset
      }
      recognition.onend = () => { if (finalTranscript.trim()) setInput(finalTranscript.trim()); setListening(false) }
      recognitionRef.current = recognition
      recognition.start()
      setInput('')
      setListening(true)
    } catch (err: any) {
      console.warn('Voice input failed:', err)
      setListening(false)
      if (err?.name === 'NotAllowedError') {
        alert('Microphone access denied. Check browser settings and allow microphone for this site.')
      } else {
        alert('Voice input could not start. Please check microphone permissions and try again.')
      }
    }
  }

  const toolLabels: Record<string, string> = {
    create_task: 'Task', search_contacts: 'Contacts', search_deals: 'Deals',
    search_organizations: 'Orgs', log_activity: 'Activity', move_deal_stage: 'Deal',
    create_contact: 'Contact', get_my_tasks: 'Tasks', get_outreach_due: 'Outreach',
    get_pipeline_summary: 'Pipeline', search_projects: 'Projects',
    get_recent_activities: 'Activities', web_search: 'Web',
    search_emails: 'Email', search_calendar: 'Calendar', send_email: 'Email',
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>

      {/* Header — compact mobile */}
      <div className="flex items-center justify-between px-3 py-2.5 bg-one70-black text-white shrink-0">
        <div className="flex items-center gap-2">
          <button onClick={() => router.back()} className="p-1.5 -ml-1 rounded-md active:bg-white/10">
            <ArrowLeft size={20} />
          </button>
          <div className="w-7 h-7 rounded-full bg-one70-yellow flex items-center justify-center">
            <Sparkles size={14} className="text-one70-black" />
          </div>
          <span className="text-sm font-bold">ONE70 AI</span>
        </div>
        <button onClick={() => { setMessages([]); generateGreeting() }}
          className="p-2 rounded-md active:bg-white/10 text-white/70">
          <RotateCcw size={16} />
        </button>
      </div>

      {/* Messages — scrollable area */}
      <div className="flex-1 overflow-y-auto overscroll-contain px-3 py-3 space-y-3">
        {messages.length === 0 && !loading && (
          <div className="text-center py-10">
            <Sparkles size={28} className="mx-auto text-gray-300 mb-3" />
            <p className="text-sm text-one70-mid mb-5">What can I help you with?</p>
            <div className="space-y-2 max-w-[280px] mx-auto">
              {['What are my tasks today?', 'Show pipeline deals', 'Check my email', 'Draft a follow-up'].map(q => (
                <button key={q} onClick={() => sendMessage(q)}
                  className="block w-full text-left text-sm px-4 py-3 rounded-xl bg-one70-gray text-one70-dark active:bg-gray-200">
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] ${msg.role === 'user'
              ? 'bg-one70-black text-white rounded-2xl rounded-br-sm px-3.5 py-2.5'
              : 'bg-one70-gray text-one70-dark rounded-2xl rounded-bl-sm px-3.5 py-2.5'
            }`}>
              {msg.actions && msg.actions.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-1.5">
                  {msg.actions.map((a, j) => (
                    <span key={j} className={`text-[10px] px-1.5 py-0.5 rounded-full ${a.success ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {toolLabels[a.tool] || a.tool} {a.success ? '✓' : '✗'}
                    </span>
                  ))}
                </div>
              )}
              <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{msg.content}</p>
              {msg.links && msg.links.length > 0 && (
                <div className="mt-2 space-y-1.5 border-t border-gray-200/50 pt-2">
                  {msg.links.map((link, j) => (
                    <button key={j} onClick={() => router.push(link.url)}
                      className="flex items-center gap-2 w-full text-left text-sm py-1 active:opacity-70">
                      <ChevronRight size={14} className="text-gray-400 shrink-0" />
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

      {/* Voice listening banner */}
      {listening && (
        <div className="bg-red-50 px-4 py-3 border-t border-red-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex gap-1 items-center">
              <span className="w-2 h-4 bg-red-500 rounded-full animate-pulse" />
              <span className="w-2 h-5 bg-red-400 rounded-full animate-pulse" style={{ animationDelay: '0.15s' }} />
              <span className="w-2 h-6 bg-red-500 rounded-full animate-pulse" style={{ animationDelay: '0.3s' }} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-red-700">Listening...</p>
              {input && <p className="text-sm text-red-900 truncate mt-0.5">{input}</p>}
            </div>
            <button onClick={toggleVoice} className="px-4 py-2 bg-red-500 text-white rounded-full text-sm font-medium active:bg-red-600">
              Stop
            </button>
          </div>
        </div>
      )}

      {/* Input bar — fixed at bottom, large touch targets */}
      <div className="shrink-0 border-t border-one70-border bg-white px-3 py-2">
        <div className="flex items-center gap-2">
          {speechSupported && !listening && (
            <button onClick={toggleVoice}
              className="w-11 h-11 rounded-full shrink-0 bg-one70-gray text-one70-mid flex items-center justify-center active:bg-gray-300">
              <Mic size={20} />
            </button>
          )}
          <input ref={inputRef} type="text" value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); sendMessage() } }}
            placeholder={listening ? 'Speak now...' : 'Ask anything...'}
            className="flex-1 text-[16px] border border-one70-border rounded-full px-4 py-2.5 focus:outline-none focus:border-one70-black"
            disabled={loading || listening} autoFocus />
          <button onClick={() => sendMessage()} disabled={!input.trim() || loading}
            className="w-11 h-11 rounded-full bg-one70-black text-white disabled:opacity-30 shrink-0 flex items-center justify-center active:bg-one70-dark">
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  )
}
