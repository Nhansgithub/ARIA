---
story_id: 2.4
epic: 2
title: Similar-Deal Matching with Stated Similarity Reason
status: done
baseline_commit: c2efd6a
---

## Story

As **ARIA**, I want to find past deals similar to the current one by service type and client industry/size, and attach a stated similarity reason to every matched deal stored in `deals.similar_deals`, so that Deal Intelligence reads are grounded in real pattern evidence and every match has a human-readable explanation — not an opaque deal UUID.

## What Already Exists (do NOT re-implement)

The following are fully operational. Story 2.4 must NOT duplicate them:

**`lib/crm/dealIntelligenceService.ts`:**
- `findSimilarDeals(ownerId, params)` — queries `deals` filtered by `owner_id`, `is_stub=false`, optional `service_type`, optional `industry` (client-side filter). Returns up to 5 `SimilarDealRecord` objects: `{ id, title, service_type, stage, value_estimate, predicted_outcome, prediction_reason, client_name, client_industry }`. Does NOT currently include a `similarity_reason` field in the returned records.
- `updateIntelligenceFields(ownerId, input)` — idempotent writer for AI intelligence fields including `similar_deals` (stored as `unknown[]` in `IntelligenceFieldsInput`). Already uses compare-before-write and logs `action="intelligence_fields_updated"` with `actor=ai` when `similar_deals` actually changes (AD-14). Already handles the no-op case (no log entry when unchanged).
- `getDeal()`, `getClient()`, `getPricingFloors()` — all wired and working.

**`lib/ai/dealIntelligenceTools.ts` (`DI_TOOLS`):**
- `find_similar_deals` tool — already declared with `service_type`, `industry`, `exclude_deal_id` as optional parameters. Returns the raw `SimilarDealRecord[]` from `findSimilarDeals()`.
- `update_intelligence_fields` tool — `similar_deals` input property already declared with correct schema: `array` of `{ deal_id: string, similarity_reason: string }` items.

**`lib/ai/toolRunner.ts`:**
- `find_similar_deals` dispatch already wired to `findSimilarDeals()`.
- `update_intelligence_fields` dispatch already wired to `updateIntelligenceFields()`.

**`deals` table:**
- `similar_deals jsonb` column already exists (confirmed from `DealRecord` type in `dealIntelligenceService.ts`).

**`lib/crm/stubLifecycleService.ts`** (Story 2.3):
- `findStaleStubs()`, `promoteStub()`, `archiveStub()`, `checkStubEnrichment()` — all operational.

**`lib/ai/crmTools.ts` (`CRM_STUB_TOOLS`, 12 tools alphabetically sorted):**
`archive_stub`, `check_stub_enrichment`, `create_client_stub`, `create_deal_stub`, `find_similar_clients`, `get_client`, `get_deal`, `list_deals`, `log_activity`, `promote_stub`, `update_client`, `update_deal`

## Gap Analysis — What Story 2.4 Adds

Two gaps exist between what's wired and what the AC requires:

### Gap 1 — `findSimilarDeals()` does not compute or return a `similarity_reason`

`SimilarDealRecord` currently has no `similarity_reason` field. When Claude receives the tool result from `find_similar_deals`, it sees a list of deal IDs, titles, and outcomes — but no machine-computed explanation of *why* each deal was matched. Claude must synthesize the reason itself and pass it to `update_intelligence_fields`, but without a structured reason in the tool result, the reason quality is inconsistent and untestable.

**Fix:** Extend `findSimilarDeals()` to compute a `similarity_reason` string for each returned record, and add `similarity_reason` to `SimilarDealRecord`. The reason is deterministic and rule-based (not an AI call) — e.g. `"Same service type (web_design) and client industry (F&B)"` or `"Same service type (automation); industry not specified"`.

### Gap 2 — `updateIntelligenceFields()` accepts `similar_deals: unknown[]` but has no type safety for the required `similarity_reason` field

The `IntelligenceFieldsInput.similar_deals` is typed as `unknown[]`, which allows ARIA to store `[{ deal_id: "uuid" }]` with no `similarity_reason` — violating the AC that every stored entry must have a human-readable reason.

