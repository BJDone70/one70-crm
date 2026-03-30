import OrgForm from '@/components/org-form'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default function NewOrganizationPage() {
  return (
    <div>
      <Link href="/organizations" className="flex items-center gap-1 text-sm text-one70-mid hover:text-one70-dark mb-4">
        <ArrowLeft size={16} /> Back to Organizations
      </Link>
      <h1 className="text-2xl font-bold text-one70-black mb-6">New Organization</h1>
      <OrgForm mode="create" />
    </div>
  )
}
