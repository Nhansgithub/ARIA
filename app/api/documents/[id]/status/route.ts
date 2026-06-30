import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { updateDocumentStatus, getDocument } from '@/lib/crm/documentService'
import type { DocumentStatus } from '@/lib/crm/documentService'

// Server-side legal transition guard — mirrors client-side STATUS_TRANSITIONS
const STATUS_TRANSITIONS: Record<DocumentStatus, DocumentStatus[]> = {
  draft: ['review', 'archived'],
  review: ['sent', 'archived'],
  sent: ['signed', 'archived'],
  signed: ['archived'],
  archived: [],
}

const VALID_STATUSES = new Set<DocumentStatus>(['draft', 'review', 'sent', 'signed', 'archived'])

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }

  const body = (await req.json()) as { status: DocumentStatus }
  const { status } = body

  if (!status || !VALID_STATUSES.has(status)) {
    return new Response(JSON.stringify({ error: 'Invalid status value' }), { status: 400 })
  }

  // Fetch current status to enforce legal transitions server-side
  const current = await getDocument(user.id, { id: params.id })
  if (!current) {
    return new Response(JSON.stringify({ error: 'Document not found' }), { status: 404 })
  }

  const allowed = STATUS_TRANSITIONS[current.status]
  if (!allowed.includes(status)) {
    return new Response(
      JSON.stringify({
        error: `Transition from '${current.status}' to '${status}' is not allowed`,
      }),
      { status: 422 }
    )
  }

  const result = await updateDocumentStatus(user.id, {
    id: params.id,
    status,
    actor: 'user',
  })

  return new Response(JSON.stringify(result), {
    headers: { 'Content-Type': 'application/json' },
  })
}
