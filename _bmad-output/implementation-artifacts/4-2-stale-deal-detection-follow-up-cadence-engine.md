---
story: 4-2
title: Stale-Deal Detection & Follow-Up Cadence Engine
status: done
epic: 4
sprint: 1
---

# Story 4-2: Stale-Deal Detection & Follow-Up Cadence Engine

## Summary

Adds `lib/crm/staleDealService.ts` — a server-only engine that scans all active deals,
marks deals stale (once, idempotently) when no activity_log entry exists for >=7 calendar days,
and applies a proposal follow-up cadence (first reminder at 3 days, second at 7 days).
Cadence resets automatically when the Owner logs user activity on the deal.
Configurable thresholds read from the settings table (default 3/7/7 days).
Empty CRM guard: no writes if zero active deals.

## Scope

- **FR-16**: `stale_since` set idempotently on first cross of 7-day threshold; never overwritten
- **FR-17**: Proposal-stage cadence: step 1 at ≥3 days idle, step 2 at ≥7 days idle
- **FR-18**: Cadence resets when last activity is `actor: 'user'` within the firstFollowUpDays window
- **FR-19**: Activity log: `actor: 'ai'`, `action: 'stale_detected'` | `'follow_up_cadence_flagged'`
- **FR-20**: Empty CRM guard — no writes if zero active (non-closed, non-stub) deals
- **FR-21**: Configurable intervals via `settings.cadence_config` (defaults: stale=7, first=3, second=7)

## Files Created / Modified

- `lib/crm/staleDealService.ts` — NEW: detection + cadence engine (server-only)
- `lib/__tests__/staleDealDetection42.test.ts` — NEW: inline ts-node tests
- `package.json` — add `test:stale-deal42` script + CI chain entry

## Architecture Decisions

- **AD-11**: `import 'server-only'` at line 1
- **AD-13**: `createServerClient()` only — never `createServiceClient()`
- **AD-14**: `stale_since` is append-only from AI perspective — set once, `.is('stale_since', null)` guard ensures idempotency; activity_log is INSERT-only
- **AD-2**: Every Supabase query includes `.eq('owner_id', ownerId)`
- **Closed stage filter**: Deals with stage containing 'won', 'lost', 'archived', 'completed', 'signed' are skipped
- **Proposal stage match**: Keyword-based (proposal, đề xuất, sent quote, quote sent) — never rejected as invalid
- **Fire-and-forget logActivity**: Activity log failures must not roll back a successful deal update — `.catch(console.warn)` pattern
- **Cadence message marker**: Cadence-set next_action starts with 'Nhắc lần' for reliable reset detection

## Acceptance Criteria

1. `detectAndFlagStaleDeals(ownerId, config?)` exists and is exported
2. Deal with 0 active non-closed deals → returns `[]` immediately (empty CRM guard)
3. Deal idle ≥7 days and `stale_since = null` → `stale_since` set to last-activity date; `stale_detected` logged
4. Deal idle ≥7 days and `stale_since` already set → no write, no log (idempotent)
5. Deal at proposal stage, idle ≥3 days → cadence step 1 applied (next_action set to "Nhắc lần 1:...")
6. Deal at proposal stage, idle ≥7 days → cadence step 2 applied (next_action set to "Nhắc lần 2:...")
7. Last activity `actor: 'user'`, idle < firstFollowUpDays, next_action starts 'Nhắc lần' → cleared
8. Boundary: idle exactly 7 → stale (threshold is ≥7, not >7)
9. Boundary: idle exactly 3 → cadence step 1 (threshold is ≥3)
10. `getCadenceConfig(ownerId)` reads settings and falls back to defaults

### Review Findings

- [x] [Review][P1-rejected] `stale_since = lastActivityDateStr` vs `todayStr` — Reviewer argued `todayStr` is correct. Rejected: `stale_since` means "onset of staleness = date of last activity". Setting `todayStr` would make `days_stalled = 0` at first detection, masking actual idle duration. `lastActivityDateStr` is semantically correct.
- [x] [Review][P1-rejected] Fire-and-forget logActivity failure → cadence reset on next run — Rejected: the reset condition requires `daysIdle < firstFollowUpDays` AND `actor === 'user'`. If those conditions hold, user WAS recently active, so cadence reset is correct by spec.
- [x] [Review][P2-fixed] `await logActivity(...).catch()` is not true fire-and-forget — Removed `await` from both logActivity calls so the loop iteration is not blocked by log write.
- [x] [Review][P2-fixed] `hasChanged` embeds `daysIdle` in message string → always true → unbounded activity_log growth — Fixed: compare cadence step prefix (`startsWith('Nhắc lần 1/2')`) instead of full message with embedded day count.
- [x] [Review][P2-fixed] `StaleDealResult` missing `cadenceReset: boolean` — Added field; populated in results push.
- [x] [Review][P3-deferred] `getCadenceConfig` partial merge path not tested — deferred, merge logic is straightforward `??` fallback.
- [x] [Review][P3-verified] `saveDocumentRevision` import in toolRunner.ts — confirmed used at line 120, not dead code.
