---
story: 4-8
title: Check-In Cadence Configuration & Per-Deal Pause
status: done
epic: 4
sprint: 1
baseline_commit: c2efd6a
---

# Story 4.8: Check-In Cadence Configuration & Per-Deal Pause

Status: done

## Story

As an Owner,
I want to configure global check-in frequency, adjust the inactivity thresholds, and pause check-ins per deal or globally,
so that proactive prompts are helpful rather than noise.

## Acceptance Criteria

1. **Settings surface**: Settings → Check-in Cadence panel renders: global daily cap (default 3, min 1 max 10), high-priority threshold (default 3 days, min 1), standard threshold (default 5 days, min 1), global enabled toggle. All inputs have visible `<label>` elements.
2. **Settings persist**: Saving updated cadence values writes to `settings.checkin_config` (jsonb) scoped to `owner_id` (AD-2).
3. **Activity log**: On save, an activity_log entry is inserted: `entity_type='settings'`, `entity_id=ownerId`, `action='checkin_cadence_configured'`, `actor='user'`, `payload` contains before/after values.
4. **Evaluation reads config**: `evaluateCheckInTriggers()` in `checkInService.ts` fetches owner cadence config and passes it to `evaluateTriggerCriteria()` instead of using hardcoded defaults.
5. **High-priority threshold**: Deals with `priority='high'` use `high_priority_threshold_days` for the stale trigger; other deals use `standard_threshold_days`.
6. **Daily cap**: The cron evaluator stops scheduling new check-ins for an owner when the total scheduled that day >= `daily_cap`.
7. **Global pause**: When `enabled = false`, `evaluateCheckInTriggers()` returns `{ scheduled: 0 }` immediately without querying deals.
8. **Per-deal pause via conversation**: ARIA's `update_deal` tool now accepts `checkin_paused: boolean`. When an owner says "Pause check-ins for the X deal", ARIA sets `checkin_paused = true`; "Resume…" sets it `false`. ARIA confirms and tells owner how to reverse.
9. **Per-deal pause enforced**: `evaluateTriggerCriteria` skips deals where `checkin_paused = true` (no triggers fire for those deals).
10. **Threshold validation**: If high-priority threshold >= standard threshold, the API returns 400 and the UI shows inline validation: "Ngưỡng ưu tiên cao nên ngắn hơn ngưỡng thông thường."
11. **Auth guard**: Both API routes return 401 for unauthenticated requests.
12. **AD-2**: All DB queries include `.eq('owner_id', user.id)` or equivalent.
13. **Tests pass**: `npm run test:check-in-cadence48` exits 0 with all ≥60 assertions passing.
14. **CI chain intact**: `npm test` includes the new test and does not break any prior test.

## Tasks / Subtasks

- [ ] T1: Create migration `supabase/migrations/20260630100000_checkin_cadence_config.sql` (AC: 2, 9)
  - [ ] T1.1: `ALTER TABLE settings ADD COLUMN IF NOT EXISTS checkin_config jsonb NOT NULL DEFAULT '{"daily_cap":3,"high_priority_threshold_days":3,"standard_threshold_days":5,"enabled":true}'::jsonb;`
  - [ ] T1.2: `ALTER TABLE deals ADD COLUMN IF NOT EXISTS checkin_paused boolean NOT NULL DEFAULT false;`

- [ ] T2: Create `app/api/settings/cadence/route.ts` (AC: 1, 2, 3, 10, 11, 12)
  - [ ] T2.1: GET handler — `createServerClient()`, 401 if no user; fetch `checkin_config` from settings; return defaults if no row
  - [ ] T2.2: PUT handler — validate body fields; validate high < standard threshold (400 if not); upsert `checkin_config`; log activity; return updated config

