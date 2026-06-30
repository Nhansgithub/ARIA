---
story_id: 2.3
epic: 2
title: Stub Lifecycle — Deduplication, Enrichment Gate, and Archival
status: done
baseline_commit: c2efd6a
---

## Story

As **ARIA**, I want to manage stubs — checking for duplicates before creating, blocking un-enriched stubs from pattern matching, and surfacing stale stubs for archival — so that the CRM stays clean and pattern-matching is never corrupted by thin records.

## What Already Exists (do NOT re-implement)

The following tools, services, and infrastructure are fully operational. Story 2.3 must NOT duplicate them:

**Tools already in `lib/ai/crmTools.ts` (`CRM_STUB_TOOLS`, 9 tools alphabetically sorted):**
- `create_client_stub` — creates a client row with `is_stub=true`, writes `action="client_stub_created"` to activity log
- `create_deal_stub` — creates a deal row with `is_stub=true`, linked to client, writes `action="deal_stub_created"` to activity log
- `find_similar_clients` — searches clients by name/company (dedup guard before creation)
- `get_client` — fetches a client by id or name, owner-scoped
- `get_deal` — fetches a deal by id or title, owner-scoped
- `list_deals` — lists deals with optional stage/is_stub/limit filters, owner-scoped
- `log_activity` — appends an activity log entry for any entity/event
- `update_client` — partial update of client fields with human-edit protection + activity log
- `update_deal` — partial update of deal fields with human-edit protection, stage_history append, + activity log

**Service layer (`lib/crm/`):**
- `stubService.ts` — `createClientStub()`, `createDealStub()`, `findSimilarClients()`
- `crmService.ts` — `listDeals()`, `updateDeal()`, `updateClient()` (added in Story 2.2)
- `dealIntelligenceService.ts` — `getDeal()`, `getClient()`, `findSimilarDeals()` (excludes `is_stub=true` records), `getPricingFloors()`, `updateIntelligenceFields()`
- `strategyService.ts` — `getPipelineSummary()`
- `activityLogService.ts` — `logActivity()`, `getActivityLog()`

**Wired in `lib/ai/toolRunner.ts`:**
- All 9 `CRM_STUB_TOOLS` tools are dispatched
- `find_similar_deals` is dispatched (from `dealIntelligenceService`)

**Infrastructure:**
- `activity_log` append-only DB trigger (Story 2.1)
- `findSimilarDeals()` already filters `is_stub=false` — the enrichment gate on pattern-matching is already enforced at the service layer
- All tables have `owner_id` + RLS (Stories 0.2–0.3)

## Gap Analysis — What Story 2.3 Adds

Three things are missing that this story delivers:

1. **`stub_lifecycle` service (`lib/crm/stubLifecycleService.ts`)** — a new service module with:
   - `checkStubEnrichment(ownerId, dealId)` — reads the four required enrichment fields (`client_stated_need`, `service_type`, `stage`, `value_estimate`) and returns `{ isEnriched: boolean; missingFields: string[] }`. Called by toolRunner when ARIA wants to promote a stub.
   - `promoteStub(ownerId, entityType, entityId, actor)` — sets `is_stub=false` on a client or deal record (using `updateDeal`/`updateClient` internally), logs `action="stub_promoted"`, and returns the updated record. Only callable when all four enrichment fields are non-null.
   - `archiveStub(ownerId, entityType, entityId, actor)` — sets `status='archived'` on a client or deal record, logs `action="stub_archived"`, and returns confirmation. Uses `update_deal`/`update_client` (not a DELETE) per AD-14 archival-not-deletion rule.
   - `findStaleStubs(ownerId, idleThresholdDays)` — queries deals where `is_stub=true` AND no `activity_log` entry exists for that `entity_id` in the last `idleThresholdDays` days (default 14); returns a list of `{ id, title, client_id, created_at, daysSinceUpdate }`.

2. **Three new Claude tool declarations in `CRM_STUB_TOOLS`** (alphabetically inserted):
   - `archive_stub` — archives a stub client or deal (`status=archived`, not delete)
   - `check_stub_enrichment` — checks whether a deal stub has all four required enrichment fields
   - `promote_stub` — promotes an enriched deal stub to a full record (`is_stub=false`)

