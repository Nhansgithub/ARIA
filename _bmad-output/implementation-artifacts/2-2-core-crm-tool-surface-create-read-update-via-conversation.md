---
story_id: 2.2
epic: 2
title: Core CRM Tool Surface — Create, Read, Update via Conversation
status: done
baseline_commit: c2efd6a
---

## Story

As an **Owner**, I want to create, retrieve, and update full client and deal records entirely through conversation, so that I never need to open a form to maintain my pipeline.

## What Already Exists (do NOT re-implement)

The following tools, services, and infrastructure are fully operational. Story 2.2 must NOT duplicate them:

**CRM_STUB_TOOLS already in `lib/ai/crmTools.ts`:**
- `find_similar_clients` — searches clients by name/company (dedup guard before creation)
- `create_client_stub` — creates a client row with `is_stub=true`, writes activity log
- `create_deal_stub` — creates a deal row with `is_stub=true`, linked to client, writes activity log
- `log_activity` — appends an activity log entry for any entity/event (added in Story 2.1)

**Tools wired in `lib/ai/toolRunner.ts` (from `dealIntelligenceService.ts` and `strategyService.ts`):**
- `get_deal` → `getDeal(ownerId, params)` — fetches a deal by `id` or `title`, owner-scoped
- `get_client` → `getClient(ownerId, params)` — fetches a client by `id` or `name`, owner-scoped
- `find_similar_deals` → `findSimilarDeals()` — finds non-stub deals by service_type/industry
- `get_pricing_floors` → `getPricingFloors()` — reads pricing benchmarks from settings
- `update_intelligence_fields` → `updateIntelligenceFields()` — idempotent write of AI-maintained deal fields (inferred_real_need, risk_flags, etc.)
- `get_pipeline_summary` → `getPipelineSummary()` — summary count/value by stage
- `log_activity` → `logActivity()` (added in Story 2.1)

**Service layer already implemented (`lib/crm/`):**
- `stubService.ts` — `createClientStub()`, `createDealStub()`, `findSimilarClients()`
- `dealIntelligenceService.ts` — `getDeal()`, `getClient()`, `findSimilarDeals()`, `getPricingFloors()`, `updateIntelligenceFields()`
- `strategyService.ts` — `getPipelineSummary()`
- `activityLogService.ts` — `logActivity()`, `getActivityLog()` (added in Story 2.1)

**Infrastructure:**
- `activity_log` append-only DB trigger (Story 2.1)
- All tables have `owner_id` + RLS (Stories 0.2–0.3)
- `createServerClient()` pattern established across all `lib/crm/` files

## Gap Analysis — What Story 2.2 Adds

Five things are missing that this story delivers:

1. **`update_deal` Claude tool** — not in `CRM_STUB_TOOLS`. The story acceptance criteria explicitly requires ARIA to call `update_deal(id, fields)` to update any deal field (stage, value_estimate, notes, etc.) with partial-update semantics (no-clobber) and activity log writing.

2. **`update_client` Claude tool** — not in `CRM_STUB_TOOLS`. Required by AC for updating client fields via conversation with proper provenance tracking.

3. **`list_deals` Claude tool** — not in `CRM_STUB_TOOLS`. Required by AC so ARIA can answer "what are all my active deals?" by calling `list_deals(filters)`.

4. **`get_deal` and `get_client` tools added to `CRM_STUB_TOOLS`** — these tools ARE already wired in `toolRunner.ts` (from `dealIntelligenceService.ts`), but they are NOT declared in `CRM_STUB_TOOLS`. Claude cannot call an undeclared tool. They must be added to the tool array so Claude's tool list includes them during CRM sessions.

5. **`lib/crm/crmService.ts`** — a new service module with `updateDeal()`, `updateClient()`, and `listDeals()` implementations. `updateDeal` and `updateClient` must implement the AD-14 idempotency pattern (compare-before-write, log only changed fields, protect human edits from silent AI overwrite). `listDeals` must apply owner-scoped filtering with optional stage/status filters.