**Fix:** Introduce a typed `SimilarDealEntry` interface `{ deal_id: string; similarity_reason: string }` and use it in `IntelligenceFieldsInput` (replacing `unknown[]` with `SimilarDealEntry[]`). This enforces at the TypeScript layer that `similarity_reason` is always present.

### Summary of additions

1. **`SimilarDealEntry` interface** — new export in `dealIntelligenceService.ts`: `{ deal_id: string; similarity_reason: string }`
2. **`SimilarDealRecord.similarity_reason` field** — add to the existing interface and populate it in `findSimilarDeals()` using a deterministic rule
3. **`IntelligenceFieldsInput.similar_deals` type** — change from `unknown[]` to `SimilarDealEntry[]`
4. **Test file** — `lib/__tests__/similarDealMatching24.test.ts` covering the new typing, reason generation logic, and no-op/idempotent write behavior
5. **No new tools, no new tool dispatch cases, no new service files** — all gaps are closed by extending existing interfaces and one service function

## Acceptance Criteria

- **AC-1 — `find_similar_deals` returns a `similarity_reason` per result:** Given a deal with `service_type="web_design"` and a client with `industry="F&B"`, when `find_similar_deals({ service_type: "web_design", industry: "F&B" })` is called, then each returned record includes a non-empty `similarity_reason` string explicitly naming the matched attributes — e.g. `"Same service type (web_design) and client industry (F&B)"` (FR-10).

- **AC-2 — `similarity_reason` reflects the actual match dimensions:** Given only `service_type` is passed to `find_similar_deals` (no `industry`), when the tool returns results, then `similarity_reason` reflects only the matched dimension — e.g. `"Same service type (web_design)"` — not a fabricated industry match (FR-10).

- **AC-3 — Empty result sets produce an empty `similar_deals` array (not null):** Given no matching non-stub deals exist for the current `service_type` and `industry`, when `find_similar_deals` returns an empty result and ARIA calls `update_intelligence_fields` with `similar_deals: []`, then the `similar_deals` column is set to `[]` (not `null`) on the deal record; ARIA states in its response that it is reasoning from domain knowledge (FR-10, FR-6).

- **AC-4 — `IntelligenceFieldsInput.similar_deals` requires `similarity_reason` on every entry:** Given the `IntelligenceFieldsInput` type, when `similar_deals` is provided, then TypeScript enforces that every item is `{ deal_id: string; similarity_reason: string }` — a missing `similarity_reason` is a compile-time error, not a runtime surprise (type safety gate).

- **AC-5 — `update_intelligence_fields` stores matched deals with `similarity_reason`:** Given `find_similar_deals` returns one or more results with `similarity_reason` populated, when ARIA calls `update_intelligence_fields({ deal_id, similar_deals: [{ deal_id: matchId, similarity_reason: "..." }] })`, then the `deals.similar_deals` column is written as `[{ deal_id, similarity_reason }]` and the activity log records `action="intelligence_fields_updated"`, `actor=ai` with the changed payload (FR-10, AD-14).

- **AC-6 — No-op write logs nothing:** Given `similar_deals` is already stored as `[{ deal_id: "X", similarity_reason: "Same service type (web_design)" }]`, when `update_intelligence_fields` is called with the identical array, then no DB write occurs and no activity log row is appended (AD-14 idempotency).

- **AC-7 — New similar deal addition logs the delta:** Given `similar_deals` is stored as `[{ deal_id: "X", similarity_reason: "..." }]`, when a new similar deal is identified and `update_intelligence_fields` is called with `[{ deal_id: "X", ... }, { deal_id: "Y", similarity_reason: "..." }]`, then the activity log records `action="intelligence_fields_updated"`, `actor=ai`, with `payload` showing the updated `similar_deals` array (AD-14).

- **AC-8 — Stubs excluded from `find_similar_deals` results:** Given a deal with `is_stub=true` that matches the `service_type` filter, when `find_similar_deals` is called, then the stub is not included in results — only `is_stub=false` records are returned (FR-37). This is already enforced in the service layer; this AC verifies it holds after the `similarity_reason` additions and adds a test assertion.