- [ ] T3: Modify `lib/crm/checkInService.ts` (AC: 4, 5, 6, 7, 9)
  - [ ] T3.1: Define `CheckInConfig` interface: `{ daily_cap: number; high_priority_threshold_days: number; standard_threshold_days: number; enabled: boolean }`
  - [ ] T3.2: Add `DEFAULT_CHECKIN_CONFIG` constant matching the migration default values
  - [ ] T3.3: Update `evaluateTriggerCriteria` signature to accept `config: CheckInConfig` as 4th parameter
  - [ ] T3.4: Replace hardcoded `7` (stale days) with `deal.priority === 'high' ? config.high_priority_threshold_days : config.standard_threshold_days`
  - [ ] T3.5: In `evaluateCheckInTriggers`: if `!config.enabled`, return `{ scheduled: 0 }` immediately
  - [ ] T3.6: In `evaluateCheckInTriggers`: fetch cadence config from settings via `supabase.from('settings').select('checkin_config').eq('owner_id', ownerId).single()`; merge with defaults
  - [ ] T3.7: In `evaluateCheckInTriggers`: filter deals with `deal.checkin_paused === true` before evaluation
  - [ ] T3.8: In `evaluateCheckInTriggers`: count check-ins already scheduled today (query `check_ins` where `due_date = today AND status = 'pending'`); stop when `scheduled + existingToday >= config.daily_cap`
  - [ ] T3.9: Update `DealRow` interface to include `checkin_paused: boolean`

- [ ] T4: Modify `lib/ai/crmTools.ts` — extend `update_deal` tool (AC: 8)
  - [ ] T4.1: Add `checkin_paused: { type: 'boolean', description: 'Set to true to pause check-in reminders for this deal, false to resume.' }` to update_deal input_schema properties
  - [ ] T4.2: Update the `update_deal` tool description to mention pause/resume capability

- [ ] T5: Modify `lib/crm/crmService.ts` — handle `checkin_paused` in deal update (AC: 8, 9)
  - [ ] T5.1: In the `update_deal` handler, include `checkin_paused` in the allowed update fields (alongside stage, value, etc.)
  - [ ] T5.2: Log activity with `action: checkin_paused ? 'checkin_paused' : 'checkin_resumed'` when the field changes

- [ ] T6: Create `components/settings/CadencePanel.tsx` (AC: 1, 2, 10)
  - [ ] T6.1: `'use client'` at line 1
  - [ ] T6.2: Fetch `GET /api/settings/cadence` on mount; populate form fields
  - [ ] T6.3: Controlled inputs: daily_cap (number), high_priority_threshold_days (number), standard_threshold_days (number), enabled (checkbox/toggle)
  - [ ] T6.4: Client-side validation: high_priority < standard (block save if not, show Vietnamese error message)
  - [ ] T6.5: Save button → `PUT /api/settings/cadence`; show saving/saved/error state
  - [ ] T6.6: Each input has a visible `<label>` (accessible, EXPERIENCE.md floor)

- [ ] T7: Modify `components/layout/AppShell.tsx` (AC: 1)
  - [ ] T7.1: Import `CadencePanel`
  - [ ] T7.2: Render `CadencePanel` below or alongside `BusinessContextPanel` in settings mode (use a vertical stack or simple section divider)

- [ ] T8: Create `lib/__tests__/checkInCadenceConfig48.test.ts` (AC: 13)
  - [ ] T8.1: Line 1: `export {}`; import only `fs` and `path`; `process.cwd()`, never `__dirname`
  - [ ] T8.2: NEVER import from project `lib/` — inline all pure logic
  - [ ] T8.3: Write T1–T60+ tests (see Test Coverage section)
  - [ ] T8.4: Summary block: `process.exit(1)` if any failed

- [ ] T9: Update `package.json` (AC: 13, 14)
  - [ ] T9.1: Add `"test:check-in-cadence48": "npx ts-node lib/__tests__/checkInCadenceConfig48.test.ts"`
  - [ ] T9.2: Append `&& npx ts-node lib/__tests__/checkInCadenceConfig48.test.ts` to the `"test"` CI chain

## Dev Notes

### Database Columns

**`settings.checkin_config`** (jsonb, NOT NULL, default shown):
```json
{
  "daily_cap": 3,
  "high_priority_threshold_days": 3,
  "standard_threshold_days": 5,
  "enabled": true
}
```
One row per owner (`UNIQUE owner_id`). Use upsert with `onConflict: 'owner_id'` when saving. Fetch with `.select('checkin_config').eq('owner_id', ownerId).single()`. If no row exists (new owner), fall back to `DEFAULT_CHECKIN_CONFIG`.

