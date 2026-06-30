export {}
// ts-node inline tests for Story 4.2: Stale-Deal Detection & Follow-Up Cadence Engine
// Pattern: no imports from project lib/ — all logic simulated inline.
// Run: npx ts-node lib/__tests__/staleDealDetection42.test.ts

import fs from 'fs'
import path from 'path'

// ── Helpers ───────────────────────────────────────────────────────────────────

let passed = 0
let failed = 0

function assert(condition: boolean, label: string): void {
  if (condition) {
    console.log(`  ✓ ${label}`)
    passed++
  } else {
    console.error(`  ✗ FAIL: ${label}`)
    failed++
  }
}

// ── Inline simulation of stale-deal detection logic ───────────────────────────

interface CadenceConfig {
  staleThresholdDays: number
  firstFollowUpDays: number
  secondFollowUpDays: number
}

const DEFAULT_CADENCE: CadenceConfig = {
  staleThresholdDays: 7,
  firstFollowUpDays: 3,
  secondFollowUpDays: 7,
}

function isClosedStage(stage: string): boolean {
  const lower = stage.toLowerCase()
  return ['won', 'lost', 'archived', 'completed', 'signed'].some((kw) => lower.includes(kw))
}

function isProposalStage(stage: string): boolean {
  const lower = stage.toLowerCase()
  return ['proposal', 'đề xuất', 'sent quote', 'quote sent'].some((kw) => lower.includes(kw))
}

function computeCadenceStep(daysIdle: number, config: CadenceConfig): 1 | 2 | null {
  if (daysIdle >= config.secondFollowUpDays) return 2
  if (daysIdle >= config.firstFollowUpDays) return 1
  return null
}

function isStale(daysIdle: number, config: CadenceConfig = DEFAULT_CADENCE): boolean {
  return daysIdle >= config.staleThresholdDays
}

function buildCadenceMessage(cadenceStep: 1 | 2, daysIdle: number): string {
  return cadenceStep === 1
    ? `Nhắc lần 1: Theo dõi đề xuất — đã ${daysIdle} ngày chưa có phản hồi`
    : `Nhắc lần 2: Theo dõi đề xuất — đã ${daysIdle} ngày chưa có phản hồi`
}

interface SimDeal {
  id: string
  title: string
  stage: string
  stale_since: string | null
  next_action: string | null
  next_action_due: string | null
}

interface SimLogEntry {
  actor: 'ai' | 'user'
  created_at: string // ISO datetime
}

function daysAgo(n: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - n)
  return d.toISOString()
}

interface ProcessResult {
  wasMarkedStale: boolean
  alreadyStale: boolean
  cadenceStep: 1 | 2 | null
  cadenceReset: boolean
}

