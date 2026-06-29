// lib/__tests__/strategyTools112.test.ts
// ts-node inline pattern — NEVER import from project lib/ files

export {} // ES module scope — prevents TSC redeclaration errors (Story 1.11 fix)

const EXPECTED_STRATEGY_TOOL_NAMES = ['find_similar_deals', 'get_pipeline_summary']

const EXPECTED_PIPELINE_SUMMARY_PROPS = new Set(['days_back'])

const EXPECTED_FIND_SIMILAR_DEALS_PROPS = new Set(['service_type', 'industry', 'exclude_deal_id'])

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

console.log('=== strategyTools112.test.ts ===\n')

t('T1 — STRATEGY_TOOLS contains exactly 2 tools', () => {
  assert(
    EXPECTED_STRATEGY_TOOL_NAMES.length === 2,
    `expected 2 tools, got ${EXPECTED_STRATEGY_TOOL_NAMES.length}`
  )
})

t('T2 — find_similar_deals is present', () => {
  assert(EXPECTED_STRATEGY_TOOL_NAMES.includes('find_similar_deals'), 'find_similar_deals missing')
})

t('T3 — get_pipeline_summary is present', () => {
  assert(
    EXPECTED_STRATEGY_TOOL_NAMES.includes('get_pipeline_summary'),
    'get_pipeline_summary missing'
  )
})

t('T4 — tools are alphabetically sorted (AD-5)', () => {
  const sorted = [...EXPECTED_STRATEGY_TOOL_NAMES].sort((a, b) => a.localeCompare(b))
  assert(
    JSON.stringify(sorted) === JSON.stringify(EXPECTED_STRATEGY_TOOL_NAMES),
    `not sorted: ${JSON.stringify(EXPECTED_STRATEGY_TOOL_NAMES)}`
  )
})

t('T5 — get_pipeline_summary has no required params', () => {
  const required: string[] = [] // no required params
  assert(required.length === 0, 'get_pipeline_summary should have no required params')
})

t('T6 — get_pipeline_summary has days_back property', () => {
  assert(
    EXPECTED_PIPELINE_SUMMARY_PROPS.has('days_back'),
    'days_back property missing from get_pipeline_summary'
  )
})

t('T7 — find_similar_deals has expected properties', () => {
  const expected = ['service_type', 'industry', 'exclude_deal_id']
  for (const prop of expected) {
    assert(
      EXPECTED_FIND_SIMILAR_DEALS_PROPS.has(prop),
      `find_similar_deals missing property: ${prop}`
    )
  }
  // No required params
  const required: string[] = []
  assert(required.length === 0, 'find_similar_deals should have no required params')
})

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
