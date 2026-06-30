import { NextRequest, NextResponse } from 'next/server'
import { generateBriefingForOwner, generateBriefingsForAllOwners } from '@/lib/crm/briefingService'

// AD-13: cron route uses service-role client (via briefingService) — not an owner-data path.
// CRON_SECRET is a server-only env var (no public prefix — never exposed to the client bundle).

function validateCronSecret(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return false
  const authHeader = request.headers.get('authorization')
  if (!authHeader || !/^Bearer\s+/i.test(authHeader)) return false
  const token = authHeader.replace(/^Bearer\s+/i, '')
  return token === cronSecret
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!validateCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const today = new Date().toISOString().split('T')[0]!
  const { searchParams } = new URL(request.url)
  const ownerId = searchParams.get('ownerId')
  const forceRefresh = searchParams.get('forceRefresh') === 'true'

  try {
    if (ownerId) {
      // Single-owner mode: generate for one owner
      const result = await generateBriefingForOwner(ownerId, today, forceRefresh)
      if (!result) {
        return NextResponse.json({ status: 'skipped', reason: 'no_active_deals' }, { status: 200 })
      }
      return NextResponse.json({ status: result.status, date: today, ownerId })
    }

    // All-owners mode: generate for all CRM users
    const results = await generateBriefingsForAllOwners(today)
    const summary = {
      date: today,
      total: results.length,
      generated: results.filter((r) => r.status === 'generated').length,
      degraded: results.filter((r) => r.status === 'degraded').length,
      skipped: results.filter((r) => r.status === 'skipped').length,
      errors: results.filter((r) => r.status === 'error').length,
    }
    return NextResponse.json(summary)
  } catch (err) {
    console.error('[ARIA/cron/briefing] generation failed:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