## Acceptance Criteria

- **AC-1 — `get_client` and `get_deal` exposed in tool array:** Given `CRM_STUB_TOOLS` in `lib/ai/crmTools.ts`, when Claude is given the tool list for a CRM session, then `get_client` and `get_deal` are present in `CRM_STUB_TOOLS` so Claude can call them. Both are already wired in `toolRunner.ts`; only the tool declarations need to be added to `crmTools.ts` (AD-1, AD-5: alphabetically sorted tool list).

- **AC-2 — `list_deals` tool wired end-to-end:** Given ARIA is asked "what are all my active deals?", when the orchestrator calls `list_deals(filters)` where `filters` may include `stage`, `is_stub`, or no filter, then only deals with the Owner's `owner_id` are returned; the reply is prose synthesis not a raw field dump (FR-31, AD-2).

- **AC-3 — `update_deal` partial update with activity log:** Given a deal exists, when ARIA calls `update_deal(id, fields)` with one or more fields, then only the supplied fields are updated (no clobber of unsupplied fields); the activity log records one entry with `action="deal_updated"`, a `payload` containing `{ changedFields, values }`, and `actor` reflecting the originating source (`ai` or `user`); no-op writes (fields unchanged) produce no log entry (FR-31, AD-14).

- **AC-4 — `update_client` partial update with activity log:** Given a client exists, when ARIA calls `update_client(id, fields)` with one or more fields, then only the supplied fields are updated; the activity log records one entry with `action="client_updated"`, `payload`, and correct `actor`; no-op writes produce no log entry (FR-31, AD-14).

- **AC-5 — Human-edit protection on AI writes:** Given the Owner has previously set a field via conversation (`actor=user` in the most recent activity log entry for that field), when a subsequent AI call would write a different value for the same field, then ARIA does not silently overwrite it; instead the update tool returns `{ protected: true, field, currentValue }` and ARIA proposes the new value in its reply, writing only after no conflicting human entry exists or after the Owner confirms (AD-14).

  > **Implementation note:** "human-edit protection" is enforced at the service layer by checking the most recent `activity_log` entry for the entity. If the latest entry for a field carries `actor=user` and the new AI value differs, the service returns a `protectedFields` list rather than applying the write. The tool returns this list; the caller (toolRunner) surfaces it as a non-error result; ARIA's system prompt instructs it to propose, not silently apply, when `protectedFields` is non-empty.

- **AC-6 — Owner-provided update logged as `actor=user`:** Given the Owner types "update the Hanoi restaurant deal — they pushed the timeline to August" in chat, when the orchestrator processes the message and calls `update_deal` with `actor="user"`, then the activity log records `actor=user` for that change (FR-31, AD-14).

- **AC-7 — `get_client` / `get_deal` owner-scoped:** Given a client or deal record exists, when ARIA calls `get_client(id|name)` or `get_deal(id|title)`, then the tool returns the full record filtered by the caller's `owner_id`; no fields from another owner can be returned (AD-2). These functions already implement this; AC verifies the wiring is correct via the test.

- **AC-8 — `list_deals` owner-scoped, stub-aware:** Given ARIA calls `list_deals({ stage: "prospect" })`, when the query runs, then only deals matching `owner_id` AND `stage = "prospect"` are returned; passing `is_stub: false` excludes stub records; no filter returns all deals for the owner (AD-2, FR-31).

- **AC-9 — `update_deal` stage_history append:** Given a deal's `stage` field is being updated, when `update_deal` writes the new stage, then the existing `stage_history` jsonb array is appended with `{ from_stage, to_stage, changed_at }` — the previous stages are never lost (FR-31, addendum §B.2).

- **AC-10 — CI triad passes:** `tsc --noEmit`, ESLint, Prettier on all touched files; `ts-node` test runs all passing.

## Tasks / Subtasks

