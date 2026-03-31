import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { rateLimitByIp } from '@/lib/rate-limit'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    // Auth check
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Rate limit: 10 per minute
    const headerList = await headers()
    const ip = headerList.get('x-forwarded-for')?.split(',')[0] || 'unknown'
    const { allowed } = rateLimitByIp(ip, 10, 60_000)
    if (!allowed) {
      return NextResponse.json({ error: 'Too many requests. Try again in a moment.' }, { status: 429 })
    }

    const { url } = await request.json()
    if (!url) {
      return NextResponse.json({ error: 'No URL provided' }, { status: 400 })
    }

    const anthropicKey = process.env.ANTHROPIC_API_KEY
    if (!anthropicKey) {
      return NextResponse.json({ error: 'Contact extraction is not configured. Add ANTHROPIC_API_KEY.' }, { status: 500 })
    }

    // Fetch the page content
    let pageContent = ''
    try {
      const pageRes = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; ONE70CRM/1.0)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(10000),
      })

      if (!pageRes.ok) {
        return NextResponse.json({ error: `Could not fetch the page (${pageRes.status})` }, { status: 422 })
      }

      const html = await pageRes.text()
      // Strip HTML to reduce token usage — keep text and meta tags
      pageContent = html
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 8000) // Limit to ~8k chars
    } catch (fetchErr: any) {
      return NextResponse.json({ error: 'Could not load the digital business card page' }, { status: 422 })
    }

    if (!pageContent || pageContent.length < 20) {
      return NextResponse.json({ error: 'Page appears empty or inaccessible' }, { status: 422 })
    }

    // Send to Claude to extract contact info
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [
          {
            role: 'user',
            content: `Extract contact information from this digital business card page content. This came from a QR code scan. The original URL was: ${url}

Page content:
${pageContent}

Return ONLY valid JSON with no other text, using this exact structure:
{
  "first_name": "",
  "last_name": "",
  "title": "",
  "company": "",
  "email": "",
  "phone": "",
  "website": "",
  "linkedin_url": "",
  "address": ""
}
Leave any field as empty string if not found. For phone, include the full number with area code. For LinkedIn, include the full URL if visible. If the URL itself is a LinkedIn profile, put it in linkedin_url.`,
          },
        ],
      }),
    })

    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to process page' }, { status: 500 })
    }

    const data = await response.json()
    const text = data.content?.[0]?.text || ''

    try {
      const cleaned = text.replace(/```json\n?|```\n?/g, '').trim()
      const contact = JSON.parse(cleaned)
      return NextResponse.json({ success: true, contact })
    } catch {
      return NextResponse.json({ error: 'Could not extract contact information from this page' }, { status: 422 })
    }
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to process QR code' }, { status: 500 })
  }
}
