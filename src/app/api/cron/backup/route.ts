export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const resend = new Resend(process.env.RESEND_API_KEY)
const ADMIN_EMAIL = process.env.FEEDBACK_EMAIL || process.env.FROM_EMAIL?.match(/<(.+)>/)?.[1]

const TABLES = [
  'organizations', 'contacts', 'properties', 'deals', 'tasks',
  'activities', 'key_notes', 'projects', 'sequences', 'sequence_steps',
  'sequence_enrollments', 'workflows', 'workflow_actions', 'territories',
  'documents', 'feedback', 'profiles',
]

const BUCKET = 'backups'
const MAX_BACKUPS = 8 // Keep last 8 weekly backups (2 months)

export async function GET(request: Request) {
  // Verify this is from Vercel Cron or has the secret
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startTime = Date.now()
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')
  const filename = `backup-${timestamp[0]}-${timestamp[1].substring(0, 8)}.json`

  try {
    // Ensure bucket exists
    const { data: buckets } = await supabaseAdmin.storage.listBuckets()
    if (!buckets?.find(b => b.name === BUCKET)) {
      await supabaseAdmin.storage.createBucket(BUCKET, { public: false })
    }

    // Export all tables
    const exportData: Record<string, any[]> = {}
    const errors: string[] = []
    let totalRecords = 0

    for (const table of TABLES) {
      try {
        const { data, error } = await supabaseAdmin.from(table).select('*')
        if (error) {
          errors.push(`${table}: ${error.message}`)
          exportData[table] = []
        } else {
          exportData[table] = data || []
          totalRecords += (data || []).length
        }
      } catch (err: any) {
        errors.push(`${table}: ${err.message}`)
        exportData[table] = []
      }
    }

    const summary = {
      exported_at: new Date().toISOString(),
      type: 'automated_weekly',
      filename,
      tables: Object.entries(exportData).map(([table, rows]) => ({ table, rows: rows.length })),
      total_records: totalRecords,
      errors: errors.length > 0 ? errors : undefined,
      duration_ms: Date.now() - startTime,
    }

    const jsonContent = JSON.stringify({ _summary: summary, ...exportData })

    // Upload to Supabase Storage
    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(filename, jsonContent, {
        contentType: 'application/json',
        upsert: true,
      })

    if (uploadError) {
      console.error('Backup upload failed:', uploadError)
      return NextResponse.json({ error: 'Upload failed', details: uploadError.message }, { status: 500 })
    }

    // Clean up old backups — keep only the latest MAX_BACKUPS
    try {
      const { data: files } = await supabaseAdmin.storage.from(BUCKET).list('', {
        sortBy: { column: 'created_at', order: 'desc' },
      })
      if (files && files.length > MAX_BACKUPS) {
        const toDelete = files.slice(MAX_BACKUPS).map(f => f.name)
        await supabaseAdmin.storage.from(BUCKET).remove(toDelete)
      }
    } catch {} // Don't fail the backup if cleanup fails

    // Send confirmation email
    if (!ADMIN_EMAIL) {
      console.error('Backup: ADMIN_EMAIL not configured, skipping email notification')
    } else {
      try {
        const tableRows = summary.tables
          .filter(t => t.rows > 0)
          .map(t => `<tr><td style="padding:4px 12px;border-bottom:1px solid #eee">${t.table}</td><td style="padding:4px 12px;border-bottom:1px solid #eee;text-align:right">${t.rows}</td></tr>`)
          .join('')

        await resend.emails.send({
          from: process.env.FROM_EMAIL || 'ONE70 CRM <onboarding@resend.dev>',
          to: ADMIN_EMAIL,
        subject: `[ONE70 CRM] Weekly Backup Complete — ${totalRecords} records`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:600px">
            <h2 style="color:#1A1A1A;margin-bottom:4px">Weekly CRM Backup</h2>
            <p style="color:#666;margin-top:0">${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p>
            <hr style="border:1px solid #E5E5E5">
            <p><strong>${totalRecords}</strong> records backed up across <strong>${summary.tables.filter(t => t.rows > 0).length}</strong> tables in ${summary.duration_ms}ms.</p>
            <table style="border-collapse:collapse;width:100%">
              <tr style="background:#1A1A1A;color:#fff"><th style="padding:6px 12px;text-align:left">Table</th><th style="padding:6px 12px;text-align:right">Records</th></tr>
              ${tableRows}
            </table>
            <p style="color:#999;font-size:12px;margin-top:16px">File: ${filename}<br>Stored in Supabase Storage (backups bucket). Last 8 backups retained.</p>
            ${errors.length > 0 ? `<p style="color:red;font-size:12px">Errors: ${errors.join(', ')}</p>` : ''}
            <p style="color:#999;font-size:12px">You can also download backups manually from CRM → Settings → Data & Backups.</p>
          </div>
        `,
        })
      } catch (emailErr) {
        console.error('Backup email failed:', emailErr)
      }
    }

    return NextResponse.json({
      success: true,
      filename,
      total_records: totalRecords,
      duration_ms: Date.now() - startTime,
    })
  } catch (err: any) {
    console.error('Backup failed:', err)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}
