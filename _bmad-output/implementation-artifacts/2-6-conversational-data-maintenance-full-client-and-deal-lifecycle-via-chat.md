---
story_id: 2.6
epic: 2
title: Conversational Data Maintenance — Full Client and Deal Lifecycle via Chat
status: done
baseline_commit: c2efd6a
---

## Story

As an **Owner**, I want to create, advance, and correct any client or deal entirely through natural language conversation — including stage transitions, field corrections, and relationship notes — so that I never need to open a data-entry form to keep my CRM current.

## What Already Exists (do NOT re-implement)

The following are fully operational. Story 2.6 must NOT duplicate them:

**`lib/crm/crmService.ts`:**
- `updateDeal(ownerId, UpdateDealInput)` — human-edit protection (24h window via activity_log), no-op guard (`JSON.stringify` compare-before-write), `stage_history` append on stage changes, `actor` field, returns `{ updated: boolean, changedFields: string[], protectedFields: string[] }`.
- `updateClient(ownerId, UpdateClientInput)` — same pattern as `updateDeal`. Same 24h human-edit protection, same no-op guard, same return type.
- `listDeals(ownerId, ListDealsParams)` — cap 50, returns `DealSummary[]` filtered by `owner_id`.
- `UpdateDealInput` — supports: `id`, `actor`, `title`, `stage`, `service_type`, `value_estimate`, `client_stated_need`, `next_action`, `next_action_due`, `notes`, `priority`, `is_stub`, `status`.
- `UpdateClientInput` — supports: `id`, `actor`, `name`, `company`, `email`, `phone`, `industry`, `company_size`, `relationship_stage`, `decision_maker`, `communication_style`, `known_hesitations`, `language_pref`, `notes`, `is_stub`, `status`.
- **`stage_history` is already handled inside `updateDeal`** — when `stage` changes, it appends `{ from_stage, to_stage, changed_at }` to the `stage_history` jsonb array automatically. No extra code needed.

**`lib/crm/stubLifecycleService.ts`:**
- `promoteStub`, `archiveStub`, `checkStubEnrichment`, `findStaleStubs` — all operational.
- `promoteStub` sets `is_stub=false` and logs `action="stub_promoted"`. `archiveStub` sets `status=archived` and logs `action="stub_archived"`.

**`lib/crm/dealIntelligenceService.ts`:**
- `updateIntelligenceFields(ownerId, IntelligenceFieldsInput)` — fully wired with compare-before-write idempotency, human-edit protection (24h window), `source` provenance, `protectedFields` return value.
- `getDeal()`, `getClient()`, `getPricingFloors()`, `findSimilarDeals()`.

**`lib/crm/stubService.ts`:**
- `createClientStub`, `createDealStub`, `findSimilarClients` — all operational. Used by `crm_action` specialist.

**`lib/ai/crmTools.ts` (`CRM_STUB_TOOLS`, 12 tools alphabetically sorted):**
`archive_stub`, `check_stub_enrichment`, `create_client_stub`, `create_deal_stub`, `find_similar_clients`, `get_client`, `get_deal`, `list_deals`, `log_activity`, `promote_stub`, `update_client`, `update_deal`

All 12 tools are already dispatched in `lib/ai/toolRunner.ts`. The `crm_action` specialist in `lib/ai/orchestrator.ts` already uses the full `CRM_STUB_TOOLS` list and has a complete `STUB CREATION PROTOCOL` that handles create, deduplication, and confirmation.

**`app/api/chat/route.ts`:**
- `crm_action` intent → `runAgentWithTools` with `CRM_STUB_TOOLS`. All wired.
- `deal_intelligence` intent → `runAgentWithTools` with `DI_TOOLS`. All wired.
- `classifyIntent` classifies "create/update/query clients or deals via conversation, pipeline status" as `crm_action`.

**`lib/ai/agentWithTools.ts`:**
- Agentic tool loop (up to 3 iterations), streaming response, tool calling wired to `runTools`.

**`lib/crm/activityLogService.ts`:**
- `logActivity(ownerId, params)` — `payload` is `Record<string, unknown>`. Used by all write paths.

## Gap Analysis — What Story 2.6 Adds

