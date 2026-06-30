---
story: 4-6
title: Proactive Check-In Scheduler — Trigger Criteria & Job
status: done
epic: 4
sprint: 1
baseline_commit: c2efd6a
---

# Story 4-6: Proactive Check-In Scheduler — Trigger Criteria & Job

## Summary

Implements the check-in scheduling engine that decides **when** to schedule proactive check-ins for the owner based on deal state. This is the "trigger" layer only — it evaluates criteria and inserts rows into `check_ins`; it does NOT deliver check-ins to the UI (that is Story 4.7).

Three files created:
- `lib/crm/checkInService.ts` — server-only service: trigger evaluation, scheduling, and pending query
- `app/api/cron/check-in-scheduler/route.ts` — cron endpoint (Bearer secret); calls evaluator for all owners
- `lib/__tests__/checkInScheduler46.test.ts` — ≥60 ts-node inline tests

No database migrations are written by the dev agent — the `check_ins` table is assumed to exist per Sprint 0 schema assumptions (see Database Assumption section below).

## Scope

- **FR-36, FR-37**: Evaluate active deals nightly; insert `check_ins` rows for deals meeting trigger criteria
- **Trigger types** (deterministic, no AI needed):
  - `stale_7d`: deal has `stale_since` AND `today − stale_since ≥ 7 days` AND no check-in of this type sent in the last 7 days
  - `pre_action_due`: deal has `next_action_due` AND it is exactly 1 day away (i.e. `next_action_due = tomorrow`) AND no check-in of this type sent in last 24 h for this deal
  - `cadence_followup`: deal's `next_action` starts with `'Nhắc lần'` AND no check-in of this type sent in last 24 h for this deal
- **Idempotency**: `UNIQUE(owner_id, deal_id, trigger_type, due_date)` — upsert with `onConflict` prevents duplicate rows
- **AD-6**: Cron route returns a degraded-safe summary even on partial failures (per-owner try/catch)
- **AD-13**: `createServiceClient()` used throughout (cron / system task path — not an owner request)
- **AD-2**: All queries scoped with `.eq('owner_id', ownerId)`
- **AD-11**: `import 'server-only'` at line 1 of `lib/crm/checkInService.ts`
- **AD-4**: No AI calls in this story — trigger evaluation is purely deterministic TypeScript

## Files Created / Modified

| Path | Action | Notes |
|------|--------|-------|
| `lib/crm/checkInService.ts` | NEW | `import 'server-only'` at line 1; pure evaluator + DB functions |
| `app/api/cron/check-in-scheduler/route.ts` | NEW | GET handler; Bearer auth; calls evaluator for all owners |
| `lib/__tests__/checkInScheduler46.test.ts` | NEW | ≥60 ts-node inline tests; no project lib imports |
| `package.json` | MODIFY | Add `test:check-in-scheduler46` script + include in CI chain |

## Architecture Decisions

| Decision | Rationale |
|----------|-----------|
| **AD-11** `import 'server-only'` line 1 | All `lib/crm/` files must carry this guard |
| **AD-13** `createServiceClient()` everywhere in this service | This is a scheduled/system task path, never an owner-initiated request — consistent with `briefingService.ts` pattern |
| **AD-2** `.eq('owner_id', ownerId)` on every query | RLS + defence-in-depth; same as all other services |
| **AD-4** No AI in this story | Trigger evaluation is deterministic; no Haiku/Sonnet call needed for scheduling |
| **AD-6** Per-owner try/catch in cron route | Partial failures must not abort the full run; matches `generateBriefingsForAllOwners` pattern |
| **AD-14** Activity log is append-only | Log `checkin_scheduled` on each new `check_ins` row; do NOT log on upsert no-ops |
| Pure helper extracted for testability | `evaluateTriggerCriteria(deal, lastCheckIns, today)` is a pure function — mirrors `getTier` / `computeStructuredFlags` from `briefingService.ts`; tests cover it without DB |
| Idempotency via upsert | `UNIQUE(owner_id, deal_id, trigger_type, due_date)` + `.upsert({ onConflict: 'owner_id,deal_id,trigger_type,due_date' })` — safe to re-run |

## Database Assumption

The `check_ins` table is assumed to exist in Supabase with the following schema. **The dev agent must NOT create a migration** — this table was established as part of Sprint 0 schema work.