3. **Three new dispatch cases in `lib/ai/toolRunner.ts`** wiring the new tools to `stubLifecycleService.ts`.

**Note on deduplication:** The existing `find_similar_clients` + `CRM_STUB_TOOLS` instruction ordering already provides the dedup guard at the Claude prompt level (ARIA is instructed to call `find_similar_clients` before `create_client_stub`). Story 2.3 reinforces this with a system prompt instruction update — no new service function is needed for dedup itself since `findSimilarClients()` already exists. The gap is in the stub-promotion, archival, stale-detection, and merge-proposal logic.

## Acceptance Criteria

- **AC-1 — Deduplication guard before stub creation:** Given the Owner mentions a new client or deal by name, when ARIA is about to call `create_client_stub` or `create_deal_stub`, then ARIA first calls `find_similar_clients` (for clients) or `list_deals` (for deals) to check for an existing record with a similar name/company; if a likely match is found, ARIA proposes linking to the existing record rather than creating a duplicate, and creation proceeds only if the Owner confirms it is a different entity (FR-37). This is enforced via the system prompt instruction already in place plus tool ordering — no new service code required for this AC.

- **AC-2 — Stub enrichment gate on pattern-matching:** Given a stub record exists with `is_stub=true`, when `find_similar_deals` is called to populate pattern-matching context (used in Deal Intelligence or Story 2.4), then records with `is_stub=true` are excluded from the results — un-enriched stubs do not influence the similar-deal read (FR-37, FR-10). This is already enforced by `findSimilarDeals()` in `dealIntelligenceService.ts`; this AC verifies the gate holds and adds a test assertion.

- **AC-3 — Stub enrichment check tool:** Given a stub deal exists, when ARIA calls `check_stub_enrichment({ entity_type: "deal", entity_id })`, then the tool returns `{ isEnriched: boolean; missingFields: string[] }` where `isEnriched` is `true` only when all four fields are present and non-null: `client_stated_need`, `service_type`, `stage`, `value_estimate`. Missing field names are listed for ARIA to target in follow-up questions (FR-37).

- **AC-4 — Stub promotion is a state transition, not a new record:** Given a stub has been enriched with all four required fields, when ARIA calls `promote_stub({ entity_type, entity_id, actor })`, then `is_stub` is set to `false` on the existing record (not a new insert — AD-14), the activity log records `action="stub_promoted"`, `actor` set to whichever party provided the final fields, and the tool returns `{ promoted: true, entity_id }` (FR-37, AD-14).

- **AC-5 — Promotion blocked when fields are missing:** Given a stub deal is missing one or more of the four required enrichment fields, when ARIA calls `promote_stub`, then the service returns `{ promoted: false, missingFields: string[] }` without writing to the DB or activity log; ARIA surfaces the missing fields in its reply (FR-37).

- **AC-6 — Stale stub detection:** Given a stub has `is_stub=true` and has not had any `activity_log` entry against it for longer than the configurable idle threshold (default: 14 days), when `findStaleStubs(ownerId, 14)` is called (from the briefing scheduler or inline conversation check), then the stub appears in the returned list with `{ id, title, client_id, created_at, daysSinceUpdate }` (FR-37).

- **AC-7 — ARIA surfaces stale stubs conversationally:** Given a stale stub exists (no activity log entry in 14 days), when the Owner's session includes a deal intelligence read or pipeline query, then ARIA mentions the stale stub with a conversational prompt: "Em có một stub cho [name] chưa cập nhật 14 ngày — anh muốn bổ sung thông tin, giữ lại, hay lưu trữ nó không?" / "I have a stub for [name] with no updates in 14 days — complete it, keep it, or archive it?" (FR-37).

- **AC-8 — Stub archival via conversation (not deletion):** Given the Owner says "discard the stub for [name]" via conversation, when ARIA processes the request, then ARIA calls `archive_stub({ entity_type, entity_id, actor: "user" })`, which sets `status='archived'` on the record (not a DELETE — AD-14 archival-not-deletion preserves the log), confirms the action in its reply, and the activity log records `action="stub_archived"`, `actor=user` (FR-37, AD-14).

