import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { deleteDeal } from '@/services/deleteService'

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const dealId = params.id

  // Explicit ownership check — RLS enforces this too, but we return 403 rather than
  // exposing an opaque DB error to the caller (AD-13)
  const { data: deal } = await supabase
    .from('deals')
    .select('id')
    .eq('id', dealId)
    .eq('owner_id', user.id)
    .single()

  if (!deal) {
    return NextResponse.json({ error: 'Not found or access denied' }, { status: 403 })
  }

  try {
    await deleteDeal(user.id, dealId)
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    console.error('[DELETE /api/deals/:id]', err)
    return NextResponse.json({ error: 'Failed to delete deal' }, { status: 500 })
  }
}
