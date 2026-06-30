---
story_id: 2.5
epic: 2
title: AI-Maintained Intelligence Fields — Idempotent Updates with Provenance
status: done
baseline_commit: c2efd6a
---

## Story

As **ARIA**, I want to update deal and client intelligence fields automatically after a Deal Intelligence session, with full provenance and idempotency, so that the Owner's records improve over time without any manual effort and without clobbering human edits.

## What Already Exists (do NOT re-implement)

The following are fully operational. Story 2.5 must NOT duplicate them:

**`lib/crm/dealIntelligenceService.ts`:**
- `updateIntelligenceFields(ownerId, input)` — fully wired idempotent writer. Fetches current values, compares via `JSON.stringify`, builds `updates`/`changedFields`, writes all changed fields in a single `supabase.update()`, then inserts one `activity_log` row with `action="intelligence_fields_updated"`, `actor="ai"`, `payload: { changedFields, values: updates }`. Returns `{ updated: boolean, changedFields: string[] }`.
- `IntelligenceFieldsInput` — typed as `{ deal_id, inferred_real_need?, risk_flags?, opportunity_signals?, predicted_outcome?, prediction_reason?, similar_deals?: SimilarDealEntry[], stall_diagnosis? }`. Already requires `SimilarDealEntry[]` (typed since Story 2.4).
- `getDeal()`, `getClient()`, `findSimilarDeals()`, `getPricingFloors()` — all wired and working.
- `SimilarDealEntry` interface (`{ deal_id: string; similarity_reason: string }`) — exported from `dealIntelligenceService.ts`.

**`lib/crm/crmService.ts`:**
- `updateDeal(ownerId, input)` — already has 24h human-edit protection. Checks last `activity_log` entry for the deal; if `actor=user` within 24h, moves all `changedFields` to `protectedFields` and skips the write.
- `updateClient(ownerId, input)` — same 24h human-edit protection pattern as `updateDeal`. Logs `action="client_updated"`, `actor=ai|user`.

**`lib/ai/dealIntelligenceTools.ts` (`DI_TOOLS`):**
- `update_intelligence_fields` tool — already declared with full schema. `deal_id` is `required`. All intelligence field properties correctly typed. `similar_deals` items schema includes `{ deal_id: string, similarity_reason: string }`.
- Tool list is alphabetically ordered for cache stability (AD-5).

**`lib/ai/toolRunner.ts`:**
- `update_intelligence_fields` dispatch already wired to `updateIntelligenceFields()`.
- All other tool dispatches (CRM tools, DI tools) are wired and working.

**`lib/crm/activityLogService.ts`:**
- `logActivity(ownerId, params)` — `payload` is `Record<string, unknown>`, so arbitrary keys (including `source`) can be placed in it with no schema change.

**`lib/crm/stubLifecycleService.ts`** (Story 2.3):
- `findStaleStubs()`, `promoteStub()`, `archiveStub()`, `checkStubEnrichment()` — all operational. Untouched by this story.

## Gap Analysis — What Story 2.5 Adds

Story 2.5 closes two gaps not covered by prior stories:

### Gap 1 — `updateIntelligenceFields()` lacks human-edit protection

`updateDeal()` and `updateClient()` in `crmService.ts` both implement a 24h human-edit protection window: if the most recent `activity_log` entry for the entity has `actor=user` and is less than 24 hours old, AI writes are blocked and the affected fields are returned as `protectedFields`. **`updateIntelligenceFields()` in `dealIntelligenceService.ts` has no such protection.** An AI session could silently overwrite `inferred_real_need` that the Owner set manually just hours ago.

The AC in Epic 2, Story 5 explicitly requires: "ARIA does not silently overwrite it; instead ARIA proposes the new inference in its response ('I now read their real need as X — want me to update the record?') and writes only after the Owner confirms." The caller (orchestrator/DI specialist) must know which fields were blocked to do this — it needs `protectedFields` in the return value.

**Fix:** Add human-edit protection to `updateIntelligenceFields()` using the same 24h window pattern as `updateDeal()`: query the last `activity_log` row for the deal filtered by `entity_type='deal'`, `entity_id=input.deal_id`; if `actor=user` and age < 24h, move all `changedFields` to `protectedFields`, skip the DB write and log, return `{ updated: false, changedFields: [], protectedFields }`.

Update the return type: `{ updated: boolean; changedFields: string[]; protectedFields: string[] }`.

### Gap 2 — Activity log entry for intelligence field updates lacks a `source` field

