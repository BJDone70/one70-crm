'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { isNativeApp } from '@/lib/native'

export default function ShareReceiver() {
  const router = useRouter()

  useEffect(() => {
    if (!isNativeApp()) return

    async function setupShareListener() {
      try {
        const { App } = await import('@capacitor/app')

        App.addListener('appUrlOpen', (data) => {
          if (!data.url) return

          // Handle share extension URL: one70crm://share?t=BASE64TEXT
          if (data.url.startsWith('one70crm://share')) {
            try {
              // Extract query param manually since custom scheme URL parsing can be unreliable
              const tMatch = data.url.match(/[?&]t=([^&]+)/)
              const encoded = tMatch?.[1]
              if (encoded) {
                // Decode URL-safe base64
                const base64 = encoded
                  .replace(/-/g, '+')
                  .replace(/_/g, '/')
                  + '='.repeat((4 - (encoded.length % 4)) % 4)
                const text = atob(base64)

                if (text.trim()) {
                  sessionStorage.setItem('one70_shared_text', text.trim())
                  router.push('/ingest')
                }
              }
            } catch (err) {
              console.error('Failed to parse shared text:', err)
            }
          }

          // Handle direct ingest URL: one70crm://ingest
          if (data.url.startsWith('one70crm://ingest')) {
            router.push('/ingest')
          }
        })
      } catch (err) {
        console.error('Share receiver setup error:', err)
      }
    }

    setupShareListener()
  }, [router])

  return null
}