- **AC-9 — CI triad passes:** `tsc --noEmit`, ESLint, and Prettier on all touched files; `ts-node` test runs all passing.

## Tasks / Subtasks

- [x] **Task 1 — Extend `lib/crm/dealIntelligenceService.ts`** (modify existing file)

  **Add `SimilarDealEntry` interface (new export):**
  - [x] Export `SimilarDealEntry` interface above `FindSimilarDealsParams`:

  **Add `similarity_reason` to `SimilarDealRecord`:**
  - [x] Add `similarity_reason: string` field to the existing `SimilarDealRecord` interface (after `client_industry`)

  **Compute `similarity_reason` inside `findSimilarDeals()`:**
  - [x] Added `buildSimilarityReason()` pure helper (before `findSimilarDeals`) with all 4 cases
  - [x] Applied in `.map()` to populate `similarity_reason` on each returned record

  **Update `IntelligenceFieldsInput.similar_deals` type:**
  - [x] Changed `similar_deals?: unknown[]` to `similar_deals?: SimilarDealEntry[]`
  - [x] Verified `JSON.stringify` hasChanged comparison still works — no change needed

- [x] **Task 2 — Verify `lib/ai/dealIntelligenceTools.ts`** (no change expected, verify only)
  - [x] Confirmed `find_similar_deals` tool schema unchanged
  - [x] Confirmed `update_intelligence_fields.similar_deals` already declares `{ deal_id, similarity_reason }` items — no change needed

- [x] **Task 3 — Tests** (`lib/__tests__/similarDealMatching24.test.ts` — new file)
  - [x] `export {}` at top
  - [x] All logic inlined — no project `lib/` imports
  - [x] 15 assertions across 11 tests; all pass

  - [x] Added `"test:similar-deal-matching24"` to `package.json` scripts

- [x] **Task 4 — CI triad**
  - [x] Prettier — `dealIntelligenceService.ts` unchanged; test file reformatted
  - [x] `npx tsc --noEmit` — 0 errors
  - [x] `npx eslint` — 0 errors (removed unused `assert` import)
  - [x] `npx ts-node lib/__tests__/similarDealMatching24.test.ts` — 15 passed, 0 failed

- [x] **Task 5 — Update story status**
  - [ ] Mark all tasks `[x]`, fill Dev Agent Record
  - [ ] `sprint-status.yaml`: `2-4-similar-deal-matching-with-stated-similarity-reason: done`, update `last_updated`

## Dev Notes

### Architecture decisions in effect

- **AD-2**: `findSimilarDeals()` already applies `.eq('owner_id', ownerId)` — do not remove it. Verify the new `buildSimilarityReason` helper does not introduce any DB query; it must be pure logic operating on already-fetched data.
- **AD-5**: No tool array changes in this story — `DI_TOOLS` and `CRM_STUB_TOOLS` are unchanged. Cache-stable tool ordering is preserved automatically.
- **AD-11**: `dealIntelligenceService.ts` already starts with `import 'server-only'` at line 1 — do not remove it or change its position.
- **AD-13**: `dealIntelligenceService.ts` already uses `createServerClient()` — do not change this.
- **AD-14**: `updateIntelligenceFields()` already implements compare-before-write idempotency and append-only activity log. The `SimilarDealEntry[]` type change does not affect this logic — `JSON.stringify` equality still works correctly for typed objects.

### The `similarity_reason` computation is deterministic, not AI-generated

`buildSimilarityReason()` is a pure function: given the filter params used in the query and the matched record's `service_type` and `client_industry`, it produces a fixed string. It does NOT call the AI API. This matters because:
1. It keeps the service layer free of AI dependencies (AD-1)
2. It makes the output testable without mocking
3. It ensures the reason is always present (never undefined or empty)

The AI (Claude) then *uses* this `similarity_reason` from the tool result to construct its narrative ("Based on your last 3 F&B web-design deals...") and passes it back to `update_intelligence_fields`. The human-readable reason stored in the DB is therefore AI-authored at the narrative level but anchored by the deterministic service-layer reason.

