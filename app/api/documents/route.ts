import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { listDocuments } from '@/lib/crm/documentService'
import type { DocumentStatus } from '@/lib/crm/documentService'

export async function GET(req: NextRequest) {
  const supabase = createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') as DocumentStatus | null

  const docs = await listDocuments(user.id, {
    status: status ?? undefined,
    limit: 50,
  })

  return new Response(JSON.stringify(docs), {
    headers: { 'Content-Type': 'application/json' },
  })
}
