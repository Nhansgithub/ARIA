---
story: 3-6
title: Inline Document Edit and Conversational Re-Generation
status: done
epic: 3
sprint: 1
---

# Story 3-6: Inline Document Edit and Conversational Re-Generation

## Summary

Adds conversational document revision: ARIA identifies "revise this document" intent (distinct from "create new document"), fetches the current content via `get_document`, applies a targeted Sonnet edit, and saves a new version row (`created_by=ai`, `version=N+1`) with an activity log entry (`action=document_revised`). Also adds a confirmation guard in the DocumentViewer when the Owner tries to enter Edit mode on a sent/signed/archived document.

## Scope

- **Document revision via chat** — new `document_revision` intent bucket + specialist prompt + `save_document_revision` tool
- **Edit confirmation for locked statuses** — DocumentViewer shows a bilingual confirmation before entering edit mode when status is `sent`, `signed`, or `archived`
- **Degradation** — if AI is unavailable, ARIA returns a degraded message pointing the Owner to use the viewer's Edit mode directly

## Files Created / Modified

- `lib/crm/documentService.ts` — add `saveDocumentRevision()` function
- `lib/ai/documentTools.ts` — add `save_document_revision` tool definition
- `lib/ai/documentRevisionTools.ts` — NEW: `DOCUMENT_REVISION_TOOLS` array (get_document + save_document_revision, alphabetically sorted)
- `lib/ai/orchestrator.ts` — add `document_revision` to IntentBucket + classifier prompt + specialist prompt + INTENT_MODEL_MAP entry
- `lib/ai/toolRunner.ts` — add `save_document_revision` handler
- `app/api/chat/route.ts` — add routing for `document_revision` intent
- `components/documents/DocumentViewer.tsx` — add `editConfirm` state + confirmation UI for sent/signed/archived edits
- `lib/__tests__/inlineDocumentEdit36.test.ts` — NEW: ts-node inline tests
- `package.json` — add `test:inline-doc-edit36` script

## Architecture Decisions

- **AD-2**: All Supabase queries include `.eq('owner_id', ownerId)`
- **AD-4**: Document revision uses Sonnet (same tier as initial drafting)
- **AD-11**: `import 'server-only'` at line 1 of `documentRevisionTools` NOT needed (pure data); service functions must have it
- **AD-13**: `createServerClient()` only — no service role
- **AD-14**: Revision creates a new row (version=N+1); source row is never mutated; activity log is append-only with `action='document_revised'`
- **Story 3.2 gate bypass**: Revision path skips elicitation→outline→approval — goes directly to Sonnet edit call
- **Human edits win**: ARIA's revision always reads the latest version (including any human edits from Story 3.3 autosave)

## Acceptance Criteria

See epics.md Story 3.6 for full BDD specs.

Key scenarios:
1. Conversational revision detected → `get_document` → Sonnet edit → `save_document_revision` → new version row → brief change summary in chat
2. Direct viewer edit (Story 3.3 autosave) → `created_by=human` — unchanged behaviour
3. Edit on sent/signed/archived → confirmation prompt before entering Edit mode
4. AI unavailable → degraded message pointing Owner to Edit mode
