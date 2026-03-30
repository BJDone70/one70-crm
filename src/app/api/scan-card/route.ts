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

    // Rate limit: 10 scans per minute per IP
    const headerList = await headers()
    const ip = headerList.get('x-forwarded-for')?.split(',')[0] || 'unknown'
    const { allowed, resetIn } = rateLimitByIp(ip, 10, 60_000)
    if (!allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Try again in a moment.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(resetIn / 1000)) } }
      )
    }

    const { image } = await request.json()

    if (!image) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 })
    }

    // Call Claude API to extract contact info from business card
    const anthropicKey = process.env.ANTHROPIC_API_KEY
    if (!anthropicKey) {
      return NextResponse.json({ error: 'Card scanning is not configured. Add ANTHROPIC_API_KEY to environment variables.' }, { status: 500 })
    }

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
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: image.startsWith('/9j/') ? 'image/jpeg' : 'image/png',
                  data: image,
                },
              },
              {
                type: 'text',
                text: `Extract the contact information from this business card image. Return ONLY valid JSON with no other text, using this exact structure:
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
Leave any field as empty string if not found. For phone, include the full number with area code. For LinkedIn, include the full URL if visible.`,
              },
            ],
          },
        ],
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      console.error('Anthropic API error:', err)
      return NextResponse.json({ error: 'Failed to process image' }, { status: 500 })
    }

    const data = await response.json()
    const text = data.content?.[0]?.text || ''

    // Parse the JSON response
    try {
      const cleaned = text.replace(/```json\n?|```\n?/g, '').trim()
      const contact = JSON.parse(cleaned)
      return NextResponse.json({ success: true, contact })
    } catch {
      console.error('Failed to parse Claude response:', text)
      return NextResponse.json({ error: 'Could not read the business card. Try a clearer photo.' }, { status: 422 })
    }
  } catch (error: any) {
    console.error('Scan error:', error)
    return NextResponse.json({ error: error.message || 'Failed to scan card' }, { status: 500 })
  }
}
