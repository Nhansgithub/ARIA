export {}
// ts-node inline tests for Story 4.6: Proactive Check-In Scheduler — Trigger Criteria & Job
// Pattern: no imports from project lib/ — logic simulated inline.
// Run: npx ts-node lib/__tests__/checkInScheduler46.test.ts

import fs from 'fs'
import path from 'path'

let passed = 0
let failed = 0

function assert(condition: boolean, label: string): void {
  if (condition) {
    console.log('  PASS: ' + label)
    passed++
  } else {
    console.error('  FAIL: ' + label)
    failed++
  }
}

// ── Inline simulation of types ────────────────────────────────────────────────

type CheckInTriggerType = 'stale_7d' | 'pre_action_due' | 'cadence_followup'
// lastCheckIns values are YYYY-MM-DD (calendar day of most recent check-in for that trigger type)
type LastCheckInsMap = Partial<Record<CheckInTriggerType, string | null>>

interface DealRow {
  id: string
  title: string
  stage: string
  priority: string | null
  next_action: string | null
  next_action_due: string | null
  stale_since: string | null
}

// ── Inline simulation of evaluateTriggerCriteria ──────────────────────────────
// Must exactly match lib/crm/checkInService.ts.
// Cooldowns use calendar-day (midnight-snapped) comparisons for deterministic evaluation.

function toUtcDate(isoOrDate: string): string {
  return isoOrDate.split('T')[0]!
}

function evaluateTriggerCriteria(
  deal: DealRow,
  lastCheckIns: LastCheckInsMap,
  today: string,
): CheckInTriggerType[] {
  const triggers: CheckInTriggerType[] = []
  const todayMs = new Date(today + 'T00:00:00Z').getTime()

  if (deal.stale_since) {
    const staleDays = Math.floor(
      (todayMs - new Date(deal.stale_since + 'T00:00:00Z').getTime()) / 86_400_000
    )
    if (staleDays >= 7) {
      const lastSentDate = lastCheckIns['stale_7d']
      const lastSentMs = lastSentDate
        ? new Date(toUtcDate(lastSentDate) + 'T00:00:00Z').getTime()
        : null
      const cooldownOk = !lastSentMs || (todayMs - lastSentMs) >= 7 * 86_400_000
      if (cooldownOk) { triggers.push('stale_7d') }
    }
  }

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

// ── Fixtures / helpers ────────────────────────────────────────────────────────

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().split('T')[0]!
}

const TODAY = '2026-06-30'

function makeDeal(overrides: Partial<DealRow> = {}): DealRow {
  return {
    id: 'd1', title: 'Test', stage: 'proposal', priority: 'medium',
    next_action: null, next_action_due: null, stale_since: null,
    ...overrides,
  }
}

// ── T1–T15: evaluateTriggerCriteria — core behavior ──────────────────────────

console.log('\n[T1-T15] evaluateTriggerCriteria — core behavior')

const stale7DaysAgo = addDays(TODAY, -7)
const stale10DaysAgo = addDays(TODAY, -10)
const stale6DaysAgo = addDays(TODAY, -6)
const tomorrow = addDays(TODAY, 1)
const dayAfterTomorrow = addDays(TODAY, 2)

assert(
  evaluateTriggerCriteria(makeDeal({ stale_since: stale7DaysAgo }), {}, TODAY).includes('stale_7d'),
  'T1: stale_7d fires when stale_since exactly 7 days ago, no prior check-in'
)
assert(
  evaluateTriggerCriteria(makeDeal({ stale_since: stale10DaysAgo }), {}, TODAY).includes('stale_7d'),
  'T2: stale_7d fires when stale_since 10 days ago'
)
assert(
  !evaluateTriggerCriteria(makeDeal({ stale_since: stale6DaysAgo }), {}, TODAY).includes('stale_7d'),
  'T3: stale_7d does NOT fire when stale_since 6 days ago'
)
assert(
  !evaluateTriggerCriteria(makeDeal({ stale_since: null }), {}, TODAY).includes('stale_7d'),
  'T4: stale_7d does NOT fire when stale_since is null'
)

