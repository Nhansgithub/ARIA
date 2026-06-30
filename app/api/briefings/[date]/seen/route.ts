import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

// AD-13: owner-data route — createServerClient() only
// POST /api/briefings/[date]/seen — marks briefing as seen (sets seen_at = now)

export async function POST(
  _request: NextRequest,
  { params }: { params: { date: string } },
): Promise<NextResponse> {
  const supabase = createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const dateParam = params.date
  // Validate format YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    return NextResponse.json({ error: 'Invalid date format' }, { status: 400 })
  }

  // P2-3 fix: maybeSingle() returns null data (no error) on 0 rows, distinguishing not-found from DB error
  const { data, error } = await supabase
    .from('briefings')
    .update({ seen_at: new Date().toISOString() })
    .eq('owner_id', user.id)
    .eq('date', dateParam)
    .select('id')
    .maybeSingle()

  if (error) {
    console.error('[ARIA/briefings/seen] DB error:', error.message)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ error: 'Briefing not found' }, { status: 404 })
  }

  return new NextResponse(null, { status: 204 })
}