- [x] **Task 1 — `lib/crm/crmService.ts`** (new file)
  - [x] Add `import 'server-only'` at line 1 (AD-11)
  - [x] Add `import { createServerClient } from '@/lib/supabase/server'` (AD-13)
  - [x] Add `import { logActivity } from '@/lib/crm/activityLogService'`

  **`listDeals` function:**
  - [x] Export `ListDealsParams` interface: `{ stage?: string; is_stub?: boolean; limit?: number }`
  - [x] Export `DealSummary` interface (fields useful for pipeline display): `{ id, client_id, title, service_type, stage, value_estimate, is_stub, stale_since, predicted_outcome, created_at }`
  - [x] Export `async function listDeals(ownerId: string, params: ListDealsParams): Promise<DealSummary[]>`
    - Query `deals` table with `.eq('owner_id', ownerId)`
    - Apply `.eq('stage', params.stage)` if `params.stage` is provided
    - Apply `.eq('is_stub', params.is_stub)` if `params.is_stub` is not `undefined`
    - Apply `.limit(params.limit ?? 20)`
    - Order by `created_at DESC`
    - Throw on DB error

  **`updateDeal` function:**
  - [x] Export `UpdateDealInput` interface:
    ```typescript
    export interface UpdateDealInput {
      id: string
      actor: 'ai' | 'user'
      // updatable fields — all optional, no intelligence fields (those go through updateIntelligenceFields)
      title?: string
      stage?: string
      service_type?: 'web_design' | 'web_app' | 'automation' | 'other'
      value_estimate?: number
      client_stated_need?: string
      next_action?: string
      next_action_due?: string // ISO date
      notes?: string
      priority?: 'high' | 'medium' | 'low'
    }
    ```
  - [x] Export `UpdateDealResult` interface: `{ updated: boolean; changedFields: string[]; protectedFields: string[] }`
  - [x] Export `async function updateDeal(ownerId: string, input: UpdateDealInput): Promise<UpdateDealResult>`
    - Fetch current deal row: `id`, `title`, `stage`, `stage_history`, `service_type`, `value_estimate`, `client_stated_need`, `next_action`, `next_action_due`, `notes`, `priority` — with `.eq('id', input.id).eq('owner_id', ownerId)`. Throw if not found.
    - Detect changed fields using `JSON.stringify` equality (same `hasChanged` pattern as `updateIntelligenceFields`)
    - **Human-edit protection:** For each changed field where `input.actor === 'ai'`, query `activity_log` for the most recent entry matching `entity_id = input.id` AND `payload` containing that field name; if the most recent entry for that field has `actor = 'user'`, add it to `protectedFields` and exclude it from `updates`. Return `protectedFields` to caller without applying protected overwrites.
    - **Stage history append:** If `stage` is in `changedFields`, append `{ from_stage: current.stage, to_stage: input.stage, changed_at: new Date().toISOString() }` to `stage_history` (read current `stage_history` array, push new entry, write back)
    - If `changedFields.length === 0` (after excluding protected), return `{ updated: false, changedFields: [], protectedFields }`
    - Apply `.update({ ...updates, updated_at: new Date().toISOString() }).eq('id', input.id).eq('owner_id', ownerId)`; throw on error
    - Call `logActivity(ownerId, { entity_type: 'deal', entity_id: input.id, action: 'deal_updated', actor: input.actor, payload: { changedFields, values: updates } })`
    - Return `{ updated: true, changedFields, protectedFields }`

  > **Simplified human-edit protection approach:** Rather than querying `activity_log` per-field (expensive), implement a pragmatic version: check the most recent `activity_log` entry for the entity overall. If the most recent entry for this deal has `actor = 'user'` AND was created within the last 24 hours, flag all AI-written fields that differ from current stored values as `protectedFields`. This avoids N+1 log queries while still catching the primary conflict scenario (human just updated, AI would overwrite). The system prompt tells Claude to propose when `protectedFields` is non-empty.

  **`updateClient` function:**
  - [x] Export `UpdateClientInput` interface:
    ```typescript
    export interface UpdateClientInput {
      id: string
      actor: 'ai' | 'user'
      // updatable fields — all optional
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
    ```
  - [x] Export `UpdateClientResult` interface: `{ updated: boolean; changedFields: string[]; protectedFields: string[] }`
  - [x] Export `async function updateClient(ownerId: string, input: UpdateClientInput): Promise<UpdateClientResult>`
    - Fetch current client row with `.eq('id', input.id).eq('owner_id', ownerId)`. Throw if not found.
    - Detect changed fields via `JSON.stringify` equality
    - Same simplified human-edit protection pattern: check most recent activity log entry for this client; if `actor=user` and within 24 hours, flag AI-changed fields as `protectedFields`
    - If `changedFields.length === 0`, return `{ updated: false, changedFields: [], protectedFields }`
    - Apply `.update({ ...updates, updated_at: new Date().toISOString() }).eq('id', input.id).eq('owner_id', ownerId)`; throw on error
    - Call `logActivity(ownerId, { entity_type: 'client', entity_id: input.id, action: 'client_updated', actor: input.actor, payload: { changedFields, values: updates } })`
    - Return `{ updated: true, changedFields, protectedFields }`

