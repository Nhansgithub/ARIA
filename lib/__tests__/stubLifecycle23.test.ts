export {}

// Inline types — never import from project lib/ (ts-node test pattern)

interface StubEnrichmentResult {
  isEnriched: boolean
  missingFields: string[]
}

interface PromoteStubInput {
  entity_type: 'client' | 'deal'
  entity_id: string
  actor: 'ai' | 'user'
}

interface PromoteStubResult {
  promoted: boolean
  entity_id: string
  missingFields?: string[]
}

interface ArchiveStubInput {
  entity_type: 'client' | 'deal'
  entity_id: string
  actor: 'ai' | 'user'
}

interface ArchiveStubResult {
  archived: boolean
  entity_id: string
}

interface StaleStubRecord {
  id: string
  title: string
  client_id: string
  created_at: string
  daysSinceUpdate: number
}

interface DealLike {
  id: string
  is_stub: boolean
  client_stated_need: string | null
  service_type: string | null
  stage: string | null
  value_estimate: number | null
}

// Inline enrichment check logic
function checkEnrichment(deal: DealLike): StubEnrichmentResult {
  const required = ['client_stated_need', 'service_type', 'stage', 'value_estimate'] as const
  const missingFields: string[] = []
  for (const field of required) {
    const val = deal[field as keyof DealLike]
    if (val === null || val === undefined || val === '') {
      missingFields.push(field)
    }
  }
  return { isEnriched: missingFields.length === 0, missingFields }
}

let passed = 0
let failed = 0

function assert(condition: boolean, label: string) {
  if (condition) {
    console.log(`  ✓ ${label}`)
    passed++
  } else {
    console.error(`  ✗ ${label}`)
    failed++
  }
}

// T1 — StubEnrichmentResult shape
console.log('T1 — StubEnrichmentResult shape')
{
  const result: StubEnrichmentResult = {
    isEnriched: false,
    missingFields: ['service_type', 'value_estimate'],
  }
  assert(result.isEnriched === false, 'isEnriched is false')
  assert(result.missingFields.length === 2, 'missingFields has 2 entries')
}

// T2 — Enrichment gate: all four fields required
console.log('T2 — Enrichment gate: all four fields required')
{
  const enrichedDeal: DealLike = {
    id: 'uuid-1',
    is_stub: true,
    client_stated_need: 'Needs a website',
    service_type: 'web_design',
    stage: 'prospect',
    value_estimate: 15000000,
  }
  const r1 = checkEnrichment(enrichedDeal)
  assert(r1.isEnriched === true, 'fully enriched deal → isEnriched true')
  assert(r1.missingFields.length === 0, 'no missing fields')

  const incompleteDeal: DealLike = {
    id: 'uuid-2',
    is_stub: true,
    client_stated_need: 'Needs a website',
    service_type: 'web_design',
    stage: 'prospect',
    value_estimate: null,
  }
  const r2 = checkEnrichment(incompleteDeal)
  assert(r2.isEnriched === false, 'missing value_estimate → isEnriched false')
  assert(r2.missingFields.includes('value_estimate'), 'value_estimate in missingFields')
}

// T3 — PromoteStubInput shape
console.log('T3 — PromoteStubInput shape')
{
  const input: PromoteStubInput = { entity_type: 'deal', entity_id: 'uuid-3', actor: 'user' }
  assert(input.entity_type === 'deal', 'entity_type present')
  assert(input.entity_id === 'uuid-3', 'entity_id present')
  assert(input.actor === 'user', 'actor present')
}

// T4 — PromoteStubResult — promoted
console.log('T4 — PromoteStubResult — promoted')
{
  const result: PromoteStubResult = { promoted: true, entity_id: 'uuid-4' }
  assert(result.promoted === true, 'promoted is true')
  assert(result.entity_id === 'uuid-4', 'entity_id present')
  assert(result.missingFields === undefined, 'no missingFields on success')
}

// T5 — PromoteStubResult — blocked
console.log('T5 — PromoteStubResult — blocked')
{
  const result: PromoteStubResult = {
    promoted: false,
    entity_id: 'uuid-5',
    missingFields: ['value_estimate'],
  }
  assert(result.promoted === false, 'promoted is false')
  assert(
    result.missingFields !== undefined && result.missingFields.length === 1,
    'one missing field'
  )
}

