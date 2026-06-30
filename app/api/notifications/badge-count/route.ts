import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

// AD-13: owner-data route — createServerClient() only
// Returns count of unaddressed high-urgency items: unseen high-flag briefing items + pending high-priority check-ins

function todayUtc(): string {
  return new Date().toISOString().split('T')[0]!
}

export async function GET(): Promise<NextResponse> {
  const supabase = createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 1. Unseen high-urgency briefing flags for today
  const { data: briefing } = await supabase
    .from('briefings')
    .select('flags, seen_at')
    .eq('owner_id', user.id)
    .eq('date', todayUtc())
    .maybeSingle()

  const highFlagCount =
    // P2-2 fix: use == null (covers both null and undefined)
    briefing && briefing.seen_at == null
      ? ((briefing.flags as { items?: Array<{ severity: string }> } | null)?.items ?? []).filter(
          (f) => f.severity === 'high'
        ).length
      : 0

  // 2. Pending check-ins for high-priority deals
  // P1-1 fix: .filter() correctly serialises as PostgREST embedded-resource filter
  const { count: checkInCount } = await supabase
    .from('check_ins')
    .select('id, deals!inner(priority)', { count: 'exact', head: true })
    .eq('owner_id', user.id)
    .eq('status', 'pending')
    .filter('deals.priority', 'eq', 'high')

  return NextResponse.json({ count: highFlagCount + (checkInCount ?? 0) })
}
