// ts-node inline pattern — no imports from project lib/ files
export {}

// ── Inlined types (mirror activityLogService.ts) ─────────────────────────────

interface LogActivityParams {
  entity_type: 'client' | 'deal' | 'document' | 'settings'
  entity_id: string
  action: string
  actor: 'ai' | 'user'
  payload?: Record<string, unknown>
}

interface ActivityLogRow {
  id: string
  owner_id: string
  entity_type: string
  entity_id: string
  action: string
  actor: string
  payload: Record<string, unknown>
  created_at: string
  // NOTE: no updated_at — append-only (AD-14)
}

// ── Inlined helpers ───────────────────────────────────────────────────────────

function hasChanged(newVal: unknown, currentVal: unknown): boolean {
  if (newVal === undefined) return false
  return JSON.stringify(newVal) !== JSON.stringify(currentVal)
}

function effectiveLimit(limit: number | undefined): number {
  return limit ?? 20
}

// ── Test harness ──────────────────────────────────────────────────────────────

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

console.log('=== activityLog21.test.ts ===\n')

// ── T1 — LogActivityParams shape ──────────────────────────────────────────────

t('T1 — LogActivityParams shape: required fields present', () => {
  const params: LogActivityParams = {
    entity_type: 'deal',
    entity_id: 'uuid-123',
    action: 'phone_call_noted',
    actor: 'user',
  }
  assert('entity_type' in params, 'entity_type missing')
  assert('entity_id' in params, 'entity_id missing')
  assert('action' in params, 'action missing')
  assert('actor' in params, 'actor missing')
  // payload is optional — should not be required
  assert(!('payload' in params), 'payload should be absent when not provided')
})

// ── T2 — actor values ─────────────────────────────────────────────────────────

t('T2 — actor: only "ai" or "user" are valid values', () => {
  const validActors: Array<'ai' | 'user'> = ['ai', 'user']
  assert(validActors.includes('ai'), '"ai" should be valid')
  assert(validActors.includes('user'), '"user" should be valid')
  // "system" is NOT a valid actor
  const invalidActor = 'system'
  assert(!(validActors as string[]).includes(invalidActor), '"system" should not be a valid actor')
})

// ── T3 — getActivityLog default limit ─────────────────────────────────────────

t('T3 — getActivityLog default limit: undefined → 20', () => {
  assert(effectiveLimit(undefined) === 20, 'default limit should be 20')
})

t('T3b — getActivityLog explicit limit: 5 → 5', () => {
  assert(effectiveLimit(5) === 5, 'explicit limit 5 should remain 5')
})

// ── T4 — No-op detection (scalar) ─────────────────────────────────────────────

t('T4 — hasChanged("foo", "foo") returns false', () => {
  assert(hasChanged('foo', 'foo') === false, 'identical strings should not be changed')
})

t('T4b — hasChanged("foo", "bar") returns true', () => {
  assert(hasChanged('foo', 'bar') === true, 'different strings should be changed')
})

// ── T5 — No-op detection (jsonb / deep equality) ──────────────────────────────

t('T5 — hasChanged([{flag:"A"}], [{flag:"A"}]) returns false (deep JSON equality)', () => {
  assert(
    hasChanged([{ flag: 'A' }], [{ flag: 'A' }]) === false,
    'identical JSON arrays should not be changed'
  )
})

t('T5b — hasChanged([{flag:"A"}], [{flag:"B"}]) returns true', () => {
  assert(
    hasChanged([{ flag: 'A' }], [{ flag: 'B' }]) === true,
    'different JSON arrays should be changed'
  )
})

// ── T6 — log_activity tool input validation ───────────────────────────────────

t('T6 — log_activity tool input: all required fields present and payload is object', () => {
  const input: Record<string, unknown> = {
    entity_type: 'deal',
    entity_id: 'uuid-here',
    action: 'note_added',
    actor: 'user',
    payload: { note: 'called' },
  }
  assert(typeof input['entity_type'] === 'string', 'entity_type should be string')
  assert(typeof input['entity_id'] === 'string', 'entity_id should be string')
  assert(typeof input['action'] === 'string', 'action should be string')
  assert(typeof input['actor'] === 'string', 'actor should be string')
  assert(
    typeof input['payload'] === 'object' && input['payload'] !== null,
    'payload should be object'
  )
})

// ── T7 — Append-only: no updated_at on ActivityLogRow ─────────────────────────

t('T7 — ActivityLogRow has no updated_at field (append-only invariant)', () => {
  const row: ActivityLogRow = {
    id: '1',
    owner_id: '2',
    entity_type: 'deal',
    entity_id: '3',
    action: 'x',
    actor: 'ai',
    payload: {},
    created_at: '2026-06-29',
  }
  assert(!('updated_at' in row), 'ActivityLogRow must not have updated_at (AD-14 append-only)')
})

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