```sql
-- ASSUMED — do not create migration
create table check_ins (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references auth.users(id),
  deal_id      uuid not null references deals(id),
  trigger_type text not null,          -- 'stale_7d' | 'pre_action_due' | 'cadence_followup'
  due_date     date not null,          -- date on which this check-in is due
  status       text not null default 'pending',  -- 'pending' | 'sent' | 'skipped'
  created_at   timestamptz not null default now(),
  constraint check_ins_unique unique (owner_id, deal_id, trigger_type, due_date)
);
-- RLS assumed enabled; service role bypasses RLS (AD-13)
```

## Tasks/Subtasks

- [ ] T1: Create `lib/crm/checkInService.ts`
  - [ ] T1.1: Add `import 'server-only'` at line 1
  - [ ] T1.2: Define `CheckInTriggerType` union type (`'stale_7d' | 'pre_action_due' | 'cadence_followup'`)
  - [ ] T1.3: Define `CheckIn` interface (all columns from schema above)
  - [ ] T1.4: Define `CheckInTriggerCriteria` interface (see Dev Notes)
  - [ ] T1.5: Implement and **export** `evaluateTriggerCriteria(deal, lastCheckIns, today)` — pure function, no DB
  - [ ] T1.6: Implement `evaluateCheckInTriggers(ownerId, today)` — queries active deals + last check-ins, calls pure helper, schedules via `scheduleCheckIn`
  - [ ] T1.7: Implement `scheduleCheckIn(ownerId, dealId, triggerType, dueDate)` — upsert; log activity on new insert
  - [ ] T1.8: Implement `getPendingCheckIns(ownerId)` — returns `status = 'pending'` AND `due_date <= today`
  - [ ] T1.9: Export all public symbols at bottom of file

- [ ] T2: Create `app/api/cron/check-in-scheduler/route.ts`
  - [ ] T2.1: Implement `validateCronSecret` helper (exact same pattern as briefing cron)
  - [ ] T2.2: Implement GET handler: auth check → get distinct active owner IDs → loop per owner → return `{ scheduled, owners }` summary
  - [ ] T2.3: Per-owner try/catch; partial failures log error and continue (do not abort full run)

- [ ] T3: Create `lib/__tests__/checkInScheduler46.test.ts`
  - [ ] T3.1: First line `export {}`; imports only `fs` and `path`; uses `process.cwd()` not `__dirname`
  - [ ] T3.2: Inline all simulated types and pure logic (no imports from project `lib/`)
  - [ ] T3.3: Write T1–T60 test groups (see Test Coverage section)
  - [ ] T3.4: Summary block: print passed/failed counts; `process.exit(1)` if any failed

- [ ] T4: Update `package.json`
  - [ ] T4.1: Add `"test:check-in-scheduler46": "npx ts-node lib/__tests__/checkInScheduler46.test.ts"`
  - [ ] T4.2: Append `&& npx ts-node lib/__tests__/checkInScheduler46.test.ts` to the `"test"` CI chain

## Acceptance Criteria

1. **Auth guard**: `GET /api/cron/check-in-scheduler` with no `Authorization` header or wrong secret → 401; correct secret → 200.
2. **stale_7d trigger fires**: a deal with `stale_since = 7 days ago` and no prior check-in of type `stale_7d` → `check_ins` row inserted with `trigger_type = 'stale_7d'`, `status = 'pending'`.
3. **stale_7d cooldown**: a deal already has a `stale_7d` check-in created within the last 7 days → no new row created (upsert no-op due to unique constraint on same `due_date`).
4. **pre_action_due trigger fires**: deal has `next_action_due = tomorrow` and no `pre_action_due` check-in in last 24 h → row inserted.
5. **pre_action_due not early**: deal has `next_action_due = 2 days away` → no check-in scheduled.
6. **cadence_followup trigger fires**: deal's `next_action` starts with `'Nhắc lần'` and no `cadence_followup` check-in in last 24 h → row inserted.
7. **Idempotency**: running `evaluateCheckInTriggers` twice for the same owner/day → same rows, no duplicates (upsert is safe).
8. **Empty CRM guard**: owner with zero active deals → `evaluateCheckInTriggers` returns `{ scheduled: 0 }` and no rows inserted.
9. **AD-2 / owner scoping**: all queries in the service include `.eq('owner_id', ownerId)`; no cross-owner data can be read or written.
10. **AD-11 guard**: `lib/crm/checkInService.ts` first line is `import 'server-only'`.
11. **getPendingCheckIns** returns only rows where `status = 'pending'` AND `due_date <= today`; future-dated rows excluded.
12. **Activity log**: when a NEW `check_ins` row is inserted (not a no-op upsert), an `activity_log` entry is written with `actor: 'ai'`, `action: 'checkin_scheduled'`, `entity_type: 'deal'`, `entity_id: dealId`.
13. **Tests pass**: `npm run test:check-in-scheduler46` exits 0; all ≥60 assertions pass.
14. **CI chain**: `npm test` includes `checkInScheduler46.test.ts` and does not break existing tests.