- **AC-9 — Stub merge via conversation:** Given the Owner says "merge the [name] stub with the existing [name] record" via conversation, when ARIA processes the request, then ARIA calls `get_deal`/`get_client` to read both records, proposes which fields from the stub to carry over onto the target record, the Owner confirms, ARIA calls `update_deal`/`update_client` with the merged fields on the target record, and the stub is archived via `archive_stub` — no duplicate persists (FR-37).

- **AC-10 — `update_deal` and `update_client` used for archival/promotion (no new write paths):** Given the `archive_stub` and `promote_stub` service functions, when they write to the DB, then they call the existing `updateDeal()`/`updateClient()` from `crmService.ts` internally (not raw Supabase queries) — this ensures human-edit protection, stage_history append, and idempotency rules are respected automatically (AD-14).

- **AC-11 — Tool list alphabetical order preserved (AD-5):** Given the three new tools are added to `CRM_STUB_TOOLS`, when the tool array is inspected, then the 12 tools are in strict alphabetical order: `archive_stub`, `check_stub_enrichment`, `create_client_stub`, `create_deal_stub`, `find_similar_clients`, `get_client`, `get_deal`, `list_deals`, `log_activity`, `promote_stub`, `update_client`, `update_deal` (AD-5 cache-stable tool list).

- **AC-12 — CI triad passes:** `tsc --noEmit`, ESLint, Prettier on all touched files; `ts-node` test runs all passing.

## Tasks / Subtasks

- [x] **Task 1 — `lib/crm/stubLifecycleService.ts`** (new file)
  - [x] Add `import 'server-only'` at line 1 (AD-11)
  - [x] Add `import { createServerClient } from '@/lib/supabase/server'` (AD-13)
  - [x] Add `import { updateDeal, updateClient } from '@/lib/crm/crmService'`
  - [x] Add `import { logActivity } from '@/lib/crm/activityLogService'`

  **`checkStubEnrichment` function:**
  - [x] Export `StubEnrichmentResult` interface: `{ isEnriched: boolean; missingFields: string[] }`
  - [x] Export `async function checkStubEnrichment(ownerId: string, dealId: string): Promise<StubEnrichmentResult>`
    - Fetch deal row: `id`, `client_stated_need`, `service_type`, `stage`, `value_estimate`, `is_stub` with `.eq('id', dealId).eq('owner_id', ownerId)` — throw if not found or not a stub
    - Check each of the four required fields; collect names of null/undefined ones into `missingFields`
    - Return `{ isEnriched: missingFields.length === 0, missingFields }`

  **`promoteStub` function:**
  - [x] Export `PromoteStubInput` interface: `{ entity_type: 'client' | 'deal'; entity_id: string; actor: 'ai' | 'user' }`
  - [x] Export `PromoteStubResult` interface: `{ promoted: boolean; entity_id: string; missingFields?: string[] }`
  - [x] Export `async function promoteStub(ownerId: string, input: PromoteStubInput): Promise<PromoteStubResult>`
    - For `entity_type === 'deal'`: first call `checkStubEnrichment(ownerId, input.entity_id)` — if not enriched, return `{ promoted: false, entity_id: input.entity_id, missingFields }` without writing
    - For `entity_type === 'client'`: skip the enrichment gate (clients promote when they have `name` + `company`; check these two fields non-null)
    - Call `updateDeal(ownerId, { id: input.entity_id, actor: input.actor, is_stub: false })` or `updateClient(ownerId, { id: input.entity_id, actor: input.actor, is_stub: false })`

    > **Note on `is_stub` in update inputs:** `UpdateDealInput` and `UpdateClientInput` from `crmService.ts` do not currently include `is_stub`. Add `is_stub?: boolean` to both interfaces (modify `crmService.ts`). The DB field must also be written in the `update()` call in `updateDeal`/`updateClient`.

    - Call `logActivity(ownerId, { entity_type: input.entity_type, entity_id: input.entity_id, action: 'stub_promoted', actor: input.actor, payload: {} })`
    - Return `{ promoted: true, entity_id: input.entity_id }`

  **`archiveStub` function:**
  - [x] Export `ArchiveStubInput` interface: `{ entity_type: 'client' | 'deal'; entity_id: string; actor: 'ai' | 'user' }`
  - [x] Export `ArchiveStubResult` interface: `{ archived: boolean; entity_id: string }`
  - [x] Export `async function archiveStub(ownerId: string, input: ArchiveStubInput): Promise<ArchiveStubResult>`
    - Call `updateDeal(ownerId, { id: input.entity_id, actor: input.actor, status: 'archived' })` or `updateClient(ownerId, { id: input.entity_id, actor: input.actor, status: 'archived' })`

    > **Note on `status` in update inputs:** Add `status?: string` to `UpdateDealInput` and `UpdateClientInput` in `crmService.ts`. This field should be written to the DB in the update call.

    - Call `logActivity(ownerId, { entity_type: input.entity_type, entity_id: input.entity_id, action: 'stub_archived', actor: input.actor, payload: { reason: 'archived_via_conversation' } })`
    - Return `{ archived: true, entity_id: input.entity_id }`

  **`findStaleStubs` function:**
  - [x] Export `StaleStubRecord` interface: `{ id: string; title: string; client_id: string; created_at: string; daysSinceUpdate: number }`
  - [x] Export `async function findStaleStubs(ownerId: string, idleThresholdDays?: number): Promise<StaleStubRecord[]>`
    - Default `idleThresholdDays` to 14
    - Fetch all deals with `is_stub=true` and `owner_id=ownerId`
    - For each stub, check whether any `activity_log` entry exists for `entity_id = stub.id` within the last `idleThresholdDays` days:
      ```typescript
      const cutoff = new Date(Date.now() - idleThresholdDays * 24 * 60 * 60 * 1000).toISOString()
      const { data: recentLog } = await supabase
        .from('activity_log')
        .select('id')
        .eq('owner_id', ownerId)
        .eq('entity_id', stub.id)
        .gte('created_at', cutoff)
        .limit(1)
      ```
    - If `recentLog` is empty (no recent activity), compute `daysSinceUpdate` from `stub.created_at` (use `created_at` as the baseline when no activity log entry exists at all)
    - Return only stubs with no recent activity, with `daysSinceUpdate` populated
    - Sort by `daysSinceUpdate DESC` (stalest first)

