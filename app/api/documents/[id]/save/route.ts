import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { saveDocumentVersion } from '@/lib/crm/documentService'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }

  const body = await req.json() as { content_md: string }
  const { content_md } = body

  if (!content_md) {
    return new Response(JSON.stringify({ error: 'content_md is required' }), { status: 400 })
  }

  // created_by is always 'human' for user-initiated saves — never accepted from client
  const newDoc = await saveDocumentVersion(user.id, {
    source_id: params.id,
    content_md,
    created_by: 'human',
  })

  return new Response(JSON.stringify(newDoc), {
    headers: { 'Content-Type': 'application/json' },
  })
}
