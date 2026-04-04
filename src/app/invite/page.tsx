'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Suspense } from 'react'

function InviteForm() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get('token')

  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [validating, setValidating] = useState(true)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('')
  const [invalid, setInvalid] = useState(false)

  // Validate token on load
  useEffect(() => {
    if (!token) {
      setInvalid(true)
      setValidating(false)
      return
    }

    async function validateToken() {
      try {
        const res = await fetch(`/api/invite/validate?token=${token}`)
        const data = await res.json()
        if (data.valid) {
          setInviteEmail(data.email)
          setInviteRole(data.role)
        } else {
          setInvalid(true)
          setError(data.error || 'Invalid invitation')
        }
      } catch {
        setInvalid(true)
        setError('Could not validate invitation')
      }
      setValidating(false)
    }

    validateToken()
  }, [token])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    setLoading(true)

    try {
      const res = await fetch('/api/invite/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, full_name: fullName, password }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Failed to create account')
        setLoading(false)
        return
      }

      setSuccess(true)
      setTimeout(() => router.push('/login'), 3000)
    } catch {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  const roleLabels: Record<string, string> = {
    admin: 'Admin', rep: 'Sales Rep', viewer: 'Viewer',
    pm: 'Project Manager', superintendent: 'Superintendent',
    estimator: 'Estimator', foreman: 'Foreman', exec: 'Executive',
  }
  const roleLabel = roleLabels[inviteRole] || inviteRole.charAt(0).toUpperCase() + inviteRole.slice(1).replace(/_/g, ' ')

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: '#1A1A1A' }}>
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <img src="/logo-white.png" alt="ONE70 Group" className="h-16 w-auto mx-auto" />
          <div className="h-1 w-16 mx-auto mt-3 mb-3" style={{ backgroundColor: '#FFE500' }}></div>
          <p className="text-sm uppercase tracking-widest" style={{ color: '#666666' }}>CRM</p>
        </div>

        <div className="bg-white rounded-lg shadow-xl p-8">
          {validating ? (
            <div className="text-center py-8">
              <p className="text-gray-500">Validating your invitation...</p>
            </div>
          ) : invalid ? (
            <div className="text-center py-8">
              <h2 className="text-xl font-bold text-gray-900 mb-3">Invalid Invitation</h2>
              <p className="text-gray-500 mb-6">{error || 'This invitation link is invalid or has expired.'}</p>
              <a href="/login" className="text-sm font-medium text-gray-900 hover:underline">
                Go to sign in
              </a>
            </div>
          ) : success ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: '#E8F5E9' }}>
                <span className="text-2xl">✓</span>
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Account Created!</h2>
              <p className="text-gray-500 mb-2">Welcome to ONE70 Group CRM.</p>
              <p className="text-gray-400 text-sm">Redirecting to sign in...</p>
            </div>
          ) : (
            <>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Create Your Account</h2>
              <p className="text-sm text-gray-500 mb-6">
                You&apos;ve been invited to join as <strong>{roleLabel}</strong>
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={inviteEmail}
                    disabled
                    className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm bg-gray-50 text-gray-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:border-transparent"
                    style={{ '--tw-ring-color': '#FFE500' } as any}
                    placeholder="Your full name"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:border-transparent"
                    placeholder="Minimum 8 characters"
                    minLength={8}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:border-transparent"
                    placeholder="Re-enter your password"
                    minLength={8}
                    required
                  />
                </div>

                {error && (
                  <div className="bg-red-50 text-red-700 px-3 py-2 rounded-md text-sm">{error}</div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full text-white py-2.5 rounded-md font-semibold transition-colors disabled:opacity-50"
                  style={{ backgroundColor: '#1A1A1A' }}
                >
                  {loading ? 'Creating Account...' : 'Create Account'}
                </button>
              </form>

              <p className="mt-4 text-center">
                <a href="/login" className="text-sm text-gray-500 hover:text-gray-700">
                  Already have an account? Sign in
                </a>
              </p>
            </>
          )}
        </div>

        <p className="text-center text-xs mt-6" style={{ color: '#666666' }}>
          Clear Cost. Clear Schedule. Ability to Scale.
        </p>
      </div>
    </div>
  )
}

export default function InvitePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#1A1A1A' }}>
        <p className="text-gray-500">Loading...</p>
      </div>
    }>
      <InviteForm />
    </Suspense>
  )
}
