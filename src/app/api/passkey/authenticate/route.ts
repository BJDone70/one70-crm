import { NextResponse } from 'next/server'
import { generateAuthenticationOptions } from '@simplewebauthn/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { rpID } from '@/lib/webauthn'
import { headers } from 'next/headers'
import { rateLimitByIp } from '@/lib/rate-limit'

export async function POST(request: Request) {
  try {
    // Rate limit: 5 auth attempts per minute per IP
    const headerList = await headers()
    const ip = headerList.get('x-forwarded-for')?.split(',')[0] || 'unknown'
    const { allowed } = rateLimitByIp(ip, 5, 60_000)
    if (!allowed) {
      return NextResponse.json({ error: 'Too many attempts. Try again shortly.' }, { status: 429 })
    }

    const { email } = await request.json()
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    const adminDb = createAdminClient()

    // Find user by email
    const { data: profile } = await adminDb
      .from('profiles')
      .select('id')
      .eq('email', email)
      .eq('is_active', true)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'No account found with this email' }, { status: 404 })
    }

    // Get their passkeys
    const { data: passkeys } = await adminDb
      .from('passkeys')
      .select('credential_id, transports')
      .eq('user_id', profile.id)

    if (!passkeys || passkeys.length === 0) {
      return NextResponse.json({ error: 'No passkeys registered for this account' }, { status: 404 })
    }

    const options = await generateAuthenticationOptions({
      rpID,
      allowCredentials: passkeys.map(k => ({
        id: k.credential_id,
        transports: k.transports || [],
      })),
      userVerification: 'required',
    })

    // Store challenge (use null user_id since not authenticated yet)
    // Store with the profile.id so we can match it during verification
    await adminDb.from('webauthn_challenges').insert({
      user_id: profile.id,
      challenge: options.challenge,
      type: 'authentication',
    })

    try { await adminDb.rpc('cleanup_expired_challenges') } catch {}

    return NextResponse.json({ ...options, userId: profile.id })
  } catch (error: any) {
    console.error('Auth options error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
