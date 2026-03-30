'use client'

import { useState, useEffect } from 'react'
import { startRegistration, browserSupportsWebAuthn } from '@simplewebauthn/browser'
import { Fingerprint, X } from 'lucide-react'

export default function EnableBiometricPrompt({ userEmail }: { userEmail: string }) {
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    // Skip in Capacitor native app — WebAuthn doesn't work in WKWebView
    if (typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform?.()) return

    // Only show if:
    // 1. Device supports WebAuthn
    // 2. User hasn't dismissed or already set up
    // 3. Not already showing as the biometric email
    if (!browserSupportsWebAuthn()) return

    const dismissed = localStorage.getItem('one70_biometric_dismissed')
    const alreadySetup = localStorage.getItem('one70_biometric_email')

    if (!dismissed && !alreadySetup) {
      // Small delay so it doesn't flash on page load
      const timer = setTimeout(() => setShow(true), 2000)
      return () => clearTimeout(timer)
    }
  }, [])

  async function handleEnable() {
    setError('')
    setLoading(true)

    try {
      // Step 1: Get registration options
      const optionsRes = await fetch('/api/passkey/register', { method: 'POST' })
      const options = await optionsRes.json()

      if (!optionsRes.ok) {
        setError(options.error || 'Failed to start setup')
        setLoading(false)
        return
      }

      // Step 2: Trigger Face ID / biometric enrollment
      const regResponse = await startRegistration({ optionsJSON: options })

      // Step 3: Verify on server
      const verifyRes = await fetch('/api/passkey/register/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...regResponse, deviceName: getDeviceName() }),
      })

      const verifyData = await verifyRes.json()

      if (!verifyRes.ok) {
        setError(verifyData.error || 'Setup failed')
        setLoading(false)
        return
      }

      // Save email for biometric login
      if (typeof window !== 'undefined') {
        localStorage.setItem('one70_biometric_email', userEmail)
      }
      setSuccess(true)
      setTimeout(() => setShow(false), 3000)
    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        setError('Biometric setup was cancelled')
      } else {
        setError(err.message || 'Setup failed')
      }
    }

    setLoading(false)
  }

  function handleDismiss() {
    if (typeof window !== 'undefined') {
      localStorage.setItem('one70_biometric_dismissed', 'true')
    }
    setShow(false)
  }

  function getDeviceName(): string {
    const ua = navigator.userAgent
    if (/iPhone/.test(ua)) return 'iPhone'
    if (/iPad/.test(ua)) return 'iPad'
    if (/Android/.test(ua)) return 'Android'
    if (/Mac/.test(ua)) return 'Mac'
    if (/Windows/.test(ua)) return 'Windows'
    return 'This device'
  }

  if (!show) return null

  return (
    <div className="fixed bottom-20 right-4 left-4 sm:left-auto sm:w-96 bg-white rounded-lg shadow-xl border border-one70-border p-5 z-40 animate-in slide-in-from-bottom-5">
      <button onClick={handleDismiss} className="absolute top-3 right-3 text-gray-400 hover:text-gray-600">
        <X size={16} />
      </button>

      {success ? (
        <div className="text-center py-2">
          <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-2">
            <Fingerprint size={22} className="text-green-600" />
          </div>
          <p className="text-sm font-medium text-gray-900">Face ID Enabled!</p>
          <p className="text-xs text-gray-500 mt-1">Next time, just tap &quot;Sign in with Face ID&quot;</p>
        </div>
      ) : (
        <>
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-one70-black flex items-center justify-center shrink-0">
              <Fingerprint size={20} className="text-one70-yellow" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">Enable Face ID?</p>
              <p className="text-xs text-gray-500 mt-1">
                Sign in faster with Face ID, Touch ID, or fingerprint. You won&apos;t need to type your password each time.
              </p>
            </div>
          </div>

          {error && <div className="bg-red-50 text-red-700 px-3 py-1.5 rounded text-xs mt-3">{error}</div>}

          <div className="flex gap-2 mt-4">
            <button
              onClick={handleEnable}
              disabled={loading}
              className="flex-1 bg-one70-black text-white py-2 rounded-md text-sm font-semibold hover:bg-one70-dark transition-colors disabled:opacity-50"
            >
              {loading ? 'Setting up...' : 'Enable'}
            </button>
            <button
              onClick={handleDismiss}
              className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              Not now
            </button>
          </div>
        </>
      )}
    </div>
  )
}
