import { NextResponse } from 'next/server'
import { verifyAuthenticationResponse } from '@simplewebauthn/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { rpID, origin } from '@/lib/webauthn'
import { headers } from 'next/headers'
import { rateLimitByIp } from '@/lib/rate-limit'

function base64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return new Uint8Array(bytes.buffer.slice(0)) as Uint8Array<ArrayBuffer>
}

export async function POST(request: Request) {
  try {
    // Rate limit: 5 verify attempts per minute per IP
    const headerList = await headers()
    const ip = headerList.get('x-forwarded-for')?.split(',')[0] || 'unknown'
    const { allowed } = rateLimitByIp(ip, 5, 60_000)
    if (!allowed) {
      return NextResponse.json({ error: 'Too many attempts. Try again shortly.' }, { status: 429 })
    }

    const { response, userId } = await request.json()

    if (!response || !userId) {
      return NextResponse.json({ error: 'Missing response or userId' }, { status: 400 })
    }

    const adminDb = createAdminClient()

    // Get the stored challenge
    const { data: challengeRecord } = await adminDb
      .from('webauthn_challenges')
      .select('challenge')
      .eq('user_id', userId)
      .eq('type', 'authentication')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (!challengeRecord) {
      return NextResponse.json({ error: 'No pending authentication challenge' }, { status: 400 })
    }

    // Get the credential
    const { data: passkey } = await adminDb
      .from('passkeys')
      .select('*')
      .eq('credential_id', response.id)
      .eq('user_id', userId)
      .single()

    if (!passkey) {
      return NextResponse.json({ error: 'Passkey not found' }, { status: 400 })
    }

    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: challengeRecord.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
      credential: {
        id: passkey.credential_id,
        publicKey: base64ToUint8Array(passkey.public_key),
        counter: passkey.counter,
      },
    })

    if (!verification.verified) {
      return NextResponse.json({ error: 'Verification failed' }, { status: 400 })
    }

    // Update counter and last used
    await adminDb
      .from('passkeys')
      .update({
        counter: verification.authenticationInfo.newCounter,
        last_used_at: new Date().toISOString(),
      })
      .eq('id', passkey.id)

    // Clean up challenge
    await adminDb
      .from('webauthn_challenges')
      .delete()
      .eq('user_id', userId)
      .eq('type', 'authentication')

    // Get user email to generate sign-in link
    const { data: profile } = await adminDb
      .from('profiles')
      .select('email')
      .eq('id', userId)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'User not found' }, { status: 400 })
    }

    // Generate a magic link token for session creation
    const { data: linkData, error: linkError } = await adminDb.auth.admin.generateLink({
      type: 'magiclink',
      email: profile.email,
    })

    if (linkError || !linkData) {
      console.error('Failed to generate sign-in link:', linkError)
      return NextResponse.json({ error: 'Failed to create session' }, { status: 500 })
    }

    // Extract the token hash from the generated link
    const tokenHash = linkData.properties?.hashed_token

    if (!tokenHash) {
      return NextResponse.json({ error: 'Failed to generate token' }, { status: 500 })
    }

    // Update last login
    await adminDb
      .from('profiles')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', userId)

    return NextResponse.json({
      success: true,
      tokenHash,
      email: profile.email,
    })
  } catch (error: any) {
    console.error('Auth verify error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