- [x] **Task 2 — Extend `lib/ai/crmTools.ts`** (modify existing file)

  All tools are alphabetically sorted per AD-5. Current tools: `create_client_stub`, `create_deal_stub`, `find_similar_clients`, `log_activity`. Add the five new/missing tool declarations in their alphabetical positions:

  - [x] Add `get_client` tool (after `find_similar_clients`, before `list_deals`):
    ```typescript
    {
      name: 'get_client',
      description: 'Retrieve a client record by id or name. Use to read current client state before updating or for Deal Intelligence context.',
      input_schema: {
        type: 'object' as const,
        properties: {
          id: { type: 'string', description: 'Client UUID (preferred — exact match)' },
          name: { type: 'string', description: 'Client name (fuzzy match — use when id is unknown)' },
        },
        required: [] as readonly string[],
      },
    }
    ```

  - [x] Add `get_deal` tool (after `get_client`, before `list_deals`):
    ```typescript
    {
      name: 'get_deal',
      description: 'Retrieve a deal record by id or title. Use to read current deal state before updating or for Deal Intelligence context.',
      input_schema: {
        type: 'object' as const,
        properties: {
          id: { type: 'string', description: 'Deal UUID (preferred — exact match)' },
          title: { type: 'string', description: 'Deal title (fuzzy match — use when id is unknown)' },
        },
        required: [] as readonly string[],
      },
    }
    ```

  - [x] Add `list_deals` tool (after `log_activity`, before `update_client`):
    ```typescript
    {
      name: 'list_deals',
      description: 'List deals for the Owner with optional filters. Use for pipeline queries like "what are my active deals?" or "show me all prospects". Returns up to 20 deals by default.',
      input_schema: {
        type: 'object' as const,
        properties: {
          stage: { type: 'string', description: 'Filter by stage — e.g. prospect, qualified, proposal, negotiation, won, lost' },
          is_stub: { type: 'boolean', description: 'Set false to exclude stub records from results' },
          limit: { type: 'number', description: 'Maximum results to return (default 20, max 50)' },
        },
        required: [] as readonly string[],
      },
    }
    ```

  - [x] Add `update_client` tool (after `list_deals`, before `update_deal`):
    ```typescript
    {
      name: 'update_client',
      description: 'Update one or more fields on an existing client record. Only supply fields that have changed — unsupplied fields are untouched. Set actor="user" when the Owner provided the new information; actor="ai" when ARIA is inferring it.',
      input_schema: {
        type: 'object' as const,
        properties: {
          id: { type: 'string', description: 'Client UUID (required)' },
          actor: { type: 'string', enum: ['ai', 'user'], description: '"user" if the Owner stated this; "ai" if ARIA inferred it' },
          name: { type: 'string' },
          company: { type: 'string' },
          email: { type: 'string' },
          phone: { type: 'string' },
          industry: { type: 'string' },
          company_size: { type: 'string', enum: ['solo', 'small', 'medium', 'enterprise'] },
          relationship_stage: { type: 'string', enum: ['cold', 'warming', 'trusted', 'long_term'] },
          decision_maker: { type: 'string', description: 'Name/role of the actual decision-maker' },
          communication_style: { type: 'string' },
          known_hesitations: { type: 'string' },
          language_pref: { type: 'string', enum: ['vi', 'en'] },
          notes: { type: 'string' },
        },
        required: ['id', 'actor'] as readonly string[],
      },
    }
    ```

  - [x] Add `update_deal` tool (after `update_client`):
    ```typescript
    {
      name: 'update_deal',
      description: 'Update one or more fields on an existing deal record. Only supply fields that have changed — unsupplied fields are untouched. Use update_intelligence_fields for AI-maintained analysis fields (inferred_real_need, risk_flags, etc.). Set actor="user" when the Owner stated this; actor="ai" when ARIA infers it.',
      input_schema: {
        type: 'object' as const,
        properties: {
          id: { type: 'string', description: 'Deal UUID (required)' },
          actor: { type: 'string', enum: ['ai', 'user'], description: '"user" if the Owner stated this; "ai" if ARIA inferred it' },
          title: { type: 'string' },
          stage: { type: 'string', description: 'Deal stage — e.g. prospect, qualified, proposal, negotiation, won, lost' },
          service_type: { type: 'string', enum: ['web_design', 'web_app', 'automation', 'other'] },
          value_estimate: { type: 'number', description: 'Estimated deal value in VND' },
          client_stated_need: { type: 'string', description: 'What the client said they want' },
          next_action: { type: 'string', description: 'Next action ARIA recommends' },
          next_action_due: { type: 'string', description: 'ISO date for next action due' },
          notes: { type: 'string' },
          priority: { type: 'string', enum: ['high', 'medium', 'low'] },
        },
        required: ['id', 'actor'] as readonly string[],
      },
    }
    ```

  > **Alphabetical order check after additions:** `create_client_stub`, `create_deal_stub`, `find_similar_clients`, `get_client`, `get_deal`, `list_deals`, `log_activity`, `update_client`, `update_deal`. Verify this exact order in the final file.