## Dev Notes

### Exact Interfaces

```typescript
// lib/crm/checkInService.ts

import 'server-only'
import { createServiceClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/crm/activityLogService'

export type CheckInTriggerType = 'stale_7d' | 'pre_action_due' | 'cadence_followup'

export interface CheckIn {
  id: string
  owner_id: string
  deal_id: string
  trigger_type: CheckInTriggerType
  due_date: string          // YYYY-MM-DD
  status: 'pending' | 'sent' | 'skipped'
  created_at: string
}

// Criteria result — which triggers apply to a single deal
export interface CheckInTriggerCriteria {
  dealId: string
  triggerTypes: CheckInTriggerType[]
}

// Shape of deal rows fetched from DB
interface DealRow {
  id: string
  title: string
  stage: string
  priority: string | null
  next_action: string | null
  next_action_due: string | null    // YYYY-MM-DD
  stale_since: string | null        // YYYY-MM-DD
}

// Last check-in timestamps per trigger type for a given deal
// Key = trigger_type, value = most recent check-in created_at (ISO string) or null
export type LastCheckInsMap = Partial<Record<CheckInTriggerType, string | null>>
```

### Pure Evaluator Function (extract for testability)

This is the key testable unit — it has NO side effects and NO DB calls. The async DB functions call this internally.

```typescript
/**
 * Evaluate which trigger types apply to a single deal given its last check-in timestamps.
 * Pure — no I/O. Mirrors getTier() / computeStructuredFlags() pattern from briefingService.ts.
 *
 * @param deal        - Deal row from DB
 * @param lastCheckIns - Map of trigger_type → ISO datetime of most recent check-in (or undefined/null)
 * @param today       - YYYY-MM-DD string (injected for testability)
 * @returns array of trigger types that should fire for this deal
 */
export function evaluateTriggerCriteria(
  deal: DealRow,
  lastCheckIns: LastCheckInsMap,
  today: string,
): CheckInTriggerType[] {
  const triggers: CheckInTriggerType[] = []
  const todayMs = new Date(today + 'T00:00:00Z').getTime()

  // ── stale_7d ──────────────────────────────────────────────────────────────
  // Condition: stale_since is set AND today - stale_since >= 7 days
  //            AND no stale_7d check-in sent in the last 7 days
  if (deal.stale_since) {
    const staleDays = Math.floor(
      (todayMs - new Date(deal.stale_since + 'T00:00:00Z').getTime()) / 86_400_000
    )
    if (staleDays >= 7) {
      const lastSent = lastCheckIns['stale_7d']
      const cooldownOk = !lastSent || (todayMs - new Date(lastSent).getTime()) >= 7 * 86_400_000
      if (cooldownOk) triggers.push('stale_7d')
    }
  }

  // ── pre_action_due ────────────────────────────────────────────────────────
  // Condition: next_action_due is exactly tomorrow (1 day away)
  //            AND no pre_action_due check-in in last 24 h
  if (deal.next_action_due) {
    const dueDays = Math.floor(
      (new Date(deal.next_action_due + 'T00:00:00Z').getTime() - todayMs) / 86_400_000
    )
    if (dueDays === 1) {
      const lastSent = lastCheckIns['pre_action_due']
      const cooldownOk = !lastSent || (todayMs - new Date(lastSent).getTime()) >= 24 * 3_600_000
      if (cooldownOk) triggers.push('pre_action_due')
    }
  }

  // ── cadence_followup ──────────────────────────────────────────────────────
  // Condition: next_action starts with 'Nhắc lần'
  //            AND no cadence_followup check-in in last 24 h
  if (deal.next_action?.startsWith('Nhắc lần')) {
    const lastSent = lastCheckIns['cadence_followup']
    const cooldownOk = !lastSent || (todayMs - new Date(lastSent).getTime()) >= 24 * 3_600_000
    if (cooldownOk) triggers.push('cadence_followup')
  }

  return triggers
}
```

