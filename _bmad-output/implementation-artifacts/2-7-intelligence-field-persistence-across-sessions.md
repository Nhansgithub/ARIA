---
story_id: "2.7"
epic: 2
title: "Intelligence Field Persistence Across Sessions (Context Reconstruction)"
status: done
baseline_commit: c2efd6a
---

# Story 2.7 — Intelligence Field Persistence Across Sessions (Context Reconstruction)

## Story

As ARIA, I want intelligence fields and activity history persisted in the CRM to be the sole durable record of what is known about a deal or client, so that every new session reconstructs full context from the DB rather than relying on chat transcript memory.

---

## What Already Exists (Do NOT Re-Implement)

Everything below was delivered in Stories 2.1–2.6 and must be treated as immutable foundation.

### `lib/crm/dealIntelligenceService.ts`
- `updateIntelligenceFields(ownerId, IntelligenceFieldsInput)` — fully wired with compare-before-write idempotency, 24-hour human-edit protection (`.maybeSingle()` guard), `source` provenance in the activity log payload, and `protectedFields` return. Return type: `Promise<{ updated: boolean; changedFields: string[]; protectedFields: string[] }>`.
- Fields: `inferred_real_need`, `risk_flags`, `opportunity_signals`, `predicted_outcome`, `prediction_reason`, `similar_deals?: SimilarDealEntry[]`, `stall_diagnosis`, `source?`.
- `getDeal()` returns `DealRecord` with `similar_deals: SimilarDealEntry[]`.
- `findSimilarDeals()` returns `SimilarDealRecord[]` each containing `similarity_reason: string`.
- `SimilarDealEntry { deal_id: string; similarity_reason: string }`.

### `lib/ai/dealIntelligenceTools.ts` (`DI_TOOLS`)
- Tools: `find_similar_deals`, `get_client`, `get_deal`, `get_pricing_floors`, `update_intelligence_fields` — all wired and alphabetically sorted (AD-5).

### `lib/ai/orchestrator.ts`
- `deal_intelligence` specialist has a FOUR-LAYER SYNTHESIS PROTOCOL. Step 3 of the protocol calls `update_intelligence_fields` after composing the response.
- `crm_action` specialist has a `DEAL LIFECYCLE PROTOCOL` (added in Story 2.6).

### `lib/ai/toolRunner.ts`
- `update_intelligence_fields` dispatch injects `source: 'deal_intelligence'` server-side — not exposed in the tool schema (preserves AD-5 cache stability).

### `lib/crm/crmService.ts`
- `updateDeal`, `updateClient`, `listDeals` — operational with human-edit protection.

### `lib/crm/stubLifecycleService.ts`
- `promoteStub`, `archiveStub`, `checkStubEnrichment`, `findStaleStubs`.

### Activity Log (AD-14)
- Append-only; `updateIntelligenceFields` is idempotent — no write and no log entry on a no-op (compare-before-write).
- `source` lives inside `payload jsonb`, not as a top-level column — no migration needed.
- `actor` field distinguishes `"ai"` from `"user"` writes.

### Story 1.13 — "Start New Topic"
- Clears only the in-memory conversation window; CRM data (clients, deals, documents, activity log, intelligence fields) is untouched in the DB.

---

## Gap Analysis — What Story 2.7 Adds

Story 2.7 is a **prompt engineering + activity-log query story**. No new DB columns, no new tool schemas, no new service function signatures are needed. The gaps are:

### Gap 1 — `deal_intelligence` specialist prompt lacks an explicit session-reconstruction preamble
The FOUR-LAYER SYNTHESIS PROTOCOL tells ARIA to call tools during a session, but there is no directive that instructs the orchestrator to treat the DB (not conversation history) as the sole source of truth at the start of every DI call. A `SESSION RECONSTRUCTION PROTOCOL` block must be prepended to the `deal_intelligence` specialist system prompt so that:
- The first action in every DI session is always `get_deal` + `get_client` via tools.
- Previously written intelligence fields (returned by `get_deal`) are read as the current baseline before any new synthesis.
- No prior chat transcript is assumed to exist or to be reliable.

