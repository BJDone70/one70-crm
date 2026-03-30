import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')
  const placeId = searchParams.get('place_id')
  const apiKey = process.env.GOOGLE_PLACES_API_KEY

  if (!apiKey) return NextResponse.json({ error: 'Google Places API not configured' }, { status: 500 })

  // Validate input parameters
  // q: search query validation
  if (q !== null && (!q || q.length < 1 || q.length > 200)) {
    return NextResponse.json({ error: 'Invalid search query' }, { status: 400 })
  }
  // placeId: validate against known pattern (Google place IDs are typically alphanumeric with specific format)
  if (placeId !== null && !/^[a-zA-Z0-9_\-:]+$/.test(placeId)) {
    return NextResponse.json({ error: 'Invalid place ID format' }, { status: 400 })
  }

  try {
    // Place details request
    if (placeId) {
      // NOTE: API key is in URL query string (Google Places API does not support header-based auth)
      // This is safe because this is a server-side API route — the key is never exposed to the browser client
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=address_components,formatted_address&key=${apiKey}`
      )
      const data = await res.json()
      if (data.result) {
        const components = data.result.address_components || []
        const get = (type: string) => components.find((c: any) => c.types.includes(type))?.long_name || ''
        const getShort = (type: string) => components.find((c: any) => c.types.includes(type))?.short_name || ''

        return NextResponse.json({
          structured: {
            address: `${get('street_number')} ${get('route')}`.trim(),
            city: get('locality') || get('sublocality') || get('administrative_area_level_3'),
            state: getShort('administrative_area_level_1'),
            zip: get('postal_code'),
            full: data.result.formatted_address,
          }
        })
      }
      return NextResponse.json({ structured: null })
    }

    // Autocomplete request
    if (!q || q.length < 3) return NextResponse.json({ results: [] })

    // NOTE: API key is in URL query string (Google Places API does not support header-based auth)
    // This is safe because this is a server-side API route — the key is never exposed to the browser client
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(q)}&types=address&components=country:us&key=${apiKey}`
    )
    const data = await res.json()

    const results = (data.predictions || []).map((p: any) => ({
      description: p.description,
      place_id: p.place_id,
    }))

    return NextResponse.json({ results })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