The current `updateIntelligenceFields()` logs: `payload: { changedFields, values: updates }`. The AC requires the log entry to include a `source` field naming the originating reasoning path (e.g. `"deal_intelligence"`, `"proactive_checkin"`) so provenance is auditable.

**Fix:** Add an optional `source?: string` field to `IntelligenceFieldsInput`. When present, include it in the `payload` on the activity log insert: `payload: { changedFields, values: updates, source: input.source }`. When absent, omit the key (backward compatible). No DB schema change — `payload` is `jsonb`.

### Gap 3 — No story-specific test file

Stories 2.1–2.4 each have a corresponding test file in `lib/__tests__/`. Story 2.5 needs `lib/__tests__/intelligenceFields25.test.ts` covering: human-edit protection logic (field blocking), provenance payload shape, no-op idempotency, and retry-safe behavior.

### Summary of additions

1. **`IntelligenceFieldsInput.source`** — add optional `source?: string` field
2. **`updateIntelligenceFields()` return type** — add `protectedFields: string[]` to the return object
3. **Human-edit protection logic** — add 24h window check (same pattern as `updateDeal`) to `updateIntelligenceFields()`
4. **Provenance in log payload** — include `source` key in `payload` when provided
5. **`lib/__tests__/intelligenceFields25.test.ts`** — new test file
6. **`package.json`** — add `"test:intelligence-fields25"` script

**No new tools, no new tool dispatch cases, no new service files, no DB migrations.**

## Acceptance Criteria

- **AC-1 — Batch write + single log entry:** Given a Deal Intelligence session produces new values for `inferred_real_need`, `risk_flags`, and `predicted_outcome`, when ARIA calls `update_intelligence_fields` (via `updateIntelligenceFields()`), then all three changed fields are written in a single `supabase.update()` call; one `activity_log` row is inserted with `action="intelligence_fields_updated"`, `actor="ai"`, and `payload.changedFields` listing all three field names (FR-8, AD-14).

- **AC-2 — Identical values are a no-op:** Given intelligence field values identical to those already stored, when `updateIntelligenceFields()` is called, then no DB write occurs and no `activity_log` row is inserted; the return value is `{ updated: false, changedFields: [], protectedFields: [] }` (AD-14 idempotent AI writes).

- **AC-3 — Human-edit protection blocks AI overwrite:** Given the most recent `activity_log` entry for the deal has `actor="user"` and was created less than 24 hours ago, when `updateIntelligenceFields()` is called with one or more changed intelligence fields, then no `supabase.update()` is executed, no `activity_log` row is inserted, and the return value is `{ updated: false, changedFields: [], protectedFields: [<blocked field names>] }` — the caller uses `protectedFields` to propose the update conversationally (AD-14).

- **AC-4 — Client intelligence fields obey the same rules:** Given a Deal Intelligence session extracts signals about a client's `communication_style` or `known_hesitations`, when ARIA calls `update_client` (via `updateClient()`) with `actor="ai"`, then the client record is updated (or blocked if human-edit protection triggers), the activity log records `actor="ai"`, and the same idempotency and 24h protection rules apply — these fields flow through `updateClient()` in `crmService.ts` which already implements the protection (no additional code needed for this AC; verify existing behavior holds).

- **AC-5 — Retry idempotency (no duplicate log entries):** Given `updateIntelligenceFields()` is called twice with the same input for the same deal, when the first call has already written the fields (no material change on second call), then the second call detects no change via compare-before-write and writes nothing — the `activity_log` contains exactly one entry for the change, not two (AD-14).

- **AC-6 — Provenance `source` field in log payload:** Given `updateIntelligenceFields()` is called with `source="deal_intelligence"`, when the activity log entry is written, then `payload.source === "deal_intelligence"` is present in the row; given `source` is omitted from the call, then `payload.source` is absent from the row (backward compatible) (AD-14).

- **AC-7 — CI triad passes:** `tsc --noEmit`, ESLint, and Prettier on all touched files; `ts-node` test file runs with all assertions passing.

## Tasks / Subtasks