**`deals.checkin_paused`** (boolean, NOT NULL DEFAULT false):
Added by migration. `evaluateTriggerCriteria` skips deals where this is true. The cron route queries include `deals.checkin_paused` in the select.

### `CheckInConfig` interface and defaults

```typescript
export interface CheckInConfig {
  daily_cap: number
  high_priority_threshold_days: number
  standard_threshold_days: number
  enabled: boolean
}

export const DEFAULT_CHECKIN_CONFIG: CheckInConfig = {
  daily_cap: 3,
  high_priority_threshold_days: 3,
  standard_threshold_days: 5,
  enabled: true,
}
```

### Updated `DealRow` interface (add `checkin_paused`)

```typescript
interface DealRow {
  id: string
  title: string
  stage: string
  priority: string | null
  next_action: string | null
  next_action_due: string | null
  stale_since: string | null
  checkin_paused: boolean          // NEW — Story 4.8
}
```

And in the `evaluateCheckInTriggers` select:
```typescript
.select('id, title, stage, priority, next_action, next_action_due, stale_since, checkin_paused')
```

### Updated `evaluateTriggerCriteria` signature

```typescript
export function evaluateTriggerCriteria(
  deal: DealRow,
  lastCheckIns: LastCheckInsMap,
  today: string,
  config: CheckInConfig,   // NEW — replaces hardcoded defaults
): CheckInTriggerType[] {
  if (deal.checkin_paused) return []        // NEW — respect per-deal pause
  
  const staleThreshold = deal.priority === 'high'
    ? config.high_priority_threshold_days
    : config.standard_threshold_days
    
  // stale_7d trigger — use staleThreshold instead of hardcoded 7
  if (deal.stale_since) {
    const staleDays = Math.floor(
      (todayMs - new Date(deal.stale_since + 'T00:00:00Z').getTime()) / 86_400_000
    )
    if (staleDays >= staleThreshold) {
      const lastSentDate = lastCheckIns['stale_7d']
      const lastSentMs = lastSentDate
        ? new Date(toUtcDate(lastSentDate) + 'T00:00:00Z').getTime()
        : null
      // Cooldown = staleThreshold calendar days (not hardcoded 7)
      const cooldownOk = !lastSentMs || (todayMs - lastSentMs) >= staleThreshold * 86_400_000
      if (cooldownOk) { triggers.push('stale_7d') }
    }
  }
  // pre_action_due and cadence_followup remain unchanged (1-day cooldown each)
}
```

**Note**: The `pre_action_due` trigger (fires when action is due tomorrow) and `cadence_followup` trigger (fires when `next_action.startsWith('Nhắc lần')`) are NOT made configurable by this story — only the stale detection thresholds change.

### Updated `evaluateCheckInTriggers` with config fetch and daily cap

```typescript
export async function evaluateCheckInTriggers(
  ownerId: string,
  today: string,
): Promise<{ scheduled: number }> {
  const supabase = createServiceClient()

  // Fetch cadence config (Story 4.8) — merge with defaults for missing fields
  const { data: settingsRow } = await supabase
    .from('settings')
    .select('checkin_config')
    .eq('owner_id', ownerId)
    .single()
  
  const rawConfig = settingsRow?.checkin_config
  const config: CheckInConfig = {
    ...DEFAULT_CHECKIN_CONFIG,
    ...(typeof rawConfig === 'object' && rawConfig !== null ? rawConfig : {}),
  }

  // Global pause: skip all evaluation
  if (!config.enabled) return { scheduled: 0 }

  // ... existing deal fetch ...
  // Filter paused deals
  const activeDeals = ((rawDeals ?? []) as DealRow[])
    .filter((d) => isActiveStage(d.stage) && !d.checkin_paused)  // NEW

  // Count check-ins already scheduled today (daily cap)
  const { count: existingTodayCount } = await supabase
    .from('check_ins')
    .select('id', { count: 'exact', head: true })
    .eq('owner_id', ownerId)
    .eq('due_date', today)

  let scheduledThisRun = 0

  for (const deal of activeDeals) {
    if ((existingTodayCount ?? 0) + scheduledThisRun >= config.daily_cap) break  // cap reached

    const lastCheckIns = checkInsByDeal.get(deal.id) ?? {}
    const triggerTypes = evaluateTriggerCriteria(deal, lastCheckIns, today, config)  // pass config

    for (const triggerType of triggerTypes) {
      if ((existingTodayCount ?? 0) + scheduledThisRun >= config.daily_cap) break
      await scheduleCheckIn(ownerId, deal.id, triggerType, today, supabase)
      scheduledThisRun++
    }
  }

  return { scheduled: scheduledThisRun }
}
```