- [x] **Task 3 — Extend `lib/ai/toolRunner.ts`** (modify existing file)
  - [x] Import `{ listDeals, updateDeal, updateClient, type ListDealsParams, type UpdateDealInput, type UpdateClientInput }` from `@/lib/crm/crmService` (add to import block at top)
  - [x] Import `{ getDeal, getClient, type GetDealParams, type GetClientParams }` — already imported from `dealIntelligenceService`; verify it is already there, do not duplicate
  - [x] Add dispatch case for `'get_client'`: (already wired, no duplicate added)
  - [x] Add dispatch case for `'get_deal'`: (already wired, no duplicate added)
    > NOTE: `get_deal` and `get_client` are ALREADY wired in toolRunner.ts — no duplicate dispatch cases added.
  - [x] Add dispatch case for `'list_deals'`
  - [x] Add dispatch case for `'update_deal'`
  - [x] Add dispatch case for `'update_client'`

- [x] **Task 4 — Tests** (`lib/__tests__/crmService22.test.ts` — new file)
  - [x] Add `export {}` at top (ES module scope, mandatory since Story 1.11)
  - [x] Inline all logic — NEVER import from project `lib/` files (ts-node test pattern)
  - [x] **T1 — `UpdateDealInput` shape:** Construct a valid `UpdateDealInput` object with required fields (`id`, `actor`) and optional `stage`; assert required fields are present and all optional fields are truly optional (type-level check — no DB call)
  - [x] **T2 — `UpdateClientInput` shape:** Same shape verification for `UpdateClientInput`
  - [x] **T3 — `ListDealsParams` defaults:** Inline the limit logic `params.limit ?? 20`; assert that when `limit` is undefined the effective limit is 20; when `limit = 5` it is 5
  - [x] **T4 — `hasChanged` equality (reuse pattern from activityLog21.test.ts):** Inline the `hasChanged` function; assert `hasChanged('prospect', 'prospect')` returns `false`; `hasChanged('prospect', 'qualified')` returns `true`
  - [x] **T5 — No-op result shape:** Construct a result `{ updated: false, changedFields: [], protectedFields: [] }`; assert `updated === false` and both arrays are empty
  - [x] **T6 — stage_history append logic:** Inline the append logic: given `stageHistory = [{ from_stage: 'prospect', to_stage: 'qualified', changed_at: '2026-06-01T00:00:00Z' }]` and new transition `{ from: 'qualified', to: 'proposal' }`, assert that after push the array has 2 entries and the latest entry has `to_stage === 'proposal'`
  - [x] **T7 — `actor` values:** Assert that `actor` only accepts `'ai'` or `'user'`; construct objects with both values and assert they type-check; the string `'system'` is NOT valid
  - [x] **T8 — `UpdateDealResult` shape:** Construct `{ updated: true, changedFields: ['stage', 'value_estimate'], protectedFields: [] }`; assert `changedFields.length === 2` and `protectedFields` is empty
  - [x] **T9 — Protected fields non-empty:** Construct a result where `protectedFields: ['notes']`; assert `protectedFields.length === 1` and the field name is `'notes'`
  - [x] Add `"test:crm-service22": "npx ts-node lib/__tests__/crmService22.test.ts"` to `package.json` scripts

