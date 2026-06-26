import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function POST() {
  const supabase = createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { error } = await supabase
    .from('settings')
    .upsert(
      { owner_id: user.id, ai_processing_notice_acknowledged_at: new Date().toISOString() },
      { onConflict: 'owner_id' }
    )

  if (error) {
    return NextResponse.json({ error: 'Failed to record acknowledgement' }, { status: 500 })
  }

  return new NextResponse(null, { status: 200 })
}