Story 2.6 is a **behavioural completeness story** — it validates and strengthens the end-to-end conversational lifecycle rather than introducing a new subsystem. The infrastructure (tools, service functions, toolRunner, route) is fully wired. The gaps are in two areas: (1) orchestrator prompt gaps that cause incomplete or incorrect AI behaviour for specific lifecycle scenarios, and (2) a missing end-to-end test file.

### Gap 1 — `crm_action` specialist prompt: stage-advance + close lifecycle

The `STUB CREATION PROTOCOL` in the `crm_action` specialist prompt handles stub creation well. However, the specialist prompt does **not** include explicit behavioural rules for:

**a. Stage transitions with next-step recommendation:**
When the Owner says "the Hanoi restaurant signed off on scope, moving to proposal", the AC requires ARIA to:
- Call `update_deal` with the new stage (stage_history append is handled by `updateDeal` — correct).
- Confirm the transition.
- **Recommend the next document or action** for the new stage.
The current `crm_action` prompt ends with: "If the Owner asks only for information, answer the question and stop." This is correct for queries, but for stage-advance messages the specialist needs to acknowledge the transition and recommend the next step — it currently lacks an explicit directive for this.

**b. Deal close ("mark as Won"):**
AC-6 requires ARIA to:
- Call `update_deal` with `stage="Won"` and `predicted_outcome="likely_win"`.
- Confirm and offer to create a win-note or next document.
The `update_deal` tool schema already supports both `stage` and `predicted_outcome` is **not** in `UpdateDealInput` (it is an intelligence field). However, the AC says to set `predicted_outcome="likely_win"` on close — this is a gap. `updateDeal` does not write `predicted_outcome` (it is in `updateIntelligenceFields`). The resolution: on deal close, ARIA should call `update_deal` for the stage change and then call `update_intelligence_fields` (via the DI tool) for `predicted_outcome`. But `update_intelligence_fields` is only in `DI_TOOLS`, not `CRM_STUB_TOOLS`. The simplest conformant resolution: the `crm_action` specialist calls `update_deal` for stage and `log_activity` to record the close context; the `predicted_outcome` update happens naturally on the next DI session. The AC phrase "ARIA calls `update_deal` to set `stage='Won'`, `predicted_outcome='likely_win'`" should be read as a goal state, not as a single tool call — the developer must interpret this correctly and not add `predicted_outcome` to `UpdateDealInput` (which would break the intelligence field separation established in Story 2.5).

**Fix:** Add a `DEAL LIFECYCLE PROTOCOL` section to the `crm_action` specialist system prompt in `lib/ai/orchestrator.ts` that covers:
1. Stage advance — call `update_deal` with new `stage`; confirm and recommend next document/action based on stage.
2. Field correction — call `update_deal` or `update_client` with corrected value; confirm.
3. Deal close — call `update_deal` with `stage="Won"`; offer win-note via `log_activity`; do NOT attempt to set `predicted_outcome` (intelligence field, owned by DI specialist).
4. Note that if `update_deal` returns `protectedFields`, ARIA must surface the protected fields conversationally ("Em thấy anh đã cập nhật [field] gần đây — anh có muốn mình ghi đè không?").

### Gap 2 — `crm_action` specialist prompt: field correction reply pattern

When the Owner corrects a field ("actually their budget is 80 million VND, not 50"), the current specialist has no explicit directive to: (a) parse the correction as a `user`-actor update, (b) confirm it succinctly ("Got it — updated the budget to 80M VND"), and (c) not volunteer unrequested strategic advice. The existing "If the Owner asks only for information, answer the question and stop" rule does not cover corrections explicitly.

**Fix:** Add to the `DEAL LIFECYCLE PROTOCOL` in the `crm_action` prompt: corrections must use `actor="user"`, must confirm the corrected value in the reply, and must not append unsolicited analysis.

### Gap 3 — No story-specific test file

Stories 2.1–2.5 each have a corresponding test file in `lib/__tests__/`. Story 2.6 needs `lib/__tests__/conversationalMaintenance26.test.ts` covering the key behavioural contracts: stage transition logic (stage_history append), no-op guard, human-edit protection, actor assignment, and the close lifecycle.

