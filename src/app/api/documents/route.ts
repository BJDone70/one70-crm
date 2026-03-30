import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import { rateLimitByIp } from '@/lib/rate-limit'
import { apiError } from '@/lib/api-error'

export async function POST(request: Request) {
  try {
    const headerList = await headers()
    const ip = headerList.get('x-forwarded-for')?.split(',')[0] || 'unknown'
    const { allowed } = rateLimitByIp(ip, 20, 60_000)
    if (!allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const formData = await request.formData()
    const file = formData.get('file') as File
    const recordType = formData.get('record_type') as string
    const recordId = formData.get('record_id') as string

    if (!file || !recordType || !recordId) {
      return NextResponse.json({ error: 'File, record_type, and record_id are required' }, { status: 400 })
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large. Maximum 10MB.' }, { status: 400 })
    }

    // Validate MIME type — allow common business document and image types
    const ALLOWED_MIME_TYPES = new Set([
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain', 'text/csv',
      'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
    ])
    if (file.type && !ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json({ error: `File type "${file.type}" is not allowed.` }, { status: 400 })
    }

    // Upload to Supabase Storage
    const ext = file.name.split('.').pop() || 'bin'
    const path = `${recordType}/${recordId}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('documents')
      .upload(path, file, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 })
    }

    // Get the URL
    const { data: urlData } = supabase.storage.from('documents').getPublicUrl(path)

    // Create document record
    const { data: doc, error: dbError } = await supabase.from('documents').insert({
      name: file.name,
      file_url: path, // Store the path, not the full URL
      file_size: file.size,
      mime_type: file.type,
      record_type: recordType,
      record_id: recordId,
      uploaded_by: user.id,
    }).select().single()

    if (dbError) {
      // Clean up the uploaded file if db insert fails
      await supabase.storage.from('documents').remove([path])
      return NextResponse.json({ error: dbError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, document: doc })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { documentId } = await request.json()
    if (!documentId) return NextResponse.json({ error: 'Document ID required' }, { status: 400 })

    // Get the document
    const { data: doc } = await supabase.from('documents').select('*').eq('id', documentId).single()
    if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 })

    // Verify ownership
    if (doc.uploaded_by !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Delete from storage
    await supabase.storage.from('documents').remove([doc.file_url])

    // Delete the record
    await supabase.from('documents').delete().eq('id', documentId)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
