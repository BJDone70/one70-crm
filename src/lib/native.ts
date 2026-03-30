// Utility to detect if running inside Capacitor native shell
// and provide native API wrappers that fall back to web APIs

export function isNativeApp(): boolean {
  if (typeof window === 'undefined') return false
  return !!(window as any).Capacitor?.isNativePlatform?.()
}

export function getPlatform(): 'ios' | 'android' | 'web' {
  if (typeof window === 'undefined') return 'web'
  const cap = (window as any).Capacitor
  if (!cap?.isNativePlatform?.()) return 'web'
  return cap.getPlatform?.() || 'web'
}

// Pick a contact from the native contact list (iOS + Android)
export async function pickNativeContact(): Promise<{
  first_name: string; last_name: string; email: string; phone: string
  company: string; title: string
} | null> {
  if (!isNativeApp()) return null

  try {
    const { CapacitorContacts } = await import('@capgo/capacitor-contacts')

    // Request permission first
    const perm = await CapacitorContacts.requestPermissions()
    if (perm.readContacts !== 'granted') return null

    const result = await CapacitorContacts.pickContact({
      fields: ['givenName', 'familyName', 'emailAddresses', 'phoneNumbers', 'organizationName', 'jobTitle'],
    })

    if (!result?.contacts?.length) return null
    const c = result.contacts[0]

    return {
      first_name: c.givenName || '',
      last_name: c.familyName || '',
      email: c.emailAddresses?.[0]?.value || '',
      phone: c.phoneNumbers?.[0]?.value || '',
      company: c.organizationName || '',
      title: c.jobTitle || '',
    }
  } catch (err) {
    console.error('Native contact pick failed:', err)
    return null
  }
}

// Request push notification permission and get token
export async function registerPushNotifications(): Promise<string | null> {
  if (!isNativeApp()) return null

  try {
    const { PushNotifications } = await import('@capacitor/push-notifications')

    const permission = await PushNotifications.requestPermissions()
    if (permission.receive !== 'granted') return null

    await PushNotifications.register()

    return new Promise((resolve) => {
      PushNotifications.addListener('registration', (token) => {
        resolve(token.value)
      })
      PushNotifications.addListener('registrationError', () => {
        resolve(null)
      })
      // Timeout after 10 seconds
      setTimeout(() => resolve(null), 10000)
    })
  } catch {
    return null
  }
}

// Trigger haptic feedback
export async function hapticFeedback(style: 'light' | 'medium' | 'heavy' = 'light') {
  if (!isNativeApp()) return
  try {
    const { Haptics, ImpactStyle } = await import('@capacitor/haptics')
    const map = { light: ImpactStyle.Light, medium: ImpactStyle.Medium, heavy: ImpactStyle.Heavy }
    await Haptics.impact({ style: map[style] })
  } catch {}
}

// Set status bar style
export async function setStatusBar(dark: boolean = true) {
  if (!isNativeApp()) return
  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar')
    await StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light })
    await StatusBar.setBackgroundColor({ color: '#1A1A1A' })
  } catch {}
}

// ---- Face ID / Biometric Authentication ----

const CREDENTIAL_SERVER = 'crm.one70group.com'

// Check if Face ID / biometric is available on this device
export async function isBiometricAvailable(): Promise<{ available: boolean; type: string }> {
  if (!isNativeApp()) return { available: false, type: 'none' }
  try {
    const { NativeBiometric, BiometryType } = await import('@capgo/capacitor-native-biometric')
    const result = await NativeBiometric.isAvailable()
    const typeMap: Record<number, string> = {
      [BiometryType.FACE_ID]: 'Face ID',
      [BiometryType.TOUCH_ID]: 'Touch ID',
      [BiometryType.FINGERPRINT]: 'Fingerprint',
      [BiometryType.FACE_AUTHENTICATION]: 'Face',
      [BiometryType.IRIS_AUTHENTICATION]: 'Iris',
    }
    return {
      available: result.isAvailable,
      type: typeMap[result.biometryType] || 'Biometric',
    }
  } catch {
    return { available: false, type: 'none' }
  }
}

// Prompt Face ID and return true if verified
export async function verifyBiometric(reason?: string): Promise<boolean> {
  if (!isNativeApp()) return false
  try {
    const { NativeBiometric } = await import('@capgo/capacitor-native-biometric')
    await NativeBiometric.verifyIdentity({
      reason: reason || 'Unlock ONE70 CRM',
      title: 'ONE70 CRM',
      subtitle: 'Authenticate to continue',
      useFallback: true,
      maxAttempts: 3,
    })
    return true
  } catch {
    return false
  }
}

// Save login credentials to the secure native keychain (behind Face ID)
export async function saveBiometricCredentials(email: string, password: string): Promise<boolean> {
  if (!isNativeApp()) return false
  try {
    const { NativeBiometric } = await import('@capgo/capacitor-native-biometric')
    await NativeBiometric.setCredentials({
      username: email,
      password: password,
      server: CREDENTIAL_SERVER,
    })
    markBiometricCredentialsSaved()
    return true
  } catch {
    return false
  }
}

// Retrieve stored credentials after Face ID verification
export async function getBiometricCredentials(): Promise<{ email: string; password: string } | null> {
  if (!isNativeApp()) return null
  try {
    const { NativeBiometric } = await import('@capgo/capacitor-native-biometric')
    const credentials = await NativeBiometric.getCredentials({ server: CREDENTIAL_SERVER })
    if (credentials.username && credentials.password) {
      return { email: credentials.username, password: credentials.password }
    }
    return null
  } catch {
    return null
  }
}

// Delete stored biometric credentials
export async function deleteBiometricCredentials(): Promise<void> {
  if (!isNativeApp()) return
  try {
    const { NativeBiometric } = await import('@capgo/capacitor-native-biometric')
    await NativeBiometric.deleteCredentials({ server: CREDENTIAL_SERVER })
  } catch {}
}

// Check if credentials are stored (uses localStorage flag — does NOT prompt Face ID)
export async function hasBiometricCredentials(): Promise<boolean> {
  if (!isNativeApp()) return false
  if (typeof window === 'undefined') return false
  return localStorage.getItem('one70_native_bio_saved') === 'true'
}

// Mark that biometric credentials have been saved (call after saveBiometricCredentials)
export function markBiometricCredentialsSaved() {
  if (typeof window !== 'undefined') {
    localStorage.setItem('one70_native_bio_saved', 'true')
  }
}

// Clear the biometric saved flag (call after deleteBiometricCredentials)
export function clearBiometricCredentialsSaved() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('one70_native_bio_saved')
  }
}
