'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { startAuthentication, browserSupportsWebAuthn } from '@simplewebauthn/browser'
import { Fingerprint } from 'lucide-react'
import {
  isNativeApp, isBiometricAvailable, verifyBiometric,
  getBiometricCredentials, saveBiometricCredentials, hasBiometricCredentials,
} from '@/lib/native'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<'login' | 'reset' | 'faceid'>('login')
  const [resetSent, setResetSent] = useState(false)
  const [nativeBiometric, setNativeBiometric] = useState<{ available: boolean; type: string; hasCredentials: boolean }>({ available: false, type: 'none', hasCredentials: false })
  const [webBiometric, setWebBiometric] = useState({ available: false, email: '' })
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function checkBiometric() {
      if (isNativeApp()) {
        // Native app: use Face ID / Touch ID with stored credentials
        const bio = await isBiometricAvailable()
        const hasCreds = await hasBiometricCredentials()
        setNativeBiometric({ available: bio.available, type: bio.type, hasCredentials: hasCreds })
      } else {
        // Web: use WebAuthn passkeys
        setWebBiometric({
          available: browserSupportsWebAuthn(),
          email: localStorage.getItem('one70_biometric_email') || '',
        })
      }
    }
    checkBiometric()
  }, [])

  // ---- Native Face ID login (Capacitor) ----
  async function handleNativeBiometricLogin() {
    setError('')
    setLoading(true)
    try {
      const verified = await verifyBiometric()
      if (!verified) {
        setError(`${nativeBiometric.type} authentication cancelled`)
        setLoading(false)
        return
      }

      const credentials = await getBiometricCredentials()
      if (!credentials) {
        setError(`No saved credentials. Please sign in with password first.`)
        setLoading(false)
        return
      }

      const { error: authError } = await supabase.auth.signInWithPassword({
        email: credentials.email,
        password: credentials.password,
      })

      if (authError) {
        setError('Saved credentials expired. Please sign in with password.')
        setLoading(false)
        return
      }

      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase.from('profiles').update({ last_login_at: new Date().toISOString() }).eq('id', user.id)
      }

      router.push('/')
      router.refresh()
    } catch (err: any) {
      setError(err.message || 'Authentication failed')
      setLoading(false)
    }
  }

  // ---- Password login (saves credentials for Face ID if in native app) ----
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    // Save credentials for native Face ID on next login
    if (isNativeApp() && nativeBiometric.available) {
      await saveBiometricCredentials(email, password)
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('profiles').update({ last_login_at: new Date().toISOString() }).eq('id', user.id)
    }

    router.push('/')
    router.refresh()
  }

  // ---- WebAuthn passkey login (web only) ----
  async function handleWebBiometricLogin() {
    const loginEmail = webBiometric.email || email
    if (!loginEmail) { setMode('faceid'); return }

    setError('')
    setLoading(true)

    try {
      const optionsRes = await fetch('/api/passkey/authenticate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail }),
      })
      const optionsData = await optionsRes.json()

      if (!optionsRes.ok) {
        setError(optionsData.error?.includes('No passkeys')
          ? 'No passkey registered. Sign in with password first, then enable biometrics.'
          : optionsData.error || 'Failed to start authentication')
        setLoading(false)
        return
      }

      const authResponse = await startAuthentication({ optionsJSON: optionsData })
      const verifyRes = await fetch('/api/passkey/authenticate/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response: authResponse, userId: optionsData.userId }),
      })
      const verifyData = await verifyRes.json()

      if (!verifyRes.ok) {
        setError(verifyData.error || 'Authentication failed')
        setLoading(false)
        return
      }

      const { error: otpError } = await supabase.auth.verifyOtp({ token_hash: verifyData.tokenHash, type: 'magiclink' })
      if (otpError) {
        setError('Failed to create session. Please sign in with password.')
        setLoading(false)
        return
      }

      router.push('/')
      router.refresh()
    } catch (err: any) {
      setError(err.name === 'NotAllowedError' ? 'Authentication cancelled' : err.message || 'Authentication failed')
      setLoading(false)
    }
  }

  async function handleFaceIdWithEmail(e: React.FormEvent) {
    e.preventDefault()
    if (!email) return
    localStorage.setItem('one70_biometric_email', email)
    setWebBiometric(prev => ({ ...prev, email }))
    await handleWebBiometricLogin()
  }

  const [resetCooldown, setResetCooldown] = useState(0)

  // Cooldown timer
  useEffect(() => {
    if (resetCooldown <= 0) return
    const t = setInterval(() => setResetCooldown(c => c - 1), 1000)
    return () => clearInterval(t)
  }, [resetCooldown])

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (resetCooldown > 0) { setError(`Please wait ${resetCooldown}s before requesting another reset.`); return }
    setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/confirm?type=recovery`,
    })
    if (error) {
      if (error.message.toLowerCase().includes('rate limit')) {
        setError('Too many reset requests. Please wait 60 minutes, or contact your admin to reset your password directly.')
        setResetCooldown(120)
      } else {
        setError(error.message)
      }
      setLoading(false)
      return
    }
    setResetSent(true)
    setResetCooldown(60) // Prevent re-clicking for 60 seconds
    setLoading(false)
  }

  // Determine which biometric button to show
  const showNativeFaceId = isNativeApp() && nativeBiometric.available && nativeBiometric.hasCredentials
  const showWebBiometric = !isNativeApp() && webBiometric.available && webBiometric.email
  const biometricLabel = isNativeApp() ? nativeBiometric.type : 'Face ID'

  return (
    <div className="min-h-screen bg-one70-black flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Migration banner */}
        <div className="bg-amber-500 text-black rounded-lg px-4 py-3 mb-6 text-center shadow-md">
          <p className="text-sm font-bold">
            This platform has been retired. All data has been migrated to the new platform and will not be synced moving forward.
          </p>
          <p className="text-xs mt-0.5">
            Contact Ben Diamond for any access issues to the new platform.
          </p>
        </div>
        {/* Logo */}
        <div className="text-center mb-8">
          <img src="/logo-white.png" alt="ONE70 Group" className="h-16 w-auto mx-auto" />
          <div className="h-1 w-16 bg-one70-yellow mx-auto mt-3 mb-3"></div>
          <p className="text-one70-mid text-sm uppercase tracking-widest">CRM</p>
        </div>

        <div className="bg-white rounded-lg shadow-xl p-8">
          {mode === 'login' ? (
            <>
              <h2 className="text-xl font-bold text-one70-black mb-6">Sign In</h2>

              {/* Native Face ID button */}
              {showNativeFaceId && (
                <div className="mb-6">
                  <button onClick={handleNativeBiometricLogin} disabled={loading}
                    className="w-full flex items-center justify-center gap-3 bg-one70-black text-white py-3 rounded-md font-semibold hover:bg-one70-dark transition-colors disabled:opacity-50">
                    <Fingerprint size={22} />
                    {loading ? 'Authenticating...' : `Sign in with ${nativeBiometric.type}`}
                  </button>
                  <div className="flex items-center gap-3 my-4">
                    <div className="flex-1 h-px bg-one70-border"></div>
                    <span className="text-xs text-one70-mid">or use password</span>
                    <div className="flex-1 h-px bg-one70-border"></div>
                  </div>
                </div>
              )}

              {/* Web biometric (WebAuthn) button */}
              {showWebBiometric && (
                <div className="mb-6">
                  <button onClick={handleWebBiometricLogin} disabled={loading}
                    className="w-full flex items-center justify-center gap-3 bg-one70-black text-white py-3 rounded-md font-semibold hover:bg-one70-dark transition-colors disabled:opacity-50">
                    <Fingerprint size={22} />
                    {loading ? 'Authenticating...' : 'Sign in with Face ID'}
                  </button>
                  <p className="text-xs text-one70-mid text-center mt-2">{webBiometric.email}</p>
                  <div className="flex items-center gap-3 my-4">
                    <div className="flex-1 h-px bg-one70-border"></div>
                    <span className="text-xs text-one70-mid">or use password</span>
                    <div className="flex-1 h-px bg-one70-border"></div>
                  </div>
                </div>
              )}

              {/* Native app first-time hint */}
              {isNativeApp() && nativeBiometric.available && !nativeBiometric.hasCredentials && (
                <div className="bg-one70-gray border border-one70-border rounded-md px-3 py-2 mb-4 text-xs text-one70-mid">
                  <Fingerprint size={14} className="inline mr-1" />
                  Sign in with your password once to enable {nativeBiometric.type} for future logins.
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-one70-dark mb-1">Email</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-one70-border rounded-md focus:outline-none focus:ring-2 focus:ring-one70-yellow focus:border-transparent"
                    placeholder="you@one70group.com" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-one70-dark mb-1">Password</label>
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-one70-border rounded-md focus:outline-none focus:ring-2 focus:ring-one70-yellow focus:border-transparent"
                    placeholder="••••••••" required />
                </div>
                {error && <div className="bg-red-50 text-red-700 px-3 py-2 rounded-md text-sm">{error}</div>}
                <button type="submit" disabled={loading}
                  className="w-full bg-one70-black text-white py-2.5 rounded-md font-semibold hover:bg-one70-dark transition-colors disabled:opacity-50">
                  {loading ? 'Signing in...' : 'Sign In'}
                </button>
              </form>

              <div className="mt-4 flex justify-between">
                <button onClick={() => { setMode('reset'); setError('') }} className="text-sm text-one70-mid hover:text-one70-dark">
                  Forgot password?
                </button>
                {!isNativeApp() && webBiometric.available && !webBiometric.email && (
                  <button onClick={() => { setMode('faceid'); setError('') }} className="text-sm text-one70-mid hover:text-one70-dark flex items-center gap-1">
                    <Fingerprint size={14} /> Use Face ID
                  </button>
                )}
              </div>
            </>
          ) : mode === 'faceid' ? (
            <>
              <h2 className="text-xl font-bold text-one70-black mb-2">Face ID Sign In</h2>
              <p className="text-sm text-one70-mid mb-6">Enter your email to sign in with biometrics.</p>
              <form onSubmit={handleFaceIdWithEmail} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-one70-dark mb-1">Email</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-one70-border rounded-md focus:outline-none focus:ring-2 focus:ring-one70-yellow focus:border-transparent"
                    placeholder="you@one70group.com" required />
                </div>
                {error && <div className="bg-red-50 text-red-700 px-3 py-2 rounded-md text-sm">{error}</div>}
                <button type="submit" disabled={loading}
                  className="w-full flex items-center justify-center gap-2 bg-one70-black text-white py-2.5 rounded-md font-semibold hover:bg-one70-dark transition-colors disabled:opacity-50">
                  <Fingerprint size={18} />
                  {loading ? 'Authenticating...' : 'Continue with Face ID'}
                </button>
              </form>
              <button onClick={() => { setMode('login'); setError('') }} className="mt-4 text-sm text-one70-mid hover:text-one70-dark">
                Back to password sign in
              </button>
            </>
          ) : (
            <>
              <h2 className="text-xl font-bold text-one70-black mb-2">Reset Password</h2>
              <p className="text-sm text-one70-mid mb-6">Enter your email and we&apos;ll send a reset link.</p>
              {resetSent ? (
                <div className="bg-green-50 text-green-700 px-4 py-3 rounded-md text-sm">Check your email for the reset link.</div>
              ) : (
                <form onSubmit={handleReset} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-one70-dark mb-1">Email</label>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-3 py-2 border border-one70-border rounded-md focus:outline-none focus:ring-2 focus:ring-one70-yellow focus:border-transparent"
                      placeholder="you@one70group.com" required />
                  </div>
                  {error && <div className="bg-red-50 text-red-700 px-3 py-2 rounded-md text-sm">{error}</div>}
                  <button type="submit" disabled={loading}
                    className="w-full bg-one70-black text-white py-2.5 rounded-md font-semibold hover:bg-one70-dark transition-colors disabled:opacity-50">
                    {loading ? 'Sending...' : 'Send Reset Link'}
                  </button>
                </form>
              )}
              <button onClick={() => { setMode('login'); setError(''); setResetSent(false) }} className="mt-4 text-sm text-one70-mid hover:text-one70-dark">
                Back to sign in
              </button>
            </>
          )}
        </div>

        <p className="text-center text-one70-mid text-xs mt-6">Clear Cost. Clear Schedule. Ability to Scale.</p>
      </div>
    </div>
  )
}
