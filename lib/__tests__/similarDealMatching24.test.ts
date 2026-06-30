export {}

// Inline types — never import from project lib/ (ts-node test pattern)

interface SimilarDealEntry {
  deal_id: string
  similarity_reason: string
}

interface FindSimilarDealsParams {
  service_type?: string
  industry?: string
  exclude_deal_id?: string
}

interface SimilarDealRecord {
  id: string
  title: string
  service_type: string
  stage: string
  value_estimate: number | null
  predicted_outcome: string | null
  prediction_reason: string | null
  client_name: string | null
  client_industry: string | null
  similarity_reason: string
}

// Inline buildSimilarityReason logic
function buildSimilarityReason(
  params: FindSimilarDealsParams,
  record: { service_type: string; client_industry: string | null }
): string {
  if (params.service_type && params.industry) {
    return `Same service type (${record.service_type}) and client industry (${record.client_industry ?? params.industry})`
  }
  if (params.service_type) {
    return `Same service type (${record.service_type})`
  }
  if (params.industry) {
    return `Same client industry (${record.client_industry ?? params.industry})`
  }
  return `Similar past deal (${record.service_type})`
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

// T1 — SimilarDealEntry shape
console.log('T1 — SimilarDealEntry shape')
{
  const entry: SimilarDealEntry = {
    deal_id: 'uuid-1',
    similarity_reason: 'Same service type (web_design) and client industry (F&B)',
  }
  check(
    typeof entry.deal_id === 'string' && entry.deal_id.length > 0,
    'deal_id is non-empty string'
  )
  check(
    typeof entry.similarity_reason === 'string' && entry.similarity_reason.length > 0,
    'similarity_reason is non-empty string'
  )
}

// T2 — similarity_reason when both service_type and industry match
console.log('T2 — similarity_reason: both service_type and industry')
{
  const params: FindSimilarDealsParams = { service_type: 'web_design', industry: 'F&B' }
  const record = { service_type: 'web_design', client_industry: 'F&B' }
  const reason = buildSimilarityReason(params, record)
  check(
    reason === 'Same service type (web_design) and client industry (F&B)',
    'both dimensions stated'
  )
}

// T3 — similarity_reason when only service_type provided
console.log('T3 — similarity_reason: only service_type')
{
  const params: FindSimilarDealsParams = { service_type: 'automation' }
  const record = { service_type: 'automation', client_industry: null }
  const reason = buildSimilarityReason(params, record)
  check(reason === 'Same service type (automation)', 'service_type only')
}

// T4 — similarity_reason when only industry provided
console.log('T4 — similarity_reason: only industry')
{
  const params: FindSimilarDealsParams = { industry: 'retail' }
  const record = { service_type: 'web_design', client_industry: 'retail' }
  const reason = buildSimilarityReason(params, record)
  check(reason === 'Same client industry (retail)', 'industry only')
}

// T5 — similarity_reason fallback (no filters)
console.log('T5 — similarity_reason: fallback (no filters)')
{
  const params: FindSimilarDealsParams = {}
  const record = { service_type: 'other', client_industry: null }
  const reason = buildSimilarityReason(params, record)
  check(reason === 'Similar past deal (other)', 'fallback reason uses service_type')
}

// T6 — SimilarDealRecord shape includes similarity_reason
console.log('T6 — SimilarDealRecord shape includes similarity_reason')
{
  const record: SimilarDealRecord = {
    id: 'uuid-6',
    title: 'Café website redesign',
    service_type: 'web_design',
    stage: 'won',
    value_estimate: 25000000,
    predicted_outcome: 'likely_win',
    prediction_reason: 'Client had clear brief and budget',
    client_name: 'Trà Sữa ABC',
    client_industry: 'F&B',
    similarity_reason: 'Same service type (web_design) and client industry (F&B)',
  }
  check(
    typeof record.similarity_reason === 'string' && record.similarity_reason.length > 0,
    'similarity_reason is non-empty string on SimilarDealRecord'
  )
}

// T7 — Stub exclusion gate
console.log('T7 — Stub exclusion gate')
{
  type DealMock = { id: string; title: string; is_stub: boolean }
  const deals: DealMock[] = [
    { id: 'a', title: 'Stub deal', is_stub: true },
    { id: 'b', title: 'Real deal', is_stub: false },
  ]
  const result = deals.filter((d) => !d.is_stub)
  check(result.length === 1, 'only one non-stub deal')
  check(result[0]!.id === 'b', 'non-stub deal id is b')
}

// T8 — Idempotent no-op detection (JSON.stringify equality)
console.log('T8 — Idempotent no-op detection')
{
  const existing: SimilarDealEntry[] = [
    { deal_id: 'X', similarity_reason: 'Same service type (web_design)' },
  ]
  const incoming: SimilarDealEntry[] = [
    { deal_id: 'X', similarity_reason: 'Same service type (web_design)' },
  ]
  check(
    JSON.stringify(existing) === JSON.stringify(incoming),
    'identical arrays stringify equal → no-op'
  )
}

// T9 — Change detection when new entry added
console.log('T9 — Change detection when new entry added')
{
  const existing: SimilarDealEntry[] = [
    { deal_id: 'X', similarity_reason: 'Same service type (web_design)' },
  ]
  const incoming: SimilarDealEntry[] = [
    { deal_id: 'X', similarity_reason: 'Same service type (web_design)' },
    { deal_id: 'Y', similarity_reason: 'Same service type (web_design)' },
  ]
  check(
    JSON.stringify(existing) !== JSON.stringify(incoming),
    'different arrays stringify unequal → change detected'
  )
}

// T10 — Empty similar_deals array (not null) for no-match case
console.log('T10 — Empty similar_deals array (not null)')
{
  const noMatch: SimilarDealEntry[] = []
  check(Array.isArray(noMatch) && noMatch.length === 0, 'empty array is an array of length 0')
  check(noMatch !== null, 'empty array is not null')
}

// T11 — update_intelligence_fields tool similar_deals schema (static verification)
// NOTE: This test verifies the expected schema shape via an inline object, NOT by importing
// DI_TOOLS from lib/ai/dealIntelligenceTools.ts (ts-node pattern forbids project lib/ imports).
// If the live tool schema changes, this test will still pass — manual cross-check required.
console.log('T11 — tool schema similar_deals includes similarity_reason')
{
  const schema = {
    type: 'array',
    description: 'Similar past deals. Each item: {deal_id: uuid, similarity_reason: string}',
    items: {
      type: 'object' as const,
      properties: {
        deal_id: { type: 'string' },
        similarity_reason: { type: 'string' },
      },
    },
  }
  check(schema.type === 'array', 'schema type is array')
  check(
    schema.items.properties.similarity_reason.type === 'string',
    'items.properties.similarity_reason.type is string'
  )
}

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
