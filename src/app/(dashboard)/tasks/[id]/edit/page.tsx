import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import TaskForm from '@/components/task-form'

export default async function TaskEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: task } = await supabase
    .from('tasks')
    .select('*')
    .eq('id', id)
    .single()

  if (!task) notFound()

  return (
    <div>
      <Link href={`/tasks/${id}`} className="flex items-center gap-1 text-sm text-one70-mid hover:text-one70-dark mb-4">
        <ArrowLeft size={16} /> Back to Task
      </Link>
      <h1 className="text-2xl font-bold text-one70-black mb-6">Edit Task</h1>
      <TaskForm mode="edit" initialData={task} />
    </div>
  )
}