### Summary of additions

1. **`lib/ai/orchestrator.ts`** — add `DEAL LIFECYCLE PROTOCOL` section to the `crm_action` specialist system prompt.
2. **`lib/__tests__/conversationalMaintenance26.test.ts`** — new test file.
3. **`package.json`** — add `"test:conversational-maintenance26"` script.

**No new tools. No new service functions. No new tool dispatch cases. No DB migrations. No changes to `crmService.ts`, `toolRunner.ts`, `crmTools.ts`, or `agentWithTools.ts`.**

## Acceptance Criteria

- **AC-1 — Stub creation confirms and asks ≤2 gap questions:** Given the Owner types a description of a new client and deal in chat (e.g. "Just met an F&B chain owner who wants a website and maybe automation, budget unclear"), when the orchestrator processes the message, then ARIA calls `create_client_stub` and `create_deal_stub`, confirms creation in its reply, and asks no more than 2 gap-filling questions in the same turn. *(Already implemented in `crm_action` STUB CREATION PROTOCOL — verify existing behaviour holds, no new code.)*

- **AC-2 — Stage transition: stage_history updated, confirmation + next-step recommendation:** Given a deal exists in stage "Discovery", when the Owner says "the Hanoi restaurant signed off on scope, moving to proposal" in chat, then ARIA calls `update_deal` with `stage="proposal"` and `actor="user"`, the `stage_history` jsonb is appended by `updateDeal` (automatic — no extra code), the activity log records `action="deal_updated"`, `actor="user"`, and ARIA's reply confirms the transition and recommends the next document or action (FR-31, AD-14).

- **AC-3 — Field correction: actor=user, confirmation:** Given a client or deal record has incorrect information, when the Owner says "actually their budget is 80 million VND, not 50" in chat, then ARIA calls `update_deal` with `value_estimate=80_000_000` and `actor="user"`, the activity log records `actor="user"`, and ARIA confirms the correction succinctly without appending unsolicited strategy (FR-31).

- **AC-4 — Complete lifecycle via chat only:** Given the Owner wants to check the full conversational maintenance lifecycle without ever opening a UI form, when a complete sequence of create → enrich → stage-advance → correct → close is performed via chat messages alone, then all state transitions are reflected in the DB and activity log, and no form submission is required at any step (FR-31).

- **AC-5 — Manual surface reuses same write path:** Given a minimal manual edit surface exists in the UI (e.g. an inline field editor on a client/deal detail view), when the Owner uses it to edit a field, then the same `update_client`/`update_deal` tool path is invoked and the activity log records `actor="user"` — the manual surface is NOT a separate code path. *(This is a constraint on future UI implementation — no code change in this story; document in Dev Notes as an invariant.)*