- [x] **Task 5 — CI triad**
  - [x] `npx tsc --noEmit` — zero errors
  - [x] `npx eslint lib/crm/crmService.ts lib/ai/crmTools.ts lib/ai/toolRunner.ts lib/__tests__/crmService22.test.ts`
  - [x] `npx prettier --write` on all touched files
  - [x] `npx ts-node lib/__tests__/crmService22.test.ts` — 33 tests pass

- [x] **Task 6 — Update story status**
  - [x] Mark all tasks `[x]`, fill Dev Agent Record
  - [x] `sprint-status.yaml`: `2-2-core-crm-tool-surface-create-read-update-via-conversation: done`, update `last_updated`

## Dev Notes

### Architecture decisions in effect

- **AD-2**: Every query in `crmService.ts` must `.eq('owner_id', ownerId)` as explicit filter on top of RLS (belt-and-suspenders — matches pattern in all existing `lib/crm/` services).
- **AD-5**: Tool array in `crmTools.ts` must be alphabetically sorted so the tool list is byte-stable across calls (cache-friendly). Final order: `create_client_stub`, `create_deal_stub`, `find_similar_clients`, `get_client`, `get_deal`, `list_deals`, `log_activity`, `update_client`, `update_deal`.
- **AD-11**: `lib/crm/crmService.ts` must start with `import 'server-only'` at line 1. This is mandatory for all new `lib/crm/` files.
- **AD-13**: Use `createServerClient()` (anon key + user session) in `crmService.ts`. `createServiceClient()` must not appear.
- **AD-14**: `updateDeal` and `updateClient` implement the same no-op idempotency pattern as `updateIntelligenceFields`: compare before write, log nothing on no-op, never clobber without provenance. Stage history is appended, never replaced.

### Existing `lib/crm/` pattern to follow exactly

Every service in `lib/crm/` starts:
```typescript
import 'server-only'
import { createServerClient } from '@/lib/supabase/server'
```

Every query includes `.eq('owner_id', ownerId)` as an explicit filter. Match this pattern in `crmService.ts`.

### toolRunner.ts — read before editing (critical)

