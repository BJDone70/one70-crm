import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import SequenceEditor from './sequence-editor'

export default async function SequenceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: sequence } = await supabase
    .from('sequences')
    .select('*')
    .eq('id', id)
    .single()

  if (!sequence) notFound()

  const { data: steps } = await supabase
    .from('sequence_steps')
    .select('*')
    .eq('sequence_id', id)
    .order('step_number')

  const { data: enrollments } = await supabase
    .from('sequence_enrollments')
    .select('*, contacts(id, first_name, last_name, email, org_id, organizations:org_id(name))')
    .eq('sequence_id', id)
    .order('created_at', { ascending: false })
    .limit(50)

  const { data: reps } = await supabase.from('profiles').select('id, full_name').eq('is_active', true)
  const nameMap = Object.fromEntries((reps || []).map(r => [r.id, r.full_name]))

  return (
    <div>
      <Link href="/sequences" className="flex items-center gap-1 text-sm text-one70-mid hover:text-one70-dark mb-4">
        <ArrowLeft size={16} /> Back to Sequences
      </Link>
      <SequenceEditor
        sequence={sequence}
        steps={steps || []}
        enrollments={enrollments || []}
        nameMap={nameMap}
      />
    </div>
  )
}
