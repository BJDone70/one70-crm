import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // If no user and not on a public page, redirect to login
  const isPublicPath = 
    request.nextUrl.pathname.startsWith('/login') || 
    request.nextUrl.pathname.startsWith('/auth') ||
    request.nextUrl.pathname.startsWith('/invite') ||
    request.nextUrl.pathname.startsWith('/api/invite/validate') ||
    request.nextUrl.pathname.startsWith('/api/invite/accept') ||
    request.nextUrl.pathname.startsWith('/api/passkey/authenticate') ||
    request.nextUrl.pathname.startsWith('/api/cron') ||
    request.nextUrl.pathname.startsWith('/api/m365/callback') ||
    request.nextUrl.pathname.startsWith('/teams/config')

  if (!user && !isPublicPath) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // If user is on login page, redirect to dashboard
  if (user && request.nextUrl.pathname.startsWith('/login')) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  // Allow Microsoft Teams to embed the CRM in an iframe
  const isTeamsRequest = request.nextUrl.searchParams.get('teams') === '1' ||
    request.nextUrl.pathname.startsWith('/teams/')
  
  if (isTeamsRequest) {
    supabaseResponse.headers.set(
      'Content-Security-Policy',
      "frame-ancestors 'self' https://teams.microsoft.com https://*.teams.microsoft.com https://*.skype.com https://teams.live.com https://*.teams.live.com https://*.office.com https://*.microsoft.com"
    )
    supabaseResponse.headers.delete('X-Frame-Options')
  } else {
    // Block framing on non-Teams pages
    supabaseResponse.headers.set('X-Frame-Options', 'DENY')
  }

  // Security headers on all responses
  supabaseResponse.headers.set('X-Content-Type-Options', 'nosniff')
  supabaseResponse.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  supabaseResponse.headers.set('X-DNS-Prefetch-Control', 'on')
  supabaseResponse.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  supabaseResponse.headers.set('Permissions-Policy', 'camera=(self), microphone=(), geolocation=()')

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
