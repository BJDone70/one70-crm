'use client'

import { UserPlus } from 'lucide-react'

interface SaveToPhoneProps {
  firstName: string
  lastName: string
  email?: string | null
  phone?: string | null
  title?: string | null
  company?: string | null
  linkedinUrl?: string | null
}

export default function SaveToPhone({ firstName, lastName, email, phone, title, company, linkedinUrl }: SaveToPhoneProps) {
  function handleSave() {
    const lines: string[] = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      `N:${lastName};${firstName};;;`,
      `FN:${firstName} ${lastName}`,
    ]

    if (company) lines.push(`ORG:${company}`)
    if (title) lines.push(`TITLE:${title}`)
    if (phone) lines.push(`TEL;TYPE=WORK,VOICE:${phone}`)
    if (email) lines.push(`EMAIL;TYPE=WORK:${email}`)
    if (linkedinUrl) lines.push(`URL:${linkedinUrl}`)
    lines.push(`NOTE:Added from ONE70 Group CRM`)
    lines.push('END:VCARD')

    const vcf = lines.join('\r\n')
    const blob = new Blob([vcf], { type: 'text/vcard;charset=utf-8' })
    const url = URL.createObjectURL(blob)

    const link = document.createElement('a')
    link.href = url
    link.download = `${firstName}_${lastName}.vcf`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <button onClick={handleSave}
      className="flex items-center gap-1.5 px-3 py-1.5 border border-one70-border rounded-md text-xs font-medium text-one70-dark hover:bg-one70-gray transition-colors">
      <UserPlus size={14} /> Save to Phone
    </button>
  )
}
