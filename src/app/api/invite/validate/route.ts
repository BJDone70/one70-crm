import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.json({ valid: false, error: 'No token provided' })
    }

    const supabase = createAdminClient()

    const { data: invite, error } = await supabase
      .from('user_invites')
      .select('email, role, expires_at, status')
      .eq('token', token)
      .eq('status', 'pending')
      .single()

    if (error || !invite) {
      return NextResponse.json({ valid: false, error: 'Invalid or expired invitation' })
    }

    if (new Date(invite.expires_at) < new Date()) {
      // Mark as expired
      await supabase
        .from('user_invites')
        .update({ status: 'expired' })
        .eq('token', token)

      return NextResponse.json({ valid: false, error: 'This invitation has expired' })
    }

    return NextResponse.json({
      valid: true,
      email: invite.email,
      role: invite.role,
    })
  } catch (error: any) {
    return NextResponse.json({ valid: false, error: 'Could not validate invitation' })
  }
}