### Active Stage Filter

Reuse the same closed-stage definition as `briefingService.ts` — do NOT import it (would create a cross-file import that breaks the test pattern). Copy inline:

```typescript
function isActiveStage(stage: string): boolean {
  const lower = stage.toLowerCase()
  return !['won', 'lost', 'archived', 'completed'].some((kw) => lower.includes(kw))
}
```

### evaluateCheckInTriggers — Full Async Function

```typescript
export async function evaluateCheckInTriggers(
  ownerId: string,
  today: string,
): Promise<{ scheduled: number }> {
  const supabase = createServiceClient()

  // Step 1: Fetch active non-stub deals for owner
  const { data: rawDeals, error: dealsError } = await supabase
    .from('deals')
    .select('id, title, stage, priority, next_action, next_action_due, stale_since')
    .eq('owner_id', ownerId)
    .eq('is_stub', false)
    .limit(100)

  if (dealsError) throw new Error(`evaluateCheckInTriggers: ${dealsError.message}`)

  const activeDeals = ((rawDeals ?? []) as DealRow[]).filter((d) => isActiveStage(d.stage))

  // Empty CRM guard
  if (activeDeals.length === 0) return { scheduled: 0 }

  // Step 2: For each active deal, fetch most recent check-in per trigger type
  let scheduled = 0

  for (const deal of activeDeals) {
    // Query the most recent check-in for each trigger type for this deal
    const { data: recentCheckIns } = await supabase
      .from('check_ins')
      .select('trigger_type, created_at')
      .eq('owner_id', ownerId)
      .eq('deal_id', deal.id)
      .order('created_at', { ascending: false })
      .limit(20)  // enough to cover all trigger types

    // Build lastCheckIns map
    const lastCheckIns: LastCheckInsMap = {}
    for (const ci of recentCheckIns ?? []) {
      const tt = ci.trigger_type as CheckInTriggerType
      if (!lastCheckIns[tt]) {
        lastCheckIns[tt] = ci.created_at as string
      }
    }

    // Step 3: Evaluate triggers (pure function)
    const triggerTypes = evaluateTriggerCriteria(deal, lastCheckIns, today)

    // Step 4: Schedule a check-in for each trigger type that fired
    for (const triggerType of triggerTypes) {
      await scheduleCheckIn(ownerId, deal.id, triggerType, today)
      scheduled++
    }
  }

  return { scheduled }
}
```

### scheduleCheckIn — Upsert + Activity Log

```typescript
export async function scheduleCheckIn(
  ownerId: string,
  dealId: string,
  triggerType: CheckInTriggerType,
  dueDate: string,
): Promise<void> {
  const supabase = createServiceClient()

  // Idempotent upsert — UNIQUE(owner_id, deal_id, trigger_type, due_date)
  // On conflict: update status back to 'pending' to re-activate a previously skipped row
  const { data: upserted, error } = await supabase
    .from('check_ins')
    .upsert(
      {
        owner_id: ownerId,
        deal_id: dealId,
        trigger_type: triggerType,
        due_date: dueDate,
        status: 'pending',
      },
      { onConflict: 'owner_id,deal_id,trigger_type,due_date' }
    )
    .select('id, created_at')
    .single()

  if (error) throw new Error(`scheduleCheckIn: ${error.message}`)

  // Activity log — fire-and-forget (mirrors briefingService pattern)
  // Note: Supabase upsert returns the row regardless of insert vs. update;
  // we log unconditionally here since the cron re-run is daily and cooldowns
  // prevent re-scheduling the same trigger type within its cooldown window.
  logActivity(ownerId, {
    entity_type: 'deal',
    entity_id: dealId,
    action: 'checkin_scheduled',
    actor: 'ai',
    payload: { trigger_type: triggerType, due_date: dueDate, check_in_id: upserted?.id },
  }).catch((err) => console.warn('scheduleCheckIn: activity log failed:', err))
}
```

### getPendingCheckIns

