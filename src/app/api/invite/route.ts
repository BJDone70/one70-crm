import { createClient } from '@/lib/supabase/server'
import { sendInviteEmail } from '@/lib/email'
import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { rateLimitByIp } from '@/lib/rate-limit'

export async function POST(request: Request) {
  try {
    const headerList = await headers()
    const ip = headerList.get('x-forwarded-for')?.split(',')[0] || 'unknown'
    const { allowed } = rateLimitByIp(ip, 5, 60_000)
    if (!allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

    const supabase = await createClient()

    // Verify the requester is an admin
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, full_name')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const { email, role } = await request.json()

    if (!email || !role) {
      return NextResponse.json({ error: 'Email and role are required' }, { status: 400 })
    }

    // Check if user already exists
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email)
      .single()

    if (existingProfile) {
      return NextResponse.json({ error: 'A user with this email already exists' }, { status: 400 })
    }

    // Check if there's already a pending invite
    const { data: existingInvite } = await supabase
      .from('user_invites')
      .select('id')
      .eq('email', email)
      .eq('status', 'pending')
      .single()

    if (existingInvite) {
      return NextResponse.json({ error: 'A pending invite already exists for this email' }, { status: 400 })
    }

    // Generate invite token
    const token = crypto.randomUUID()

    // Create invite record
    const { error: insertError } = await supabase.from('user_invites').insert({
      email,
      role,
      invited_by: user.id,
      token,
    })

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    // Build invite URL
    const baseUrl = request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'https://crm.one70group.com'
    const inviteUrl = `${baseUrl}/invite?token=${token}`

    // Send email
    await sendInviteEmail({
      to: email,
      inviterName: profile.full_name,
      role,
      inviteUrl,
    })

    return NextResponse.json({ success: true, message: `Invitation sent to ${email}` })
  } catch (error: any) {
    console.error('Invite error:', error)
    return NextResponse.json({ error: error.message || 'Failed to send invitation' }, { status: 500 })
  }
}
