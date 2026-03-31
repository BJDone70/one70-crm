'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { FolderKanban, ArrowRight, Hammer } from 'lucide-react'

export default function ConvertToProject({ dealId, existingProject, buildProjectExists }: {
  dealId: string
  existingProject: { id: string; name: string; status: string } | null
  buildProjectExists?: boolean
}) {
  const [converting, setConverting] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  if (existingProject) {
    return (
      <div className="space-y-1.5">
        <div className="flex items-center gap-3">
          <FolderKanban size={16} className="text-green-600" />
          <span className="text-sm text-gray-600">Project created:</span>
          <Link href={`/projects/${existingProject.id}`}
            className="text-sm font-medium text-blue-600 hover:underline flex items-center gap-1">
            {existingProject.name} <ArrowRight size={14} />
          </Link>
        </div>
        {buildProjectExists && (
          <div className="flex items-center gap-2 ml-7">
            <Hammer size={13} className="text-orange-500" />
            <span className="text-xs text-orange-600 font-medium">Build project synced</span>
          </div>
        )}
      </div>
    )
  }

  async function handleConvert() {
    setConverting(true)
    setError('')
    try {
      const res = await fetch('/api/projects/convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deal_id: dealId }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.project_id) {
          router.push(`/projects/${data.project_id}`)
          return
        }
        throw new Error(data.error || 'Failed to convert')
      }
      router.push(`/projects/${data.project_id}`)
    } catch (err: any) {
      setError(err.message)
      setConverting(false)
    }
  }

  return (
    <div>
      <button onClick={handleConvert} disabled={converting}
        className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-md text-sm font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors">
        <FolderKanban size={16} /> {converting ? 'Converting...' : 'Convert to Project'}
      </button>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  )
}
