---
story: 4-4
title: Briefing Structure, Detection Logic & Ranking
status: done
epic: 4
sprint: 1
baseline_commit: c2efd6a
---

# Story 4-4: Briefing Structure, Detection Logic & Ranking

## Summary

Adds fixed 5-section briefing structure, "Today" ranking engine, missing-document detection
integration, slow-moving deal computation, and structured `flags` JSONB payload to the existing
briefing generation service.

## Scope

- **FR-26**: Fixed 5-section output: Today (max 3 ranked), Pipeline Snapshot, Documents Pending,
  This Week's Focus, Slow-Moving Deals — no section omitted even when empty
- **FR-26 (Today ranking)**: overdue → due-today → cadence reminder → high-priority stale;
  within tier: priority (high > medium > low), tie-break value_estimate DESC; max 3
- **FR-22 (Missing docs)**: reuse `detectMissingDocumentsByStage` pure function from
  `lib/crm/missingDocumentService.ts` — single implementation shared with Epic 3
- **FR-26 (Slow-Moving Deals)**: compute days-stale = today − stale_since; show per deal
- **FR-26 (Pipeline Snapshot)**: prose sentence — active deal count, total estimated value,
  stage distribution
- **FR-26 (This Week's Focus)**: one strategic cross-deal note in same Haiku AI call (AD-4)
- **Flags payload**: structured `BriefingFlag[]` with type/deal_id/severity/label — count of
  severity:high drives unread badge (FR-38)

## Files Created / Modified

- `lib/crm/missingDocumentService.ts` — ADD `detectMissingDocumentsByStage` pure function
- `lib/crm/briefingService.ts` — MODIFY: new prompt, ranking logic, structured flags, doc query
- `lib/__tests__/briefingStructure44.test.ts` — NEW: inline ts-node tests
- `package.json` — add `test:briefing-structure44` + CI chain

## Architecture Decisions

- **AD-4**: Same Haiku call (economical) — all 5 sections produced in one AI call
- **AD-5**: System prompt stable → cache breakpoint; volatile context per-run
- **AD-11**: `import 'server-only'` at line 1 of all lib files
- **AD-2**: All DB queries include `.eq('owner_id', ownerId)`
- **AD-13**: `createServiceClient()` for briefing cron path; existing server client in
  missingDocumentService is bypassed — use the new pure function instead
- **shared detection rule**: `detectMissingDocumentsByStage` is the canonical implementation;
  `detectMissingDocuments` (DB version) will be refactored to call it internally
- **flags format**: `{ items: BriefingFlag[], deal_count, doc_pending_count, activity_count_24h }`
  — `items` replaces legacy empty flags from Story 4.3

## Tasks/Subtasks

- [x] T1: Add `detectMissingDocumentsByStage` pure function to `missingDocumentService.ts`
- [x] T2: Update `DealRow` interface in `briefingService.ts` — add `id`, `priority`
- [x] T3: Update `DocRow` interface — add `deal_id`; update doc query accordingly
- [x] T4: Add `BriefingFlag` type and `PRIORITY_ORDER` constant
- [x] T5: Implement `getTier(deal, today)` ranking tier function
- [x] T6: Implement `rankTodayItems(deals, today)` — returns top 3 sorted
- [x] T7: Implement `computeStructuredFlags(deals, docsByDeal, today)` — all flag types
- [x] T8: Update `BRIEFING_SYSTEM_PROMPT` — strict 5-section format
- [x] T9: Update `generateBriefingForOwner` — extended queries, ranking, flags, volatile context
- [x] T10: Write `briefingStructure44.test.ts` with ≥70 tests; all pass
- [x] T11: Update `package.json` — add test script + CI chain entry

## Acceptance Criteria

1. `BRIEFING_SYSTEM_PROMPT` mandates exactly 5 sections in fixed order
2. "Today" section contains max 3 items ranked: overdue > due-today > cadence > high-stale
3. Within same tier, priority (high > medium > low) sorts first; value_estimate descending breaks ties
4. Deals with `stale_since` set appear in "Slow-Moving Deals" with days-stale count
5. Missing-doc detection calls `detectMissingDocumentsByStage` (shared function, not duplicated)
6. `detectMissingDocumentsByStage` is a pure function (no DB calls) in missingDocumentService
7. `flags` column written as `{ items: BriefingFlag[], deal_count, doc_pending_count, activity_count_24h }`
8. Each `BriefingFlag` has `type`, `deal_id`, `severity`, `label`
9. `severity: 'high'` flags: overdue actions + high-priority stale deals
10. Pipeline Snapshot section produced in same AI call — no extra AI round-trip

## Dev Agent Record

### Completion Notes

- Story 4.3 stored flags as `{ deal_count, doc_pending_count, activity_count_24h }` — Story 4.4
  replaces this with `{ items: BriefingFlag[], deal_count, doc_pending_count, activity_count_24h }`
  adding the structured items array while preserving the legacy numeric fields for observability
- `detectMissingDocumentsByStage` is a pure function (O(n) matching against STAGE_REQUIRED_DOCS)
  callable from both the server-request context (Story 3.5) and the service-client cron context
  (Story 4.4) without any DB coupling
- The doc query in `generateBriefingForOwner` now selects `deal_id` to build the `docsByDeal` map
- "Today" ranking is computed in TypeScript before the AI call; the AI receives the pre-ranked list
  so it can follow the order faithfully without needing to rank itself

### File List

- `lib/crm/missingDocumentService.ts` — MODIFIED
- `lib/crm/briefingService.ts` — MODIFIED
- `lib/__tests__/briefingStructure44.test.ts` — NEW
- `package.json` — MODIFIED

### Change Log

| Date | Change |
|------|--------|
| 2026-06-30 | Story implemented — all 5 sections, ranking, flags, shared detection |
