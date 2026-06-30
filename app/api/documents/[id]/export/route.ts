import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getDocument } from '@/lib/crm/documentService'
import { logActivity } from '@/lib/crm/activityLogService'
import { generatePdf } from '@/lib/pdf/generatePdf'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  // 1. Auth
  const supabase = createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })

  // 2. Fetch document (owner-scoped, AD-2)
  const doc = await getDocument(user.id, { id: params.id })
  if (!doc) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 })

  // 3. Generate PDF — wrapped to return a JSON error shape on failure
  let pdfBuffer: Buffer
  try {
    pdfBuffer = await generatePdf(doc.content_md ?? '', {
      title: doc.title,
      type: doc.type,
      version: doc.version,
      ownerName: user.email ?? undefined,
    })
  } catch (err) {
    console.error('[export] PDF generation failed', err)
    return new Response(JSON.stringify({ error: 'PDF generation failed' }), { status: 500 })
  }

  // 4. Upload to Supabase Storage — owner-scoped path
  const storagePath = `${user.id}/documents/${params.id}_v${doc.version}.pdf`
  const { error: uploadError } = await supabase.storage
    .from('documents')
    .upload(storagePath, new Uint8Array(pdfBuffer), {
      contentType: 'application/pdf',
      upsert: true,
    })

  if (uploadError) {
    return new Response(JSON.stringify({ error: 'PDF upload failed' }), { status: 500 })
  }

  // 5. Update file_url on the documents row (direct update — check result for silent failures)
  const { error: updateError } = await supabase
    .from('documents')
    .update({ file_url: storagePath, updated_at: new Date().toISOString() })
    .eq('id', params.id)
    .eq('owner_id', user.id)

  if (updateError) {
    console.error('[export] file_url update failed', updateError.message)
    return new Response(JSON.stringify({ error: 'DB update failed' }), { status: 500 })
  }

  // 6. Log activity (AD-14 append-only)
  await logActivity(user.id, {
    entity_type: 'document',
    entity_id: params.id,
    action: 'pdf_exported',
    actor: 'user',
    payload: { version: doc.version, file_url: storagePath },
  })

  // 7. Return PDF as download — sanitize title to prevent Content-Disposition header injection
  const safeFilename = doc.title.replace(/["\\\r\n]/g, '_') + '.pdf'
  return new Response(new Uint8Array(pdfBuffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${safeFilename}"; filename*=UTF-8''${encodeURIComponent(safeFilename)}`,
    },
  })
}