// lastCheckIns values are YYYY-MM-DD (calendar day)
const last3DaysAgo = addDays(TODAY, -3)
assert(
  !evaluateTriggerCriteria(makeDeal({ stale_since: stale10DaysAgo }), { stale_7d: last3DaysAgo }, TODAY).includes('stale_7d'),
  'T5: stale_7d does NOT fire when last check-in was 3 calendar days ago (within cooldown)'
)
const lastExactly7Days = addDays(TODAY, -7)
assert(
  evaluateTriggerCriteria(makeDeal({ stale_since: stale10DaysAgo }), { stale_7d: lastExactly7Days }, TODAY).includes('stale_7d'),
  'T6: stale_7d fires when last check-in was exactly 7 calendar days ago (boundary fires)'
)
const last8DaysAgo = addDays(TODAY, -8)
assert(
  evaluateTriggerCriteria(makeDeal({ stale_since: stale10DaysAgo }), { stale_7d: last8DaysAgo }, TODAY).includes('stale_7d'),
  'T7: stale_7d fires when last check-in was 8 calendar days ago'
)
assert(
  evaluateTriggerCriteria(makeDeal({ next_action_due: tomorrow }), {}, TODAY).includes('pre_action_due'),
  'T8: pre_action_due fires when next_action_due is exactly tomorrow'
)
assert(
  !evaluateTriggerCriteria(makeDeal({ next_action_due: dayAfterTomorrow }), {}, TODAY).includes('pre_action_due'),
  'T9: pre_action_due does NOT fire when next_action_due is 2 days away'
)
assert(
  !evaluateTriggerCriteria(makeDeal({ next_action_due: TODAY }), {}, TODAY).includes('pre_action_due'),
  'T10: pre_action_due does NOT fire when next_action_due is today'
)
assert(
  !evaluateTriggerCriteria(makeDeal({ next_action_due: null }), {}, TODAY).includes('pre_action_due'),
  'T11: pre_action_due does NOT fire when next_action_due is null'
)
const lastYesterday = addDays(TODAY, -1)
assert(
  evaluateTriggerCriteria(makeDeal({ next_action_due: tomorrow }), { pre_action_due: lastYesterday }, TODAY).includes('pre_action_due'),
  'T12: pre_action_due fires when last check-in was yesterday (>= 1 calendar day)'
)
assert(
  evaluateTriggerCriteria(makeDeal({ next_action: 'Nhắc lần 1: gọi' }), {}, TODAY).includes('cadence_followup'),
  'T13: cadence_followup fires when next_action starts with Nhac lan 1'
)
assert(
  evaluateTriggerCriteria(makeDeal({ next_action: 'Nhắc lần 2: email' }), {}, TODAY).includes('cadence_followup'),
  'T14: cadence_followup fires when next_action starts with Nhac lan 2'
)
assert(
  !evaluateTriggerCriteria(makeDeal({ next_action: null }), {}, TODAY).includes('cadence_followup'),
  'T15: cadence_followup does NOT fire when next_action is null'
)

// ── T16–T30: stale_7d edge cases ─────────────────────────────────────────────

console.log('\n[T16-T30] stale_7d edge cases')

