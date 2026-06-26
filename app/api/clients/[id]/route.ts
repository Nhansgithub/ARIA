import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { deleteClient } from '@/services/deleteService'

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const clientId = params.id

  // Explicit ownership check before deletion — RLS enforces this too, but we return 403
  // rather than letting an opaque DB error surface (AD-13)
  const { data: client } = await supabase
    .from('clients')
    .select('id')
    .eq('id', clientId)
    .eq('owner_id', user.id)
    .single()

  if (!client) {
    return NextResponse.json({ error: 'Not found or access denied' }, { status: 403 })
  }

  try {
    await deleteClient(user.id, clientId)
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    console.error('[DELETE /api/clients/:id]', err)
    return NextResponse.json({ error: 'Failed to delete client' }, { status: 500 })
  }
}
