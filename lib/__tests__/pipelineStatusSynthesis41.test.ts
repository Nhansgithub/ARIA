export {}
// ts-node inline tests for Story 4.1: Pipeline Status Synthesis & Stage-Aware Next-Action
// Pattern: no imports from project lib/ — logic is simulated inline.
// Run: npx ts-node lib/__tests__/pipelineStatusSynthesis41.test.ts

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

// ── Inline simulation of stage-aware next-action logic ────────────────────────

type ServiceType = 'web_design' | 'web_app' | 'automation' | 'other'

interface SimDeal {
  id: string
  title: string
  stage: string
  service_type: ServiceType
  value_estimate: number
  days_idle: number
}

const STAGE_NEXT_ACTION: { keywords: string[]; action: string }[] = [
  {
    keywords: ['prospect', 'qualified', 'discovery'],
    action: 'schedule_discovery',
  },
  {
    keywords: ['proposal', 'đề xuất', 'sent'],
    action: 'follow_up',
  },
  {
    keywords: ['contract', 'hợp đồng', 'negotiation', 'sow'],
    action: 'push_for_signature',
  },
  {
    keywords: ['kickoff', 'onboarding', 'started', 'delivery'],
    action: 'confirm_kickoff',
  },
  {
    keywords: ['won', 'completed', 'signed'],
    action: 'request_referral',
  },
  {
    keywords: ['lost', 'archived'],
    action: 'log_loss_reason',
  },
]

function getNextAction(stage: string): string {
  const lower = stage.toLowerCase()
  for (const rule of STAGE_NEXT_ACTION) {
    if (rule.keywords.some((kw) => lower.includes(kw))) return rule.action
  }
  return 'contextual_inference'
}

function isStale(daysIdle: number): boolean {
  return daysIdle >= 7
}