Read `lib/ai/toolRunner.ts` fully before Task 3. The dispatch uses a series of `if / else if` blocks. Specifically:
- `get_deal` and `get_client` are ALREADY wired (they were added for Deal Intelligence in Epic 1). Do NOT add duplicate branches — the file will have unreachable code that ESLint will catch.
- Add ONLY `list_deals`, `update_deal`, `update_client` dispatch cases.
- The `getDeal` and `getClient` imports from `dealIntelligenceService` are already at the top of the file — do not re-import.

### crmService.ts — full structure outline

```typescript
import 'server-only'
import { createServerClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/crm/activityLogService'

// -- listDeals --
export interface ListDealsParams { stage?: string; is_stub?: boolean; limit?: number }
export interface DealSummary { id: string; client_id: string; title: string; service_type: string; stage: string; value_estimate: number | null; is_stub: boolean; stale_since: string | null; predicted_outcome: string | null; created_at: string }
export async function listDeals(ownerId: string, params: ListDealsParams): Promise<DealSummary[]>

// -- updateDeal --
export interface UpdateDealInput { id: string; actor: 'ai' | 'user'; title?: string; stage?: string; service_type?: ...; value_estimate?: number; client_stated_need?: string; next_action?: string; next_action_due?: string; notes?: string; priority?: ... }
export interface UpdateDealResult { updated: boolean; changedFields: string[]; protectedFields: string[] }
export async function updateDeal(ownerId: string, input: UpdateDealInput): Promise<UpdateDealResult>

// -- updateClient --
export interface UpdateClientInput { id: string; actor: 'ai' | 'user'; name?: string; company?: string; email?: string; phone?: string; industry?: string; company_size?: ...; relationship_stage?: ...; decision_maker?: string; communication_style?: string; known_hesitations?: string; language_pref?: ...; notes?: string }
export interface UpdateClientResult { updated: boolean; changedFields: string[]; protectedFields: string[] }
export async function updateClient(ownerId: string, input: UpdateClientInput): Promise<UpdateClientResult>
```

### Human-edit protection — implementation guidance

The simplified approach (check most recent activity log entry for the entity, flag AI-written changes as protected if human edited within 24h) avoids N+1 log queries. Here is the recommended implementation for `updateDeal`:

```typescript
// After detecting changedFields, check for human-edit protection when actor === 'ai'
let protectedFields: string[] = []
if (input.actor === 'ai' && changedFields.length > 0) {
  const supabase = createServerClient()
  const { data: latestLog } = await supabase
    .from('activity_log')
    .select('actor, created_at, payload')
    .eq('owner_id', ownerId)
    .eq('entity_id', input.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (latestLog && latestLog.actor === 'user') {
    const ageMs = Date.now() - new Date(latestLog.created_at).getTime()
    const within24h = ageMs < 24 * 60 * 60 * 1000
    if (within24h) {
      // All AI-changed fields are potentially conflicting — surface them all
      protectedFields = [...changedFields]
      changedFields = []
    }
  }
}
```

This is a pragmatic approximation — it flags a conflict when the human touched the entity recently, not per-field. The activity log payload could be inspected per-field for precision, but that adds complexity. The 24h window keeps false positives low in practice. Document this trade-off in a code comment referencing AD-14.

### `update_intelligence_fields` vs `update_deal` — boundary

These two tools serve different purposes and must NOT overlap:
- `update_intelligence_fields` (already exists): writes AI-maintained analysis fields (`inferred_real_need`, `risk_flags`, `opportunity_signals`, `predicted_outcome`, `prediction_reason`, `similar_deals`, `stall_diagnosis`). Has its own idempotency logic. Actor is always `ai`.
- `update_deal` (this story): writes factual deal fields the Owner or ARIA updates from conversation (`title`, `stage`, `value_estimate`, `client_stated_need`, `next_action`, `notes`, `priority`). Actor can be `ai` or `user`.

