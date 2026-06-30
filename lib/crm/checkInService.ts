import 'server-only'
import { createServiceClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/crm/activityLogService'
import type { SupabaseClient } from '@supabase/supabase-js'

// ── Types ─────────────────────────────────────────────────────────────────────

export type CheckInTriggerType = 'stale_7d' | 'pre_action_due' | 'cadence_followup'

export interface CheckIn {
  id: string
  owner_id: string
  deal_id: string
  trigger_type: CheckInTriggerType
  due_date: string        // YYYY-MM-DD
  status: 'pending' | 'sent' | 'skipped'
  created_at: string
}

export interface CheckInTriggerCriteria {
  dealId: string
  triggerTypes: CheckInTriggerType[]
}

// Key = trigger_type, value = YYYY-MM-DD of the most recent check-in for that type (or undefined/null)
export type LastCheckInsMap = Partial<Record<CheckInTriggerType, string | null>>

// Story 4.8: configurable cadence thresholds
export interface CheckInConfig {
  daily_cap: number
  high_priority_threshold_days: number
  standard_threshold_days: number
  enabled: boolean
}

export const DEFAULT_CHECKIN_CONFIG: CheckInConfig = {
  daily_cap: 3,
  high_priority_threshold_days: 3,
  standard_threshold_days: 5,
  enabled: true,
}

interface DealRow {
  id: string
  title: string
  stage: string
  priority: string | null
  next_action: string | null
  next_action_due: string | null   // YYYY-MM-DD
  stale_since: string | null       // YYYY-MM-DD
  checkin_paused: boolean          // Story 4.8 — per-deal pause
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// Copied inline — do NOT import to preserve test-boundary isolation (same as briefingService.ts)
function isActiveStage(stage: string): boolean {
  const lower = stage.toLowerCase()
  return !['won', 'lost', 'archived', 'completed'].some((kw) => lower.includes(kw))
}

// Snap a full ISO datetime string to its UTC midnight date string (YYYY-MM-DD)
function toUtcDate(isoOrDate: string): string {
  return isoOrDate.split('T')[0]!
}

// ── Pure evaluator (BOUNDARY: no I/O — safe to call in any context) ──────────
// All cooldowns use calendar-day comparisons (midnight-to-midnight) for deterministic
// daily evaluation regardless of when in the day the cron runs.

/**
 * Evaluate which trigger types apply to a single deal.
 *
 * @param deal         - Deal row from DB
 * @param lastCheckIns - Map of trigger_type → YYYY-MM-DD of most recent check-in (or undefined/null)
 * @param today        - YYYY-MM-DD (injected for testability — the day the cron runs)
 * @param config       - Cadence config (Story 4.8 — replaces hardcoded defaults)
 * @returns array of trigger types that should fire for this deal today
 */
export function evaluateTriggerCriteria(
  deal: DealRow,
  lastCheckIns: LastCheckInsMap,
  today: string,
  config: CheckInConfig = DEFAULT_CHECKIN_CONFIG,
): CheckInTriggerType[] {
  // Per-deal pause (Story 4.8)
  if (deal.checkin_paused) return []

  const triggers: CheckInTriggerType[] = []
  const todayMs = new Date(today + 'T00:00:00Z').getTime()

  // Stale threshold: high-priority deals use high_priority_threshold_days; others use standard
  const staleThreshold =
    deal.priority === 'high'
      ? config.high_priority_threshold_days
      : config.standard_threshold_days

  // ── stale_7d ──────────────────────────────────────────────────────────────
  // Condition: stale_since is set AND today − stale_since >= staleThreshold
  //            AND no stale_7d check-in sent within the last staleThreshold calendar days
  if (deal.stale_since) {
    const staleDays = Math.floor(
      (todayMs - new Date(deal.stale_since + 'T00:00:00Z').getTime()) / 86_400_000
    )
    if (staleDays >= staleThreshold) {
      const lastSentDate = lastCheckIns['stale_7d']
      const lastSentMs = lastSentDate
        ? new Date(toUtcDate(lastSentDate) + 'T00:00:00Z').getTime()
        : null
      const cooldownOk = !lastSentMs || (todayMs - lastSentMs) >= staleThreshold * 86_400_000
      if (cooldownOk) { triggers.push('stale_7d') }
    }
  }

  // ── pre_action_due ────────────────────────────────────────────────────────
  // Condition: next_action_due is exactly tomorrow (1 calendar day away)
  //            AND no pre_action_due check-in sent within the last 1 calendar day
  if (deal.next_action_due) {
    const dueDays = Math.floor(
      (new Date(deal.next_action_due + 'T00:00:00Z').getTime() - todayMs) / 86_400_000
    )
    if (dueDays === 1) {
      const lastSentDate = lastCheckIns['pre_action_due']
      const lastSentMs = lastSentDate
        ? new Date(toUtcDate(lastSentDate) + 'T00:00:00Z').getTime()
        : null
      const cooldownOk = !lastSentMs || (todayMs - lastSentMs) >= 86_400_000
      if (cooldownOk) { triggers.push('pre_action_due') }
    }
  }

  // ── cadence_followup ──────────────────────────────────────────────────────
  // Condition: next_action starts with 'Nhắc lần' (case-sensitive)
  //            AND no cadence_followup check-in sent within the last 1 calendar day
  if (deal.next_action?.startsWith('Nhắc lần')) {
    const lastSentDate = lastCheckIns['cadence_followup']
    const lastSentMs = lastSentDate
      ? new Date(toUtcDate(lastSentDate) + 'T00:00:00Z').getTime()
      : null
    const cooldownOk = !lastSentMs || (todayMs - lastSentMs) >= 86_400_000
    if (cooldownOk) { triggers.push('cadence_followup') }
  }

  return triggers
}

// ── Async DB functions ────────────────────────────────────────────────────────

/**
 * Evaluate all active deals for an owner and schedule check-ins for triggered criteria.
 * Reads cadence config from settings (Story 4.8).
 * Uses createServiceClient() — AD-13: system/cron task path only.
 */
export async function evaluateCheckInTriggers(
  ownerId: string,
  today: string,
): Promise<{ scheduled: number }> {
  const supabase = createServiceClient()

  // Fetch cadence config (Story 4.8) — merge with defaults for missing/null fields
  const { data: settingsRow } = await supabase
    .from('settings')
    .select('checkin_config')
    .eq('owner_id', ownerId)
    .single()

  const rawConfig = settingsRow?.checkin_config
  const config: CheckInConfig = {
    ...DEFAULT_CHECKIN_CONFIG,
    ...(typeof rawConfig === 'object' && rawConfig !== null
      ? (rawConfig as Partial<CheckInConfig>)
      : {}),
  }

  // Global pause: skip all evaluation when check-ins disabled
  if (!config.enabled) return { scheduled: 0 }

  const { data: rawDeals, error: dealsError } = await supabase
    .from('deals')
    .select('id, title, stage, priority, next_action, next_action_due, stale_since, checkin_paused')
    .eq('owner_id', ownerId)
    .eq('is_stub', false)
    .limit(100)

  if (dealsError) { throw new Error(`evaluateCheckInTriggers: ${dealsError.message}`) }

  const activeDeals = ((rawDeals ?? []) as DealRow[])
    .filter((d) => isActiveStage(d.stage) && !d.checkin_paused)  // skip paused deals

  if (activeDeals.length === 0) { return { scheduled: 0 } }

  // Warn if truncated — 100 is the per-owner deal cap (MVP constraint)
  if ((rawDeals?.length ?? 0) >= 100) {
    console.warn(`[ARIA/checkIn] owner ${ownerId}: deal query hit 100-row limit — some deals may be skipped`)
  }

  const dealIds = activeDeals.map((d) => d.id)

  // Batch-fetch all recent check-ins for active deals in one query (avoids N+1)
  const { data: allCheckIns } = await supabase
    .from('check_ins')
    .select('deal_id, trigger_type, created_at')
    .eq('owner_id', ownerId)
    .in('deal_id', dealIds)
    .order('created_at', { ascending: false })
    .limit(500)

  // Build map: deal_id → LastCheckInsMap (keyed by trigger_type → most recent date)
  const checkInsByDeal = new Map<string, LastCheckInsMap>()
  for (const ci of allCheckIns ?? []) {
    const dealId = ci.deal_id as string
    const tt = ci.trigger_type as CheckInTriggerType
    if (!checkInsByDeal.has(dealId)) { checkInsByDeal.set(dealId, {}) }
    const map = checkInsByDeal.get(dealId)!
    if (!map[tt]) {
      // created_at is an ISO datetime; store as date string for midnight-snapped cooldowns
      map[tt] = toUtcDate(ci.created_at as string)
    }
  }

  // Count check-ins already scheduled today (daily cap enforcement — Story 4.8)
  const { count: existingTodayCount } = await supabase
    .from('check_ins')
    .select('id', { count: 'exact', head: true })
    .eq('owner_id', ownerId)
    .eq('due_date', today)

  const existingToday = existingTodayCount ?? 0
  let scheduledThisRun = 0

  for (const deal of activeDeals) {
    if (existingToday + scheduledThisRun >= config.daily_cap) break

    const lastCheckIns = checkInsByDeal.get(deal.id) ?? {}
    const triggerTypes = evaluateTriggerCriteria(deal, lastCheckIns, today, config)

    for (const triggerType of triggerTypes) {
      if (existingToday + scheduledThisRun >= config.daily_cap) break
      await scheduleCheckIn(ownerId, deal.id, triggerType, today, supabase)
      scheduledThisRun++
    }
  }

  return { scheduled: scheduledThisRun }
}

/**
 * Idempotently insert a check-in row for a specific trigger type and date.
 * On conflict (same owner/deal/type/date) updates status back to 'pending'.
 * Fire-and-forget activity log on schedule.
 * Accepts an optional pre-created supabase client to avoid per-call instantiation.
 */
export async function scheduleCheckIn(
  ownerId: string,
  dealId: string,
  triggerType: CheckInTriggerType,
  dueDate: string,
  supabaseClient?: SupabaseClient,
): Promise<void> {
  const supabase = supabaseClient ?? createServiceClient()

  // UNIQUE(owner_id, deal_id, trigger_type, due_date) — see migration 20260630000000
  const { data: upserted, error } = await supabase
    .from('check_ins')
    .upsert(
      {
        owner_id: ownerId,
        deal_id: dealId,
        trigger_type: triggerType,
        due_date: dueDate,
        status: 'pending',
      },
      { onConflict: 'owner_id,deal_id,trigger_type,due_date' }
    )
    .select('id, created_at')
    .single()

  if (error) { throw new Error(`scheduleCheckIn: ${error.message}`) }

  // Fire-and-forget activity log — best-effort in cron context (logActivity uses server client)
  logActivity(ownerId, {
    entity_type: 'deal',
    entity_id: dealId,
    action: 'checkin_scheduled',
    actor: 'ai',
    payload: { trigger_type: triggerType, due_date: dueDate, check_in_id: upserted?.id },
  }).catch((err) => console.warn('scheduleCheckIn: activity log failed:', err))
}

/**
 * Returns pending check-ins for an owner where due_date <= today.
 * Used by Story 4.7 (delivery). Uses createServiceClient() — AD-13.
 */
export async function getPendingCheckIns(ownerId: string): Promise<CheckIn[]> {
  const supabase = createServiceClient()
  const today = new Date().toISOString().split('T')[0]!

  const { data, error } = await supabase
    .from('check_ins')
    .select('id, owner_id, deal_id, trigger_type, due_date, status, created_at')
    .eq('owner_id', ownerId)
    .eq('status', 'pending')
    .lte('due_date', today)
    .order('due_date', { ascending: true })

  if (error) { throw new Error(`getPendingCheckIns: ${error.message}`) }
  return (data ?? []) as CheckIn[]
}
