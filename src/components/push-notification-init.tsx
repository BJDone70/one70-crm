'use client'

import { useEffect } from 'react'
import { isNativeApp, getPlatform } from '@/lib/native'
import { createClient } from '@/lib/supabase/client'

export default function PushNotificationInit() {
  useEffect(() => {
    if (!isNativeApp()) return

    async function registerPush() {
      try {
        const { PushNotifications } = await import('@capacitor/push-notifications')

        // Check current permission
        const perm = await PushNotifications.checkPermissions()
        if (perm.receive === 'denied') return

        // Request permission if not granted
        if (perm.receive !== 'granted') {
          const req = await PushNotifications.requestPermissions()
          if (req.receive !== 'granted') return
        }

        // Register with APNs/FCM
        await PushNotifications.register()

        // Listen for the token
        PushNotifications.addListener('registration', async (token) => {
          try {
            // console.log('Push token received:', token.value.substring(0, 20) + '...')
            
            // Register directly via supabase client (bypasses server auth issues)
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
              console.error('Push registration: no user session')
              return
            }

            const platform = getPlatform()
            const deviceName = getDeviceName()

            // Deactivate this token for any other user
            await supabase
              .from('device_tokens')
              .update({ is_active: false })
              .eq('token', token.value)
              .neq('user_id', user.id)

            // Upsert for current user
            const { error } = await supabase
              .from('device_tokens')
              .upsert({
                user_id: user.id,
                token: token.value,
                platform: platform === 'web' ? 'ios' : platform,
                device_name: deviceName,
                is_active: true,
                updated_at: new Date().toISOString(),
              }, { onConflict: 'user_id,token' })

            if (error) {
              console.error('Push token upsert failed:', error)
              // Try insert as fallback
              const { error: insertErr } = await supabase
                .from('device_tokens')
                .insert({
                  user_id: user.id,
                  token: token.value,
                  platform: platform === 'web' ? 'ios' : platform,
                  device_name: deviceName,
                  is_active: true,
                })
              if (insertErr) console.error('Push token insert also failed:', insertErr)
            } else {
              // console.log('Push token registered successfully')
            }

            // Ensure notification preferences exist
            const { data: prefs } = await supabase
              .from('notification_preferences')
              .select('id')
              .eq('user_id', user.id)
              .single()
            if (!prefs) {
              await supabase.from('notification_preferences').insert({ user_id: user.id })
            }
          } catch (err) {
            console.error('Failed to register push token:', err)
          }
        })

        // Handle registration errors
        PushNotifications.addListener('registrationError', (error) => {
          console.error('Push registration failed:', error)
        })

        // Handle incoming notifications while app is open
        PushNotifications.addListener('pushNotificationReceived', (notification) => {
          // console.log('Push received:', notification)
        })

        // Handle notification tap (app opened from notification)
        PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
          const data = action.notification.data
          if (data?.type === 'task_assigned' || data?.type === 'task_due') {
            window.location.href = '/tasks'
          } else if (data?.type === 'deal_stage' || data?.type === 'deal_won' || data?.type === 'deal_lost') {
            window.location.href = '/deals'
          } else if (data?.type === 'sequence_action_due') {
            window.location.href = '/outreach'
          } else if (data?.type === 'project_status') {
            window.location.href = '/projects'
          }
        })
      } catch (err) {
        console.error('Push notification setup failed:', err)
      }
    }

    // Delay to let login complete first
    const timer = setTimeout(registerPush, 3000)
    return () => clearTimeout(timer)
  }, [])

  return null
}

function getDeviceName(): string {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
  if (/iPhone/.test(ua)) return 'iPhone'
  if (/iPad/.test(ua)) return 'iPad'
  if (/Android/.test(ua)) return 'Android'
  return 'Mobile Device'
}