```typescript
export async function getPendingCheckIns(ownerId: string): Promise<CheckIn[]> {
  const supabase = createServiceClient()
  const today = new Date().toISOString().split('T')[0]!

  const { data, error } = await supabase
    .from('check_ins')
    .select('id, owner_id, deal_id, trigger_type, due_date, status, created_at')
    .eq('owner_id', ownerId)
    .eq('status', 'pending')
    .lte('due_date', today)
    .order('due_date', { ascending: true })

  if (error) throw new Error(`getPendingCheckIns: ${error.message}`)
  return (data ?? []) as CheckIn[]
}
```

### Cron Route — Exact Pattern

Mirror `app/api/cron/briefing/route.ts` exactly:

```typescript
// app/api/cron/check-in-scheduler/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { evaluateCheckInTriggers } from '@/lib/crm/checkInService'

// AD-13: cron route uses service-role client (via checkInService) — not an owner-data path.
// CRON_SECRET is server-only (no NEXT_PUBLIC_ prefix — never exposed to client bundle).

function validateCronSecret(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return false
  const authHeader = request.headers.get('authorization')
  if (!authHeader || !/^Bearer\s+/i.test(authHeader)) return false
  const token = authHeader.replace(/^Bearer\s+/i, '')
  return token === cronSecret
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!validateCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const today = new Date().toISOString().split('T')[0]!
  const supabase = createServiceClient()

  // Get distinct owner IDs with active (non-closed) deals
  const { data: owners, error } = await supabase
    .from('deals')
    .select('owner_id')
    .eq('is_stub', false)
    .not('stage', 'in', '("won","lost","archived","completed")')
    .limit(10_000)

  if (error) {
    console.error('[ARIA/cron/check-in-scheduler] owner query failed:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  // Deduplicate owner IDs
  const allOwnerIds = (owners ?? []).map((r: { owner_id: string }) => r.owner_id)
  const ownerIds = allOwnerIds.filter((id, idx) => allOwnerIds.indexOf(id) === idx)

  let totalScheduled = 0
  let errorCount = 0

  for (const ownerId of ownerIds) {
    try {
      const result = await evaluateCheckInTriggers(ownerId, today)
      totalScheduled += result.scheduled
    } catch (err) {
      console.error(`[ARIA/cron/check-in-scheduler] error for owner ${ownerId}:`, err)
      errorCount++
    }
  }

  return NextResponse.json({
    date: today,
    scheduled: totalScheduled,
    owners: ownerIds.length,
    errors: errorCount,
  })
}
```

### Cooldown Logic Summary

| Trigger Type | Cooldown | How Enforced |
|---|---|---|
| `stale_7d` | 7 days | Check `lastCheckIns['stale_7d']` timestamp; skip if within 7 × 86400 ms |
| `pre_action_due` | 24 hours | Check `lastCheckIns['pre_action_due']` timestamp; skip if within 86400000 ms |
| `cadence_followup` | 24 hours | Check `lastCheckIns['cadence_followup']` timestamp; skip if within 86400000 ms |

All cooldown comparisons use `todayMs` (midnight UTC of today) as the reference point, NOT `Date.now()`, to ensure deterministic daily evaluation.

### Idempotency Approach

- **Primary guard**: `UNIQUE(owner_id, deal_id, trigger_type, due_date)` on the `check_ins` table
- **Cooldown guard**: `lastCheckIns` map prevents the same trigger from firing again within its window even for a different `due_date`
- **Result**: Running `evaluateCheckInTriggers` multiple times on the same day produces the same `check_ins` state

### ts-node Test Pattern (MANDATORY)

All test files **MUST** follow this exact pattern — deviations from this structure cause CI failures:

