'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import TaskForm from '@/components/task-form'

export default function NewTaskPage() {
  const params = useSearchParams()
  const parentId = params.get('parent') || undefined
  const defaults: any = {}
  if (params.get('contact_id')) defaults.contact_id = params.get('contact_id')
  if (params.get('org_id')) defaults.org_id = params.get('org_id')
  if (params.get('deal_id')) defaults.deal_id = params.get('deal_id')

  return (
    <div>
      <Link href={parentId ? `/tasks/${parentId}` : '/tasks'} className="flex items-center gap-1 text-sm text-one70-mid hover:text-one70-dark mb-4">
        <ArrowLeft size={16} /> {parentId ? 'Back to Parent Task' : 'Back to Tasks'}
      </Link>
      <h1 className="text-2xl font-bold text-one70-black mb-6">{parentId ? 'New Sub-task' : 'New Task'}</h1>
      <TaskForm mode="create" initialData={Object.keys(defaults).length > 0 ? defaults : undefined} parentTaskId={parentId} />
    </div>
  )
}
