import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { listDocumentVersions } from '@/lib/crm/documentService'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }

  const versions = await listDocumentVersions(user.id, params.id)

  return new Response(JSON.stringify(versions), {
    headers: { 'Content-Type': 'application/json' },
  })
}
