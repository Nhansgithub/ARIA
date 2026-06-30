---
story: 3-5
title: Missing-Document Detection and Teaching
status: done
epic: 3
sprint: 1
implemented: 2026-06-29
---

# Story 3-5: Missing-Document Detection and Teaching

## Summary

Implements server-side missing-document detection: a `detectMissingDocuments(ownerId, dealId)` function that checks which document types are expected at the deal's current stage and which ones already exist in the DB, then returns a list of missing document types with static teaching rationale (Vietnamese + English). The detection is wired into the deal_intelligence specialist prompt so ARIA surfaces document gaps with a one-line rationale and offers to draft the missing document.

## Scope

**FR-22** — Missing-document detection.

Detection rules (stage keyword matching):
- Stage contains "proposal" / "đề xuất" / "sent" → expected: `proposal`
- Stage contains "contract" / "hợp đồng" / "signed" / "sow" → expected: `proposal` + `contract`
- Stage contains "brief" / "discovery confirmed" / "kickoff" → expected: `proposal` + `contract` + `brief`
- All other stages → no required documents

Suppressed for deals with `status = archived` or `likely_lost` predicted outcome.

Detection is inline (called during Deal Intelligence reads) — not a scheduled job (Epic 4 owns scheduling).

## Files Created / Modified

- `lib/crm/missingDocumentService.ts` — server-only module with stage→doc mapping, static rationale strings, and `detectMissingDocuments(ownerId, dealId)` function
- `lib/ai/orchestrator.ts` — extended `deal_intelligence` specialist prompt with MISSING DOCUMENT CHECK section in the FOUR-LAYER SYNTHESIS PROTOCOL
- `lib/__tests__/missingDocumentDetection35.test.ts` — ts-node inline tests (T1–T10)
- `package.json` — added `test:missing-doc-detection35` script

## Architecture Decisions Honoured

- AD-2: All queries include `.eq('owner_id', ownerId)`
- AD-11: `import 'server-only'` at line 1 of `missingDocumentService.ts`
- AD-13: `createServerClient()` used exclusively — no service role
- AD-14: Read-only detection — no writes, no flags table, returns computed flags inline

## Acceptance Criteria

**Given** detection runs for a deal at the "proposal" stage with no proposal document,
**When** `detectMissingDocuments` is called,
**Then** it returns a flag for `proposal` with the Vietnamese + English teaching rationale.

**Given** a deal already has a proposal document (any non-archived status),
**When** detection runs,
**Then** no flag is generated for `proposal` — idempotent.

**Given** a deal with `status = archived` or predicted outcome `likely_lost`,
**When** detection runs,
**Then** no flags are returned.

**Given** Deal Intelligence is triggered for a deal with missing documents,
**When** ARIA composes the synthesis,
**Then** ARIA surfaces each missing document as a one-line gap with teaching rationale and offers to draft it.

## CI Results

- `npx tsc --noEmit` — clean
- `npx next lint` — clean (pre-existing `<img>` warnings in unrelated files only)
- `npm run test:missing-doc-detection35` — 32/32 passed
