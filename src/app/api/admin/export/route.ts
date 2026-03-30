import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// Sanitize CSV values to prevent formula injection
function sanitizeCsvValue(val: any): string {
  if (val === null || val === undefined) return ''
  const str = typeof val === 'object' ? JSON.stringify(val) : String(val)
  // If value starts with =, +, -, or @, prefix with single quote to prevent formula evaluation
  if (/^[=+\-@]/.test(str)) {
    return `'${str}`
  }
  return str
}

const TABLES = [
  'organizations',
  'contacts',
  'properties',
  'deals',
  'tasks',
  'activities',
  'key_notes',
  'projects',
  'sequences',
  'sequence_steps',
  'sequence_enrollments',
  'workflows',
  'workflow_actions',
  'workflow_log',
  'territories',
  'documents',
  'feedback',
  'profiles',
]

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Admin only
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Admin access required' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const format = searchParams.get('format') || 'json'

  const exportData: Record<string, any[]> = {}
  const errors: string[] = []

  for (const table of TABLES) {
    try {
      const { data, error } = await supabase.from(table).select('*')
      if (error) {
        errors.push(`${table}: ${error.message}`)
        exportData[table] = []
      } else {
        exportData[table] = data || []
      }
    } catch (err: any) {
      errors.push(`${table}: ${err.message}`)
      exportData[table] = []
    }
  }

  const timestamp = new Date().toISOString().split('T')[0]
  const summary = {
    exported_at: new Date().toISOString(),
    exported_by: user.email,
    tables: Object.entries(exportData).map(([table, rows]) => ({ table, rows: rows.length })),
    total_records: Object.values(exportData).reduce((s, rows) => s + rows.length, 0),
    errors: errors.length > 0 ? errors : undefined,
  }

  if (format === 'csv') {
    // Generate CSV zip-like format (one big CSV-friendly JSON)
    const csvSections: string[] = []
    for (const [table, rows] of Object.entries(exportData)) {
      if (rows.length === 0) continue
      const headers = Object.keys(rows[0])
      const csvRows = rows.map(row =>
        headers.map(h => {
          const sanitized = sanitizeCsvValue(row[h])
          // Quote values that contain special characters
          return sanitized.includes(',') || sanitized.includes('"') || sanitized.includes('\n')
            ? `"${sanitized.replace(/"/g, '""')}"`
            : sanitized
        }).join(',')
      )
      csvSections.push(`\n=== ${table.toUpperCase()} (${rows.length} rows) ===\n${headers.join(',')}\n${csvRows.join('\n')}`)
    }

    const csvContent = `ONE70 CRM Data Export — ${timestamp}\nExported by: ${user.email}\nTotal records: ${summary.total_records}\n${csvSections.join('\n')}`

    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="one70-crm-export-${timestamp}.csv"`,
      },
    })
  }

  // Default: JSON
  const jsonContent = JSON.stringify({ _summary: summary, ...exportData }, null, 2)

  return new NextResponse(jsonContent, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="one70-crm-backup-${timestamp}.json"`,
    },
  })
}
