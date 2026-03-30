'use client'

import { useState, useEffect } from 'react'
import { Bell, BellOff, Send, Loader2, CheckCircle, Smartphone } from 'lucide-react'
import { isNativeApp } from '@/lib/native'

interface Prefs {
  task_due_today: boolean
  task_assigned: boolean
  deal_stage_changed: boolean
  deal_won: boolean
  deal_lost: boolean
  sequence_action_due: boolean
  project_status_changed: boolean
  daily_digest: boolean
  quiet_hours_start: string | null
  quiet_hours_end: string | null
}

const DEFAULT_PREFS: Prefs = {
  task_due_today: true,
  task_assigned: true,
  deal_stage_changed: true,
  deal_won: true,
  deal_lost: true,
  sequence_action_due: true,
  project_status_changed: true,
  daily_digest: false,
  quiet_hours_start: null,
  quiet_hours_end: null,
}

export default function NotificationSettingsPage() {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [testSending, setTestSending] = useState(false)
  const [testResult, setTestResult] = useState('')
  const [native, setNative] = useState(false)
  const [apnsConfigured, setApnsConfigured] = useState<boolean | null>(null)
  const [deviceRegistered, setDeviceRegistered] = useState(false)

  useEffect(() => {
    setNative(isNativeApp())
    fetch('/api/notifications/preferences')
      .then(r => r.json())
      .then(data => {
        setPrefs({ ...DEFAULT_PREFS, ...data })
        setLoading(false)
      })
      .catch(() => setLoading(false))
    // Check APNs status
    fetch('/api/notifications/status')
      .then(r => r.json())
      .then(data => {
        setApnsConfigured(data.apns_configured)
        setDeviceRegistered(data.device_registered)
      })
      .catch(() => {})
  }, [])

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    await fetch('/api/notifications/preferences', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(prefs),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  async function handleTestNotification() {
    setTestSending(true)
    setTestResult('')
    try {
      const res = await fetch('/api/notifications/test', { method: 'POST' })
      const data = await res.json()
      if (data.sent > 0) {
        setTestResult('Test notification sent! Check your phone.')
      } else if (data.errors?.length > 0 && data.errors[0].includes('not configured')) {
        setTestResult('APNs not configured. Add APNS_KEY_ID, APNS_TEAM_ID, and APNS_KEY_P8 to Vercel.')
      } else if (data.errors?.length > 0) {
        setTestResult(`Failed: ${data.errors[0]}`)
      } else {
        setTestResult('No devices registered. Open the app on your phone first.')
      }
    } catch {
      setTestResult('Failed to send test notification.')
    }
    setTestSending(false)
  }

  function toggle(key: keyof Prefs) {
    setPrefs(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const [registerStatus, setRegisterStatus] = useState('')
  const [registering, setRegistering] = useState(false)

  async function manualRegister() {
    setRegistering(true)
    setRegisterStatus('Checking environment...')
    
    try {
      // Check Capacitor
      const cap = (window as any).Capacitor
      if (!cap) {
        setRegisterStatus('Not running in native app (Capacitor not found). Install from TestFlight.')
        setRegistering(false)
        return
      }
      
      if (!cap.isNativePlatform?.()) {
        setRegisterStatus('Not running as native app (isNativePlatform = false). Open from TestFlight, not Safari.')
        setRegistering(false)
        return
      }

      setRegisterStatus(`Platform: ${cap.getPlatform?.()} — importing push plugin...`)
      
      const { PushNotifications } = await import('@capacitor/push-notifications')
      
      setRegisterStatus('Checking permissions...')
      const perm = await PushNotifications.checkPermissions()
      setRegisterStatus(`Permission status: ${perm.receive}`)

      if (perm.receive === 'denied') {
        setRegisterStatus('Notifications DENIED. Go to iPhone Settings → ONE70 CRM → Notifications → Allow Notifications.')
        setRegistering(false)
        return
      }

      if (perm.receive !== 'granted') {
        setRegisterStatus('Requesting permission...')
        const req = await PushNotifications.requestPermissions()
        setRegisterStatus(`Permission result: ${req.receive}`)
        if (req.receive !== 'granted') {
          setRegisterStatus('Permission not granted. Go to iPhone Settings → ONE70 CRM → Notifications → Allow Notifications.')
          setRegistering(false)
          return
        }
      }

      setRegisterStatus('Registering with Apple Push service...')
      
      // Set up listener BEFORE calling register
      PushNotifications.addListener('registration', async (token) => {
        setRegisterStatus(`Token received! Saving to server... (${token.value.substring(0, 20)}...)`)
        try {
          const res = await fetch('/api/notifications/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              token: token.value,
              platform: cap.getPlatform?.() || 'ios',
              deviceName: /iPhone/.test(navigator.userAgent) ? 'iPhone' : /iPad/.test(navigator.userAgent) ? 'iPad' : 'Device',
            }),
          })
          if (res.ok) {
            setRegisterStatus('Device registered successfully! Try Send Test now.')
            setDeviceRegistered(true)
          } else {
            const data = await res.json()
            setRegisterStatus(`Server error: ${data.error || res.status}`)
          }
        } catch (err: any) {
          setRegisterStatus(`Network error saving token: ${err.message}`)
        }
        setRegistering(false)
      })

      PushNotifications.addListener('registrationError', (error) => {
        setRegisterStatus(`Registration error: ${JSON.stringify(error)}`)
        setRegistering(false)
      })

      await PushNotifications.register()
      
      // If no callback fires within 10 seconds, something is wrong
      setTimeout(() => {
        setRegistering(current => {
          if (current) {
            setRegisterStatus(prev => prev.includes('successfully') ? prev : prev + ' — No response from Apple after 10s. The entitlements may not be configured in the build.')
          }
          return false
        })
      }, 10000)

    } catch (err: any) {
      setRegisterStatus(`Error: ${err.message}`)
      setRegistering(false)
    }
  }

  const inputClass = "w-full px-3 py-2 border border-one70-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"

  if (loading) return <div className="text-sm text-one70-mid p-8">Loading preferences...</div>

  return (
    <div>
      <h1 className="text-2xl font-bold text-one70-black mb-6">Notification Settings</h1>

      {!native && (
        <div className="bg-one70-gray border border-one70-border rounded-lg p-4 mb-6 flex items-start gap-3">
          <Smartphone size={20} className="text-one70-mid mt-0.5 shrink-0" />
          <div className="text-sm text-one70-dark">
            Push notifications are delivered to the ONE70 CRM native app on your phone. Open the app to register your device, then configure which notifications you receive below.
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg border border-one70-border overflow-hidden">
        <div className="px-6 py-4 border-b border-one70-border">
          <h2 className="text-lg font-semibold text-one70-black flex items-center gap-2">
            <Bell size={20} /> Notification Types
          </h2>
          <p className="text-sm text-one70-mid mt-1">Choose which events trigger push notifications.</p>
        </div>

        <div className="divide-y divide-one70-border">
          {[
            { key: 'task_due_today' as keyof Prefs, label: 'Tasks due today', desc: 'Daily reminder of tasks due today' },
            { key: 'task_assigned' as keyof Prefs, label: 'Task assigned to me', desc: 'When someone assigns you a task' },
            { key: 'deal_stage_changed' as keyof Prefs, label: 'Deal stage changed', desc: 'When a deal moves to a new pipeline stage' },
            { key: 'deal_won' as keyof Prefs, label: 'Deal won', desc: 'Team-wide alert when a deal is won' },
            { key: 'deal_lost' as keyof Prefs, label: 'Deal lost', desc: 'Team-wide alert when a deal is lost' },
            { key: 'sequence_action_due' as keyof Prefs, label: 'Outreach action due', desc: 'When a sequence step is ready to send' },
            { key: 'project_status_changed' as keyof Prefs, label: 'Project status changed', desc: 'When a project moves to a new phase' },
          ].map(item => (
            <div key={item.key} className="flex items-center justify-between px-6 py-4">
              <div>
                <p className="text-sm font-medium text-one70-dark">{item.label}</p>
                <p className="text-xs text-one70-mid mt-0.5">{item.desc}</p>
              </div>
              <button
                onClick={() => toggle(item.key)}
                className={`relative w-11 h-6 rounded-full transition-colors ${prefs[item.key] ? 'bg-one70-black' : 'bg-gray-200'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${prefs[item.key] ? 'translate-x-5' : ''}`} />
              </button>
            </div>
          ))}
        </div>

        {/* Quiet Hours */}
        <div className="px-6 py-4 border-t border-one70-border">
          <h3 className="text-sm font-semibold text-one70-dark flex items-center gap-2 mb-3">
            <BellOff size={16} /> Quiet Hours
          </h3>
          <p className="text-xs text-one70-mid mb-3">No notifications during these hours.</p>
          <div className="flex items-center gap-3">
            <div>
              <label className="block text-xs text-one70-mid mb-1">From</label>
              <input
                type="time"
                value={prefs.quiet_hours_start || ''}
                onChange={e => setPrefs(prev => ({ ...prev, quiet_hours_start: e.target.value || null }))}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs text-one70-mid mb-1">To</label>
              <input
                type="time"
                value={prefs.quiet_hours_end || ''}
                onChange={e => setPrefs(prev => ({ ...prev, quiet_hours_end: e.target.value || null }))}
                className={inputClass}
              />
            </div>
            {prefs.quiet_hours_start && (
              <button
                onClick={() => setPrefs(prev => ({ ...prev, quiet_hours_start: null, quiet_hours_end: null }))}
                className="text-xs text-red-500 hover:text-red-700 mt-4"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 mt-6">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2.5 bg-one70-black text-white rounded-md text-sm font-semibold hover:bg-one70-dark transition-colors disabled:opacity-50"
        >
          {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Preferences'}
        </button>
        {saved && <CheckCircle size={18} className="text-green-500" />}
      </div>

      {/* Register device */}
      <div className="mt-8 bg-white rounded-lg border border-one70-border p-6">
        <h3 className="text-sm font-semibold text-one70-dark mb-2 flex items-center gap-2">
          <Smartphone size={16} /> Register This Device
        </h3>
        <p className="text-xs text-one70-mid mb-3">Tap to register this device for push notifications. Must be opened from the TestFlight app, not Safari.</p>
        <button
          onClick={manualRegister}
          disabled={registering}
          className="px-4 py-2 bg-one70-black text-white rounded-md text-sm font-medium hover:bg-one70-dark disabled:opacity-50 transition-colors flex items-center gap-2"
        >
          {registering ? <Loader2 size={16} className="animate-spin" /> : <Bell size={16} />}
          {registering ? 'Registering...' : 'Register Device'}
        </button>
        {registerStatus && (
          <p className={`text-sm mt-3 ${registerStatus.includes('successfully') ? 'text-green-600' : 'text-one70-mid'}`}>
            {registerStatus}
          </p>
        )}
      </div>

      {/* Test notification */}
      <div className="mt-8 bg-white rounded-lg border border-one70-border p-6">
        <h3 className="text-sm font-semibold text-one70-dark mb-2 flex items-center gap-2">
          <Send size={16} /> Test Notification
        </h3>
        <p className="text-xs text-one70-mid mb-3">Send a test push notification to all your registered devices.</p>
        <button
          onClick={handleTestNotification}
          disabled={testSending}
          className="px-4 py-2 bg-white border border-one70-border rounded-md text-sm font-medium text-one70-dark hover:bg-one70-gray transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {testSending ? <Loader2 size={16} className="animate-spin" /> : <Bell size={16} />}
          {testSending ? 'Sending...' : 'Send Test'}
        </button>
        {testResult && (
          <p className={`text-sm mt-3 ${testResult.includes('sent') ? 'text-green-600' : 'text-one70-mid'}`}>
            {testResult}
          </p>
        )}
      </div>

      {/* APNs Status */}
      {apnsConfigured === true && (
        <div className="mt-6 bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
          <CheckCircle size={18} className="text-green-600 shrink-0" />
          <div>
            <p className="text-sm font-medium text-green-800">Push notifications are configured</p>
            <p className="text-xs text-green-600 mt-0.5">
              {deviceRegistered ? 'Your device is registered. Use Send Test above to verify.' : 'Open the app on your phone to register your device.'}
            </p>
          </div>
        </div>
      )}

      {apnsConfigured === false && (
        <div className="mt-6 bg-amber-50 border border-amber-200 rounded-lg p-5">
          <h3 className="text-sm font-semibold text-amber-800 mb-2">APNs Setup Required</h3>
          <p className="text-xs text-amber-700 mb-2">Push notifications require an Apple Push Notification service key. One-time setup:</p>
          <ol className="text-xs text-amber-700 space-y-1 list-decimal list-inside">
            <li>Go to developer.apple.com/account → Keys → click +</li>
            <li>Name it &quot;ONE70 CRM Push&quot; and check &quot;Apple Push Notifications service (APNs)&quot;</li>
            <li>Download the .p8 file and note the Key ID</li>
            <li>Go to your Team ID (top right of the developer portal page)</li>
            <li>In Vercel, add these environment variables:
              <span className="font-mono text-amber-900"> APNS_KEY_ID</span>,
              <span className="font-mono text-amber-900"> APNS_TEAM_ID</span>,
              <span className="font-mono text-amber-900"> APNS_KEY_P8</span> (base64-encode the .p8 file contents)
            </li>
            <li>Redeploy Vercel, then use the &quot;Send Test&quot; button above to verify</li>
          </ol>
        </div>
      )}
    </div>
  )
}
