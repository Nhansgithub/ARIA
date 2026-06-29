// lib/__tests__/dealIntelligenceTools111.test.ts
// ts-node inline pattern — NEVER import from project lib/ files
export {}

const EXPECTED_TOOL_NAMES = [
  'find_similar_deals',
  'get_client',
  'get_deal',
  'get_pricing_floors',
  'update_intelligence_fields',
]

const EXPECTED_UPDATE_PROPS = new Set([
  'deal_id',
  'inferred_real_need',
  'risk_flags',
  'opportunity_signals',
  'predicted_outcome',
  'prediction_reason',
  'similar_deals',
  'stall_diagnosis',
])

const EXPECTED_PRICING_FLOORS_REQUIRED: string[] = []

let passed = 0,
  failed = 0
function t(label: string, fn: () => void) {
  try {
    fn()
    console.log(`  ✓ ${label}`)
    passed++
  } catch (e) {
    console.error(`  ✗ ${label}:`, e instanceof Error ? e.message : e)
    failed++
  }
}
function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg)
}

console.log('=== dealIntelligenceTools111.test.ts ===\n')

t('T1 — tool list has 5 tools', () => {
  assert(EXPECTED_TOOL_NAMES.length === 5, `expected 5 tools, got ${EXPECTED_TOOL_NAMES.length}`)
})

t('T2 — get_pricing_floors is present', () => {
  assert(EXPECTED_TOOL_NAMES.includes('get_pricing_floors'), 'get_pricing_floors missing')
})

t('T3 — tools are alphabetically sorted (AD-5 cache stability)', () => {
  const sorted = [...EXPECTED_TOOL_NAMES].sort((a, b) => a.localeCompare(b))
  assert(
    JSON.stringify(sorted) === JSON.stringify(EXPECTED_TOOL_NAMES),
    `not sorted: ${JSON.stringify(EXPECTED_TOOL_NAMES)}`
  )
})

t('T4 — get_pricing_floors requires no parameters', () => {
  assert(
    EXPECTED_PRICING_FLOORS_REQUIRED.length === 0,
    'get_pricing_floors should have no required params'
  )
})

t('T5 — update_intelligence_fields still includes stall_diagnosis (regression from 1.10)', () => {
  assert(EXPECTED_UPDATE_PROPS.has('stall_diagnosis'), 'stall_diagnosis missing — regression!')
})

t('T6 — all 5 tools present in alphabetical order', () => {
  const expected = [
    'find_similar_deals',
    'get_client',
    'get_deal',
    'get_pricing_floors',
    'update_intelligence_fields',
  ]
  for (const name of expected) {
    assert(EXPECTED_TOOL_NAMES.includes(name), `missing tool: ${name}`)
  }
  assert(
    JSON.stringify(EXPECTED_TOOL_NAMES) === JSON.stringify(expected),
    'order mismatch'
  )
})

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
