import { NextResponse } from 'next/server'
import { generateRegistrationOptions } from '@simplewebauthn/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { rpName, rpID } from '@/lib/webauthn'

export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Get existing passkeys for this user
    const adminDb = createAdminClient()
    const { data: existingKeys } = await adminDb
      .from('passkeys')
      .select('credential_id')
      .eq('user_id', user.id)

    const { data: profile } = await adminDb
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single()

    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userID: new TextEncoder().encode(user.id),
      userName: user.email || user.id,
      userDisplayName: profile?.full_name || user.email || 'User',
      authenticatorSelection: {
        authenticatorAttachment: 'platform', // Face ID, Touch ID, fingerprint
        userVerification: 'required',
        residentKey: 'preferred',
      },
      excludeCredentials: (existingKeys || []).map(k => ({
        id: k.credential_id,
      })),
    })

    // Store challenge
    await adminDb.from('webauthn_challenges').insert({
      user_id: user.id,
      challenge: options.challenge,
      type: 'registration',
    })

    // Cleanup old challenges
    try { await adminDb.rpc('cleanup_expired_challenges') } catch {}

    return NextResponse.json(options)
  } catch (error: any) {
    console.error('Registration options error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
