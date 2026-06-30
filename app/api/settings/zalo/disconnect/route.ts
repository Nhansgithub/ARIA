import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

// AD-13: owner request path — createServerClient()

export async function POST(): Promise<NextResponse> {
  const supabase = createServerClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date().toISOString()
  const { error } = await supabase
    .from('settings')
    .update({
      zalo_user_id: null,
      zalo_access_token: null,
      encrypted_zalo_refresh_token: null,
      zalo_token_issued_at: null,
      zalo_status: 'not_configured',
      updated_at: now,
    })
    .eq('owner_id', user.id)

  if (error) {
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  return new NextResponse(null, { status: 204 })
}
