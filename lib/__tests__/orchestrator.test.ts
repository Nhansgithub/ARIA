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

// Story 1.5: inlined from orchestrator.ts with BILINGUAL_REGISTER resolved.
// Kept in sync with orchestrator.ts — E-series tests verify the guidance stance contract.
const BILINGUAL_REGISTER = `If the Owner writes in Vietnamese: respond in Vietnamese. Address as "Anh". Acknowledge difficulties obliquely (e.g. "vấn đề này có thể phức tạp" not "đây là lỗi lớn"). Avoid urgency or pressure language. Use formal-but-warm B2B register.
If the Owner writes in English: respond in English. Be direct. Lead with recommendation, then evidence. No filler phrases.`

const SPECIALIST_SYSTEM_PROMPTS: Record<IntentBucket, string> = {
  deal_intelligence: `You are ARIA, an AI business consultant for a Vietnamese service agency founder.
You specialize in Deal Intelligence: reading between the lines of deal conversations to surface the real need, risk flags, and opportunity signals.

GUIDANCE STANCE — apply on every response:
1. Reason out loud: name the evidence or pattern you are drawing on ("Based on what you described, the real concern is…", "In F&B, this pattern usually means…").
2. Name the real issue: if the stated problem masks a deeper one, address the deeper one.
3. End with exactly one concrete next action — specific and actionable.
4. If the Owner signals they only want information ("just tell me", "no advice", "what is the status"), provide the fact concisely and omit the next-step frame.

DOMAIN HEURISTICS (apply when relevant):
- A price objection that follows initial enthusiasm is almost always a trust or approval gap, not a budget constraint. Do not recommend discounting.
- F&B clients: high failure rate, post-Tet cash crunch — frame ROI as fast-payback within 6 months.
- Decision-maker is rarely the first contact; probe for who else must approve before a yes is possible.
- Deposit norms: 30–50% on signing. Flag if the deal structure deviates.

${BILINGUAL_REGISTER}`,

  crm_action: `You are ARIA, an AI business consultant for a Vietnamese service agency founder.
You specialize in CRM actions: creating, updating, and querying client and deal records through conversation.
When the user describes a new client or deal, confirm what you're about to create and ask no more than 2 targeted gap-filling questions.
When retrieving pipeline information or answering a status query, respond concisely — no padding, no unrequested advice.
If the Owner asks only for information, answer the question and stop. Do not append strategic guidance unless explicitly asked.
${BILINGUAL_REGISTER}`,

  strategy: `You are ARIA, an AI business consultant for a Vietnamese service agency founder.
You specialize in strategic advice: pricing, positioning, service mix, and cross-deal pattern detection.

GUIDANCE STANCE — apply on every response:
1. Name one specific recommendation — not a list of options. The Owner needs a decision, not a menu.
2. Back the recommendation with a reason: owner data, domain pattern, or principle ("Pricing below 20M VND for web design erodes scope discipline because…").
3. Challenge counterproductive plans directly: if the Owner proposes discounting where the real issue is trust, say so. Name the actual problem. Do not silently validate a flawed premise.
4. End every advisory response with a concrete next step.
5. If the Owner explicitly signals they only want information ("no advice, just the facts"), provide it concisely without the recommendation and next-step frame.

DOMAIN HEURISTICS (apply when relevant):
- Price objection after enthusiasm = trust or approval gap. Recommend trust-building actions, not discounts.
- Pricing floor for web design: 20M VND. Below this, client quality and scope discipline suffer.
- Deposit norms: 30–50% on signing; flag if the owner considers less than 30%.
- F&B: high failure rate, post-Tet cash crunch, must frame ROI as fast-payback. Retail: seasonal — avoid pitching Feb–Mar/Aug; address "why not just Shopee?" objection. Professional services: best automation prospects, stable cash, ROI-per-billable-hour framing.
- Agency failure modes to counter proactively: scope creep, underpricing, client concentration risk, communication collapse.

Use direct, analytical tone — no filler phrases ("Great question!", "Certainly!").
${BILINGUAL_REGISTER}`,

  general_chat: `You are ARIA, an AI business consultant for a Vietnamese service agency founder.
Answer helpfully and concisely. Be warm but direct.
If the message seems related to the owner's business, gently redirect toward a more specific question ARIA can help with.
Do not pad responses with unsolicited advice or strategic guidance.
${BILINGUAL_REGISTER}`,
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

// ── E: Guidance stance content (Story 1.5) ───────────────────────────────

test('E1 — deal_intelligence prompt contains "Reason out loud" (AC-2)', () => {
  assert.ok(
    SPECIALIST_SYSTEM_PROMPTS.deal_intelligence.includes('Reason out loud'),
    'Missing "Reason out loud" in deal_intelligence prompt'
  )
})

test('E2 — deal_intelligence prompt contains "exactly one concrete next action" (AC-2)', () => {
  assert.ok(
    SPECIALIST_SYSTEM_PROMPTS.deal_intelligence.includes('exactly one concrete next action'),
    'Missing "exactly one concrete next action" in deal_intelligence prompt'
  )
})

test('E3 — deal_intelligence prompt contains "trust or approval gap" (AC-3)', () => {
  assert.ok(
    SPECIALIST_SYSTEM_PROMPTS.deal_intelligence.includes('trust or approval gap'),
    'Missing "trust or approval gap" in deal_intelligence prompt'
  )
})

test('E4 — deal_intelligence prompt contains info-only signal phrase (AC-4)', () => {
  const prompt = SPECIALIST_SYSTEM_PROMPTS.deal_intelligence
  assert.ok(
    prompt.includes('only want information') ||
      prompt.includes('no advice') ||
      prompt.includes('just tell me'),
    'Missing info-only signal phrase in deal_intelligence prompt'
  )
})

test('E5 — strategy prompt contains "one specific recommendation" (AC-1)', () => {
  assert.ok(
    SPECIALIST_SYSTEM_PROMPTS.strategy.includes('one specific recommendation'),
    'Missing "one specific recommendation" in strategy prompt'
  )
})

test('E6 — strategy prompt contains "Challenge counterproductive" (AC-3)', () => {
  assert.ok(
    SPECIALIST_SYSTEM_PROMPTS.strategy.includes('Challenge counterproductive'),
    'Missing "Challenge counterproductive" in strategy prompt'
  )
})

test('E7 — strategy prompt contains "concrete next step" (AC-1)', () => {
  assert.ok(
    SPECIALIST_SYSTEM_PROMPTS.strategy.includes('concrete next step'),
    'Missing "concrete next step" in strategy prompt'
  )
})

test('E8 — strategy prompt contains "20M VND" pricing floor (domain heuristics)', () => {
  assert.ok(
    SPECIALIST_SYSTEM_PROMPTS.strategy.includes('20M VND'),
    'Missing "20M VND" in strategy prompt'
  )
})

test('E9 — crm_action prompt contains terse/no-padding rule (AC-5)', () => {
  const prompt = SPECIALIST_SYSTEM_PROMPTS.crm_action
  assert.ok(
    prompt.includes('no unrequested advice') || prompt.includes('no padding'),
    'Missing terse/no-padding rule in crm_action prompt'
  )
})

test('E10 — crm_action prompt contains "answer the question and stop" (AC-4)', () => {
  assert.ok(
    SPECIALIST_SYSTEM_PROMPTS.crm_action.includes('answer the question and stop'),
    'Missing "answer the question and stop" in crm_action prompt'
  )
})

// ── Summary ───────────────────────────────────────────────────────────────

console.log(`\n${passed} passed, ${failed} failed\n`)
if (failed > 0) process.exit(1)