assert(
  !evaluateTriggerCriteria(makeDeal({ stale_since: TODAY }), {}, TODAY).includes('stale_7d'),
  'T16: stale_since = today → 0 days → does NOT fire (validates UTC midnight reference)'
)
assert(
  evaluateTriggerCriteria(makeDeal({ stale_since: stale7DaysAgo }), {}, TODAY).includes('stale_7d'),
  'T17: exact 7-day boundary — stale_since = 7d ago → fires'
)
assert(
  !evaluateTriggerCriteria(makeDeal({ stale_since: stale6DaysAgo }), {}, TODAY).includes('stale_7d'),
  'T18: exact 6-day boundary — stale_since = 6d ago → does NOT fire'
)
assert(
  evaluateTriggerCriteria(makeDeal({ stale_since: stale10DaysAgo }), {}, TODAY).includes('stale_7d'),
  'T19: stale_7d with empty lastCheckIns map → fires'
)
const last6DaysAgo = addDays(TODAY, -6)
assert(
  !evaluateTriggerCriteria(makeDeal({ stale_since: stale10DaysAgo }), { stale_7d: last6DaysAgo }, TODAY).includes('stale_7d'),
  'T20: stale_7d cooldown — last check-in 6 calendar days ago → does NOT fire'
)
assert(
  evaluateTriggerCriteria(makeDeal({ stale_since: stale10DaysAgo }), { stale_7d: lastExactly7Days }, TODAY).includes('stale_7d'),
  'T21: stale_7d cooldown — last check-in exactly 7 calendar days ago → fires (boundary inclusive)'
)
const multiDeal = makeDeal({ stale_since: stale10DaysAgo, next_action: 'Nhắc lần 1' })
const multiResult = evaluateTriggerCriteria(multiDeal, {}, TODAY)
assert(
  multiResult.includes('stale_7d') && multiResult.includes('cadence_followup'),
  'T22: Multiple triggers can fire simultaneously — stale_7d + cadence_followup'
)
assert(
  !evaluateTriggerCriteria(makeDeal({ stale_since: null, next_action: 'Nhắc lần 1' }), {}, TODAY).includes('stale_7d'),
  'T23: stale_7d ignored when stale_since is null even if other triggers fire'
)
const originalDeal = makeDeal({ stale_since: stale10DaysAgo })
const stageBefore = originalDeal.stale_since
evaluateTriggerCriteria(originalDeal, {}, TODAY)
assert(
  originalDeal.stale_since === stageBefore,
  'T24: pure function does NOT mutate the deal object'
)
const onlyStale = evaluateTriggerCriteria(makeDeal({ stale_since: stale10DaysAgo }), {}, TODAY)
assert(
  onlyStale.length === 1 && onlyStale[0] === 'stale_7d',
  'T25: result contains only stale_7d when only that trigger applies'
)
const futureDeal = makeDeal({ stale_since: addDays(TODAY, 1) })
assert(
  !evaluateTriggerCriteria(futureDeal, {}, TODAY).includes('stale_7d'),
  'T26: stale_since in the future → negative staleDays → does NOT fire'
)
// Active stage filtering is caller responsibility — pure fn evaluates all deals
const wonDeal = makeDeal({ stale_since: stale10DaysAgo, stage: 'won' })
assert(
  evaluateTriggerCriteria(wonDeal, {}, TODAY).includes('stale_7d'),
  'T27: pure fn fires for any stage — active stage filtering is caller responsibility'
)
assert(
  evaluateTriggerCriteria(makeDeal({ stale_since: stale10DaysAgo }), { stale_7d: null }, TODAY).includes('stale_7d'),
  'T28: lastCheckIns[stale_7d] = null → treated as no prior check-in → fires'
)
assert(
  evaluateTriggerCriteria(makeDeal({ stale_since: stale10DaysAgo }), {}, TODAY).includes('stale_7d'),
  'T29: lastCheckIns[stale_7d] = undefined (key absent) → treated as no prior check-in → fires'
)
assert(
  !evaluateTriggerCriteria(makeDeal({ stale_since: TODAY }), {}, TODAY).includes('stale_7d'),
  'T30: stale_since = today → 0 days → does NOT fire'
)

// ── T31–T40: pre_action_due trigger ──────────────────────────────────────────

console.log('\n[T31-T40] pre_action_due trigger')

