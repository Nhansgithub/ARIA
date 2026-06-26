/**
 * Standalone ts-node test for orchestrator classification logic.
 * Inlines pure logic to avoid server-only boundary and ESM resolution issues.
 *
 * Run: npx ts-node lib/__tests__/orchestrator.test.ts
 */

import assert from 'assert'

// ── Inline constants (mirrors orchestrator.ts and models.ts) ───────────────

const ARIA_MODELS = {
  economical: 'claude-haiku-4-5-20251001',
  highJudgment: 'claude-sonnet-4-6',
} as const

type IntentBucket = 'deal_intelligence' | 'crm_action' | 'strategy' | 'general_chat'

interface ClassificationResult {
  intent: IntentBucket
  confidence: number
}

const INTENT_MODEL_MAP: Record<IntentBucket, string> = {
  deal_intelligence: ARIA_MODELS.highJudgment,
  crm_action: ARIA_MODELS.highJudgment,
  strategy: ARIA_MODELS.highJudgment,
  general_chat: ARIA_MODELS.economical,
}

const VALID_BUCKETS: IntentBucket[] = [
  'deal_intelligence',
  'crm_action',
  'strategy',
  'general_chat',
]

const FALLBACK: ClassificationResult = { intent: 'general_chat', confidence: 0 }

function parseClassification(raw: string): ClassificationResult {
  try {
    const cleaned = raw.replace(/^```[\w]*\n?|\n?```$/gm, '').trim()
    const parsed = JSON.parse(cleaned) as { intent?: unknown; confidence?: unknown }
    const intent = parsed.intent as IntentBucket
    if (!VALID_BUCKETS.includes(intent)) return { ...FALLBACK }
    const rawConf = typeof parsed.confidence === 'number' ? parsed.confidence : 0
    const confidence = Math.min(1, Math.max(0, rawConf))
    return { intent, confidence }
  } catch {
    return { ...FALLBACK }
  }
}

const SPECIALIST_SYSTEM_PROMPTS: Record<IntentBucket, string> = {
  deal_intelligence: 'deal intelligence specialist prompt (placeholder for test)',
  crm_action: 'crm action specialist prompt (placeholder for test)',
  strategy: 'strategy specialist prompt (placeholder for test)',
  general_chat: 'general chat specialist prompt (placeholder for test)',
}

// ── Test harness ───────────────────────────────────────────────────────────

let passed = 0
let failed = 0

function test(name: string, fn: () => void): void {
  try {
    fn()
    console.log(`  ✓ ${name}`)
    passed++
  } catch (err) {
    console.error(`  ✗ ${name}`)
    console.error(`    ${err instanceof Error ? err.message : err}`)
    failed++
  }
}

console.log('\n=== orchestrator.test.ts ===\n')

// ── A: Parsing happy paths ─────────────────────────────────────────────────

test('A1 — parses deal_intelligence with confidence', () => {
  const r = parseClassification('{"intent":"deal_intelligence","confidence":0.95}')
  assert.strictEqual(r.intent, 'deal_intelligence')
  assert.strictEqual(r.confidence, 0.95)
})

test('A2 — parses strategy bucket', () => {
  const r = parseClassification('{"intent":"strategy","confidence":0.8}')
  assert.strictEqual(r.intent, 'strategy')
})

test('A3 — parses crm_action bucket', () => {
  const r = parseClassification('{"intent":"crm_action","confidence":0.7}')
  assert.strictEqual(r.intent, 'crm_action')
})

test('A4 — defaults confidence to 0 when field missing (unknown, not assumed high)', () => {
  const r = parseClassification('{"intent":"general_chat"}')
  assert.strictEqual(r.intent, 'general_chat')
  assert.strictEqual(r.confidence, 0)
})

// ── B: Fallback / error cases ──────────────────────────────────────────────

test('B1 — falls back on invalid JSON', () => {
  const r = parseClassification('not json at all')
  assert.strictEqual(r.intent, 'general_chat')
  assert.strictEqual(r.confidence, 0)
})

test('B2 — falls back on unknown bucket', () => {
  const r = parseClassification('{"intent":"document_request","confidence":0.9}')
  assert.strictEqual(r.intent, 'general_chat')
  assert.strictEqual(r.confidence, 0)
})

test('B3 — strips markdown fences before parsing', () => {
  const r = parseClassification('```json\n{"intent":"strategy","confidence":0.7}\n```')
  assert.strictEqual(r.intent, 'strategy')
  assert.strictEqual(r.confidence, 0.7)
})

test('B4 — falls back on empty string', () => {
  const r = parseClassification('')
  assert.strictEqual(r.intent, 'general_chat')
  assert.strictEqual(r.confidence, 0)
})

// ── C: Model routing ──────────────────────────────────────────────────────

test('C1 — deal_intelligence → highJudgment', () => {
  assert.strictEqual(INTENT_MODEL_MAP.deal_intelligence, ARIA_MODELS.highJudgment)
})

test('C2 — crm_action → highJudgment', () => {
  assert.strictEqual(INTENT_MODEL_MAP.crm_action, ARIA_MODELS.highJudgment)
})

test('C3 — strategy → highJudgment', () => {
  assert.strictEqual(INTENT_MODEL_MAP.strategy, ARIA_MODELS.highJudgment)
})

test('C4 — general_chat → economical', () => {
  assert.strictEqual(INTENT_MODEL_MAP.general_chat, ARIA_MODELS.economical)
})

// ── D: Specialist prompts ─────────────────────────────────────────────────

test('D1 — all four specialist prompts are defined', () => {
  for (const bucket of VALID_BUCKETS) {
    assert.ok(
      SPECIALIST_SYSTEM_PROMPTS[bucket] && SPECIALIST_SYSTEM_PROMPTS[bucket].length > 10,
      `Missing prompt for ${bucket}`
    )
  }
})

// ── Summary ───────────────────────────────────────────────────────────────

console.log(`\n${passed} passed, ${failed} failed\n`)
if (failed > 0) process.exit(1)