### Gap 2 — No `get_activity_log` tool for history queries
When the Owner asks "what has changed on this deal recently?" the orchestrator has no tool to query the `activity_log` table for a given `entity_id`. A new tool `get_activity_log` must be added to `DI_TOOLS` (alphabetically after `find_similar_deals`, before `get_client`) and a corresponding service function added to `dealIntelligenceService.ts`.

### Gap 3 — `deal_intelligence` specialist prompt lacks a `HISTORY QUERY PROTOCOL`
The orchestrator needs a protocol block explaining how to answer history questions: call `get_activity_log`, attribute changes by `actor` (`"ai"` → "I revised …"; `"user"` → "You updated …"), and present them in chronological order. The activity log — not chat history — is the explicit source of truth for this response.

### Gap 4 — No story-specific test file
Per project convention, each story ships a `lib/__tests__/<slug>.test.ts` file with a `test:<slug>` npm script.

---

## Acceptance Criteria

| # | Scenario | Criterion |
|---|----------|-----------|
| AC1 | Session reconstruction without transcript | Given a DI session concluded and intelligence fields were written, when the Owner opens a new conversation (new tab, next-day, or after "Start new topic"), then ARIA's DI specialist calls `get_deal` + `get_client` via tools at the start of every session — without reading any prior chat transcript. (AD-3, FR-35) |
| AC2 | Context budget compliance | Given a new DI session begins, when the Owner asks about a specific deal, then ARIA fetches only that deal and its client (not the entire CRM), keeping reconstructed context within the per-DI-call context budget (≤~2,000 tokens of Business Context per AD-3/FR-4). |
| AC3 | `similar_deals` freshness + idempotency | Given `similar_deals` is already populated from a prior session, when a new DI session runs for the same deal, then ARIA calls `find_similar_deals` again for fresh matches but also reads the stored `similar_deals` as a baseline; if results are unchanged, no new activity log entry is written (AD-14). |
| AC4 | Activity log as source of truth for history queries | Given the `activity_log` contains field-change history for a deal, when the Owner asks "what has changed on this deal recently?", then ARIA calls `get_activity_log` and summarises material changes in chronological order — the log, not chat history, is the explicit source of truth. (AD-3, FR-30) |
| AC5 | Correct actor attribution in history summaries | Given the log contains `actor="ai"` and `actor="user"` entries, when ARIA summarises deal history, then it correctly attributes each change (e.g. "You updated the budget on June 10; I revised the risk flags after our session on June 12"). (FR-30, AD-14) |
| AC6 | "Start new topic" does not wipe CRM data | Given "Start new topic" is triggered, when the conversation window is cleared, then all CRM data (clients, deals, documents, activity log, intelligence fields) remains intact in the DB — only the in-memory conversation window is reset. (AD-3, FR-35) — **This AC is already satisfied by Story 1.13; the test must assert it explicitly and reference the existing code path.** |

---

## Tasks / Subtasks

### Task 1 — Add `SESSION RECONSTRUCTION PROTOCOL` to the `deal_intelligence` specialist prompt
**File:** `lib/ai/orchestrator.ts`

- Prepend a `SESSION RECONSTRUCTION PROTOCOL` block to the `deal_intelligence` specialist system prompt (before the existing FOUR-LAYER SYNTHESIS PROTOCOL).
- The block must instruct ARIA to:
  1. Always call `get_deal` + `get_client` at the start of every DI session.
  2. Read the returned intelligence fields (e.g. `inferred_real_need`, `risk_flags`, `similar_deals`) as the current authoritative baseline.
  3. Never assume any prior conversation transcript exists or is accurate.
  4. Re-run `find_similar_deals` for freshness, then compare with the stored `similar_deals`; write via `update_intelligence_fields` only if there is a change (idempotency rule).
- The block must also explicitly state: "The database is the sole durable memory of this deal. Each session starts fresh from the DB."