function processDeal(
  deal: SimDeal,
  lastEntry: SimLogEntry | null,
  config: CadenceConfig = DEFAULT_CADENCE
): ProcessResult {
  if (!lastEntry)
    return {
      wasMarkedStale: false,
      alreadyStale: !!deal.stale_since,
      cadenceStep: null,
      cadenceReset: false,
    }

  const todayStr = new Date().toISOString().split('T')[0]!
  const lastActivityDateStr = lastEntry.created_at.split('T')[0]!
  const daysIdle = Math.floor(
    (new Date(todayStr + 'T00:00:00Z').getTime() -
      new Date(lastActivityDateStr + 'T00:00:00Z').getTime()) /
      86_400_000
  )

  const alreadyStale = deal.stale_since !== null
  let wasMarkedStale = false

  // Mark stale
  if (daysIdle >= config.staleThresholdDays && !alreadyStale) {
    wasMarkedStale = true
  }

  // Cadence
  let cadenceStep: 1 | 2 | null = null
  let cadenceReset = false

  if (isProposalStage(deal.stage)) {
    if (
      lastEntry.actor === 'user' &&
      daysIdle < config.firstFollowUpDays &&
      typeof deal.next_action === 'string' &&
      deal.next_action.startsWith('Nhắc lần')
    ) {
      cadenceReset = true
    } else if (daysIdle >= config.firstFollowUpDays) {
      cadenceStep = computeCadenceStep(daysIdle, config)
    }
  }

  return { wasMarkedStale, alreadyStale, cadenceStep, cadenceReset }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

console.log('\nStory 4.2 — Stale-Deal Detection & Follow-Up Cadence Engine\n')

// T1: isClosedStage — closed stages are filtered out
console.log('T1: isClosedStage — closed stages skipped')
{
  assert(isClosedStage('won'), '"won" is closed')
  assert(isClosedStage('lost'), '"lost" is closed')
  assert(isClosedStage('archived'), '"archived" is closed')
  assert(isClosedStage('completed'), '"completed" is closed')
  assert(isClosedStage('contract signed'), '"contract signed" is closed')
  assert(!isClosedStage('proposal'), '"proposal" is not closed')
  assert(!isClosedStage('discovery'), '"discovery" is not closed')
  assert(!isClosedStage('negotiation'), '"negotiation" is not closed')
}

// T2: isProposalStage — proposal-like stages trigger cadence
console.log('\nT2: isProposalStage — proposal-like stage detection')
{
  assert(isProposalStage('proposal'), '"proposal" is proposal stage')
  assert(isProposalStage('Giai đoạn đề xuất'), '"đề xuất" is proposal stage (Vietnamese)')
  assert(isProposalStage('sent quote'), '"sent quote" is proposal stage')
  assert(
    isProposalStage('Quote Sent to Client'),
    '"Quote Sent" is proposal stage (case-insensitive)'
  )
  assert(!isProposalStage('discovery'), '"discovery" is not proposal stage')
  assert(!isProposalStage('contract'), '"contract" is not proposal stage')
  assert(!isProposalStage('Đang chờ quyết định'), 'arbitrary Vietnamese text is not proposal stage')
}

// T3: isStale — threshold is >=7 (not >7)
console.log('\nT3: isStale — threshold exactly 7 days (>=7)')
{
  assert(isStale(7), 'exactly 7 days is stale (threshold is >=7)')
  assert(isStale(8), '8 days is stale')
  assert(isStale(30), '30 days is stale')
  assert(!isStale(6), '6 days is NOT stale')
  assert(!isStale(0), '0 days is NOT stale')
}

// T4: computeCadenceStep — boundaries
console.log('\nT4: computeCadenceStep — first=3, second=7')
{
  const cfg = DEFAULT_CADENCE
  assert(computeCadenceStep(2, cfg) === null, '2 days idle → no cadence')
  assert(computeCadenceStep(3, cfg) === 1, '3 days idle → step 1')
  assert(computeCadenceStep(6, cfg) === 1, '6 days idle → step 1')
  assert(computeCadenceStep(7, cfg) === 2, '7 days idle → step 2 (>=7)')
  assert(computeCadenceStep(14, cfg) === 2, '14 days idle → step 2')
}

// T5: Stale detection — idle >=7, stale_since null → marked stale
console.log('\nT5: processDeal — idle >=7, stale_since null → wasMarkedStale')
{
  const deal: SimDeal = {
    id: 'd1',
    title: 'Old Proposal',
    stage: 'discovery',
    stale_since: null,
    next_action: null,
    next_action_due: null,
  }
  const entry: SimLogEntry = { actor: 'ai', created_at: daysAgo(10) }
  const result = processDeal(deal, entry)
  assert(result.wasMarkedStale === true, 'idle 10 days → wasMarkedStale')
  assert(result.alreadyStale === false, 'stale_since was null → alreadyStale=false')
}

// T6: Idempotency — idle >=7 but stale_since already set → no write
console.log('\nT6: processDeal — stale_since already set → no re-mark')
{
  const staleSince = daysAgo(10).split('T')[0]!
  const deal: SimDeal = {
    id: 'd2',
    title: 'Already Stale',
    stage: 'discovery',
    stale_since: staleSince,
    next_action: null,
    next_action_due: null,
  }
  const entry: SimLogEntry = { actor: 'ai', created_at: daysAgo(10) }
  const result = processDeal(deal, entry)
  assert(result.wasMarkedStale === false, 'stale_since already set → wasMarkedStale=false')
  assert(result.alreadyStale === true, 'alreadyStale=true when stale_since is set')
}

// T7: Empty CRM guard — zero active deals → returns empty
console.log('\nT7: Empty CRM guard — all deals closed → no processing')
{
  const deals: SimDeal[] = [
    {
      id: 'd1',
      title: 'Won Deal',
      stage: 'won',
      stale_since: null,
      next_action: null,
      next_action_due: null,
    },
    {
      id: 'd2',
      title: 'Lost Deal',
      stage: 'lost',
      stale_since: null,
      next_action: null,
      next_action_due: null,
    },
  ]
  const activeDeals = deals.filter((d) => !isClosedStage(d.stage))
  assert(activeDeals.length === 0, 'all closed stages → zero active deals (empty CRM guard)')
}

// T8: Proposal cadence step 1 — idle >=3 and <7
console.log('\nT8: Proposal cadence step 1 — idle 4 days')
{
  const deal: SimDeal = {
    id: 'd3',
    title: 'Proposal',
    stage: 'proposal',
    stale_since: null,
    next_action: null,
    next_action_due: null,
  }
  const entry: SimLogEntry = { actor: 'ai', created_at: daysAgo(4) }
  const result = processDeal(deal, entry)
  assert(result.cadenceStep === 1, '4 days idle at proposal → cadence step 1')
  assert(result.wasMarkedStale === false, 'idle 4 days → not stale yet')
}

// T9: Proposal cadence step 2 — idle >=7
console.log('\nT9: Proposal cadence step 2 — idle >=7 days')
{
  const deal: SimDeal = {
    id: 'd4',
    title: 'Overdue Proposal',
    stage: 'proposal',
    stale_since: null,
    next_action: null,
    next_action_due: null,
  }
  const entry: SimLogEntry = { actor: 'ai', created_at: daysAgo(9) }
  const result = processDeal(deal, entry)
  assert(result.cadenceStep === 2, '9 days idle at proposal → cadence step 2')
  assert(result.wasMarkedStale === true, '9 days idle → also marked stale')
}

// T10: Non-proposal stage — no cadence applied even if idle
console.log('\nT10: Non-proposal stage — no cadence even when idle')
{
  const deal: SimDeal = {
    id: 'd5',
    title: 'Discovery Deal',
    stage: 'discovery',
    stale_since: null,
    next_action: null,
    next_action_due: null,
  }
  const entry: SimLogEntry = { actor: 'ai', created_at: daysAgo(5) }
  const result = processDeal(deal, entry)
  assert(result.cadenceStep === null, 'discovery stage → no cadence')
}

// T11: Cadence reset — user activity clears cadence-set next_action
console.log('\nT11: Cadence reset — user activity within firstFollowUpDays clears cadence')
{
  const deal: SimDeal = {
    id: 'd6',
    title: 'Reset Deal',
    stage: 'proposal',
    stale_since: null,
    next_action: 'Nhắc lần 1: Theo dõi đề xuất — đã 3 ngày chưa có phản hồi',
    next_action_due: '2026-06-27',
  }
  // User logged activity yesterday → daysIdle = 1 < firstFollowUpDays (3)
  const entry: SimLogEntry = { actor: 'user', created_at: daysAgo(1) }
  const result = processDeal(deal, entry)
  assert(
    result.cadenceReset === true,
    'user activity + daysIdle < firstFollowUpDays → cadence reset'
  )
  assert(result.cadenceStep === null, 'cadence reset path → no new cadence step')
}

// T12: Cadence reset — non-cadence next_action not cleared
console.log('\nT12: Cadence reset — manually-set next_action not cleared by user activity')
{
  const deal: SimDeal = {
    id: 'd7',
    title: 'Manual Action',
    stage: 'proposal',
    stale_since: null,
    next_action: 'Gọi điện cho khách hàng',
    next_action_due: '2026-07-01',
  }
  const entry: SimLogEntry = { actor: 'user', created_at: daysAgo(1) }
  const result = processDeal(deal, entry)
  assert(result.cadenceReset === false, 'non-cadence next_action is not cleared on user activity')
}

// T13: Cadence message format — step 1 starts with "Nhắc lần 1", step 2 with "Nhắc lần 2"
console.log('\nT13: Cadence message format')
{
  const msg1 = buildCadenceMessage(1, 4)
  const msg2 = buildCadenceMessage(2, 9)
  assert(msg1.startsWith('Nhắc lần 1'), 'step 1 message starts with "Nhắc lần 1"')
  assert(msg2.startsWith('Nhắc lần 2'), 'step 2 message starts with "Nhắc lần 2"')
  assert(msg1.includes('4'), 'step 1 message includes idle day count (4)')
  assert(msg2.includes('9'), 'step 2 message includes idle day count (9)')
}

// T14: Vietnamese proposal stage triggers cadence
console.log('\nT14: Vietnamese "đề xuất" stage → cadence applies')
{
  const deal: SimDeal = {
    id: 'd8',
    title: 'VN Deal',
    stage: 'Giai đoạn đề xuất',
    stale_since: null,
    next_action: null,
    next_action_due: null,
  }
  const entry: SimLogEntry = { actor: 'ai', created_at: daysAgo(5) }
  const result = processDeal(deal, entry)
  assert(result.cadenceStep === 1, 'Vietnamese đề xuất stage, 5 days idle → cadence step 1')
}

// T15: Boundary — idle exactly 3 → step 1
console.log('\nT15: Cadence boundary — idle exactly 3 days → step 1')
{
  const deal: SimDeal = {
    id: 'd9',
    title: 'Boundary Proposal',
    stage: 'proposal',
    stale_since: null,
    next_action: null,
    next_action_due: null,
  }
  const entry: SimLogEntry = { actor: 'ai', created_at: daysAgo(3) }
  const result = processDeal(deal, entry)
  assert(result.cadenceStep === 1, 'idle exactly 3 days → step 1 (threshold is >=3)')
}

// T16: Boundary — idle exactly 7 → step 2 AND stale
console.log('\nT16: Boundary — idle exactly 7 days → step 2 + stale')
{
  const deal: SimDeal = {
    id: 'd10',
    title: 'Boundary 7',
    stage: 'proposal',
    stale_since: null,
    next_action: null,
    next_action_due: null,
  }
  const entry: SimLogEntry = { actor: 'ai', created_at: daysAgo(7) }
  const result = processDeal(deal, entry)
  assert(result.cadenceStep === 2, 'idle exactly 7 days at proposal → step 2 (>=7)')
  assert(result.wasMarkedStale === true, 'idle exactly 7 days → stale (threshold >=7)')
}

// T17: No activity log entry → skipped (returns no result)
console.log('\nT17: No activity log entry → deal skipped')
{
  const deal: SimDeal = {
    id: 'd11',
    title: 'No Log',
    stage: 'proposal',
    stale_since: null,
    next_action: null,
    next_action_due: null,
  }
  const result = processDeal(deal, null)
  assert(result.wasMarkedStale === false, 'no log entry → not marked stale')
  assert(result.cadenceStep === null, 'no log entry → no cadence')
}

// T18: Configurable thresholds override defaults
console.log('\nT18: Custom cadence config — thresholds override defaults')
{
  const customConfig: CadenceConfig = {
    staleThresholdDays: 14,
    firstFollowUpDays: 5,
    secondFollowUpDays: 14,
  }
  assert(!isStale(7, customConfig), 'with staleThreshold=14, idle 7 days is NOT stale')
  assert(isStale(14, customConfig), 'with staleThreshold=14, idle 14 days IS stale')
  assert(computeCadenceStep(4, customConfig) === null, 'with firstFollowUp=5, idle 4 → null')
  assert(computeCadenceStep(5, customConfig) === 1, 'with firstFollowUp=5, idle 5 → step 1')
  assert(computeCadenceStep(14, customConfig) === 2, 'with secondFollowUp=14, idle 14 → step 2')
}

// T19: File existence — staleDealService.ts exists and exports required functions
console.log('\nT19: File checks — staleDealService.ts structure')
{
  const src = path.join(process.cwd(), 'lib', 'crm', 'staleDealService.ts')
  assert(fs.existsSync(src), 'lib/crm/staleDealService.ts exists')
  const content = fs.existsSync(src) ? fs.readFileSync(src, 'utf8') : ''
  assert(
    content.startsWith("import 'server-only'"),
    "staleDealService.ts starts with import 'server-only' (AD-11)"
  )
  assert(content.includes('detectAndFlagStaleDeals'), 'exports detectAndFlagStaleDeals')
  assert(content.includes('getCadenceConfig'), 'exports getCadenceConfig')
  assert(content.includes('CadenceConfig'), 'exports CadenceConfig interface')
  assert(content.includes('DEFAULT_CADENCE'), 'exports DEFAULT_CADENCE')
  assert(content.includes('createServerClient'), 'uses createServerClient (AD-13)')
  assert(!content.includes('createServiceClient'), 'does NOT use createServiceClient (AD-13)')
  assert(content.includes(".eq('owner_id', ownerId)"), 'enforces owner_id guard (AD-2)')
  assert(
    content.includes(".is('stale_since', null)"),
    'idempotent stale_since write uses .is(null) guard'
  )
}

// T20: Activity log actions
console.log('\nT20: Activity log action names match spec')
{
  const src = path.join(process.cwd(), 'lib', 'crm', 'staleDealService.ts')
  const content = fs.existsSync(src) ? fs.readFileSync(src, 'utf8') : ''
  assert(content.includes("'stale_detected'"), "staleDealService uses action 'stale_detected'")
  assert(
    content.includes("'follow_up_cadence_flagged'"),
    "staleDealService uses action 'follow_up_cadence_flagged'"
  )
  assert(content.includes("actor: 'ai'"), "activity log actor is 'ai'")
}

// T21: AD-14 — no UPDATE/DELETE on activity_log
console.log('\nT21: AD-14 — activity_log is append-only')
{
  const src = path.join(process.cwd(), 'lib', 'crm', 'staleDealService.ts')
  const content = fs.existsSync(src) ? fs.readFileSync(src, 'utf8') : ''
  // Check that no from('activity_log') chain contains .update() before the next .from(
  // Splits on each from('activity_log') occurrence and checks the segment before the next .from(
  const segments = content.split("from('activity_log')")
  const hasActivityLogUpdate = segments.slice(1).some((seg) => {
    const parts = seg.split('.from(')
    const beforeNextFrom = parts[0] ?? ''
    return beforeNextFrom.includes('.update(')
  })
  assert(!hasActivityLogUpdate, 'staleDealService never calls .update() on activity_log (AD-14)')
}

// T22: Fire-and-forget pattern for logActivity — no await before detached calls
console.log('\nT22: logActivity uses fire-and-forget (.catch) to avoid roll-back')
{
  const src = path.join(process.cwd(), 'lib', 'crm', 'staleDealService.ts')
  const content = fs.existsSync(src) ? fs.readFileSync(src, 'utf8') : ''
  assert(
    content.includes('.catch('),
    'staleDealService uses .catch() on logActivity (fire-and-forget pattern)'
  )
  // True fire-and-forget: logActivity calls should not be preceded by 'await' on the same line
  const lines = content.split('\n')
  const badLines = lines.filter((l) => /^\s*await\s+logActivity\(/.test(l))
  assert(badLines.length === 0, 'logActivity calls are not awaited — truly detached (R3 patch)')
}

// T23: package.json includes test:stale-deal42 script
console.log('\nT23: package.json test scripts')
{
  const pkgPath = path.join(process.cwd(), 'package.json')
  const pkg = fs.existsSync(pkgPath) ? JSON.parse(fs.readFileSync(pkgPath, 'utf8')) : {}
  assert(
    typeof pkg.scripts?.['test:stale-deal42'] === 'string',
    'package.json has test:stale-deal42 script'
  )
  assert(
    typeof pkg.scripts?.test === 'string' &&
      pkg.scripts.test.includes('staleDealDetection42.test.ts'),
    'staleDealDetection42.test.ts is in the main test chain'
  )
}

// T25: Cadence idempotency — step prefix comparison prevents unbounded log growth
console.log('\nT25: Cadence idempotency — comparing step prefix, not full message')
{
  // Idempotency helper mirrors production logic
  const isStepAlreadySet = (currentNextAction: string | null, cadenceStep: 1 | 2): boolean => {
    if (cadenceStep === 1)
      return typeof currentNextAction === 'string' && currentNextAction.startsWith('Nhắc lần 1')
    if (cadenceStep === 2)
      return typeof currentNextAction === 'string' && currentNextAction.startsWith('Nhắc lần 2')
    return false
  }
  // Step 1 already set → no update even if day count in message differs
  const step1Msg = 'Nhắc lần 1: Theo dõi đề xuất — đã 4 ngày chưa có phản hồi'
  assert(isStepAlreadySet(step1Msg, 1), 'step 1 message → recognized as step 1 (no re-write)')
  // Step 2 already set → no update
  const step2Msg = 'Nhắc lần 2: Theo dõi đề xuất — đã 8 ngày chưa có phản hồi'
  assert(isStepAlreadySet(step2Msg, 2), 'step 2 message → recognized as step 2 (no re-write)')
  // Step escalation from 1 → 2 SHOULD trigger update
  assert(
    !isStepAlreadySet(step1Msg, 2),
    'existing step 1 msg → NOT recognized as step 2 (escalation fires)'
  )
  // Null next_action → always triggers write
  assert(!isStepAlreadySet(null, 1), 'null next_action → step not set, write fires')
  // StaleDealResult includes cadenceReset field
  const src = path.join(process.cwd(), 'lib', 'crm', 'staleDealService.ts')
  const content = fs.existsSync(src) ? fs.readFileSync(src, 'utf8') : ''
  assert(content.includes('cadenceReset'), 'StaleDealResult includes cadenceReset field')
}

// T24: sprint-status.yaml has story 4-2 in-progress
console.log('\nT24: sprint-status.yaml reflects story 4-2 status')
{
  const statusPath = path.join(
    process.cwd(),
    '_bmad-output',
    'implementation-artifacts',
    'sprint-status.yaml'
  )
  const content = fs.existsSync(statusPath) ? fs.readFileSync(statusPath, 'utf8') : ''
  assert(
    content.includes('4-2-stale-deal-detection-follow-up-cadence-engine'),
    'sprint-status.yaml contains story 4-2 key'
  )
}

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n─────────────────────────────────────────`)
console.log(`Results: ${passed} passed, ${failed} failed`)
if (failed > 0) {
  console.error('SOME TESTS FAILED')
  process.exit(1)
} else {
  console.log('All tests passed ✓')
}