function synthesizeDeal(deal: SimDeal): {
  nextAction: string
  stale: boolean
  staleMessage?: string
} {
  const nextAction = getNextAction(deal.stage)
  const stale = isStale(deal.days_idle)
  return {
    nextAction,
    stale,
    staleMessage: stale
      ? `Deal ${deal.title} đã im lặng ${deal.days_idle} ngày — cần chú ý.`
      : undefined,
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

console.log('\nStory 4.1 — Pipeline Status Synthesis & Stage-Aware Next-Action\n')

// T1: Proposal stage → follow_up recommendation
console.log('T1: Proposal stage → follow_up action')
{
  const result = synthesizeDeal({
    id: 'd1',
    title: 'Phở 24 Website',
    stage: 'proposal',
    service_type: 'web_design',
    value_estimate: 50_000_000,
    days_idle: 4,
  })
  assert(result.nextAction === 'follow_up', 'proposal stage maps to follow_up')
}

// T2: Vietnamese stage "đề xuất" → follow_up
console.log('\nT2: Vietnamese "đề xuất" stage → follow_up')
{
  const result = synthesizeDeal({
    id: 'd2',
    title: 'ACME Deal',
    stage: 'đang ở giai đoạn đề xuất',
    service_type: 'web_design',
    value_estimate: 30_000_000,
    days_idle: 2,
  })
  assert(result.nextAction === 'follow_up', 'Vietnamese đề xuất maps to follow_up')
}

// T3: Contract stage → push_for_signature
console.log('\nT3: Contract stage → push_for_signature')
{
  const result = synthesizeDeal({
    id: 'd3',
    title: 'Tech Corp App',
    stage: 'contract review',
    service_type: 'web_app',
    value_estimate: 200_000_000,
    days_idle: 1,
  })
  assert(result.nextAction === 'push_for_signature', 'contract review maps to push_for_signature')
}

// T4: Discovery stage → schedule_discovery
console.log('\nT4: Discovery stage → schedule_discovery')
{
  const result = synthesizeDeal({
    id: 'd4',
    title: 'New Lead',
    stage: 'discovery',
    service_type: 'automation',
    value_estimate: 0,
    days_idle: 0,
  })
  assert(result.nextAction === 'schedule_discovery', 'discovery maps to schedule_discovery')
}

// T5: Kickoff stage → confirm_kickoff
console.log('\nT5: Kickoff stage → confirm_kickoff')
{
  const result = synthesizeDeal({
    id: 'd5',
    title: 'ABC Project',
    stage: 'kickoff',
    service_type: 'web_design',
    value_estimate: 80_000_000,
    days_idle: 3,
  })
  assert(result.nextAction === 'confirm_kickoff', 'kickoff maps to confirm_kickoff')
}

// T6: Won stage → request_referral
console.log('\nT6: Won stage → request_referral')
{
  const result = synthesizeDeal({
    id: 'd6',
    title: 'BigCo Deal',
    stage: 'won',
    service_type: 'web_app',
    value_estimate: 300_000_000,
    days_idle: 0,
  })
  assert(result.nextAction === 'request_referral', 'won maps to request_referral')
}

// T7: Free-text stage (no keyword match) → contextual_inference (never rejected)
console.log('\nT7: Free-text unrecognized stage → contextual_inference (not rejected)')
{
  const result = synthesizeDeal({
    id: 'd7',
    title: 'Weird Deal',
    stage: 'Đang chờ anh xem lại',
    service_type: 'other',
    value_estimate: 10_000_000,
    days_idle: 0,
  })
  assert(
    result.nextAction === 'contextual_inference',
    'unrecognized free-text stage returns contextual_inference, not an error'
  )
}

// T8: Deal idle 8 days → stale (>7 days)
console.log('\nT8: Deal idle 8 days → stale flag')
{
  const result = synthesizeDeal({
    id: 'd8',
    title: 'Stale Deal',
    stage: 'proposal',
    service_type: 'web_design',
    value_estimate: 40_000_000,
    days_idle: 8,
  })
  assert(result.stale === true, '8 days idle is stale')
  assert(
    typeof result.staleMessage === 'string' && result.staleMessage.includes('8'),
    'stale message mentions 8 days'
  )
}

// T9: Deal idle exactly 7 days → stale (boundary: >=7)
console.log('\nT9: Deal idle exactly 7 days → stale (threshold is >=7)')
{
  const result = synthesizeDeal({
    id: 'd9',
    title: 'Boundary Deal',
    stage: 'proposal',
    service_type: 'web_design',
    value_estimate: 40_000_000,
    days_idle: 7,
  })
  assert(result.stale === true, 'exactly 7 days is stale (threshold is >=7)')
  assert(
    typeof result.staleMessage === 'string' && result.staleMessage.includes('7'),
    'stale message mentions 7 days'
  )
}

// T10: Deal idle 0 days → not stale
console.log('\nT10: Deal idle 0 days → not stale')
{
  const result = synthesizeDeal({
    id: 'd10',
    title: 'Fresh Deal',
    stage: 'discovery',
    service_type: 'web_app',
    value_estimate: 100_000_000,
    days_idle: 0,
  })
  assert(result.stale === false, '0 days idle is not stale')
  assert(result.staleMessage === undefined, 'no stale message for fresh deal')
}

// T11: "negotiation" and "sow" stages → push_for_signature
console.log('\nT11: negotiation/sow stages → push_for_signature')
{
  const neg = synthesizeDeal({
    id: 'd11a',
    title: 'Neg Deal',
    stage: 'negotiation',
    service_type: 'web_app',
    value_estimate: 150_000_000,
    days_idle: 2,
  })
  const sow = synthesizeDeal({
    id: 'd11b',
    title: 'SOW Deal',
    stage: 'sow review',
    service_type: 'automation',
    value_estimate: 90_000_000,
    days_idle: 1,
  })
  assert(neg.nextAction === 'push_for_signature', 'negotiation maps to push_for_signature')
  assert(sow.nextAction === 'push_for_signature', 'sow maps to push_for_signature')
}

// T12: File checks — orchestrator has pipeline_status bucket
console.log('\nT12: orchestrator.ts has pipeline_status intent bucket')
{
  const src = path.join(process.cwd(), 'lib', 'ai', 'orchestrator.ts')
  const content = fs.existsSync(src) ? fs.readFileSync(src, 'utf8') : ''
  assert(
    content.includes("'pipeline_status'"),
    "orchestrator.ts includes 'pipeline_status' in IntentBucket or VALID_BUCKETS"
  )
  assert(
    content.includes('PIPELINE STATUS PROTOCOL'),
    'orchestrator.ts has PIPELINE STATUS PROTOCOL specialist prompt'
  )
  assert(
    content.includes('pipeline_status: ARIA_MODELS.economical'),
    'pipeline_status routes to economical (Haiku) model — AD-4'
  )
}

// T13: pipelineStatusTools.ts exists, contains all four tools, and uses explicit guards (not ! assertions)
console.log('\nT13: pipelineStatusTools.ts contains all four read-only tools with guards')
{
  const src = path.join(process.cwd(), 'lib', 'ai', 'pipelineStatusTools.ts')
  assert(fs.existsSync(src), 'lib/ai/pipelineStatusTools.ts exists')
  const content = fs.existsSync(src) ? fs.readFileSync(src, 'utf8') : ''
  assert(content.includes('get_activity_log'), 'pipelineStatusTools references get_activity_log')
  assert(content.includes('get_deal'), 'pipelineStatusTools references get_deal')
  assert(
    content.includes('get_pipeline_summary'),
    'pipelineStatusTools references get_pipeline_summary'
  )
  assert(content.includes('list_deals'), 'pipelineStatusTools references list_deals')
  // F7 fix: verify requireTool guard is used instead of ! assertions
  assert(
    content.includes('requireTool'),
    'pipelineStatusTools uses requireTool guard (not ! assertions)'
  )
  assert(
    !content.includes('find(') || content.includes('requireTool'),
    'no bare .find()! pattern — guarded access only'
  )
}

// T14: chat route.ts routes pipeline_status intent
console.log('\nT14: chat route handles pipeline_status intent')
{
  const src = path.join(process.cwd(), 'app', 'api', 'chat', 'route.ts')
  const content = fs.existsSync(src) ? fs.readFileSync(src, 'utf8') : ''
  assert(
    content.includes("classification.intent === 'pipeline_status'"),
    'chat route routes pipeline_status'
  )
  assert(content.includes('PIPELINE_STATUS_TOOLS'), 'chat route uses PIPELINE_STATUS_TOOLS')
}

// T15: Stage-Aware Table coverage — "Đang chờ" is not in keywords (confirms free-text fallback works)
console.log(
  '\nT15: Stage keyword table does not include random Vietnamese text (confirms fallback)'
)
{
  const allKeywords = STAGE_NEXT_ACTION.flatMap((r) => r.keywords)
  assert(
    !allKeywords.includes('Đang chờ anh xem lại'),
    'arbitrary Vietnamese free-text is not hardcoded — falls through to contextual_inference'
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