- [x] **Task 2 — Extend `lib/crm/crmService.ts`** (modify existing file — minimal changes only)
  - [x] Add `is_stub?: boolean` to `UpdateDealInput` and `UpdateClientInput` interfaces
  - [x] Add `status?: string` to `UpdateDealInput` and `UpdateClientInput` interfaces
  - [x] In `updateDeal()`: include `is_stub` and `status` in the fields diff detection and in the `.update()` call object (only when provided in input)
  - [x] In `updateClient()`: same as above for `is_stub` and `status`

  > These are additive changes only — no existing logic changes. The hasChanged + no-op pattern already handles these fields automatically once they are included in the tracked fields list.

- [x] **Task 3 — Extend `lib/ai/crmTools.ts`** (modify existing file)

  Add three new tool declarations in their correct alphabetical positions. After additions, the full ordered list must be: `archive_stub`, `check_stub_enrichment`, `create_client_stub`, `create_deal_stub`, `find_similar_clients`, `get_client`, `get_deal`, `list_deals`, `log_activity`, `promote_stub`, `update_client`, `update_deal`.

  - [x] Add `archive_stub` tool (before `check_stub_enrichment`, first position):
    ```typescript
    {
      name: 'archive_stub',
      description:
        'Archive a stub client or deal by setting status=archived. Use when the Owner discards or merges a stub. This is NOT a delete — the record is preserved for audit. Always confirm with the Owner before archiving.',
      input_schema: {
        type: 'object' as const,
        properties: {
          entity_type: { type: 'string', enum: ['client', 'deal'], description: 'Type of entity to archive' },
          entity_id: { type: 'string', description: 'UUID of the stub record to archive' },
          actor: { type: 'string', enum: ['ai', 'user'], description: '"user" when the Owner requested it; "ai" if ARIA auto-archives after confirmed idle' },
        },
        required: ['entity_type', 'entity_id', 'actor'] as readonly string[],
      },
    }
    ```

  - [x] Add `check_stub_enrichment` tool (after `archive_stub`, before `create_client_stub`):
    ```typescript
    {
      name: 'check_stub_enrichment',
      description:
        'Check whether a deal stub has all four required enrichment fields (client_stated_need, service_type, stage, value_estimate). Returns isEnriched and a list of missing fields. Call before promote_stub.',
      input_schema: {
        type: 'object' as const,
        properties: {
          entity_id: { type: 'string', description: 'UUID of the deal stub to check' },
        },
        required: ['entity_id'] as readonly string[],
      },
    }
    ```

  - [x] Add `promote_stub` tool (after `log_activity`, before `update_client`):
    ```typescript
    {
      name: 'promote_stub',
      description:
        'Promote an enriched stub to a full record by setting is_stub=false. Call check_stub_enrichment first to confirm all required fields are present. Promotion is a state transition on the same record — it does NOT create a new record.',
      input_schema: {
        type: 'object' as const,
        properties: {
          entity_type: { type: 'string', enum: ['client', 'deal'], description: 'Type of entity to promote' },
          entity_id: { type: 'string', description: 'UUID of the stub record to promote' },
          actor: { type: 'string', enum: ['ai', 'user'], description: '"user" if the Owner provided the final fields; "ai" if ARIA inferred them' },
        },
        required: ['entity_type', 'entity_id', 'actor'] as readonly string[],
      },
    }
    ```