### Task 2 — Add `get_activity_log` tool to `DI_TOOLS` and service function
**Files:** `lib/ai/dealIntelligenceTools.ts`, `lib/crm/dealIntelligenceService.ts`

- **`dealIntelligenceService.ts`**: Add `getActivityLog(ownerId: string, entityId: string, limit?: number): Promise<ActivityLogEntry[]>`.
  - Query `activity_log` where `owner_id = ownerId` AND `entity_id = entityId`, ordered by `created_at ASC`, limited to `limit ?? 50` rows.
  - Return fields per entry: `id`, `entity_type`, `entity_id`, `action`, `actor`, `payload`, `created_at`.
  - Must include `import 'server-only'` at line 1 (AD-11).
- **`dealIntelligenceTools.ts`**: Add `get_activity_log` to `DI_TOOLS` array, inserted alphabetically (after `find_similar_deals`, before `get_client`).
  - Schema: `{ name: 'get_activity_log', description: '...', input_schema: { type: 'object', properties: { entity_id: { type: 'string' }, limit: { type: 'number' } }, required: ['entity_id'] } }`.
  - Tools array must remain alphabetically sorted (AD-5).
- **`lib/ai/toolRunner.ts`**: Add dispatch case for `get_activity_log` — call `getActivityLog(ownerId, input.entity_id, input.limit)`.

### Task 3 — Add `HISTORY QUERY PROTOCOL` to the `deal_intelligence` specialist prompt
**File:** `lib/ai/orchestrator.ts`

- Append a `HISTORY QUERY PROTOCOL` block to the `deal_intelligence` specialist system prompt (after the FOUR-LAYER SYNTHESIS PROTOCOL).
- The block must instruct ARIA to:
  1. When the Owner asks any variant of "what has changed?", "show me the history", or "what happened to this deal?", call `get_activity_log` with the relevant `entity_id`.
  2. Attribute changes by `actor`: `actor="ai"` → "I [action] …"; `actor="user"` → "You [action] …".
  3. Present changes in chronological order; skip no-op entries (where `payload.changed_fields` is empty).
  4. State explicitly: "The activity log — not our conversation — is the authoritative record of what changed and when."

### Task 4 — Create story-specific test file
**File:** `lib/__tests__/intelligencePersistence27.test.ts`

Follow the ts-node test pattern: `export {}` at top; no project `lib/` imports; all logic inlined.

Tests must cover (minimum 10 tests, 25 assertions):

1. `getActivityLog` returns entries ordered by `created_at ASC`.
2. `getActivityLog` filters by `owner_id` (returns only rows matching ownerId).
3. `getActivityLog` filters by `entity_id`.
4. `getActivityLog` respects `limit` parameter.
5. `getActivityLog` defaults to `limit=50` when not provided.
6. `DI_TOOLS` contains `get_activity_log` as a member.
7. `DI_TOOLS` is alphabetically sorted by `name` (AD-5).
8. `get_activity_log` tool schema has `entity_id` as a required field and `limit` as optional.
9. `updateIntelligenceFields` no-op when similar_deals unchanged — no activity log write (idempotency, AD-14).
10. `updateIntelligenceFields` writes and logs when similar_deals differ (freshness path).
11. Actor attribution: an `actor="ai"` log entry should be surfaced with "I" prefix; `actor="user"` with "You" prefix (test against a formatting helper or assert the protocol exists in the specialist prompt string).

Add `"test:intelligence-persistence27": "ts-node lib/__tests__/intelligencePersistence27.test.ts"` to `package.json`.

### Task 5 — CI triad
- `npx tsc --noEmit` — 0 errors.
- `npx eslint lib/ai/dealIntelligenceTools.ts lib/crm/dealIntelligenceService.ts lib/ai/toolRunner.ts lib/ai/orchestrator.ts` — 0 errors.
- `npm run test:intelligence-persistence27` — all assertions pass.

### Task 6 — Update story and sprint status
- Set this story's `status` frontmatter to `done`.
- Update `sprint-status.yaml`: `2-7-intelligence-field-persistence-across-sessions: done`.
- If all stories in Epic 2 are done, set `epic-2: done`.
- Update `last_updated`.

