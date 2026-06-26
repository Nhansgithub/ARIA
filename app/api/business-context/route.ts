import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { updateBusinessContext } from '@/lib/businessContext/updateBusinessContext'

export async function GET() {
  const supabase = createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('settings')
    .select('business_context')
    .eq('owner_id', user.id)
    .single()

  if (error && error.code !== 'PGRST116') {
    console.error('[GET /api/business-context]', error)
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 })
  }

  return NextResponse.json({ businessContext: data?.business_context ?? null })
}

export async function PUT(req: NextRequest) {
  const supabase = createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const content = body.businessContext

  if (typeof content !== 'string') {
    return NextResponse.json({ error: 'businessContext must be a string' }, { status: 400 })
  }
  // Raw input limit — trimming to token budget happens at read time in getBusinessContext
  if (content.length > 20_000) {
    return NextResponse.json(
      { error: 'Business context too long (max 20,000 chars)' },
      { status: 400 }
    )
  }

  try {
    await updateBusinessContext(user.id, content, 'user')
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[PUT /api/business-context]', err)
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 })
  }
}
