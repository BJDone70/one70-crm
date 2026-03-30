// Parse vCard format (commonly used in QR digital business cards)
// Handles vCard 2.1, 3.0, and 4.0

interface ParsedContact {
  first_name: string
  last_name: string
  title: string
  company: string
  email: string
  phone: string
  website: string
  linkedin_url: string
  address: string
}

export function isVCard(text: string): boolean {
  return text.trim().toUpperCase().startsWith('BEGIN:VCARD')
}

export function parseVCard(text: string): ParsedContact {
  const contact: ParsedContact = {
    first_name: '', last_name: '', title: '', company: '',
    email: '', phone: '', website: '', linkedin_url: '', address: '',
  }

  const lines = text.replace(/\r\n /g, '').replace(/\r\n\t/g, '').split(/\r?\n/)

  for (const line of lines) {
    const colonIdx = line.indexOf(':')
    if (colonIdx === -1) continue

    const key = line.substring(0, colonIdx).toUpperCase().split(';')[0]
    const value = line.substring(colonIdx + 1).trim()

    switch (key) {
      case 'N': {
        // N:Last;First;Middle;Prefix;Suffix
        const parts = value.split(';')
        contact.last_name = parts[0] || ''
        contact.first_name = parts[1] || ''
        break
      }
      case 'FN': {
        // Full name fallback if N is not present
        if (!contact.first_name && !contact.last_name) {
          const parts = value.split(' ')
          contact.first_name = parts[0] || ''
          contact.last_name = parts.slice(1).join(' ') || ''
        }
        break
      }
      case 'TITLE':
        contact.title = value
        break
      case 'ORG':
        contact.company = value.split(';')[0]
        break
      case 'EMAIL':
        if (!contact.email) contact.email = value
        break
      case 'TEL':
        if (!contact.phone) contact.phone = value
        break
      case 'URL': {
        if (value.toLowerCase().includes('linkedin')) {
          contact.linkedin_url = value
        } else if (!contact.website) {
          contact.website = value
        }
        break
      }
      case 'ADR': {
        // ADR:;;Street;City;State;Zip;Country
        const parts = value.split(';').filter(Boolean)
        contact.address = parts.join(', ')
        break
      }
    }
  }

  return contact
}