assert(
  evaluateTriggerCriteria(makeDeal({ next_action_due: tomorrow }), {}, TODAY).includes('pre_action_due'),
  'T31: next_action_due = tomorrow → fires'
)
assert(
  !evaluateTriggerCriteria(makeDeal({ next_action_due: dayAfterTomorrow }), {}, TODAY).includes('pre_action_due'),
  'T32: next_action_due = 2 days away → does NOT fire'
)
assert(
  !evaluateTriggerCriteria(makeDeal({ next_action_due: addDays(TODAY, 3) }), {}, TODAY).includes('pre_action_due'),
  'T33: next_action_due = 3 days away → does NOT fire'
)
assert(
  !evaluateTriggerCriteria(makeDeal({ next_action_due: TODAY }), {}, TODAY).includes('pre_action_due'),
  'T34: next_action_due = today → 0 days away → does NOT fire'
)
assert(
  !evaluateTriggerCriteria(makeDeal({ next_action_due: addDays(TODAY, -1) }), {}, TODAY).includes('pre_action_due'),
  'T35: next_action_due = yesterday (overdue) → negative dueDays → does NOT fire'
)
// Calendar-day cooldown: same day means 0 calendar days → cooldown NOT satisfied
assert(
  !evaluateTriggerCriteria(makeDeal({ next_action_due: tomorrow }), { pre_action_due: TODAY }, TODAY).includes('pre_action_due'),
  'T36: pre_action_due cooldown — last sent TODAY (same calendar day) → does NOT fire'
)
// Yesterday = 1 calendar day → cooldown satisfied (>= 86400000 ms)
assert(
  evaluateTriggerCriteria(makeDeal({ next_action_due: tomorrow }), { pre_action_due: lastYesterday }, TODAY).includes('pre_action_due'),
  'T37: pre_action_due cooldown — last sent yesterday → fires (1 calendar day >= threshold)'
)
assert(
  evaluateTriggerCriteria(makeDeal({ next_action_due: tomorrow }), { pre_action_due: addDays(TODAY, -2) }, TODAY).includes('pre_action_due'),
  'T38: pre_action_due cooldown — last sent 2 days ago → fires'
)
assert(
  evaluateTriggerCriteria(makeDeal({ next_action_due: tomorrow }), {}, TODAY).includes('pre_action_due'),
  'T39: pre_action_due — no cooldown entry → fires'
)
const noPreDueResult = evaluateTriggerCriteria(makeDeal({ next_action_due: null, stale_since: stale10DaysAgo }), {}, TODAY)
assert(
  !noPreDueResult.includes('pre_action_due') && noPreDueResult.includes('stale_7d'),
  'T40: null next_action_due with prior stale_7d → only stale_7d fires'
)

// ── T41–T50: cadence_followup trigger ────────────────────────────────────────

console.log('\n[T41-T50] cadence_followup trigger')

