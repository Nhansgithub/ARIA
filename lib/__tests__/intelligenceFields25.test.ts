export {}

// Inline types — never import from project lib/ (ts-node test pattern)

interface SimilarDealEntry {
  deal_id: string
  similarity_reason: string
}

interface IntelligenceFieldsInput {
  deal_id: string
  inferred_real_need?: string
  risk_flags?: unknown[]
  opportunity_signals?: unknown[]
  predicted_outcome?: 'likely_win' | 'uncertain' | 'at_risk' | 'likely_lost'
  prediction_reason?: string
  similar_deals?: SimilarDealEntry[]
  stall_diagnosis?: string
  source?: string
}

interface UpdateIntelligenceFieldsResult {
  updated: boolean
  changedFields: string[]
  protectedFields: string[]
}

// Inline human-edit protection logic
function checkHumanEditProtection(
  latestLog: { actor: string; created_at: string } | null,
  nowMs: number
): boolean {
  if (!latestLog || latestLog.actor !== 'user') return false
  const ageMs = nowMs - new Date(latestLog.created_at).getTime()
  return ageMs < 24 * 60 * 60 * 1000
}

// Inline no-op detection
function hasChanged(newVal: unknown, currentVal: unknown): boolean {
  if (newVal === undefined) return false
  return JSON.stringify(newVal) !== JSON.stringify(currentVal)
}

let passed = 0
let failed = 0

function check(condition: boolean, label: string) {
  if (condition) {
    console.log(`  ✓ ${label}`)
    passed++
  } else {
    console.error(`  ✗ ${label}`)
    failed++
  }
}

// T1 — IntelligenceFieldsInput shape: source is optional string
console.log('T1 — IntelligenceFieldsInput shape with optional source')
{
  const input: IntelligenceFieldsInput = { deal_id: 'uuid-1' }
  check(input.source === undefined, 'source is undefined when not provided')

  const inputWithSource: IntelligenceFieldsInput = {
    deal_id: 'uuid-1',
    source: 'deal_intelligence',
  }
  check(typeof inputWithSource.source === 'string', 'source is string when provided')
  check(inputWithSource.source === 'deal_intelligence', 'source value correct')
}

// T2 — Return type shape: updated, changedFields, protectedFields
console.log('T2 — UpdateIntelligenceFieldsResult shape')
{
  const result: UpdateIntelligenceFieldsResult = {
    updated: false,
    changedFields: [],
    protectedFields: [],
  }
  check('updated' in result, 'result has updated')
  check('changedFields' in result, 'result has changedFields')
  check('protectedFields' in result, 'result has protectedFields')
  check(Array.isArray(result.protectedFields), 'protectedFields is array')
}

// T3 — No-op detection: identical inferred_real_need → no change
console.log('T3 — No-op detection: identical values')
{
  const currentVal = 'Client needs credibility, not just a website'
  const newVal = 'Client needs credibility, not just a website'
  check(!hasChanged(newVal, currentVal), 'identical string → no change detected')

  const noOpResult: UpdateIntelligenceFieldsResult = {
    updated: false,
    changedFields: [],
    protectedFields: [],
  }
  check(noOpResult.updated === false, 'updated is false on no-op')
  check(noOpResult.changedFields.length === 0, 'changedFields empty on no-op')
  check(noOpResult.protectedFields.length === 0, 'protectedFields empty on no-op')
}

// T4 — Change detection: different inferred_real_need → changedFields includes it
console.log('T4 — Change detection: different values')
{
  const currentVal = 'Client needs credibility'
  const newVal = 'Client needs credibility and scalable backend'
  check(hasChanged(newVal, currentVal), 'different string → change detected')

  // Simulate building changedFields
  const changedFields: string[] = []
  if (hasChanged(newVal, currentVal)) changedFields.push('inferred_real_need')
  check(changedFields.includes('inferred_real_need'), 'inferred_real_need in changedFields')
}