```typescript
export {}
// ts-node inline tests for Story 4.6: Proactive Check-In Scheduler — Trigger Criteria & Job
// Pattern: no imports from project lib/ — logic simulated inline.
// Run: npx ts-node lib/__tests__/checkInScheduler46.test.ts

import fs from 'fs'
import path from 'path'

let passed = 0
let failed = 0

function assert(condition: boolean, label: string): void {
  if (condition) {
    console.log(`  ✓ ${label}`)
    passed++
  } else {
    console.error(`  ✗ FAIL: ${label}`)
    failed++
  }
}

// ... inline simulation of all types and pure functions ...
// NEVER: import { evaluateTriggerCriteria } from '../../lib/crm/checkInService'
// ALWAYS: re-implement the pure logic inline in the test file

// Final summary block (REQUIRED):
console.log(`\nResults: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
```

**Critical rules**:
- Line 1: `export {}`
- Use `import fs from 'fs'` and `import path from 'path'` (even if only used for file structure checks)
- Use `process.cwd()` for path construction, NOT `__dirname`
- NEVER import from project `lib/` — re-implement all pure logic inline
- `process.exit(1)` at end if any test failed

## Test Coverage

### T1–T15: `evaluateTriggerCriteria` — core behavior

```
T1:  stale_7d fires when stale_since is exactly 7 days ago, no prior check-in
T2:  stale_7d fires when stale_since is 10 days ago (well past threshold)
T3:  stale_7d does NOT fire when stale_since is 6 days ago (below threshold)
T4:  stale_7d does NOT fire when stale_since is null (not yet stale)
T5:  stale_7d does NOT fire when last stale_7d check-in was 3 days ago (within cooldown)
T6:  stale_7d fires when last stale_7d check-in was exactly 7 days ago (boundary — fires)
T7:  stale_7d fires when last stale_7d check-in was 8 days ago (past cooldown)
T8:  pre_action_due fires when next_action_due is exactly tomorrow (1 day away)
T9:  pre_action_due does NOT fire when next_action_due is 2 days away
T10: pre_action_due does NOT fire when next_action_due is today (0 days away)
T11: pre_action_due does NOT fire when next_action_due is null
T12: pre_action_due does NOT fire when last pre_action_due check-in was 12 h ago (within 24h cooldown)
T13: cadence_followup fires when next_action starts with 'Nhắc lần 1'
T14: cadence_followup fires when next_action starts with 'Nhắc lần 2'
T15: cadence_followup does NOT fire when next_action is null
```

### T16–T30: stale_7d trigger edge cases

```
T16: stale_7d uses UTC midnight for daysStale calculation (not Date.now() timestamp)
T17: stale_7d exact 7-day boundary — stale_since = 7d ago → fires
T18: stale_7d exact 6-day boundary — stale_since = 6d ago → does NOT fire
T19: stale_7d with no prior check-ins (lastCheckIns empty map) → fires
T20: stale_7d cooldown — last check-in 6 days 23 h ago → does NOT fire
T21: stale_7d cooldown — last check-in exactly 7 × 86400000 ms ago → fires (boundary inclusive)
T22: Multiple triggers can fire simultaneously — stale_7d + cadence_followup both return
T23: stale_7d ignored for deal without stale_since even if other triggers fire
T24: stale_7d does NOT mutate the deal object (pure function check)
T25: stale_7d result array contains only 'stale_7d' when only that trigger applies
T26: stale_since in the future (bad data) → daysStale is negative → does NOT fire
T27: stale_7d — deal with all closed-stage keywords excluded by caller (guard is in evaluateCheckInTriggers, not pure fn)
T28: lastCheckIns['stale_7d'] = null → treated as no prior check-in → fires
T29: lastCheckIns['stale_7d'] = undefined → treated as no prior check-in → fires
T30: stale_7d with stale_since = today → 0 days → does NOT fire
```

### T31–T40: pre_action_due trigger

```
T31: pre_action_due — next_action_due = tomorrow → fires
T32: pre_action_due — next_action_due = 2 days away → does NOT fire
T33: pre_action_due — next_action_due = 3 days away → does NOT fire
T34: pre_action_due — next_action_due = today → does NOT fire
T35: pre_action_due — next_action_due = yesterday (overdue, 0 days) → does NOT fire
T36: pre_action_due cooldown — last sent 23 h ago → does NOT fire
T37: pre_action_due cooldown — last sent exactly 24 h ago → fires (boundary inclusive)
T38: pre_action_due cooldown — last sent 25 h ago → fires
T39: pre_action_due — no cooldown entry → fires
T40: pre_action_due — null next_action_due with prior stale_7d → only stale_7d fires
```

### T41–T50: cadence_followup trigger

```
T41: cadence_followup — next_action = 'Nhắc lần 1: ...' → fires
T42: cadence_followup — next_action = 'Nhắc lần 2: ...' → fires
T43: cadence_followup — next_action = 'Nhắc lần' (bare prefix) → fires
T44: cadence_followup — next_action = 'nhắc lần 1' (lowercase n) → does NOT fire (case-sensitive prefix match)
T45: cadence_followup — next_action = 'Follow up - Nhắc lần 1' (prefix not at start) → does NOT fire
T46: cadence_followup — next_action = null → does NOT fire
T47: cadence_followup — next_action = 'Other action' → does NOT fire
T48: cadence_followup cooldown — last sent 20 h ago → does NOT fire
T49: cadence_followup cooldown — last sent 24 h ago → fires
T50: cadence_followup + stale_7d both active → both returned in result array
```

### T51–T60: file structure & contract checks

```
T51: checkInService.ts file exists at lib/crm/checkInService.ts
T52: checkInService.ts first line is "import 'server-only'"
T53: checkInService.ts imports createServiceClient (not createServerClient)
T54: checkInService.ts exports evaluateTriggerCriteria
T55: checkInService.ts exports evaluateCheckInTriggers
T56: checkInService.ts exports scheduleCheckIn
T57: checkInService.ts exports getPendingCheckIns
T58: cron route exists at app/api/cron/check-in-scheduler/route.ts
T59: cron route contains 'validateCronSecret' function
T60: cron route does NOT import createServerClient (must use createServiceClient per AD-13)
```

## Previous Story Intelligence (from Story 4.5)

Story 4.5 (Briefing Panel UI) established these patterns that Story 4.6 must be consistent with:

- `createServiceClient()` is used in all service-path code (cron, background jobs); `createServerClient()` is only for owner-initiated API routes
- The briefing cron route at `app/api/cron/briefing/route.ts` is the exact template to follow for the new cron route
- `generateBriefingsForAllOwners` is the exact pattern for the multi-owner loop in the cron handler
- The `isActiveStage()` filter (`!['won', 'lost', 'archived', 'completed'].includes(stage.toLowerCase())`) must be consistent across all services — copy inline, do NOT import
- Per-owner try/catch ensures partial failures don't abort the full cron run

## Git Intelligence (recent commits)

Based on the commit history, the established patterns to follow precisely:

- `lib/crm/*.ts` files all begin with `import 'server-only'` (stories 0.7, 0.8, 4.3, 4.4)
- Test files follow the `export {}` + inline simulation pattern without exception
- `callAI()` is NOT needed in this story — trigger evaluation is deterministic (consistent with AD-4)
- `logActivity()` is imported from `@/lib/crm/activityLogService` using fire-and-forget `.catch()` pattern

## Acceptance Criteria (≥10 — Full List)

1. `GET /api/cron/check-in-scheduler` with no `Authorization` header → 401
2. `GET /api/cron/check-in-scheduler` with incorrect secret → 401
3. `GET /api/cron/check-in-scheduler` with correct `Bearer {CRON_SECRET}` → 200 with `{ date, scheduled, owners, errors }` payload
4. Deal with `stale_since = 7 days ago`, no prior `stale_7d` check-in → `check_ins` row inserted with `trigger_type = 'stale_7d'`, `status = 'pending'`
5. Deal with `stale_since = 6 days ago` → no `stale_7d` row inserted
6. Deal with `stale_since = 7 days ago` but `stale_7d` check-in already created 5 days ago → no new row (within cooldown)
7. Deal with `next_action_due = tomorrow` and no prior `pre_action_due` check-in → row inserted
8. Deal with `next_action_due = 2 days away` → no row inserted
9. Deal with `next_action = 'Nhắc lần 1: ...'` and no `cadence_followup` in last 24 h → row inserted
10. Running `evaluateCheckInTriggers` twice for same owner/day → no duplicate rows (upsert idempotent)
11. Owner with zero active deals → `{ scheduled: 0 }`, no DB writes
12. `checkInService.ts` line 1 is `import 'server-only'`; all queries include `.eq('owner_id', ownerId)`
13. `getPendingCheckIns` returns only `status = 'pending'` rows with `due_date <= today`; future-dated `pending` rows excluded
14. On new check-in insert: `activity_log` entry written with `actor: 'ai'`, `action: 'checkin_scheduled'`
15. `npm run test:check-in-scheduler46` exits 0 with all ≥60 assertions passing
16. `npm test` (CI chain) completes without breaking any prior story tests

---

## Dev Agent Record

### Completion Notes

_[Dev agent fills this in after implementation]_

### File List

_[Dev agent fills this in after implementation]_

- `lib/crm/checkInService.ts` — NEW
- `app/api/cron/check-in-scheduler/route.ts` — NEW
- `lib/__tests__/checkInScheduler46.test.ts` — NEW
- `package.json` — MODIFIED

### Change Log

| Date | Change |
|------|--------|
| 2026-06-30 | Story file created — ready for dev |
