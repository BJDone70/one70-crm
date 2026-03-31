import { createAdminClient } from '@/lib/supabase/admin'
import { sendWelcomeEmail } from '@/lib/email'
import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { rateLimitByIp } from '@/lib/rate-limit'

export async function POST(request: Request) {
  try {
    // Rate limit: 5 signup attempts per minute per IP
    const headerList = await headers()
    const ip = headerList.get('x-forwarded-for')?.split(',')[0] || 'unknown'
    const { allowed } = rateLimitByIp(ip, 5, 60_000)
    if (!allowed) {
      return NextResponse.json({ error: 'Too many attempts. Try again shortly.' }, { status: 429 })
    }

    const { token, full_name, password } = await request.json()

    if (!token || !full_name || !password) {
      return NextResponse.json({ error: 'Token, name, and password are required' }, { status: 400 })
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Find and validate the invite
    const { data: invite, error: inviteError } = await supabase
      .from('user_invites')
      .select('*')
      .eq('token', token)
      .eq('status', 'pending')
      .single()

    if (inviteError || !invite) {
      return NextResponse.json({ error: 'Invalid or expired invitation' }, { status: 400 })
    }

    // Check if expired
    if (new Date(invite.expires_at) < new Date()) {
      await supabase
        .from('user_invites')
        .update({ status: 'expired' })
        .eq('id', invite.id)

      return NextResponse.json({ error: 'This invitation has expired. Please ask your admin to send a new one.' }, { status: 400 })
    }

    // Create the auth user with admin API
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email: invite.email,
      password: password,
      email_confirm: true, // Skip email verification since they clicked the invite link
      user_metadata: {
        full_name: full_name,
        role: invite.role,
      },
    })

    if (authError) {
      // If user already exists
      if (authError.message.includes('already been registered')) {
        return NextResponse.json({ error: 'An account with this email already exists. Try signing in instead.' }, { status: 400 })
      }
      return NextResponse.json({ error: authError.message }, { status: 500 })
    }

    // Update the profile with the correct role and invite info
    // (the handle_new_user trigger creates the profile, but let's make sure role is set)
    await supabase
      .from('profiles')
      .update({
        full_name: full_name,
        role: invite.role,
        invited_by: invite.invited_by,
        invited_at: invite.created_at,
      })
      .eq('id', authUser.user.id)

    // Mark invite as accepted
    await supabase
      .from('user_invites')
      .update({
        status: 'accepted',
        accepted_at: new Date().toISOString(),
      })
      .eq('id', invite.id)

    // Send welcome email
    const baseUrl = request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'https://crm.one70group.com'
    try {
      await sendWelcomeEmail({
        to: invite.email,
        name: full_name,
        loginUrl: `${baseUrl}/login`,
      })
    } catch (emailError) {
      // Don't fail the whole signup if welcome email fails
      console.error('Failed to send welcome email:', emailError)
    }

    return NextResponse.json({ success: true, message: 'Account created successfully' })
  } catch (error: any) {
    console.error('Accept invite error:', error)
    return NextResponse.json({ error: 'Failed to create account' }, { status: 500 })
  }
}
