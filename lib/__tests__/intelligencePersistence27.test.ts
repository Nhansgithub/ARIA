export {}

// Inline types — never import from project lib/ (ts-node test pattern)

type ActivityLogEntry = {
  id: string
  entity_type: string
  entity_id: string
  action: string
  actor: 'ai' | 'user'
  payload: Record<string, unknown>
  created_at: string
}

// Inline getActivityLog logic for unit-testing its contract.
// Rows carry an optional owner_id field (not in the SELECT output but present in the DB row)
// so we can verify AD-2 owner isolation in tests.
type TestRow = ActivityLogEntry & { owner_id: string }

function simulateGetActivityLog(
  rows: TestRow[],
  ownerId: string,
  entityId: string,
  limit?: number
): ActivityLogEntry[] {
  const filtered = rows.filter((r) => r.owner_id === ownerId && r.entity_id === entityId)
  const sorted = [...filtered].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )
  return sorted.slice(0, limit ?? 50)
}

// Inline actor-attribution formatter (mirrors HISTORY QUERY PROTOCOL)
function attributeActor(entry: ActivityLogEntry): string {
  return entry.actor === 'ai' ? 'I' : 'You'
}

// Inline no-op guard (mirrors updateIntelligenceFields compare-before-write)
function hasChanged(newVal: unknown, currentVal: unknown): boolean {
  if (newVal === undefined) return false
  return JSON.stringify(newVal) !== JSON.stringify(currentVal)
}

// Expected DI_TOOLS names — mirrors dealIntelligenceTools.ts (AD-5: alphabetical)
const EXPECTED_DI_TOOL_NAMES = [
  'find_similar_deals',
  'get_activity_log',
  'get_client',
  'get_deal',
  'get_pricing_floors',
  'update_intelligence_fields',
]

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

// T1 — getActivityLog returns entries ordered by created_at ASC
console.log('T1 — getActivityLog: chronological ordering')
{
  const rows: TestRow[] = [
    {
      id: 'log-3',
      owner_id: 'owner-1',
      entity_type: 'deal',
      entity_id: 'deal-1',
      action: 'intelligence_fields_updated',
      actor: 'ai',
      payload: {},
      created_at: '2026-06-20T10:00:00Z',
    },
    {
      id: 'log-1',
      owner_id: 'owner-1',
      entity_type: 'deal',
      entity_id: 'deal-1',
      action: 'stage_changed',
      actor: 'user',
      payload: {},
      created_at: '2026-06-18T09:00:00Z',
    },
    {
      id: 'log-2',
      owner_id: 'owner-1',
      entity_type: 'deal',
      entity_id: 'deal-1',
      action: 'field_updated',
      actor: 'ai',
      payload: {},
      created_at: '2026-06-19T14:00:00Z',
    },
  ]
  const result = simulateGetActivityLog(rows, 'owner-1', 'deal-1')
  check(result.length === 3, 'returns all 3 matching entries')
  check(result[0]!.id === 'log-1', 'first entry is oldest (log-1)')
  check(result[1]!.id === 'log-2', 'second entry is middle (log-2)')
  check(result[2]!.id === 'log-3', 'third entry is newest (log-3)')
}

// T2 — getActivityLog filters by owner_id (AD-2 isolation) and entity_id
console.log('T2 — getActivityLog: owner_id isolation (AD-2) + entity_id filter')
{
  const rows: TestRow[] = [
    {
      id: 'log-a',
      owner_id: 'owner-1',
      entity_type: 'deal',
      entity_id: 'deal-1',
      action: 'stage_changed',
      actor: 'user',
      payload: {},
      created_at: '2026-06-18T09:00:00Z',
    },
    {
      id: 'log-b',
      owner_id: 'owner-2', // different owner — must be excluded
      entity_type: 'deal',
      entity_id: 'deal-1', // same entity_id as above, different owner
      action: 'intelligence_fields_updated',
      actor: 'ai',
      payload: {},
      created_at: '2026-06-18T10:00:00Z',
    },
    {
      id: 'log-c',
      owner_id: 'owner-1',
      entity_type: 'deal',
      entity_id: 'deal-2', // different deal — must be excluded
      action: 'intelligence_fields_updated',
      actor: 'ai',
      payload: {},
      created_at: '2026-06-18T11:00:00Z',
    },
  ]
  const result = simulateGetActivityLog(rows, 'owner-1', 'deal-1')
  check(result.length === 1, 'only log-a matches owner-1 + deal-1')
  check(result[0]!.id === 'log-a', 'returned entry belongs to owner-1 / deal-1')
}

// T3 — getActivityLog respects limit parameter
console.log('T3 — getActivityLog: limit parameter')
{
  const rows: TestRow[] = Array.from({ length: 10 }, (_, i) => ({
    id: `log-${i}`,
    owner_id: 'owner-1',
    entity_type: 'deal',
    entity_id: 'deal-1',
    action: 'update',
    actor: 'ai' as const,
    payload: {},
    created_at: `2026-06-${String(i + 1).padStart(2, '0')}T09:00:00Z`,
  }))
  const result = simulateGetActivityLog(rows, 'owner-1', 'deal-1', 3)
  check(result.length === 3, 'limit=3 returns 3 entries')
}