- [x] **Task 1 — Extend `lib/crm/dealIntelligenceService.ts`** (modify existing file)

  **Add `source` to `IntelligenceFieldsInput`:**
  - [x] Added `source?: string` field to `IntelligenceFieldsInput` after `stall_diagnosis`

  **Update `updateIntelligenceFields()` return type:**
  - [x] Changed return type to include `protectedFields: string[]`
  - [x] No-op early return updated to `{ updated: false, changedFields: [], protectedFields: [] }`

  **Add human-edit protection (24h window):**
  - [x] Added `.maybeSingle()` query (not `.single()` — safe on zero rows) after no-op check
  - [x] Protection triggers on `actor='user'` + age < 24h; returns `protectedFields` immediately
  - [x] Success path returns `{ updated: true, changedFields, protectedFields: [] }`

  **Add `source` to activity log payload:**
  - [x] Payload uses `...(input.source ? { source: input.source } : {})` — backward compatible

- [x] **Task 2 — Update `lib/ai/toolRunner.ts`**
  - [x] Injected `source: 'deal_intelligence'` server-side with comment documenting intentional override
  - [x] `source` is NOT in `DI_TOOLS` schema — AD-5 preserved

- [x] **Task 3 — Tests** (`lib/__tests__/intelligenceFields25.test.ts` — new file)
  - [x] `export {}` at top
  - [x] All logic inlined — no project `lib/` imports
  - [x] 28 assertions across 11 tests; all pass
  - [x] Added `"test:intelligence-fields25"` to `package.json` scripts

- [x] **Task 4 — CI triad**
  - [x] Prettier — all files unchanged
  - [x] `npx tsc --noEmit` — 0 errors
  - [x] `npx eslint` — 0 errors
  - [x] 28 passed, 0 failed

- [x] **Task 5 — Update story status**

## Dev Notes

### Architecture decisions in effect

- **AD-1**: `@anthropic-ai/sdk` is blocked outside `lib/ai/` by ESLint guard. `dealIntelligenceService.ts` must NOT import it. The `source` field is server-side provenance set by the route/toolRunner, not by Claude.
- **AD-2**: `updateIntelligenceFields()` already applies `.eq('owner_id', ownerId)` on both the fetch and the write. The new activity log query for human-edit protection must also include `.eq('owner_id', ownerId)` to prevent cross-owner log reads.
- **AD-5**: Do not change `DI_TOOLS` or `CRM_STUB_TOOLS` ordering. Tool list is alphabetically sorted and must remain cache-stable.
- **AD-11**: `dealIntelligenceService.ts` starts with `import 'server-only'` at line 1. Do not remove or reorder this import.
- **AD-13**: `dealIntelligenceService.ts` uses `createServerClient()` — do not change to `createServiceClient()`.
- **AD-14**: The `activity_log` table is append-only. No UPDATE or DELETE on any `activity_log` row. The human-edit protection check reads the log (SELECT only) — this is fine. `updateIntelligenceFields()` only INSERTs new rows.

### Exact pattern to follow for human-edit protection

Copy from `lib/crm/crmService.ts` `updateDeal()` lines 123–141. The pattern:

```typescript
// Human-edit protection: 24h window per AD-14
let protectedFields: string[] = []
if (changedFields.length > 0) {
  const { data: latestLog } = await supabase
    .from('activity_log')
    .select('actor, created_at')
    .eq('owner_id', ownerId)
    .eq('entity_type', 'deal')
    .eq('entity_id', input.deal_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (latestLog && latestLog.actor === 'user') {
    const ageMs = Date.now() - new Date(latestLog.created_at as string).getTime()
    if (ageMs < 24 * 60 * 60 * 1000) {
      protectedFields = [...changedFields]
      return { updated: false, changedFields: [], protectedFields }
    }
  }
}
```

Key differences from `updateDeal()`:
- The entity is always `'deal'` (hardcoded) and `entity_id` is `input.deal_id`
- No `if (input.actor === 'ai')` guard — `updateIntelligenceFields` is always called by AI, so the check always runs when there are changed fields

### Where to set `source` for provenance

