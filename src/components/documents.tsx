'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Paperclip, Upload, Trash2, Download, FileText, Image, File, Loader2 } from 'lucide-react'

interface Document {
  id: string
  name: string
  file_url: string
  file_size: number
  mime_type: string
  uploaded_by: string
  created_at: string
}

interface DocumentsProps {
  recordType: string
  recordId: string
  documents: Document[]
  uploaderNames?: Map<string, string>
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getFileIcon(mimeType: string) {
  if (mimeType?.startsWith('image/')) return <Image size={16} className="text-blue-500" />
  if (mimeType?.includes('pdf')) return <FileText size={16} className="text-red-500" />
  return <File size={16} className="text-gray-500" />
}

export default function Documents({ recordType, recordId, documents, uploaderNames }: DocumentsProps) {
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()
  const router = useRouter()

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setError('')

    const formData = new FormData()
    formData.append('file', file)
    formData.append('record_type', recordType)
    formData.append('record_id', recordId)

    const res = await fetch('/api/documents', {
      method: 'POST',
      body: formData,
    })

    const data = await res.json()
    if (!res.ok) {
      setError(data.error || 'Upload failed')
    }

    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
    router.refresh()
  }

  async function handleDelete(docId: string) {
    if (!confirm('Delete this file?')) return
    setDeleting(docId)

    await fetch('/api/documents', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documentId: docId }),
    })

    setDeleting(null)
    router.refresh()
  }

  async function handleDownload(doc: Document) {
    const { data } = await supabase.storage.from('documents').createSignedUrl(doc.file_url, 60)
    if (data?.signedUrl) {
      window.open(data.signedUrl, '_blank')
    }
  }

  return (
    <div className="bg-white rounded-lg border border-one70-border p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-one70-mid uppercase tracking-wider flex items-center gap-1">
          <Paperclip size={14} /> Documents ({documents.length})
        </h2>
        <label className="flex items-center gap-1 text-sm font-medium text-one70-black hover:underline cursor-pointer">
          {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
          {uploading ? 'Uploading...' : 'Upload'}
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleUpload}
            className="hidden"
            disabled={uploading}
            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.gif,.webp,.txt,.csv"
          />
        </label>
      </div>

      {error && <div className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded mb-2">{error}</div>}

      {documents.length > 0 ? (
        <div className="space-y-2">
          {documents.map(doc => (
            <div key={doc.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-one70-gray transition-colors group">
              {getFileIcon(doc.mime_type)}
              <div className="flex-1 min-w-0">
                <button onClick={() => handleDownload(doc)} className="text-sm font-medium text-gray-900 hover:underline truncate block text-left w-full">
                  {doc.name}
                </button>
                <p className="text-[10px] text-gray-400">
                  {formatFileSize(doc.file_size)} · {new Date(doc.created_at).toLocaleDateString()}
                  {uploaderNames?.get(doc.uploaded_by) && ` · ${uploaderNames.get(doc.uploaded_by)}`}
                </p>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => handleDownload(doc)} className="p-1 text-gray-400 hover:text-blue-600" title="Download">
                  <Download size={14} />
                </button>
                <button
                  onClick={() => handleDelete(doc.id)}
                  disabled={deleting === doc.id}
                  className="p-1 text-gray-400 hover:text-red-500"
                  title="Delete"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-400 py-3 text-center">No documents attached. Upload proposals, PIP docs, photos, and more.</p>
      )}
    </div>
  )
}