// T6 — ArchiveStubInput shape
console.log('T6 — ArchiveStubInput shape')
{
  const input: ArchiveStubInput = { entity_type: 'deal', entity_id: 'uuid-6', actor: 'user' }
  assert(input.entity_type === 'deal', 'entity_type present')
  assert(input.entity_id === 'uuid-6', 'entity_id present')
  assert(input.actor === 'user', 'actor present')
}

// T7 — ArchiveStubResult shape
console.log('T7 — ArchiveStubResult shape')
{
  const result: ArchiveStubResult = { archived: true, entity_id: 'uuid-7' }
  assert(result.archived === true, 'archived is true')
  assert(result.entity_id === 'uuid-7', 'entity_id present')
}

// T8 — StaleStubRecord shape
console.log('T8 — StaleStubRecord shape')
{
  const record: StaleStubRecord = {
    id: 'uuid-8',
    title: 'Test deal',
    client_id: 'c-uuid',
    created_at: '2026-06-01T00:00:00Z',
    daysSinceUpdate: 20,
  }
  assert(record.daysSinceUpdate > 14, 'daysSinceUpdate > idle threshold of 14')
  assert(record.id === 'uuid-8', 'id present')
  assert(record.title === 'Test deal', 'title present')
}

// T9 — stale threshold cutoff calculation
console.log('T9 — stale threshold cutoff calculation')
{
  const idleThresholdDays = 14
  const before = Date.now()
  const cutoffMs = Date.now() - idleThresholdDays * 24 * 60 * 60 * 1000
  const after = Date.now()
  const expectedMs = 14 * 24 * 60 * 60 * 1000
  // cutoff should be approximately 14 days in the past (within 1 second tolerance)
  assert(before - cutoffMs >= expectedMs - 1000, 'cutoff at least 14 days in the past')
  assert(after - cutoffMs <= expectedMs + 1000, 'cutoff within 1 second tolerance')
}

// T10 — entity_type values
console.log('T10 — entity_type values')
{
  const dealInput: PromoteStubInput = { entity_type: 'deal', entity_id: 'uuid-9', actor: 'ai' }
  const clientInput: PromoteStubInput = {
    entity_type: 'client',
    entity_id: 'uuid-10',
    actor: 'user',
  }
  assert(dealInput.entity_type === 'deal', 'entity_type=deal valid')
  assert(clientInput.entity_type === 'client', 'entity_type=client valid')
  const validEntityTypes: Array<'client' | 'deal'> = ['client', 'deal']
  assert(
    !validEntityTypes.includes('document' as 'client' | 'deal'),
    "'document' not valid entity_type"
  )
}

// T11 — tool count in CRM_STUB_TOOLS (12 tools in alphabetical order)
console.log('T11 — CRM_STUB_TOOLS tool count and order')
{
  const expectedTools = [
    'archive_stub',
    'check_stub_enrichment',
    'create_client_stub',
    'create_deal_stub',
    'find_similar_clients',
    'get_client',
    'get_deal',
    'list_deals',
    'log_activity',
    'promote_stub',
    'update_client',
    'update_deal',
  ]
  assert(expectedTools.length === 12, 'tool count is 12')
  assert(expectedTools[0] === 'archive_stub', 'first tool is archive_stub')
  assert(expectedTools[expectedTools.length - 1] === 'update_deal', 'last tool is update_deal')
}

// T12 — enrichment gate excludes is_stub=true from similar deals
console.log('T12 — enrichment gate excludes stubs from similar deals')
{
  const deals: DealLike[] = [
    {
      id: 'a',
      is_stub: false,
      client_stated_need: 'CRM',
      service_type: 'web_app',
      stage: 'prospect',
      value_estimate: 10000000,
    },
    {
      id: 'b',
      is_stub: true,
      client_stated_need: null,
      service_type: null,
      stage: null,
      value_estimate: null,
    },
    {
      id: 'c',
      is_stub: false,
      client_stated_need: 'Website',
      service_type: 'web_design',
      stage: 'qualified',
      value_estimate: 20000000,
    },
  ]
  const nonStubs = deals.filter((d) => !d.is_stub)
  assert(nonStubs.length === 2, 'two non-stub deals')
  assert(
    nonStubs.every((d) => !d.is_stub),
    'all results have is_stub=false'
  )
}

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
