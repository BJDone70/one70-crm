import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const { inviteId } = await request.json()
    if (!inviteId) return NextResponse.json({ error: 'Invite ID required' }, { status: 400 })

    const adminDb = createAdminClient()
    const { error } = await adminDb
      .from('user_invites')
      .update({ status: 'expired' })
      .eq('id', inviteId)
      .eq('status', 'pending')

    if (error) return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}