assert(
  evaluateTriggerCriteria(makeDeal({ next_action: 'Nhắc lần 1: gọi' }), {}, TODAY).includes('cadence_followup'),
  'T41: next_action starts with Nhac lan 1: → fires'
)
assert(
  evaluateTriggerCriteria(makeDeal({ next_action: 'Nhắc lần 2: email' }), {}, TODAY).includes('cadence_followup'),
  'T42: next_action starts with Nhac lan 2: → fires'
)
assert(
  evaluateTriggerCriteria(makeDeal({ next_action: 'Nhắc lần' }), {}, TODAY).includes('cadence_followup'),
  'T43: next_action = bare Nhac lan prefix → fires'
)
assert(
  !evaluateTriggerCriteria(makeDeal({ next_action: 'nhắc lần 1' }), {}, TODAY).includes('cadence_followup'),
  'T44: lowercase n — case-sensitive prefix match → does NOT fire'
)
assert(
  !evaluateTriggerCriteria(makeDeal({ next_action: 'Follow up - Nhắc lần 1' }), {}, TODAY).includes('cadence_followup'),
  'T45: Nhac lan not at start of next_action → does NOT fire'
)
assert(
  !evaluateTriggerCriteria(makeDeal({ next_action: null }), {}, TODAY).includes('cadence_followup'),
  'T46: next_action null → does NOT fire'
)
assert(
  !evaluateTriggerCriteria(makeDeal({ next_action: 'Gọi lại' }), {}, TODAY).includes('cadence_followup'),
  'T47: regular action string → does NOT fire'
)
assert(
  !evaluateTriggerCriteria(makeDeal({ next_action: 'Nhắc lần 1' }), { cadence_followup: TODAY }, TODAY).includes('cadence_followup'),
  'T48: cadence_followup cooldown — last sent TODAY (same day) → does NOT fire'
)
assert(
  evaluateTriggerCriteria(makeDeal({ next_action: 'Nhắc lần 1' }), { cadence_followup: lastYesterday }, TODAY).includes('cadence_followup'),
  'T49: cadence_followup cooldown — last sent yesterday → fires'
)
const bothResult = evaluateTriggerCriteria(makeDeal({ stale_since: stale10DaysAgo, next_action: 'Nhắc lần 1' }), {}, TODAY)
assert(
  bothResult.includes('cadence_followup') && bothResult.includes('stale_7d'),
  'T50: cadence_followup + stale_7d both active → both returned'
)

// ── T51–T60: file structure checks ───────────────────────────────────────────

console.log('\n[T51-T60] File structure and contract checks')

const servicePath = path.join(process.cwd(), 'lib', 'crm', 'checkInService.ts')
const serviceExists = fs.existsSync(servicePath)
assert(serviceExists, 'T51: checkInService.ts exists at lib/crm/checkInService.ts')

if (serviceExists) {
  const service = fs.readFileSync(servicePath, 'utf-8')
  const firstLine = service.split('\n')[0] ?? ''
  assert(firstLine === "import 'server-only'", 'T52: first line is import server-only')
  assert(service.includes('createServiceClient') && !service.includes('createServerClient'), 'T53: uses createServiceClient not createServerClient')
  assert(service.includes('export function evaluateTriggerCriteria'), 'T54: exports evaluateTriggerCriteria')
  assert(service.includes('export async function evaluateCheckInTriggers'), 'T55: exports evaluateCheckInTriggers')
  assert(service.includes('export async function scheduleCheckIn'), 'T56: exports scheduleCheckIn')
  assert(service.includes('export async function getPendingCheckIns'), 'T57: exports getPendingCheckIns')
  // Batch query — no N+1 per deal
  assert(service.includes('.in('), 'T57b: uses batch .in() query for check_ins (not per-deal selects)')
}

const cronPath = path.join(process.cwd(), 'app', 'api', 'cron', 'check-in-scheduler', 'route.ts')
const cronExists = fs.existsSync(cronPath)
assert(cronExists, 'T58: cron route exists at app/api/cron/check-in-scheduler/route.ts')

if (cronExists) {
  const cron = fs.readFileSync(cronPath, 'utf-8')
  assert(cron.includes('validateCronSecret'), 'T59: cron route contains validateCronSecret')
  assert(!cron.includes('createServerClient'), 'T60: cron route does NOT use createServerClient (AD-13)')
  // Bonus: timing-safe comparison and correct PostgREST stage syntax
  assert(cron.includes('timingSafeEqual'), 'T60b: uses timing-safe comparison for CRON_SECRET')
}

const migrationPath = path.join(process.cwd(), 'supabase', 'migrations', '20260630000000_check_ins_trigger_columns.sql')
const migrationExists = fs.existsSync(migrationPath)
assert(migrationExists, 'T60c: migration exists for trigger_type + due_date columns')

// ── Summary ───────────────────────────────────────────────────────────────────

console.log('\nResults: ' + passed + ' passed, ' + failed + ' failed')
if (failed > 0) { process.exit(1) }