- [x] **Task 4 — Extend `lib/ai/toolRunner.ts`** (modify existing file)
  - [x] Add import: `import { checkStubEnrichment, promoteStub, archiveStub, findStaleStubs, type PromoteStubInput, type ArchiveStubInput } from '@/lib/crm/stubLifecycleService'`
  - [x] Add dispatch case for `'check_stub_enrichment'`:
    ```typescript
    } else if (block.name === 'check_stub_enrichment') {
      const input = block.input as { entity_id: string }
      output = await checkStubEnrichment(ownerId, input.entity_id)
    ```
  - [x] Add dispatch case for `'promote_stub'`:
    ```typescript
    } else if (block.name === 'promote_stub') {
      output = await promoteStub(ownerId, block.input as PromoteStubInput)
    ```
  - [x] Add dispatch case for `'archive_stub'`:
    ```typescript
    } else if (block.name === 'archive_stub') {
      output = await archiveStub(ownerId, block.input as ArchiveStubInput)
    ```

- [x] **Task 5 — Tests** (`lib/__tests__/stubLifecycle23.test.ts` — new file)
  - [x] Add `export {}` at top (ES module scope — mandatory since Story 1.11)
  - [x] Inline all logic — NEVER import from project `lib/` files (ts-node test pattern)
  - [x] **T1 — `StubEnrichmentResult` shape:** Construct `{ isEnriched: false, missingFields: ['service_type', 'value_estimate'] }`; assert `isEnriched === false` and `missingFields.length === 2`
  - [x] **T2 — Enrichment gate: all four fields required:** Inline the enrichment-check logic; given a deal with all four fields non-null, assert `isEnriched === true` and `missingFields` is empty; given a deal missing `value_estimate`, assert `isEnriched === false` and `missingFields` includes `'value_estimate'`
  - [x] **T3 — `PromoteStubInput` shape:** Construct valid input `{ entity_type: 'deal', entity_id: 'uuid', actor: 'user' }`; assert required fields are present
  - [x] **T4 — `PromoteStubResult` — promoted:** Construct `{ promoted: true, entity_id: 'uuid' }`; assert `promoted === true`
  - [x] **T5 — `PromoteStubResult` — blocked:** Construct `{ promoted: false, entity_id: 'uuid', missingFields: ['value_estimate'] }`; assert `promoted === false` and `missingFields.length === 1`
  - [x] **T6 — `ArchiveStubInput` shape:** Construct `{ entity_type: 'deal', entity_id: 'uuid', actor: 'user' }`; assert all fields present
  - [x] **T7 — `ArchiveStubResult` shape:** Construct `{ archived: true, entity_id: 'uuid' }`; assert `archived === true`
  - [x] **T8 — `StaleStubRecord` shape:** Construct `{ id: 'uuid', title: 'Test deal', client_id: 'c-uuid', created_at: '2026-06-01T00:00:00Z', daysSinceUpdate: 20 }`; assert `daysSinceUpdate > 14`
  - [x] **T9 — stale threshold logic:** Inline the cutoff calculation `Date.now() - 14 * 24 * 60 * 60 * 1000`; assert the cutoff is 14 days in the past (within 1 second tolerance)
  - [x] **T10 — `entity_type` values:** Assert `entity_type` only accepts `'client'` or `'deal'`; construct objects with both values
  - [x] **T11 — tool count in `CRM_STUB_TOOLS`:** Inline an array of 12 expected tool names in alphabetical order; assert `tools.length === 12`; assert the first tool name is `'archive_stub'` and the last is `'update_deal'`
  - [x] **T12 — enrichment gate excludes is_stub=true from similar deals:** Inline the filter logic `deals.filter(d => !d.is_stub)`; given a mixed array of stub and non-stub deals, assert the filtered list contains only `is_stub=false` records
  - [x] Add `"test:stub-lifecycle23": "npx ts-node lib/__tests__/stubLifecycle23.test.ts"` to `package.json` scripts

