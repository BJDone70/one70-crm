import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { apiError } from '@/lib/api-error'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify admin
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Admin access required' }, { status: 403 })

  const { user_id, new_password } = await request.json()
  if (!user_id || !new_password) return NextResponse.json({ error: 'user_id and new_password required' }, { status: 400 })
  if (new_password.length < 6) return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })

  // Prevent admin-on-admin resets
  const { data: targetProfile } = await supabase.from('profiles').select('role').eq('id', user_id).single()
  if (targetProfile?.role === 'admin') return NextResponse.json({ error: 'Cannot reset another admin\'s password' }, { status: 403 })

  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { error } = await admin.auth.admin.updateUserById(user_id, { password: new_password })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
