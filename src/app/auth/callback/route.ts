import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { apiError } from '@/lib/api-error'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type')
  let next = searchParams.get('next') ?? '/'

  // Validate the next parameter: only allow relative paths starting with /
  // Reject external URLs and suspicious values
  if (next && (next.startsWith('http://') || next.startsWith('https://') || next.startsWith('//'))) {
    next = '/'
  }

  const supabase = await createClient()

  // PKCE flow — exchange code for session
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // Token hash flow (password reset, email verification)
  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash, type: type as any })
    if (!error) {
      if (type === 'recovery') {
        return NextResponse.redirect(`${origin}/auth/reset-password`)
      }
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`)
}
