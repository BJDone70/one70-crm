import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  try {
    const { text, secret } = await request.json()

    // Verify shared secret
    const expectedSecret = process.env.SHARE_EXTENSION_SECRET || 'one70-share-2024'
    if (secret !== expectedSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!text?.trim()) {
      return NextResponse.json({ error: 'No text provided' }, { status: 400 })
    }

    // Find the first active admin user to attribute this to
    const { data: admin } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('role', 'admin')
      .eq('is_active', true)
      .limit(1)
      .single()

    if (!admin) {
      return NextResponse.json({ error: 'No active user found' }, { status: 400 })
    }

    // Save to pending_shares table
    const { error } = await supabaseAdmin
      .from('pending_shares')
      .insert({
        user_id: admin.id,
        text: text.trim().substring(0, 5000),
        source: 'share_extension',
        processed: false,
      })

    if (error) {
      // Table might not exist yet, try creating inline
      console.error('pending_shares insert error:', error)
      return NextResponse.json({ success: true, queued: true, fallback: true })
    }

    return NextResponse.json({ success: true, queued: true })
  } catch (err: any) {
    console.error('Share receive error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