---

## Dev Notes

### Architecture Constraints
- **AD-1**: `@anthropic-ai/sdk` must not be imported outside `lib/ai/`. No direct SDK usage in service files.
- **AD-2**: All Supabase queries must include `.eq('owner_id', ownerId)` — never query without the owner scope.
- **AD-5**: Tools arrays must be alphabetically sorted by `name`. `get_activity_log` sorts between `find_similar_deals` and `get_client`.
- **AD-11**: `lib/ai/` and `lib/crm/` files must have `import 'server-only'` at line 1.
- **AD-13**: Only `createServerClient()` in route handlers — service functions receive the client as a parameter or use the server client internally.
- **AD-14**: `activity_log` is append-only. `updateIntelligenceFields` must remain idempotent — compare-before-write, no DB write and no log entry when there is no change.
- **Human-edit protection**: The 24-hour window guard in `updateIntelligenceFields` must not be bypassed. `getActivityLog` is read-only and has no write path.

### ts-node Test Pattern
```typescript
export {}; // must be first line — marks file as a module

// ✅ Inline all types and logic — do NOT import from project lib/
type ActivityLogEntry = {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  actor: 'ai' | 'user';
  payload: Record<string, unknown>;
  created_at: string;
};

// Assertions via console.assert / throw pattern:
function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`FAIL: ${message}`);
  console.log(`  PASS: ${message}`);
}
```

### `get_activity_log` Tool Schema Pattern
Follow the shape already established by `get_deal` and `get_client` in `dealIntelligenceTools.ts`. Alphabetical positioning — the tools array must read: `find_similar_deals`, `get_activity_log`, `get_client`, `get_deal`, `get_pricing_floors`, `update_intelligence_fields`.

### Session Reconstruction Protocol — What to Say
The `SESSION RECONSTRUCTION PROTOCOL` block is a system-prompt instruction block, not new code. It lives inside the template literal for the `deal_intelligence` specialist in `orchestrator.ts`. Keep it concise (≤12 lines) to minimise token cost against the context budget (AD-3).

### History Query Protocol — Actor Attribution Convention
Use a simple two-branch string: `actor === 'ai' ? 'I' : 'You'`. The protocol block tells the model to apply this rule; no new code helper is needed — the model applies it at inference time.

### Similar Deals Freshness — No Extra Code Needed
The idempotency path (compare-before-write in `updateIntelligenceFields`) already handles the no-op case. The protocol prompt block is what ensures ARIA re-runs `find_similar_deals` before updating — the underlying service is already correct.

### AC6 — "Start New Topic" Is Already Implemented
Story 1.13 delivered the "Start new topic" button, which resets only the React `messages` state. No DB tables are touched. AC6 is a regression guard — the test asserts that the existing code path is unchanged, not that new code is written.

### Key Learnings From Prior Stories
- **Story 2.5**: `source` is inside `payload jsonb`, not a top-level column — if querying `payload->>'source'` in `getActivityLog`, use the Postgres JSON operator.
- **Story 2.6**: `predicted_outcome` must NOT be written via `update_deal` — it belongs exclusively to the DI specialist's `update_intelligence_fields` path. Do not add `predicted_outcome` to any `crm_action` code path.
- **Stories 2.2–2.4**: All tool schemas are stable; do not modify existing schemas unless absolutely necessary. Adding a new tool is additive; it does not invalidate the cache of existing tools.
- **Story 1.7 (conversational stub creation)**: The orchestrator's intent routing already sends "what has changed" style questions to the `deal_intelligence` specialist when a deal is in context. If a question is ambiguous, the routing defaults to `general` — the `HISTORY QUERY PROTOCOL` should encourage the model to recognise deal-history questions proactively.

---

## Dev Agent Record

### Implementation Notes
_(To be filled in by the dev agent during implementation.)_

### Commits
_(To be filled in by the dev agent.)_

### Change Log
| Date | Change | Author |
|------|--------|--------|
| 2026-06-29 | Story file created | Story Context Engine |
