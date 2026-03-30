// WebAuthn Relying Party configuration
export const rpName = 'ONE70 Group CRM'
export const rpID = process.env.NEXT_PUBLIC_APP_URL
  ? new URL(process.env.NEXT_PUBLIC_APP_URL).hostname
  : 'localhost'
export const origin = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
