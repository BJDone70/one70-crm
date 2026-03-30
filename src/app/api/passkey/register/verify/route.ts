import { NextResponse } from 'next/server'
import { verifyRegistrationResponse } from '@simplewebauthn/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { rpID, origin } from '@/lib/webauthn'

function uint8ArrayToBase64(arr: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < arr.length; i++) {
    binary += String.fromCharCode(arr[i])
  }
  return btoa(binary)
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const body = await request.json()
    const adminDb = createAdminClient()

    // Get the stored challenge
    const { data: challengeRecord } = await adminDb
      .from('webauthn_challenges')
      .select('challenge')
      .eq('user_id', user.id)
      .eq('type', 'registration')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (!challengeRecord) {
      return NextResponse.json({ error: 'No pending registration challenge' }, { status: 400 })
    }

    const verification = await verifyRegistrationResponse({
      response: body,
      expectedChallenge: challengeRecord.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
    })

    if (!verification.verified || !verification.registrationInfo) {
      return NextResponse.json({ error: 'Verification failed' }, { status: 400 })
    }

    const { credential } = verification.registrationInfo

    // Store the passkey
    await adminDb.from('passkeys').insert({
      user_id: user.id,
      credential_id: credential.id,
      public_key: uint8ArrayToBase64(credential.publicKey),
      counter: credential.counter,
      transports: body.response?.transports || [],
      device_name: body.deviceName || 'This device',
    })

    // Clean up the challenge
    await adminDb
      .from('webauthn_challenges')
      .delete()
      .eq('user_id', user.id)
      .eq('type', 'registration')

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Registration verify error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
