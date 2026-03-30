'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)

    const { error: updateError } = await supabase.auth.updateUser({ password })

    if (updateError) {
      setError(updateError.message)
      setLoading(false)
      return
    }

    setSuccess(true)
    setTimeout(() => {
      router.push('/')
      router.refresh()
    }, 2000)
  }

  return (
    <div className="min-h-screen bg-one70-black flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src="/logo-white.png" alt="ONE70 Group" className="h-16 w-auto mx-auto" />
          <div className="h-1 w-16 bg-one70-yellow mx-auto mt-3 mb-3"></div>
          <p className="text-one70-mid text-sm uppercase tracking-widest">CRM</p>
        </div>

        <div className="bg-white rounded-lg shadow-xl p-8">
          <h2 className="text-xl font-bold text-one70-black mb-2">Set New Password</h2>
          <p className="text-sm text-one70-mid mb-6">Enter your new password below.</p>

          {success ? (
            <div className="bg-green-50 text-green-700 px-4 py-3 rounded-md text-sm">
              Password updated! Redirecting to dashboard...
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-one70-dark mb-1">New Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-one70-border rounded-md focus:outline-none focus:ring-2 focus:ring-one70-yellow focus:border-transparent"
                  placeholder="••••••••"
                  required
                  minLength={6}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-one70-dark mb-1">Confirm Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-one70-border rounded-md focus:outline-none focus:ring-2 focus:ring-one70-yellow focus:border-transparent"
                  placeholder="••••••••"
                  required
                  minLength={6}
                />
              </div>

              {error && <div className="bg-red-50 text-red-700 px-3 py-2 rounded-md text-sm">{error}</div>}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-one70-black text-white py-2.5 rounded-md font-semibold hover:bg-one70-dark transition-colors disabled:opacity-50"
              >
                {loading ? 'Updating...' : 'Update Password'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