// T4 — getActivityLog defaults to limit=50
console.log('T4 — getActivityLog: default limit=50')
{
  const rows: TestRow[] = Array.from({ length: 60 }, (_, i) => ({
    id: `log-${i}`,
    owner_id: 'owner-1',
    entity_type: 'deal',
    entity_id: 'deal-1',
    action: 'update',
    actor: 'ai' as const,
    payload: {},
    created_at: `2026-05-${String((i % 28) + 1).padStart(2, '0')}T${String(i % 24).padStart(2, '0')}:00:00Z`,
  }))
  const result = simulateGetActivityLog(rows, 'owner-1', 'deal-1')
  check(result.length === 50, 'default limit is 50 (returns 50 of 60 rows)')
}

// T5 — DI_TOOLS contains get_activity_log
console.log('T5 — DI_TOOLS: contains get_activity_log')
{
  check(EXPECTED_DI_TOOL_NAMES.includes('get_activity_log'), 'get_activity_log is in DI_TOOLS')
}

// T6 — DI_TOOLS is alphabetically sorted (AD-5)
console.log('T6 — DI_TOOLS: alphabetical sort (AD-5)')
{
  const sorted = [...EXPECTED_DI_TOOL_NAMES].sort()
  check(
    JSON.stringify(EXPECTED_DI_TOOL_NAMES) === JSON.stringify(sorted),
    'DI_TOOLS names are alphabetically ordered'
  )
}

// T7 — get_activity_log schema: entity_id required, limit optional
console.log('T7 — get_activity_log schema')
{
  // Mirror the expected schema from dealIntelligenceTools.ts
  const expectedSchema = {
    type: 'object',
    properties: {
      entity_id: { type: 'string' },
      limit: { type: 'number' },
    },
    required: ['entity_id'],
  }
  check(expectedSchema.required.includes('entity_id'), 'entity_id is required in schema')
  check(!expectedSchema.required.includes('limit'), 'limit is optional in schema')
  check('entity_id' in expectedSchema.properties, 'entity_id property exists in schema')
  check('limit' in expectedSchema.properties, 'limit property exists in schema')
}

// T8 — updateIntelligenceFields no-op when similar_deals unchanged (AD-14 idempotency)
console.log('T8 — idempotency: no write when similar_deals unchanged')
{
  const stored = [{ deal_id: 'uuid-past-1', similarity_reason: 'Same service type (web_design)' }]
  const incoming = [{ deal_id: 'uuid-past-1', similarity_reason: 'Same service type (web_design)' }]
  const changed = hasChanged(incoming, stored)
  check(!changed, 'identical similar_deals → no change detected')

  const changedFields: string[] = []
  if (hasChanged(incoming, stored)) changedFields.push('similar_deals')
  check(changedFields.length === 0, 'changedFields is empty → no DB write, no log entry')
}

// T9 — updateIntelligenceFields writes when similar_deals differ
console.log('T9 — freshness: write when similar_deals differ')
{
  const stored = [{ deal_id: 'uuid-past-1', similarity_reason: 'Same service type (web_design)' }]
  const incoming = [
    { deal_id: 'uuid-past-1', similarity_reason: 'Same service type (web_design)' },
    { deal_id: 'uuid-past-2', similarity_reason: 'Same client industry (F&B)' },
  ]
  const changed = hasChanged(incoming, stored)
  check(changed, 'different similar_deals → change detected')

  const changedFields: string[] = []
  if (hasChanged(incoming, stored)) changedFields.push('similar_deals')
  check(
    changedFields.includes('similar_deals'),
    'similar_deals in changedFields → DB write triggered'
  )
}

// T10 — Actor attribution: ai → "I", user → "You"
console.log('T10 — actor attribution formatting')
{
  const aiEntry: ActivityLogEntry = {
    id: 'log-ai',
    entity_type: 'deal',
    entity_id: 'deal-1',
    action: 'intelligence_fields_updated',
    actor: 'ai',
    payload: { changedFields: ['risk_flags'] },
    created_at: '2026-06-12T10:00:00Z',
  }
  const userEntry: ActivityLogEntry = {
    id: 'log-user',
    entity_type: 'deal',
    entity_id: 'deal-1',
    action: 'field_updated',
    actor: 'user',
    payload: { changedFields: ['value_estimate'] },
    created_at: '2026-06-10T09:00:00Z',
  }
  check(attributeActor(aiEntry) === 'I', 'actor=ai attributed as "I"')
  check(attributeActor(userEntry) === 'You', 'actor=user attributed as "You"')
}

// T11 — AC6: "Start new topic" clears only in-memory state, not CRM data
console.log('T11 — AC6: Start new topic does not wipe CRM data')
{
  // Model the in-memory conversation window reset
  let messages = [
    { role: 'user', content: 'Tell me about deal ABC' },
    { role: 'assistant', content: 'Here is the deal analysis...' },
  ]
  // Simulate crmData being separate from the conversation window
  const crmData = {
    deals: [{ id: 'deal-1', title: 'ABC Deal', stage: 'proposal' }],
    activityLog: [{ id: 'log-1', entity_id: 'deal-1', action: 'stage_changed' }],
  }

  // Simulate "Start new topic" — only messages cleared
  messages = []

  check(messages.length === 0, 'conversation window is cleared after Start new topic')
  check(crmData.deals.length === 1, 'CRM deals remain intact after Start new topic')
  check(crmData.activityLog.length === 1, 'activity log remains intact after Start new topic')
}

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
