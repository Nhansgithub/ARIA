import { createServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = createServerClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const ownerName: string | null =
    (user.user_metadata?.full_name as string | undefined) ??
    (user.user_metadata?.name as string | undefined) ??
    null

  try {
    const [{ count: clientCount, error: e1 }, { count: dealCount, error: e2 }] = await Promise.all([
      supabase.from('clients').select('*', { count: 'exact', head: true }).eq('owner_id', user.id),
      supabase.from('deals').select('*', { count: 'exact', head: true }).eq('owner_id', user.id),
    ])

    if (e1 || e2) {
      return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }

    const isFirstRun = (clientCount ?? 0) === 0 && (dealCount ?? 0) === 0
    return NextResponse.json({ isFirstRun, ownerName })
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
