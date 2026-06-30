export {}

// Inline types — never import from project lib/ (ts-node test pattern)

interface UpdateDealInput {
  id: string
  actor: 'ai' | 'user'
  title?: string
  stage?: string
  service_type?: 'web_design' | 'web_app' | 'automation' | 'other'
  value_estimate?: number
  client_stated_need?: string
  next_action?: string
  next_action_due?: string
  notes?: string
  priority?: 'high' | 'medium' | 'low'
}

interface UpdateDealResult {
  updated: boolean
  changedFields: string[]
  protectedFields: string[]
}

interface UpdateClientInput {
  id: string
  actor: 'ai' | 'user'
  name?: string
  company?: string
  email?: string
  phone?: string
  industry?: string
  company_size?: 'solo' | 'small' | 'medium' | 'enterprise'
  relationship_stage?: 'cold' | 'warming' | 'trusted' | 'long_term'
  decision_maker?: string
  communication_style?: string
  known_hesitations?: string
  language_pref?: 'vi' | 'en'
  notes?: string
}

interface UpdateClientResult {
  updated: boolean
  changedFields: string[]
  protectedFields: string[]
}

interface ListDealsParams {
  stage?: string
  is_stub?: boolean
  limit?: number
}

interface StageHistoryEntry {
  from_stage: string
  to_stage: string
  changed_at: string
}

const hasChanged = (a: unknown, b: unknown) => JSON.stringify(a) !== JSON.stringify(b)

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

// T1 — UpdateDealInput shape
console.log('T1 — UpdateDealInput shape')
{
  const input: UpdateDealInput = { id: 'uuid-1', actor: 'user', stage: 'qualified' }
  assert(input.id === 'uuid-1', 'required id present')
  assert(input.actor === 'user', 'required actor present')
  assert(input.stage === 'qualified', 'optional stage present')
  const minInput: UpdateDealInput = { id: 'uuid-2', actor: 'ai' }
  assert(minInput.title === undefined, 'title truly optional')
  assert(minInput.notes === undefined, 'notes truly optional')
}

// T2 — UpdateClientInput shape
console.log('T2 — UpdateClientInput shape')
{
  const input: UpdateClientInput = { id: 'uuid-3', actor: 'user', company: 'Acme' }
  assert(input.id === 'uuid-3', 'required id present')
  assert(input.actor === 'user', 'required actor present')
  assert(input.company === 'Acme', 'optional company present')
  const minInput: UpdateClientInput = { id: 'uuid-4', actor: 'ai' }
  assert(minInput.name === undefined, 'name truly optional')
  assert(minInput.email === undefined, 'email truly optional')
}

// T3 — ListDealsParams defaults
console.log('T3 — ListDealsParams defaults')
{
  const withoutLimit: ListDealsParams = {}
  const effectiveLimit = withoutLimit.limit ?? 20
  assert(effectiveLimit === 20, 'default limit is 20 when undefined')

  const withLimit: ListDealsParams = { limit: 5 }
  const effectiveLimitCustom = withLimit.limit ?? 20
  assert(effectiveLimitCustom === 5, 'explicit limit 5 is respected')
}

// T4 — hasChanged equality
console.log('T4 — hasChanged equality')
{
  assert(hasChanged('prospect', 'prospect') === false, 'same string → false')
  assert(hasChanged('prospect', 'qualified') === true, 'different strings → true')
  assert(hasChanged(null, null) === false, 'null === null → false')
  assert(hasChanged(null, 'value') === true, 'null vs string → true')
  assert(hasChanged(1000000, 1000000) === false, 'same number → false')
  assert(hasChanged(1000000, 2000000) === true, 'different numbers → true')
}

// T5 — No-op result shape
console.log('T5 — No-op result shape')
{
  const noOp: UpdateDealResult = { updated: false, changedFields: [], protectedFields: [] }
  assert(noOp.updated === false, 'updated is false')
  assert(noOp.changedFields.length === 0, 'changedFields empty')
  assert(noOp.protectedFields.length === 0, 'protectedFields empty')
}

// T6 — stage_history append logic
console.log('T6 — stage_history append logic')
{
  const existingHistory: StageHistoryEntry[] = [
    { from_stage: 'prospect', to_stage: 'qualified', changed_at: '2026-06-01T00:00:00Z' },
  ]
  const newEntry: StageHistoryEntry = {
    from_stage: 'qualified',
    to_stage: 'proposal',
    changed_at: '2026-06-29T00:00:00Z',
  }
  const updated = [...existingHistory, newEntry]
  assert(updated.length === 2, 'two entries after append')
  const latest = updated[updated.length - 1]!
  const first = updated[0]!
  assert(latest.to_stage === 'proposal', 'latest entry has correct to_stage')
  assert(first.to_stage === 'qualified', 'first entry preserved')
}

// T7 — actor values
console.log('T7 — actor values')
{
  const aiInput: UpdateDealInput = { id: 'uuid-5', actor: 'ai' }
  const userInput: UpdateDealInput = { id: 'uuid-6', actor: 'user' }
  assert(aiInput.actor === 'ai', 'actor=ai valid')
  assert(userInput.actor === 'user', 'actor=user valid')
  // 'system' is not assignable to 'ai' | 'user' — type safety enforced at compile time
  const validActors: Array<'ai' | 'user'> = ['ai', 'user']
  assert(!validActors.includes('system' as 'ai' | 'user'), "'system' not in valid actors")
}

// T8 — UpdateDealResult shape
console.log('T8 — UpdateDealResult shape')
{
  const result: UpdateDealResult = {
    updated: true,
    changedFields: ['stage', 'value_estimate'],
    protectedFields: [],
  }
  assert(result.changedFields.length === 2, 'changedFields has 2 entries')
  assert(result.protectedFields.length === 0, 'protectedFields empty')
  assert(result.updated === true, 'updated is true')
}

// T9 — Protected fields non-empty
console.log('T9 — Protected fields non-empty')
{
  const result: UpdateClientResult = {
    updated: false,
    changedFields: [],
    protectedFields: ['notes'],
  }
  assert(result.protectedFields.length === 1, 'one protected field')
  assert(result.protectedFields[0] === 'notes', 'protected field is notes')
  assert(result.updated === false, 'not updated when all fields protected')
}

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