### `app/api/settings/cadence/route.ts` — Complete Implementation

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/crm/activityLogService'
import type { CheckInConfig } from '@/lib/crm/checkInService'
import { DEFAULT_CHECKIN_CONFIG } from '@/lib/crm/checkInService'

// AD-13: owner-initiated route — createServerClient() (RLS-enforced)

export async function GET(): Promise<NextResponse> {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabase
    .from('settings')
    .select('checkin_config')
    .eq('owner_id', user.id)
    .single()

  const config: CheckInConfig = {
    ...DEFAULT_CHECKIN_CONFIG,
    ...(typeof data?.checkin_config === 'object' && data.checkin_config !== null
      ? data.checkin_config
      : {}),
  }
  return NextResponse.json({ config })
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Partial<CheckInConfig>
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const config: CheckInConfig = { ...DEFAULT_CHECKIN_CONFIG, ...body }

  // Validate threshold ordering (AC-10)
  if (config.high_priority_threshold_days >= config.standard_threshold_days) {
    return NextResponse.json(
      { error: 'Ngưỡng ưu tiên cao nên ngắn hơn ngưỡng thông thường.' },
      { status: 400 }
    )
  }
  if (config.daily_cap < 1 || config.daily_cap > 10) {
    return NextResponse.json({ error: 'daily_cap must be between 1 and 10' }, { status: 400 })
  }

  // Fetch old config for activity log
  const { data: existing } = await supabase
    .from('settings')
    .select('checkin_config')
    .eq('owner_id', user.id)
    .single()

  const { error } = await supabase
    .from('settings')
    .upsert({ owner_id: user.id, checkin_config: config }, { onConflict: 'owner_id' })

  if (error) {
    console.error('[ARIA/settings/cadence] upsert error:', error.message)
    return NextResponse.json({ error: 'save_error' }, { status: 500 })
  }

  logActivity(user.id, {
    entity_type: 'settings',
    entity_id: user.id,
    action: 'checkin_cadence_configured',
    actor: 'user',
    payload: { before: existing?.checkin_config ?? null, after: config },
  }).catch((err) => console.warn('[ARIA/settings/cadence] logActivity failed:', err))

  return NextResponse.json({ config })
}
```

### `crmTools.ts` — Extend `update_deal` tool

Add to the `update_deal` properties object:
```typescript
checkin_paused: {
  type: 'boolean',
  description: 'Set to true to pause all check-in reminders for this deal. Set to false to resume.',
},
```

The `required` array for `update_deal` should NOT include `checkin_paused` (it's optional, like all other update fields).

### `crmService.ts` — Include `checkin_paused` in deal update

In the deal update handler, add `checkin_paused` to the allowed field list alongside stage, value, etc. When `checkin_paused` changes value, log a specific activity:
```typescript
if (typeof updates.checkin_paused === 'boolean') {
  allowed.checkin_paused = updates.checkin_paused
  // Log separate activity for pause/resume
  logActivity(ownerId, {
    entity_type: 'deal',
    entity_id: dealId,
    action: updates.checkin_paused ? 'checkin_paused' : 'checkin_resumed',
    actor: 'ai',
    payload: {},
  }).catch(() => {})
}
```

### `CadencePanel.tsx` — UI implementation notes

- Follow exact styling from `BusinessContextPanel.tsx`: dark theme (#0a0e27 bg, #14b8a6 teal for save button, #f59e0b amber for warnings)
- Number inputs use `type="number"` with `min` attribute
- Enabled toggle is a `<input type="checkbox">` with label "Bật nhắc nhở check-in tự động"
- Inline validation error shown in amber (#f59e0b) below the threshold inputs when high >= standard
- Save button is disabled while saving or while validation error exists
- Show "Đã lưu" status (teal) for 3s after successful save, same pattern as BusinessContextPanel

### `AppShell.tsx` modification — CadencePanel

In the settings section, render both panels stacked vertically:
```tsx
{mode === 'settings' && (
  <div style={{ overflowY: 'auto', flex: 1 }}>
    <BusinessContextPanel />
    <CadencePanel />
  </div>
)}
```

The existing BusinessContextPanel is currently rendered directly. Wrap them in a scrollable container div.

### `crmService.ts` — find the file path

The deal update handler is likely in `lib/crm/crmService.ts` (pattern from Story 2.2). Read this file before modifying.

### Architecture Decisions Checklist

| AD | Rule | This Story |
|---|---|---|
| AD-2 | All queries `.eq('owner_id', ownerId)` | Cadence API routes and checkInService |
| AD-11 | `lib/crm/` files: `import 'server-only'` at line 1 | checkInService.ts already has it |
| AD-13 | `createServerClient()` for owner routes; `createServiceClient()` for cron | Cadence API = createServerClient(); checkInService cron = createServiceClient() |
| AD-14 | activity_log append-only | logActivity() only inserts |

## Test Coverage

### T1–T15: `evaluateTriggerCriteria` with config

```
T1:  With config high=3, standard=5, high-priority deal stale 3+ days triggers stale check-in
T2:  With config high=3, standard=5, standard deal stale 3 days does NOT trigger (needs 5)
T3:  With config high=3, standard=5, standard deal stale 5+ days triggers stale check-in
T4:  Deal with checkin_paused=true returns empty triggers array
T5:  Deal with checkin_paused=false is evaluated normally
T6:  pre_action_due trigger still fires (1-day cooldown, not configurable)
T7:  cadence_followup trigger still fires (not configurable)
T8:  Cooldown for stale uses staleThreshold days (not hardcoded 7)
T9:  High-priority deal stale threshold is high_priority_threshold_days
T10: Standard-priority deal stale threshold is standard_threshold_days
T11: Null priority uses standard_threshold_days
T12: Config with same high+standard threshold blocks no triggers (not evaluateTriggerCriteria's job to validate)
T13: Empty config fields fall back to DEFAULT_CHECKIN_CONFIG values
T14: DEFAULT_CHECKIN_CONFIG has daily_cap=3, high=3, standard=5, enabled=true
T15: evaluateTriggerCriteria with valid cooldown skips already-cooled-down trigger
```

### T16–T30: File structure checks

```
T16: migration file exists at supabase/migrations/20260630100000_checkin_cadence_config.sql
T17: migration adds checkin_config column to settings
T18: migration adds checkin_paused column to deals
T19: cadence API route exists at app/api/settings/cadence/route.ts
T20: cadence route contains createServerClient
T21: cadence route does NOT contain createServiceClient
T22: cadence route exports GET function
T23: cadence route exports PUT function
T24: cadence route validates high < standard threshold (400 on invalid)
T25: cadence route calls logActivity on PUT
T26: cadence route contains 'checkin_cadence_configured' action string
T27: checkInService.ts exports CheckInConfig interface
T28: checkInService.ts exports DEFAULT_CHECKIN_CONFIG constant
T29: checkInService.ts evaluateTriggerCriteria accepts config parameter (4 params)
T30: checkInService.ts evaluateCheckInTriggers fetches settings (checkin_config)
```

### T31–T45: Component and AppShell structure

```
T31: CadencePanel.tsx exists at components/settings/CadencePanel.tsx
T32: CadencePanel.tsx first line is 'use client'
T33: CadencePanel.tsx fetches /api/settings/cadence on mount
T34: CadencePanel.tsx has daily_cap input
T35: CadencePanel.tsx has high_priority_threshold_days input
T36: CadencePanel.tsx has standard_threshold_days input
T37: CadencePanel.tsx has enabled toggle/checkbox
T38: CadencePanel.tsx has visible labels for each input
T39: CadencePanel.tsx saves via PUT /api/settings/cadence
T40: CadencePanel.tsx has Vietnamese validation error message (Nguong uu tien)
T41: CadencePanel.tsx disables save when validation error present
T42: AppShell.tsx imports CadencePanel
T43: AppShell.tsx renders CadencePanel in settings mode
T44: CadencePanel.tsx does NOT hardcode checkin thresholds as state initial values (reads from API)
T45: CadencePanel.tsx has error/saving/saved state handling
```

### T46–T60: crmTools, crmService, and package.json

```
T46: crmTools.ts update_deal tool includes checkin_paused in input_schema
T47: crmTools.ts checkin_paused property is typed as boolean
T48: crmService.ts (or update_deal handler) includes checkin_paused in allowed update fields
T49: crmService.ts logs checkin_paused or checkin_resumed action
T50: checkInService.ts DealRow interface includes checkin_paused field
T51: checkInService.ts evaluateCheckInTriggers deal query selects checkin_paused
T52: checkInService.ts filters out checkin_paused deals
T53: checkInService.ts respects enabled=false global pause (returns scheduled:0)
T54: checkInService.ts fetches checkin_config from settings
T55: checkInService.ts merges fetched config with DEFAULT_CHECKIN_CONFIG
T56: checkInService.ts daily_cap is enforced in evaluateCheckInTriggers
T57: cadence route PUT returns 400 for high >= standard threshold
T58: cadence route PUT returns 400 for daily_cap > 10
T59: package.json contains test:check-in-cadence48 script
T60: package.json test script contains checkInCadenceConfig48.test.ts in CI chain
```

## Previous Story Intelligence (from Stories 4.6 and 4.7)

1. `evaluateTriggerCriteria` is a pure function (no I/O) — adding a 4th `config` parameter is safe and testable inline.
2. `evaluateCheckInTriggers` uses `createServiceClient()` (AD-13 — cron path). Settings fetch inside this function should also use the service client (same reasoning — cron context).
3. The `check_ins` daily cap count query should use `{ count: 'exact', head: true }` pattern for efficiency (no rows returned, just the count).
4. Test pattern: `export {}` line 1, `import fs from 'fs'`, `process.cwd()`, no project lib imports — identical for every story.
5. `crmService.ts` patterns: look at how `update_deal` calls are processed (read the file before implementing T5).
6. Settings upsert: use `{ onConflict: 'owner_id' }` (UNIQUE constraint — one row per owner).

## Git Intelligence

- Story 4.7: `logActivity` fire-and-forget `.catch()` pattern — same for this story.
- Story 4.6: batch query pattern, `toUtcDate()` for calendar-day cooldowns — both remain.
- Story 4.8 changes the `evaluateTriggerCriteria` signature (adds 4th param `config`) which means the existing calls in `evaluateCheckInTriggers` must also be updated.

## File List

- `supabase/migrations/20260630100000_checkin_cadence_config.sql` — NEW
- `app/api/settings/cadence/route.ts` — NEW
- `lib/crm/checkInService.ts` — MODIFY (CheckInConfig, DEFAULT_CHECKIN_CONFIG, evaluateTriggerCriteria 4th param, evaluateCheckInTriggers config fetch + daily cap + paused filter)
- `lib/ai/crmTools.ts` — MODIFY (add checkin_paused to update_deal)
- `lib/crm/crmService.ts` — MODIFY (handle checkin_paused in deal update)
- `components/settings/CadencePanel.tsx` — NEW
- `components/layout/AppShell.tsx` — MODIFY (import + render CadencePanel)
- `lib/__tests__/checkInCadenceConfig48.test.ts` — NEW
- `package.json` — MODIFY

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

### Change Log

| Date | Change |
|------|--------|
| 2026-06-30 | Story file created — ready for dev |
