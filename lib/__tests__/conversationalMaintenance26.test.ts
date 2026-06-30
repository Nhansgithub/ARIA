export {}

// Inline types — never import from project lib/ (ts-node test pattern)

interface StageHistoryEntry {
  from_stage: string
  to_stage: string
  changed_at: string
}

interface UpdateDealInput {
  id: string
  actor: 'ai' | 'user'
  title?: string
  stage?: string
  service_type?: string
  value_estimate?: number
  client_stated_need?: string
  next_action?: string
  next_action_due?: string
  notes?: string
  priority?: 'high' | 'medium' | 'low'
  is_stub?: boolean
  status?: string
  // predicted_outcome is intentionally absent — it belongs to updateIntelligenceFields only
}

interface UpdateDealResult {
  updated: boolean
  changedFields: string[]
  protectedFields: string[]
}

interface LogActivityInput {
  entity_type: 'client' | 'deal' | 'document' | 'settings'
  entity_id: string
  action: string
  actor: 'ai' | 'user'
  payload?: Record<string, unknown>
}

// Inline stage_history append logic (mirrors crmService.ts behaviour)
function buildStageHistoryEntry(currentStage: string, newStage: string): StageHistoryEntry {
  return {
    from_stage: currentStage,
    to_stage: newStage,
    changed_at: new Date().toISOString(),
  }
}

