import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/crm/activityLogService'
import { DEFAULT_CHECKIN_CONFIG } from '@/lib/crm/checkInService'
import type { CheckInConfig } from '@/lib/crm/checkInService'

// AD-13: owner-initiated route — createServerClient() (RLS-enforced, cookie-based JWT)
// Service-role client must NOT be used here — this path serves owner data

export async function GET(): Promise<NextResponse> {
  const supabase = createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabase
    .from('settings')
    .select('checkin_config')
    .eq('owner_id', user.id)
    .single()

  const config: CheckInConfig = {
    ...DEFAULT_CHECKIN_CONFIG,
    ...(typeof data?.checkin_config === 'object' && data.checkin_config !== null
      ? (data.checkin_config as Partial<CheckInConfig>)
      : {}),
  }

  return NextResponse.json({ config })
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
  const supabase = createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Partial<CheckInConfig>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // P2-4 fix: reject non-numeric values before merging (typeof guard prevents string coercion bypass)
  const numericFields = [
    'daily_cap',
    'high_priority_threshold_days',
    'standard_threshold_days',
  ] as const
  for (const field of numericFields) {
    if (field in body && typeof (body as Record<string, unknown>)[field] !== 'number') {
      return NextResponse.json({ error: `${field} must be a number` }, { status: 400 })
    }
  }
  if ('enabled' in body && typeof (body as Record<string, unknown>).enabled !== 'boolean') {
    return NextResponse.json({ error: 'enabled must be a boolean' }, { status: 400 })
  }

  const config: CheckInConfig = { ...DEFAULT_CHECKIN_CONFIG, ...body }

  // Validate threshold ordering (AC-10); also guard zero/negative (P2-5)
  if (config.high_priority_threshold_days < 1 || config.standard_threshold_days < 1) {
    return NextResponse.json(
      { error: 'Ngưỡng không hoạt động phải ít nhất 1 ngày.' },
      { status: 400 }
    )
  }
  if (config.high_priority_threshold_days >= config.standard_threshold_days) {
    return NextResponse.json(
      { error: 'Ngưỡng ưu tiên cao nên ngắn hơn ngưỡng thông thường.' },
      { status: 400 }
    )
  }
  if (config.daily_cap < 1 || config.daily_cap > 10) {
    return NextResponse.json({ error: 'daily_cap must be between 1 and 10' }, { status: 400 })
  }

  // Fetch old config for activity log before/after comparison
  const { data: existing } = await supabase
    .from('settings')
    .select('checkin_config')
    .eq('owner_id', user.id)
    .single()

  const { error } = await supabase
    .from('settings')
    .upsert({ owner_id: user.id, checkin_config: config }, { onConflict: 'owner_id' })

  if (error) {
    console.error('[ARIA/settings/cadence] upsert error:', error.message)
    return NextResponse.json({ error: 'save_error' }, { status: 500 })
  }

  // Write activity log (fire-and-forget — AD-14 append-only)
  logActivity(user.id, {
    entity_type: 'settings',
    entity_id: user.id,
    action: 'checkin_cadence_configured',
    actor: 'user',
    payload: { before: existing?.checkin_config ?? null, after: config },
  }).catch((err) => console.warn('[ARIA/settings/cadence] logActivity failed:', err))

  return NextResponse.json({ config })
}