The cleanest approach given the current architecture: add `source` to `IntelligenceFieldsInput` and set it in `toolRunner.ts` when dispatching `update_intelligence_fields`. Since `toolRunner.ts` currently casts `block.input as IntelligenceFieldsInput`, the tool schema does not expose `source` (Claude doesn't set it — the server does). Modify `toolRunner.ts` line 69–70:

```typescript
} else if (block.name === 'update_intelligence_fields') {
  const inp = block.input as IntelligenceFieldsInput
  // Inject server-side provenance — not exposed to Claude in tool schema
  output = await updateIntelligenceFields(ownerId, { ...inp, source: 'deal_intelligence' })
```

This is the safest approach: zero changes to the tool schema, zero risk of cache miss (AD-5), and `source` is always accurate because it's injected by the server route, not inferred by Claude.

**IMPORTANT:** If `toolRunner.ts` is shared between multiple specialist routes (DI and others), verify that all calls to `update_intelligence_fields` come only from the DI specialist. Currently the tool is only in `DI_TOOLS`, not in `CRM_STUB_TOOLS`, so this is safe.

### `source` field is payload-level, not a top-level DB column

`source` lives inside `payload jsonb` on the `activity_log` row — NOT as a top-level column. No migration is needed. The `activity_log` table schema is unchanged.

### Why `updateIntelligenceFields` doesn't use `updateDeal` internally

`updateIntelligenceFields` writes to a different field set than `updateDeal`. Intelligence fields (`inferred_real_need`, `risk_flags`, `opportunity_signals`, `predicted_outcome`, `prediction_reason`, `similar_deals`, `stall_diagnosis`) are NOT in `updateDeal`'s `candidateFields` list — they are intentionally separated so that intelligence writes always log `action="intelligence_fields_updated"` (with `actor="ai"` always) rather than the generic `"deal_updated"`. This separation is by design (AD-14 provenance).

### ts-node test pattern (mandatory — carry-forward from all prior stories)

- NEVER import from project `lib/` files in test files
- Inline all logic and types directly in the test file
- Add `export {}` at the very top
- Run via `npx ts-node lib/__tests__/intelligenceFields25.test.ts`
- Use `import assert from 'assert'` or inline `check()` helper for assertions

### Learnings carried from Stories 2.1–2.4

1. **`import 'server-only'` at line 1** — already present in `dealIntelligenceService.ts`; do not disturb it.
2. **Prettier before CI** — run `npx prettier --write` on every touched file before the CI triad.
3. **`export {}` at top of test files** — mandatory since Story 1.11.
4. **Alphabetical sort of `DI_TOOLS`** — no change in this story; verify order is unchanged.
5. **`ts-node` test pattern: no project imports** — inline all interface/type definitions in the test file.
6. **`.single()` error handling** — the Supabase `.single()` call for human-edit protection uses destructuring `{ data: latestLog }` without checking `error` (same pattern as `updateDeal`). This is intentional: if the query fails (no log rows, or DB error), `latestLog` is null and protection does not trigger — safe-fail open.

### Files to create / modify

**New files:**
- `lib/__tests__/intelligenceFields25.test.ts`

**Modified files:**
- `lib/crm/dealIntelligenceService.ts` — add `source?` to `IntelligenceFieldsInput`, update return type of `updateIntelligenceFields`, add human-edit protection, add `source` to log payload
- `lib/ai/toolRunner.ts` — inject `source: 'deal_intelligence'` when dispatching `update_intelligence_fields`
- `package.json` — add `test:intelligence-fields25` script

**Verify only (no change expected):**
- `lib/ai/dealIntelligenceTools.ts` — tool schema unchanged; `source` is NOT exposed as a tool input property
- `lib/crm/activityLogService.ts` — `payload: Record<string, unknown>` already accepts `source` key; no change needed
- `lib/crm/crmService.ts` — `updateClient()` already has human-edit protection for client intelligence fields; AC-4 is already satisfied

**Unchanged:**
- `lib/crm/stubLifecycleService.ts`, `stubService.ts`, `strategyService.ts` — no modifications
- All Supabase migration files — no schema changes
- `lib/crm/crmService.ts` — no modifications (existing human-edit protection already covers AC-4)

### Current `updateIntelligenceFields` return type (before this story)

```typescript
Promise<{ updated: boolean; changedFields: string[] }>
```

After this story:

```typescript
Promise<{ updated: boolean; changedFields: string[]; protectedFields: string[] }>
```

Any caller that destructures only `updated` and `changedFields` is backward compatible — new `protectedFields` field is additive.

## Dev Agent Record

### Agent Model Used

_[To be filled by dev agent during implementation]_

### Debug Log References

_[To be filled by dev agent during implementation]_

### Completion Notes List

_[To be filled by dev agent on completion]_

### File List

_[To be filled by dev agent on completion]_

### Change Log

| Date | Change |
|------|--------|
| 2026-06-29 | Story file created — gap analysis identified 3 gaps: missing human-edit protection in `updateIntelligenceFields`, missing provenance `source` field in log payload, and missing test file; all three closed with minimal targeted changes to `dealIntelligenceService.ts`, `toolRunner.ts`, and a new test file |
