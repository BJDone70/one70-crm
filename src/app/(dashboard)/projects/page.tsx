import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus, FolderKanban } from 'lucide-react'
import ProjectsView from './projects-view'

export default async function ProjectsPage() {
  const supabase = await createClient()

  const { data: projects } = await supabase
    .from('projects')
    .select('*, organizations(id, name), properties(id, name), contacts(id, first_name, last_name), territories(name, color)')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  const { data: reps } = await supabase.from('profiles').select('id, full_name').eq('is_active', true)
  const nameMap = Object.fromEntries((reps || []).map(r => [r.id, r.full_name]))

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-one70-black">Projects</h1>
          <p className="text-one70-mid text-sm mt-1">Active and completed construction projects</p>
        </div>
        <Link href="/projects/new"
          className="flex items-center gap-2 bg-one70-black text-white px-4 py-2.5 rounded-md text-sm font-semibold hover:bg-one70-dark transition-colors">
          <Plus size={16} /> New Project
        </Link>
      </div>
      <ProjectsView projects={projects || []} nameMap={nameMap} />
    </div>
  )
}
