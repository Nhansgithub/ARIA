import { timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { evaluateCheckInTriggers } from '@/lib/crm/checkInService'

// AD-13: cron route uses service-role client (via checkInService) — not an owner-data path.
// CRON_SECRET is server-only (no NEXT_PUBLIC_ prefix — never exposed to the client bundle).

function validateCronSecret(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) { return false }
  const authHeader = request.headers.get('authorization')
  if (!authHeader || !/^Bearer\s+/i.test(authHeader)) { return false }
  const token = authHeader.replace(/^Bearer\s+/i, '')
  // Constant-time comparison prevents timing-oracle brute-force of the secret
  const a = Buffer.from(token)
  const b = Buffer.from(cronSecret)
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!validateCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const today = new Date().toISOString().split('T')[0]!
  const supabase = createServiceClient()

  // Get all owner IDs with active (non-closed) deals
  // Note: PostgREST 'in' filter uses unquoted values for text columns
  const { data: owners, error } = await supabase
    .from('deals')
    .select('owner_id')
    .eq('is_stub', false)
    .not('stage', 'in', '(won,lost,archived,completed)')
    .limit(10_000)

  if (error) {
    console.error('[ARIA/cron/check-in-scheduler] owner query failed:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  const allOwnerIds = (owners ?? []).map((r: { owner_id: string }) => r.owner_id)
  // Set dedup is O(n) vs O(n²) for indexOf
  const ownerIds = Array.from(new Set(allOwnerIds))

  let totalScheduled = 0
  let errorCount = 0

  for (const ownerId of ownerIds) {
    try {
      const result = await evaluateCheckInTriggers(ownerId, today)
      totalScheduled += result.scheduled
    } catch (err) {
      console.error(`[ARIA/cron/check-in-scheduler] error for owner ${ownerId}:`, err)
      errorCount++
    }
  }

  return NextResponse.json({
    date: today,
    scheduled: totalScheduled,
    owners: ownerIds.length,
    errors: errorCount,
  })
}
