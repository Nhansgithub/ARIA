import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getDocument } from '@/lib/crm/documentService'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }

  const doc = await getDocument(user.id, { id: params.id })

  if (!doc) {
    return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 })
  }

  return new Response(JSON.stringify(doc), {
    headers: { 'Content-Type': 'application/json' },
  })
}