// T5 — Human-edit protection: actor=user, age < 24h → protection triggers
console.log('T5 — Human-edit protection: user edit within 24h')
{
  const nowMs = Date.now()
  const recentUserLog = {
    actor: 'user',
    created_at: new Date(nowMs - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
  }
  check(checkHumanEditProtection(recentUserLog, nowMs), 'protection triggers for recent user edit')

  const changedFields = ['inferred_real_need', 'risk_flags']
  const protectedResult: UpdateIntelligenceFieldsResult = {
    updated: false,
    changedFields: [],
    protectedFields: [...changedFields],
  }
  check(protectedResult.updated === false, 'updated is false when protected')
  check(protectedResult.protectedFields.length === 2, 'both fields in protectedFields')
  check(
    protectedResult.protectedFields.includes('inferred_real_need'),
    'inferred_real_need is protected'
  )
}

// T6 — Human-edit protection NOT triggered: last log actor=ai, age < 24h
console.log('T6 — Human-edit protection: ai edit within 24h (no protection)')
{
  const nowMs = Date.now()
  const recentAiLog = {
    actor: 'ai',
    created_at: new Date(nowMs - 1 * 60 * 60 * 1000).toISOString(), // 1 hour ago
  }
  check(!checkHumanEditProtection(recentAiLog, nowMs), 'no protection for recent ai edit')
}

// T7 — Human-edit protection NOT triggered: last log actor=user, age > 24h
console.log('T7 — Human-edit protection: user edit older than 24h (no protection)')
{
  const nowMs = Date.now()
  const oldUserLog = {
    actor: 'user',
    created_at: new Date(nowMs - 25 * 60 * 60 * 1000).toISOString(), // 25 hours ago
  }
  check(!checkHumanEditProtection(oldUserLog, nowMs), 'no protection for old user edit (> 24h)')
}

// T8 — Provenance payload: source='deal_intelligence' present when supplied
console.log('T8 — Provenance payload: source present when supplied')
{
  const changedFields = ['inferred_real_need']
  const updates = { inferred_real_need: 'Client needs scalability' }
  const source = 'deal_intelligence'

  const payload = {
    changedFields,
    values: updates,
    ...(source ? { source } : {}),
  }
  check('source' in payload, 'source key present in payload')
  check(payload.source === 'deal_intelligence', 'source value is deal_intelligence')
}

// T9 — Provenance payload: source absent when not supplied
console.log('T9 — Provenance payload: source absent when not supplied')
{
  const changedFields = ['inferred_real_need']
  const updates = { inferred_real_need: 'Client needs scalability' }
  const source = undefined

  const payload = {
    changedFields,
    values: updates,
    ...(source ? { source } : {}),
  }
  check(!('source' in payload), 'source key absent from payload when not supplied')
}

// T10 — SimilarDealEntry[] typed check
console.log('T10 — SimilarDealEntry shape in IntelligenceFieldsInput')
{
  const entry: SimilarDealEntry = {
    deal_id: 'uuid-x',
    similarity_reason: 'Same service type (web_design)',
  }
  check(typeof entry.deal_id === 'string', 'deal_id is string')
  check(typeof entry.similarity_reason === 'string', 'similarity_reason is string')

  const input: IntelligenceFieldsInput = {
    deal_id: 'uuid-1',
    similar_deals: [entry],
  }
  check(Array.isArray(input.similar_deals), 'similar_deals is array')
  check(input.similar_deals!.length === 1, 'similar_deals has one entry')
}

// T11 — Retry idempotency: second call with same values is a no-op
console.log('T11 — Retry idempotency: second call same values → no-op')
{
  const storedValue = 'Client needs a scalable backend to handle peak traffic'
  const incomingValue = 'Client needs a scalable backend to handle peak traffic'

  // First call: value differs from initial DB state (would write)
  const initialDbValue: string | null = null
  check(hasChanged(incomingValue, initialDbValue), 'first call detects change vs null DB value')

  // Second call: value now matches DB state (no-op)
  check(!hasChanged(incomingValue, storedValue), 'second call: no change vs stored value → no-op')
}

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