- **AC-6 — Deal close via conversation:** Given the Owner says "mark the Pho 24 deal as won" in chat, when ARIA processes the message, then ARIA calls `update_deal` to set `stage="won"` and `actor="user"`, appends to `stage_history` (automatic via `updateDeal`), writes an activity log entry with `actor="user"`, and offers to log a win-note or suggests creating a next document — ARIA does NOT attempt to set `predicted_outcome` via `update_deal` (that field belongs to the DI specialist's `update_intelligence_fields` path) (FR-31, AD-14).

- **AC-7 — Human-edit protection surfaced conversationally:** Given `update_deal` or `update_client` returns a non-empty `protectedFields` array (human edit within 24h), when ARIA receives this result, then ARIA surfaces the blocked fields conversationally in its reply (e.g. "Em thấy anh vừa cập nhật [field] — anh có muốn mình ghi đè không?") rather than silently discarding the AI's proposed value (AD-14).

- **AC-8 — CI triad passes:** `tsc --noEmit`, ESLint, and Prettier on all touched files; `ts-node` test file runs with all assertions passing.

## Tasks / Subtasks

- [x] **Task 1 — Update `crm_action` specialist prompt in `lib/ai/orchestrator.ts`**
  - [x] 1a: Located insertion point (after STUB CREATION PROTOCOL step 4, before "When retrieving pipeline information…")
  - [x] 1b: Inserted DEAL LIFECYCLE PROTOCOL block covering stage advance, field correction, deal close (Won), deal close (Lost)
  - [x] 1c: Prettier — orchestrator.ts unchanged
  - [x] 1d: tsc 0 errors, ESLint 0 errors

- [x] **Task 2 — Tests** (`lib/__tests__/conversationalMaintenance26.test.ts` — new file)
  - [x] `export {}` at top
  - [x] All logic inlined — no project `lib/` imports
  - [x] 27 assertions across 11 tests; all pass

- [x] **Task 3 — Update `package.json`**
  - [x] Added `"test:conversational-maintenance26"` script

- [x] **Task 4 — CI triad**
  - [x] Prettier run — test file reformatted, orchestrator unchanged
  - [x] `npx tsc --noEmit` — 0 errors
  - [x] `npx eslint` — 0 errors
  - [x] 27 passed, 0 failed

- [x] **Task 5 — Update story status**

## Dev Notes

### Architecture decisions in effect

- **AD-1**: `@anthropic-ai/sdk` is blocked outside `lib/ai/` by ESLint guard. `crmService.ts` must NOT import it. All CRM writes go through `toolRunner.ts` → service functions.
- **AD-2**: Every query in service functions uses `.eq('owner_id', ownerId)`. Do not add any query that bypasses this.
- **AD-5**: Do NOT change `CRM_STUB_TOOLS` or `DI_TOOLS` ordering. Tool list is alphabetically sorted and must remain cache-stable. The DEAL LIFECYCLE PROTOCOL is a system prompt addition only — no new tools are added.
- **AD-11**: `crmService.ts` starts with `import 'server-only'` at line 1. Do not remove or reorder this import.
- **AD-13**: `crmService.ts` uses `createServerClient()`. Do not change to `createServiceClient()`.
- **AD-14**: The `activity_log` table is append-only — INSERT only, never UPDATE or DELETE. `updateDeal` already handles this correctly.

### Critical: `predicted_outcome` is an intelligence field — do NOT add to `UpdateDealInput`

`predicted_outcome` and `prediction_reason` are managed exclusively by `updateIntelligenceFields()` in `dealIntelligenceService.ts`. They must NOT be added to `UpdateDealInput` in `crmService.ts`. The `crm_action` specialist must not attempt to write them.

This separation is by design (AD-14 provenance): intelligence writes always log `action="intelligence_fields_updated"` with `actor="ai"`. If the `crm_action` specialist were to set `predicted_outcome` via `update_deal`, the provenance would be wrong and the separation between human CRM edits and AI intelligence fields would collapse.

The AC-6 requirement to set `predicted_outcome="likely_win"` is satisfied eventually by the next DI session — the `crm_action` specialist must not attempt it synchronously.

### `stage_history` is already handled — do not re-implement

`updateDeal()` in `crmService.ts` (lines 147–159) already appends a stage history entry when `stage` is in `changedFields`. The entry format is: `{ from_stage: current.stage, to_stage: input.stage, changed_at: new Date().toISOString() }`. The `stage_history` column is `jsonb` in Postgres. No additional code is required anywhere for this behaviour.

### How `update_deal` handles human-edit protection on `actor="user"` writes

The 24h human-edit protection in `updateDeal()` (lines 123–141) only triggers when `input.actor === 'ai'`. When `actor="user"`, the protection is skipped entirely and the write proceeds unconditionally. This means: all Owner-initiated corrections and stage transitions via conversation will always write through, even if ARIA had written to the same field within the last 24 hours. This is correct per AC-3 and AC-7.

The AC-7 scenario (protectedFields surfaced conversationally) only arises when ARIA attempts an `actor="ai"` write after a recent human edit — e.g., if ARIA is trying to auto-correct a field in the same turn.

### Where to insert the DEAL LIFECYCLE PROTOCOL in orchestrator.ts

The `crm_action` system prompt is a template literal that ends with:

```
When retrieving pipeline information or answering a status query, respond concisely — no padding, no unrequested advice.
If the Owner asks only for information, answer the question and stop. Do not append strategic guidance unless explicitly asked.
${BILINGUAL_REGISTER}
```

Insert the `DEAL LIFECYCLE PROTOCOL` block **immediately before** the "When retrieving pipeline information…" paragraph. Do not remove or reorder the STUB CREATION PROTOCOL or the closing paragraphs.

### Manual UI surface constraint (AC-5)

AC-5 is an architectural constraint for future UI work: any inline field editor must call the chat API (which routes through `runAgentWithTools` → `toolRunner` → `updateDeal`/`updateClient`) rather than calling the CRM service functions directly from the client. This is already enforced by AD-1 and AD-13. No code changes are needed in this story — document it as a constraint.

### ts-node test pattern (mandatory — carry-forward from all prior stories)

- NEVER import from project `lib/` files in test files
- Inline all logic and types directly in the test file
- Add `export {}` at the very top (line 1)
- Run via `npx ts-node lib/__tests__/conversationalMaintenance26.test.ts`
- Use `import assert from 'assert'` or inline `check()` helper for assertions

Example test skeleton:

```typescript
export {}

import assert from 'assert'

// Inline types — never import from project lib/
interface UpdateDealInput {
  id: string
  actor: 'ai' | 'user'
  stage?: string
  value_estimate?: number
  // ... etc
}

interface StageHistoryEntry {
  from_stage: string
  to_stage: string
  changed_at: string
}

// --- inline test logic here ---

let passed = 0
let failed = 0

function check(label: string, fn: () => void) {
  try {
    fn()
    console.log(`  ✓ ${label}`)
    passed++
  } catch (err) {
    console.error(`  ✗ ${label}: ${err instanceof Error ? err.message : err}`)
    failed++
  }
}

// ... tests ...

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
```

### Learnings carried from Stories 2.1–2.5

1. **`import 'server-only'` at line 1** — already present in all `lib/crm/` and `lib/ai/` files; do not disturb.
2. **Prettier before CI** — run `npx prettier --write` on every touched file before the CI triad.
3. **`export {}` at top of test files** — mandatory since Story 1.11.
4. **Alphabetical sort of `CRM_STUB_TOOLS`** — no tool additions in this story; verify order is unchanged.
5. **`.single()` error handling** — use destructuring `{ data: x }` without checking `error` when a missing row is a safe-fail-open scenario (same pattern as `updateDeal` lines 134–141).
6. **No-op guard** — `updateDeal` and `updateClient` already return `{ updated: false }` on no change. Callers (toolRunner) pass the result through to Claude. ARIA should not log a lifecycle event when `updated: false` is returned.
7. **`stage` value casing** — the AC uses "Won" capitalized, but existing `stage` values in the codebase are lowercase ("prospect", "qualified", "proposal"). Use lowercase `"won"` and `"lost"` to match the existing enum. Verify the `update_deal` tool schema's `stage` description: "Deal stage — e.g. prospect, qualified, proposal, negotiation, won, lost" (already lowercase).

### Files to create / modify

**New files:**
- `lib/__tests__/conversationalMaintenance26.test.ts`

**Modified files:**
- `lib/ai/orchestrator.ts` — add DEAL LIFECYCLE PROTOCOL to `crm_action` specialist prompt
- `package.json` — add `test:conversational-maintenance26` script

**Verify only (no change expected):**
- `lib/crm/crmService.ts` — `stage_history` append and human-edit protection already correct
- `lib/ai/crmTools.ts` — no new tools; alphabetical order unchanged
- `lib/ai/toolRunner.ts` — no new dispatch cases
- `lib/crm/stubLifecycleService.ts` — untouched
- `lib/crm/dealIntelligenceService.ts` — untouched

**Unchanged:**
- All Supabase migration files — no schema changes
- `lib/crm/activityLogService.ts` — no changes needed
- `app/api/chat/route.ts` — no changes needed

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
| 2026-06-29 | Story file created — gap analysis identified 3 gaps: (1) crm_action specialist prompt missing DEAL LIFECYCLE PROTOCOL for stage transitions, field corrections, and deal close; (2) AC-6 clarification that predicted_outcome must NOT be written via update_deal; (3) missing test file; all addressed with minimal targeted changes to orchestrator.ts system prompt and a new test file |