- [x] **Task 6 — CI triad**
  - [x] `npx prettier --write` on all touched files (run first, before tsc/lint)
  - [x] `npx tsc --noEmit` — zero errors
  - [x] `npx eslint lib/crm/stubLifecycleService.ts lib/crm/crmService.ts lib/ai/crmTools.ts lib/ai/toolRunner.ts lib/__tests__/stubLifecycle23.test.ts`
  - [x] `npx ts-node lib/__tests__/stubLifecycle23.test.ts` — all tests pass

- [x] **Task 7 — Update story status**
  - [x] Mark all tasks `[x]`, fill Dev Agent Record
  - [x] `sprint-status.yaml`: `2-3-stub-lifecycle-deduplication-enrichment-gate-and-archival: done`, update `last_updated`

## Dev Notes

### Architecture decisions in effect

- **AD-2**: Every query in `stubLifecycleService.ts` must `.eq('owner_id', ownerId)` as explicit filter on top of RLS (belt-and-suspenders — matches pattern in all existing `lib/crm/` services).
- **AD-5**: Tool array in `crmTools.ts` must be alphabetically sorted after additions. Final 12-tool order: `archive_stub`, `check_stub_enrichment`, `create_client_stub`, `create_deal_stub`, `find_similar_clients`, `get_client`, `get_deal`, `list_deals`, `log_activity`, `promote_stub`, `update_client`, `update_deal`.
- **AD-11**: `lib/crm/stubLifecycleService.ts` must start with `import 'server-only'` at line 1. Mandatory for all new `lib/crm/` files.
- **AD-13**: Use `createServerClient()` (anon key + user session) in `stubLifecycleService.ts`. `createServiceClient()` must never appear.
- **AD-14**: Archival is `status='archived'` — never a DELETE. Promotion is `is_stub=false` on the same record — never a new INSERT. `stub_promoted` and `stub_archived` are logged in the activity log. No-op writes log nothing.

### Existing `lib/crm/` pattern to follow exactly

Every service in `lib/crm/` starts:
```typescript
import 'server-only'
import { createServerClient } from '@/lib/supabase/server'
```

Every query includes `.eq('owner_id', ownerId)` as an explicit filter. Match this pattern in `stubLifecycleService.ts`.

### Critical: `promoteStub` and `archiveStub` must call `updateDeal`/`updateClient` — not raw Supabase

This ensures:
1. The compare-before-write idempotency pattern is applied
2. Human-edit protection (24h window) is respected
3. Stage history append for `stage` changes is triggered
4. The activity log entry from `updateDeal`/`updateClient` is written for the field change itself

The `stub_promoted` and `stub_archived` activity log entries are *additional* entries on top of the field-change log from `updateDeal`/`updateClient`. Both entries are correct — one records the field change, one records the lifecycle event.

### `crmService.ts` minimal additions

Add only `is_stub` and `status` to the diff-detection field list and the `.update()` object. The existing `hasChanged` pattern handles them automatically. Do NOT change any other logic in `updateDeal` or `updateClient`.