The `UpdateDealInput` interface must NOT include intelligence fields — keep the boundary clean.

### ts-node test pattern (mandatory — carry-forward from all prior stories)

- NEVER import from project `lib/` files in test files
- Inline all logic and types directly in the test file
- Add `export {}` at the very top (prevents `Cannot redeclare block-scoped variable` TSC errors)
- Run via `npx ts-node lib/__tests__/crmService22.test.ts`
- Inline the `hasChanged` function (copy from `dealIntelligenceService.ts`) rather than importing

### Learnings carried from Story 2.1

1. **`import 'server-only'` at line 1** in every new `lib/crm/` file — mandatory (AD-11).
2. **Prettier before CI** — run `npx prettier --write` on every touched file before the CI triad to avoid a formatting-only CI failure.
3. **`export {}` at top of test files** — mandatory since Story 1.11.
4. **Throw, don't swallow, in service layer** — `updateDeal`, `updateClient`, `listDeals` throw on DB error; `toolRunner.ts` outer try/catch converts them to `is_error: true` tool results.
5. **No-op writes log nothing** — already established in `updateIntelligenceFields`; `updateDeal` and `updateClient` must follow the same pattern: if `changedFields.length === 0`, return without writing the DB or the activity log.
6. **Stage history append semantics**: Read the current `stage_history` jsonb array from the fetched row, push the new transition object, write the full updated array back. Do not assume the column is always an array — default to `[]` if null.

### Migration needed?

No new migration is needed for this story. The `deals` table already has `stage_history jsonb`, `next_action`, `next_action_due`, `priority`, `notes`, and all other target fields from `addendum.md §B.2`. The `clients` table already has all target fields from `addendum.md §B.1`. Verify the exact columns against the initial schema migration before writing service code.

### Files to create / modify

**New files:**
- `lib/crm/crmService.ts`
- `lib/__tests__/crmService22.test.ts`

**Modified files:**
- `lib/ai/crmTools.ts` — add `get_client`, `get_deal`, `list_deals`, `update_client`, `update_deal` tool declarations in alphabetical positions
- `lib/ai/toolRunner.ts` — add `list_deals`, `update_deal`, `update_client` dispatch cases; import from `crmService`
- `package.json` — add `test:crm-service22` script

**Unchanged:**
- All existing `lib/crm/` services — no modifications needed
- All migration files — no schema changes required
- `activityLogService.ts` — already correct; `updateDeal`/`updateClient` call `logActivity()` from it

## Dev Agent Record

### Debug Log

No issues. `get_client` and `get_deal` were already wired in `toolRunner.ts` — did not add duplicate dispatch cases. Used non-null assertion (`!`) for array index access in test T6 to satisfy TypeScript strict mode.

### Completion Notes

All 6 tasks complete. Created `lib/crm/crmService.ts` with `listDeals`, `updateDeal`, `updateClient` functions following the compare-before-write + 24h human-edit-protection pattern. Expanded `CRM_STUB_TOOLS` from 4 to 9 tools in correct alphabetical order (AD-5). Added 3 new dispatch cases to `toolRunner.ts`. 33 ts-node tests pass; tsc, ESLint, Prettier all clean.

### File List

- `lib/crm/crmService.ts` (NEW)
- `lib/__tests__/crmService22.test.ts` (NEW)
- `lib/ai/crmTools.ts` (MODIFIED — 4 → 9 tools)
- `lib/ai/toolRunner.ts` (MODIFIED — added crmService import + 3 dispatch cases)
- `package.json` (MODIFIED — added `test:crm-service22` script)

### Change Log

| Date | Change |
|------|--------|
| 2026-06-29 | Story file created — gap analysis confirmed 5 missing pieces: `update_deal`, `update_client`, `list_deals` tools + `get_client`/`get_deal` tool declarations + `crmService.ts` service layer |
| 2026-06-29 | Implementation complete — all tasks done, CI triad clean, 33 tests pass |
