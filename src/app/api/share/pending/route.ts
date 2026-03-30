import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: shares } = await supabase
    .from('pending_shares')
    .select('id, text, source, created_at')
    .eq('user_id', user.id)
    .eq('processed', false)
    .order('created_at', { ascending: false })
    .limit(10)

  return NextResponse.json({ shares: shares || [] })
}

export async function PUT(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await request.json()
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  await supabase
    .from('pending_shares')
    .update({ processed: true })
    .eq('id', id)
    .eq('user_id', user.id)

  return NextResponse.json({ success: true })
}