The `status` field on deals/clients maps to the DB column `status`. Verify the column exists in the `deals` and `clients` tables before adding it. If it is named differently in the schema (`addendum.md §B.1-B.2`), use the correct column name.

### `findStaleStubs` — N+1 query avoidance note

The naive implementation issues one `activity_log` query per stub (N stubs = N queries). For the MVP with small stub counts this is acceptable. Add a code comment: `// TODO(perf): batch with a single subquery when stub count grows`. The current implementation is correct and ship-ready; optimization is deferred.

### Stale stub surfacing — where and when

For Story 2.3, `findStaleStubs` is called from `toolRunner.ts` dispatch when ARIA runs a pipeline query or Deal Intelligence session. A full scheduler hook (briefing scheduler calling `findStaleStubs`) is deferred to Epic 4. For now, ARIA surfaces stale stubs conversationally when the Owner asks about their pipeline (ARIA calls `list_deals` + `findStaleStubs` internally when relevant).

The `findStaleStubs` function does NOT need a corresponding Claude tool for now — it is called server-side from the orchestrator logic, not by Claude directly. Claude uses `list_deals` to discover stubs and then ARIA's system prompt instructs it to check for stale ones. This keeps the tool count manageable.

### ts-node test pattern (mandatory — carry-forward from all prior stories)

- NEVER import from project `lib/` files in test files
- Inline all logic and types directly in the test file
- Add `export {}` at the very top (prevents `Cannot redeclare block-scoped variable` TSC errors)
- Run via `npx ts-node lib/__tests__/stubLifecycle23.test.ts`
- Use Node.js `assert` module (`import assert from 'assert'` or `const assert = require('assert')`) — inline test runner pattern from prior stories

### Learnings carried from Stories 2.1 and 2.2

1. **`import 'server-only'` at line 1** in every new `lib/crm/` file — mandatory (AD-11).
2. **Prettier before CI** — run `npx prettier --write` on every touched file before the CI triad to avoid a formatting-only CI failure.
3. **`export {}` at top of test files** — mandatory since Story 1.11.
4. **Throw, don't swallow, in service layer** — `checkStubEnrichment`, `promoteStub`, `archiveStub`, `findStaleStubs` throw on DB error; `toolRunner.ts` outer try/catch converts them to `is_error: true` tool results.
5. **No-op writes log nothing** — `promoteStub` when `is_stub` is already `false` and `archiveStub` when `status` is already `'archived'` should return early without writing activity log (rely on `updateDeal`/`updateClient` no-op detection).
6. **Alphabetical sort verification** — after any tool array modification, verify the exact order manually before committing.

### Migration needed?

No new migration is required if the `deals` and `clients` tables already have a `status` column. Check `supabase/migrations/` for the initial schema. If `status` column does not exist on `clients` (it exists on `deals` per addendum §B.2), a minimal migration adding `status text` to `clients` may be needed. Verify before writing service code.

Also verify: `deals` table has `is_stub boolean` — confirmed from Story 1.7 usage. `clients` table has `is_stub boolean` — check the migration; if missing, a migration adding it is required.

### Files to create / modify

**New files:**
- `lib/crm/stubLifecycleService.ts`
- `lib/__tests__/stubLifecycle23.test.ts`

**Modified files:**
- `lib/crm/crmService.ts` — add `is_stub` and `status` to `UpdateDealInput`, `UpdateClientInput`, and the diff/update logic in `updateDeal`/`updateClient`
- `lib/ai/crmTools.ts` — add `archive_stub`, `check_stub_enrichment`, `promote_stub` tool declarations in alphabetical positions (9 → 12 tools)
- `lib/ai/toolRunner.ts` — add import from `stubLifecycleService` + 3 dispatch cases
- `package.json` — add `test:stub-lifecycle23` script

**Unchanged:**
- `stubService.ts`, `dealIntelligenceService.ts`, `strategyService.ts`, `activityLogService.ts` — no modifications needed
- All migration files — schema changes only if columns are missing (see "Migration needed?" above)

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
| 2026-06-29 | Story file created — gap analysis identified 3 new tools + stubLifecycleService.ts + minimal crmService.ts additions |