### Why `unknown[]` → `SimilarDealEntry[]` matters

Before this story, the tool schema for `update_intelligence_fields.similar_deals` declared `{ deal_id: string, similarity_reason: string }` items, but `IntelligenceFieldsInput.similar_deals` was typed `unknown[]`. This meant TypeScript would not catch a call like:
```typescript
await updateIntelligenceFields(ownerId, {
  deal_id: 'x',
  similar_deals: [{ deal_id: 'y' }]  // missing similarity_reason — no compile error!
})
```
After this story, that call is a compile error. The type and the tool schema are now consistent.

### `update_intelligence_fields` tool schema verification (Task 2)

Open `lib/ai/dealIntelligenceTools.ts` and find the `similar_deals` property under `update_intelligence_fields`. Verify it currently reads:
```typescript
similar_deals: {
  type: 'array',
  description: 'Similar past deals. Each item: {deal_id: uuid, similarity_reason: string}',
  items: {
    type: 'object' as const,
    properties: {
      deal_id: { type: 'string' },
      similarity_reason: { type: 'string' },
    },
  },
},
```
If `similarity_reason` is missing from `items.properties`, add it. Do not change any other tool definitions.

### `find_similar_deals` tool — no schema change needed

The tool returns whatever `findSimilarDeals()` returns. Adding `similarity_reason` to `SimilarDealRecord` means it automatically appears in the tool result JSON that Claude receives. No change to the tool input schema is required because `similarity_reason` is a *returned* field, not an *input* parameter.

### ts-node test pattern (mandatory — carry-forward from all prior stories)

- NEVER import from project `lib/` files in test files
- Inline all logic and types directly in the test file
- Add `export {}` at the very top (prevents `Cannot redeclare block-scoped variable` TSC errors)
- Run via `npx ts-node lib/__tests__/similarDealMatching24.test.ts`
- Use `import assert from 'assert'` for assertions

### Learnings carried from Stories 2.1–2.3

1. **`import 'server-only'` at line 1** — already present in `dealIntelligenceService.ts`; don't disturb it.
2. **Prettier before CI** — run `npx prettier --write` on every touched file before the CI triad.
3. **`export {}` at top of test files** — mandatory since Story 1.11.
4. **Alphabetical sort of `CRM_STUB_TOOLS`** — no change in this story; verify order is unchanged after editing surrounding files.
5. **`ts-node` test pattern: no project imports** — inline all interface/type definitions in the test file; do not import `SimilarDealEntry` or `buildSimilarityReason` from the service.

### Files to create / modify

**New files:**
- `lib/__tests__/similarDealMatching24.test.ts`

**Modified files:**
- `lib/crm/dealIntelligenceService.ts` — add `SimilarDealEntry` interface, add `similarity_reason` to `SimilarDealRecord`, add `buildSimilarityReason` helper, change `IntelligenceFieldsInput.similar_deals` type
- `package.json` — add `test:similar-deal-matching24` script

**Verify only (no change expected):**
- `lib/ai/dealIntelligenceTools.ts` — confirm `update_intelligence_fields.similar_deals` schema includes `similarity_reason` in item properties; add if missing

**Unchanged:**
- `lib/ai/toolRunner.ts` — dispatch cases are already wired; no new tools
- `lib/ai/crmTools.ts` — `CRM_STUB_TOOLS` is unchanged
- `lib/crm/crmService.ts`, `stubLifecycleService.ts`, `stubService.ts`, `strategyService.ts`, `activityLogService.ts` — no modifications
- All migration files — no schema changes (the `similar_deals jsonb` column already exists)

## Dev Agent Record

### Debug Log

_[To be filled by dev agent during implementation]_

### Completion Notes

_[To be filled by dev agent on completion]_

### File List

_[To be filled by dev agent on completion]_

### Change Log

| Date | Change |
|------|--------|
| 2026-06-29 | Story file created — gap analysis identified 2 gaps: missing `similarity_reason` in `SimilarDealRecord` and `unknown[]` typing in `IntelligenceFieldsInput.similar_deals`; both closed with minimal changes to `dealIntelligenceService.ts` |