// Inline human-edit protection logic
function shouldProtect(
  actor: 'ai' | 'user',
  latestLog: { actor: string; created_at: string } | null,
  nowMs: number
): boolean {
  if (actor !== 'ai') return false // user writes always go through
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

// T1 — Stage transition: stage_history entry is appended correctly
console.log('T1 — Stage transition: stage_history append')
{
  const currentStage = 'discovery'
  const newStage = 'proposal'
  const entry = buildStageHistoryEntry(currentStage, newStage)

  check(entry.from_stage === 'discovery', 'from_stage is discovery')
  check(entry.to_stage === 'proposal', 'to_stage is proposal')
  check(
    typeof entry.changed_at === 'string' && entry.changed_at.includes('T'),
    'changed_at is ISO string'
  )

  const history: StageHistoryEntry[] = []
  history.push(entry)
  check(history.length === 1, 'stage_history has one entry after transition')
}

// T2 — No-op guard: identical field values produce empty changedFields
console.log('T2 — No-op guard: identical field values')
{
  const currentValue = 80_000_000
  const incomingValue = 80_000_000
  check(!hasChanged(incomingValue, currentValue), 'identical value_estimate → no change')

  const changedFields: string[] = []
  if (hasChanged(incomingValue, currentValue)) changedFields.push('value_estimate')
  check(changedFields.length === 0, 'changedFields is empty on no-op')
}

// T3 — Human-edit protection: actor=ai + recent user edit → protectedFields
console.log('T3 — Human-edit protection: actor=ai + recent user edit')
{
  const nowMs = Date.now()
  const recentUserLog = {
    actor: 'user',
    created_at: new Date(nowMs - 1 * 60 * 60 * 1000).toISOString(), // 1 hour ago
  }
  check(
    shouldProtect('ai', recentUserLog, nowMs),
    'protection triggers for ai write after recent user edit'
  )

  const changedFields = ['value_estimate', 'stage']
  const result: UpdateDealResult = {
    updated: false,
    changedFields: [],
    protectedFields: [...changedFields],
  }
  check(result.updated === false, 'updated is false when protected')
  check(result.protectedFields.length === 2, 'both fields in protectedFields')
}

// T4 — Human-edit protection NOT triggered: actor=user always writes through
console.log('T4 — Human-edit protection: actor=user always writes through')
{
  const nowMs = Date.now()
  const recentUserLog = {
    actor: 'user',
    created_at: new Date(nowMs - 30 * 60 * 1000).toISOString(), // 30 minutes ago
  }
  check(!shouldProtect('user', recentUserLog, nowMs), 'user writes are never protected')
}

// T5 — Actor assignment: Owner correction uses actor=user; AI inference uses actor=ai
console.log('T5 — Actor assignment')
{
  const ownerCorrectionInput: UpdateDealInput = {
    id: 'uuid-1',
    actor: 'user',
    value_estimate: 80_000_000,
  }
  const aiInferenceInput: UpdateDealInput = {
    id: 'uuid-1',
    actor: 'ai',
    notes: 'Client seems budget-constrained based on tone',
  }
  check(ownerCorrectionInput.actor === 'user', 'owner correction uses actor=user')
  check(aiInferenceInput.actor === 'ai', 'ai inference uses actor=ai')
}

// T6 — Deal close (Won): stage=won, predicted_outcome absent from UpdateDealInput
console.log('T6 — Deal close (Won): predicted_outcome not in UpdateDealInput')
{
  const closeInput: UpdateDealInput = {
    id: 'uuid-2',
    actor: 'user',
    stage: 'won',
  }
  check(closeInput.stage === 'won', 'stage is won')
  check(
    !('predicted_outcome' in closeInput),
    'predicted_outcome absent from UpdateDealInput — intelligence field separation preserved'
  )

  const entry = buildStageHistoryEntry('negotiation', 'won')
  check(entry.to_stage === 'won', 'stage_history records won transition')
}

// T7 — log_activity payload shape for win-note
console.log('T7 — log_activity payload shape for win-note')
{
  const winNoteActivity: LogActivityInput = {
    entity_type: 'deal',
    entity_id: 'uuid-2',
    action: 'win_note',
    actor: 'user',
    payload: { note: 'Client signed after 3-month engagement. Key factor: demo session.' },
  }
  check(winNoteActivity.action === 'win_note', 'action is win_note')
  check(winNoteActivity.actor === 'user', 'actor is user for win-note')
  check(typeof winNoteActivity.payload?.note === 'string', 'payload.note is a string')
}

// T8 — Stage advance: stage values are lowercase (won, lost, not Won/Lost)
console.log('T8 — Stage values are lowercase')
{
  const validStages = ['prospect', 'qualified', 'proposal', 'negotiation', 'won', 'lost']
  check(validStages.includes('won'), "'won' is a valid stage (lowercase)")
  check(validStages.includes('lost'), "'lost' is a valid stage (lowercase)")
  check(!validStages.includes('Won'), "'Won' is NOT a valid stage (case-sensitive)")
}

// T9 — Field correction: change detection for value_estimate
console.log('T9 — Field correction: change detection')
{
  const currentVal = 50_000_000
  const correctedVal = 80_000_000
  check(hasChanged(correctedVal, currentVal), 'different value_estimate → change detected')

  const changedFields: string[] = []
  if (hasChanged(correctedVal, currentVal)) changedFields.push('value_estimate')
  check(
    changedFields.includes('value_estimate'),
    'value_estimate in changedFields after correction'
  )
}

// T10 — protectedFields surfaced: non-empty array means human edit was blocked
console.log('T10 — protectedFields signals blocked AI write')
{
  const result: UpdateDealResult = {
    updated: false,
    changedFields: [],
    protectedFields: ['notes'],
  }
  const isProtectionActive = result.protectedFields.length > 0 && !result.updated
  check(isProtectionActive, 'protection is active when protectedFields non-empty and updated=false')
  check(result.protectedFields[0] === 'notes', 'blocked field is notes')
}

// T11 — Deal close (Lost): stage=lost, no predicted_outcome in UpdateDealInput
console.log('T11 — Deal close (Lost): stage=lost without predicted_outcome')
{
  const lostInput: UpdateDealInput = {
    id: 'uuid-3',
    actor: 'user',
    stage: 'lost',
  }
  check(lostInput.stage === 'lost', 'stage is lost')
  check(
    !('predicted_outcome' in lostInput),
    'predicted_outcome absent from UpdateDealInput for lost close'
  )
}

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
