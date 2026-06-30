---
story_id: "3.1"
epic: 3
title: "Document Data Layer — Status, Lifecycle, and Versioning"
status: done
baseline_commit: c2855fabe226c0b0484168c305babb7378c450dd
---

# Story 3.1 — Document Data Layer, Status Lifecycle, and Versioning

## Story

As an Owner, I want every document I create to be persisted with a full version history and a clear status lifecycle, so that I always have a traceable, recoverable record of every draft and its current state.

---

## What Already Exists (Do NOT Re-Implement)

Everything below was delivered in Epics 0–2 and must be treated as immutable foundation.

### Database & RLS (Epics 0.2–0.3)
- `clients`, `deals`, `activity_log`, `briefings`, `settings` tables all exist with `owner_id uuid NOT NULL` FK → `auth.users` and full RLS policies.
- `supabase/migrations/` contains numbered up-only SQL migration files; all schema changes go there.
- The `documents` table was referenced in addendum.md §B.3 but **the migration for it has NOT been created yet** — this story creates it.

### Supabase Client Factories (Story 0.6)
- `lib/supabase/server.ts` exports `createServerClient()` — used in all owner-data request handlers.
- `lib/supabase/service.ts` exports `createServiceClient()` — reserved for system/scheduler paths only (AD-13).

### Activity Log (Stories 2.1, 2.5)
- `lib/crm/activityLogService.ts` exports `logActivity(ownerId, { entity_type, entity_id, action, actor, payload })` — append-only (AD-14).
- Activity log rows are never updated or deleted; no `logActivity` call is made for no-op writes.

### CRM Service Patterns (Stories 2.2–2.6)
- `lib/crm/crmService.ts`: `updateDeal`, `updateClient`, `listDeals` — compare-before-write idempotency, human-edit 24h protection, `import 'server-only'` at line 1.
- `lib/crm/dealIntelligenceService.ts`: `getDeal`, `getClient`, `findSimilarDeals`, `updateIntelligenceFields`, `getActivityLog` — same conventions.
- All service files start with `import 'server-only'` (AD-11).

### What the `documents` Table Column List Is (addendum.md §B.3)
The addendum specifies: `id, owner_id, deal_id (FK nullable), client_id (FK nullable), type (enum proposal|contract|brief|sop|report|invoice|onboarding|other), title, status (enum draft|review|sent|signed|archived), content_md (text), file_url (text — Storage path to PDF), version (int), created_by (enum ai|human), created_at, updated_at`.

---

## Gap Analysis — What Story 3.1 Adds

Story 3.1 is a **data layer story**. It adds the Postgres schema, RLS policy, a service module, and CRM tool wiring for the `documents` table. No UI is delivered (that is Story 3.2–3.3).

### Gap 1 — No `documents` table migration
The `documents` table exists in the addendum schema spec but has no migration file in `supabase/migrations/`. This story adds the numbered migration with:
- All columns from addendum §B.3.
- `owner_id uuid NOT NULL REFERENCES auth.users(id)` with an index.
- RLS enabled; SELECT/INSERT/UPDATE/DELETE policies filtering by `owner_id = auth.uid()`.
- Appropriate Postgres ENUMs or CHECK constraints for `type`, `status`, and `created_by`.

### Gap 2 — No versioning insert rule
The epics spec defines **append-only versioning**: every `content_md` modification creates a **new row** (not an UPDATE to the existing row) with `version = previous_version + 1`. No Postgres trigger or service function implements this yet.

### Gap 3 — No `documentService.ts`
No service file exists at `lib/crm/documentService.ts`. This story creates it with:
- `createDocument(ownerId, input)` — inserts a new `documents` row at `version=1`, `status=draft`.
- `saveDocumentVersion(ownerId, input)` — inserts a new version row (version N+1) from the current version, with updated `content_md` and `created_by`.
- `updateDocumentStatus(ownerId, input)` — updates the `status` column on the current version row and appends an activity log entry.
- `getDocument(ownerId, params)` — fetches a document (by `id`) filtered by `owner_id`.
- `listDocumentVersions(ownerId, documentGroupId)` — lists all rows sharing the same logical document (same original `id` chain — see Task 3 for versioning ID strategy).
- `listDocuments(ownerId, params)` — lists latest-version documents for the owner, optionally filtered by `deal_id`, `client_id`, or `status`.

### Gap 4 — No document tool surface for the orchestrator
The addendum §C lists `get_document(id | deal+type)` and `create_document(deal_id, type, context)` as orchestrator tools. No tool definitions or toolRunner dispatch exist yet. This story adds stub tool definitions for both (concrete implementation wires them in Story 3.2).

### Gap 5 — No story-specific test file
Per project convention, each story ships a `lib/__tests__/<slug>.test.ts` file with a `test:<slug>` npm script.

---

## Acceptance Criteria

| # | Scenario | Criterion |
|---|----------|-----------|
| AC1 | `documents` table schema | Given the Epic 3 migration is applied (`supabase db reset`), then the `documents` table exists with columns: `id` (uuid PK), `owner_id` (uuid NOT NULL FK → auth.users), `deal_id` (uuid FK nullable), `client_id` (uuid FK nullable), `type` (CHECK or enum: proposal|contract|brief|sop|report|invoice|onboarding|other), `title` (text NOT NULL), `status` (CHECK or enum: draft|review|sent|signed|archived, NOT NULL default 'draft'), `content_md` (text), `file_url` (text nullable), `version` (int NOT NULL default 1), `created_by` (CHECK or enum: ai|human, NOT NULL), `created_at` (timestamptz NOT NULL default now()), `updated_at` (timestamptz NOT NULL default now()); and an index on `owner_id`. (FR-20, addendum §B.3, AD-2) |
| AC2 | RLS — owner isolation | Given RLS is enabled on `documents`, when a query runs with an authenticated owner's session, then only rows where `owner_id = auth.uid()` are returned or affected; unauthenticated and cross-owner access returns zero rows. SELECT/INSERT/UPDATE/DELETE policies all enforce this filter. (AD-2, AD-13) |
| AC3 | `createDocument` persists at version 1 | Given `createDocument(ownerId, { deal_id, client_id, type, content_md, created_by })` is called, then a row is inserted with `status='draft'`, `version=1`, `title` formatted as `{ClientName}_{DocumentType}_{YYYY-MM-DD}_v1` (or a placeholder when client name is unavailable), and an `activity_log` entry is written with `entity_type='document'`, `action='document_created'`, `actor` matching `created_by`, `owner_id`. (FR-20, AD-14) |
| AC4 | `saveDocumentVersion` creates a new row, not an UPDATE | Given a document exists at version N, when `saveDocumentVersion(ownerId, { source_id, content_md, created_by })` is called, then a **new row** is inserted with `version = N+1`, all other fields copied forward from the source row, the source row remains unchanged, the new row's `title` suffix is updated to `_v{N+1}`, and an `activity_log` entry is written with `action='document_edited'`. (FR-20, addendum §B.3 versioning rule, AD-14) |
| AC5 | `updateDocumentStatus` transitions and logs | Given a document row exists with `status='draft'`, when `updateDocumentStatus(ownerId, { id, status: 'sent', actor })` is called, then the `status` column on that row is updated to 'sent', an `activity_log` entry is written with `entity_type='document'`, `action='status_changed'`, `actor`, `payload={ from_status: 'draft', to_status: 'sent' }`. When the new status equals the current status (no-op), no DB write and no activity log entry are produced. (FR-20, AD-14) |
| AC6 | `updateDocumentStatus` includes `sent_at` in payload | Given `status` is updated to `'sent'`, when the activity log entry is written, then `payload.sent_at` contains the ISO timestamp of the status change and `actor` reflects who triggered the change. (FR-20, AD-14) |
| AC7 | `getDocument` is owner-scoped | Given `getDocument(ownerId, { id })` is called, then only the document row matching both `id` and `owner_id` is returned; a call with a mismatched `ownerId` returns `null` — no cross-owner data is reachable. (AD-2) |
| AC8 | `listDocuments` filters by deal/client/status | Given documents linked to multiple deals and owners, when `listDocuments(ownerId, { deal_id })` is called, then only documents with matching `deal_id` AND `owner_id` are returned; filtering by `status` and `client_id` works equivalently. (AD-2, FR-20) |
| AC9 | Title naming convention | Given any `createDocument` or `saveDocumentVersion` call, when the document is saved, then its `title` follows the pattern `{ClientName}_{DocumentType}_{YYYY-MM-DD}_v{N}` where `YYYY-MM-DD` is the `created_at` date of that version row and `N` is the integer version number — e.g. `PhuLong_Proposal_2026-06-25_v1`. (FR-20) |
| AC10 | Stub document tool definitions exist | Given `lib/ai/documentTools.ts` is created, then it exports a `DOCUMENT_TOOLS` array containing at minimum `get_document` and `create_document` tool definitions with correct JSON Schema shapes; the array is alphabetically sorted by `name` (AD-5). |

---

## Tasks / Subtasks

### Task 1 — Create `documents` table migration
**File:** `supabase/migrations/<next_number>_documents_table.sql`

Determine the next migration number by inspecting existing files in `supabase/migrations/` (use the next sequential number). Create the migration with:

```sql
-- Enable required extensions if not already enabled
-- (uuid-ossp is already enabled by prior migrations)

CREATE TABLE IF NOT EXISTS documents (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  deal_id       uuid REFERENCES deals(id) ON DELETE SET NULL,
  client_id     uuid REFERENCES clients(id) ON DELETE SET NULL,
  type          text NOT NULL CHECK (type IN ('proposal','contract','brief','sop','report','invoice','onboarding','other')),
  title         text NOT NULL,
  status        text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','review','sent','signed','archived')),
  content_md    text,
  file_url      text,
  version       integer NOT NULL DEFAULT 1,
  created_by    text NOT NULL CHECK (created_by IN ('ai','human')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS documents_owner_id_idx ON documents(owner_id);
CREATE INDEX IF NOT EXISTS documents_deal_id_idx ON documents(deal_id);
CREATE INDEX IF NOT EXISTS documents_client_id_idx ON documents(client_id);

-- Row Level Security
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_select" ON documents FOR SELECT USING (owner_id = auth.uid());
CREATE POLICY "owner_insert" ON documents FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "owner_update" ON documents FOR UPDATE USING (owner_id = auth.uid());
CREATE POLICY "owner_delete" ON documents FOR DELETE USING (owner_id = auth.uid());
```

Verify `supabase db reset` applies cleanly with no errors after adding this file.

### Task 2 — Create `lib/crm/documentService.ts`
**File:** `lib/crm/documentService.ts`

Line 1 must be `import 'server-only'` (AD-11). Import `createServerClient` from `@/lib/supabase/server` and `logActivity` from `@/lib/crm/activityLogService`.

**Types to define:**

```typescript
export type DocumentType = 'proposal' | 'contract' | 'brief' | 'sop' | 'report' | 'invoice' | 'onboarding' | 'other'
export type DocumentStatus = 'draft' | 'review' | 'sent' | 'signed' | 'archived'
export type DocumentCreatedBy = 'ai' | 'human'

export interface DocumentRow {
  id: string
  owner_id: string
  deal_id: string | null
  client_id: string | null
  type: DocumentType
  title: string
  status: DocumentStatus
  content_md: string | null
  file_url: string | null
  version: number
  created_by: DocumentCreatedBy
  created_at: string
  updated_at: string
}

export interface CreateDocumentInput {
  deal_id?: string
  client_id?: string
  type: DocumentType
  content_md: string
  created_by: DocumentCreatedBy
  client_name?: string   // used to build the title
}

export interface SaveDocumentVersionInput {
  source_id: string        // id of the current (latest) version row to copy forward
  content_md: string
  created_by: DocumentCreatedBy
}

export interface UpdateDocumentStatusInput {
  id: string               // id of the document row to update
  status: DocumentStatus
  actor: 'ai' | 'user'
}

export interface ListDocumentsParams {
  deal_id?: string
  client_id?: string
  status?: DocumentStatus
  limit?: number
}
```

**Function: `buildDocumentTitle(clientName: string | undefined, type: DocumentType, version: number, date: string): string`**

Helper (not exported) that returns `{ClientName}_{DocumentType}_{YYYY-MM-DD}_v{N}`. If `clientName` is undefined/empty, use `"Unknown"`. Capitalize the type for readability (e.g. `'proposal'` → `'Proposal'`). `date` is an ISO date string (`YYYY-MM-DD`).

**Function: `createDocument(ownerId: string, input: CreateDocumentInput): Promise<DocumentRow>`**

1. Get today's date as `YYYY-MM-DD` (server-side `new Date().toISOString().split('T')[0]`).
2. Build `title` using `buildDocumentTitle`.
3. Insert into `documents` with `status='draft'`, `version=1`, and `owner_id`.
4. Append activity log: `entity_type='document'`, `action='document_created'`, `actor` = `input.created_by === 'ai' ? 'ai' : 'user'`, `payload={ type, title }`.
5. Return the inserted row (use `.select().single()` after insert).

**Function: `saveDocumentVersion(ownerId: string, input: SaveDocumentVersionInput): Promise<DocumentRow>`**

1. Fetch the source row by `id` AND `owner_id` (owner guard: if not found, throw).
2. Compute `newVersion = sourceRow.version + 1`.
3. Get today's date string.
4. Build new `title` with `buildDocumentTitle` using the same `client_name` extracted from the source title (parse `{ClientName}_` prefix), or fallback to the source `client_id`.
5. Insert a **new row** copying all fields from the source row, overriding: `id` (new uuid via `gen_random_uuid()` — handled by Supabase default), `content_md`, `created_by`, `version`, `title`, `created_at = now()`, `updated_at = now()`. **Do NOT update the source row.**
6. Append activity log: `action='document_edited'`, `actor` = `input.created_by === 'ai' ? 'ai' : 'user'`, `payload={ previous_version: sourceRow.version, new_version: newVersion }`.
7. Return the inserted row.

Note on versioning ID strategy: each version is a distinct row with its own `id`. The "document group" is identified by following the version chain (each version inserts fresh; callers track the latest `id` for a given document group by querying for max `version` per logical document). Keep it simple: `listDocumentVersions` queries by `deal_id` + `type` + `created_by` lineage, or a caller passes a known `id` sequence. Do not add a `group_id` column — keep the schema exactly as per addendum.md §B.3.

**Function: `updateDocumentStatus(ownerId: string, input: UpdateDocumentStatusInput): Promise<{ updated: boolean }>`**

1. Fetch the current `status` of the document row (filtered by `id` AND `owner_id`).
2. If not found, throw.
3. If `current.status === input.status`, return `{ updated: false }` — no write, no log (AD-14 no-op rule).
4. Update `status` and `updated_at` on the row.
5. Build `payload`: `{ from_status: current.status, to_status: input.status }`. If `input.status === 'sent'`, add `payload.sent_at = new Date().toISOString()`.
6. Append activity log: `entity_type='document'`, `action='status_changed'`, `actor=input.actor`, `payload`.
7. Return `{ updated: true }`.

**Function: `getDocument(ownerId: string, params: { id: string }): Promise<DocumentRow | null>`**

Query `documents` with `.eq('id', params.id).eq('owner_id', ownerId).single()`. Return `null` on not-found (do not throw for missing rows).

**Function: `listDocuments(ownerId: string, params: ListDocumentsParams): Promise<DocumentRow[]>`**

Build a Supabase query on `documents` filtered by `owner_id`. Apply optional filters for `deal_id`, `client_id`, `status`. Order by `created_at DESC`. Limit to `Math.min(params.limit ?? 20, 100)`.

**Function: `listDocumentVersions(ownerId: string, documentId: string): Promise<DocumentRow[]>`**

Fetch the target document row. Then query all documents with the same `deal_id` + `type` + `owner_id`, ordered by `version ASC`. This returns the version history chain. If `deal_id` is null, scope the query to `client_id` + `type` instead.

### Task 3 — Create `lib/ai/documentTools.ts`
**File:** `lib/ai/documentTools.ts`

Line 1 must be `import 'server-only'` (AD-11).

Export a `DOCUMENT_TOOLS` constant typed as `readonly Anthropic.Tool[]`. Define the following two tools (alphabetically sorted — AD-5):

```typescript
{
  name: 'create_document',
  description: 'Create a new document draft for a deal or client. Called after outline approval. Returns the new document id and title.',
  input_schema: {
    type: 'object',
    properties: {
      deal_id:    { type: 'string', description: 'ID of the linked deal (optional)' },
      client_id:  { type: 'string', description: 'ID of the linked client (optional)' },
      type:       { type: 'string', description: 'Document type: proposal|contract|brief|sop|report|invoice|onboarding|other' },
      content_md: { type: 'string', description: 'Full document content in Markdown' },
      client_name: { type: 'string', description: 'Client name for the document title (optional)' }
    },
    required: ['type', 'content_md']
  }
},
{
  name: 'get_document',
  description: 'Fetch a document by id. Returns the full document row including content_md, status, and version.',
  input_schema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Document row id' }
    },
    required: ['id']
  }
}
```

Use `import Anthropic from '@anthropic-ai/sdk'` — this file is inside `lib/ai/` so AD-1 is satisfied.

### Task 4 — Wire document tools into `lib/ai/toolRunner.ts`
**File:** `lib/ai/toolRunner.ts`

Add dispatch cases for `create_document` and `get_document`:

- `create_document`: call `createDocument(ownerId, { deal_id: input.deal_id, client_id: input.client_id, type: input.type, content_md: input.content_md, created_by: 'ai', client_name: input.client_name })`. Return `{ id: result.id, title: result.title, status: result.status, version: result.version }`.
- `get_document`: call `getDocument(ownerId, { id: input.id })`. Return the full `DocumentRow` (or `{ error: 'Document not found' }` when null).

Import `createDocument` and `getDocument` from `@/lib/crm/documentService`.

Do not register `DOCUMENT_TOOLS` in any specialist yet — that happens in Story 3.2 (elicitation flow). This task only adds the dispatch so the service is reachable.

### Task 5 — Create story-specific test file
**File:** `lib/__tests__/documentDataLayer31.test.ts`

Follow the ts-node test pattern: `export {}` at top; no project `lib/` imports; all types and logic inlined.

Tests must cover (minimum 10 tests, 25 assertions):

1. `buildDocumentTitle` returns `{ClientName}_Proposal_{YYYY-MM-DD}_v1` for a standard input.
2. `buildDocumentTitle` uses `"Unknown"` when `clientName` is undefined.
3. `buildDocumentTitle` increments version correctly — `_v3` for version 3.
4. `DocumentType` union exhaustiveness — all 8 values are accepted (test via a type-check helper or an assertion that the valid set is exact).
5. `DocumentStatus` union — all 5 values (`draft|review|sent|signed|archived`) are accepted.
6. `createDocument` inserts a row and returns a `DocumentRow` with `version=1`, `status='draft'`.
7. `createDocument` builds the correct title pattern matching `{ClientName}_{Type}_{Date}_v1`.
8. `saveDocumentVersion` creates a new row (not an UPDATE); source row version remains unchanged; new row has `version = source.version + 1`.
9. `saveDocumentVersion` with an invalid/missing `source_id` for the given owner throws an error (owner isolation guard).
10. `updateDocumentStatus` no-op: when `status` equals current, returns `{ updated: false }` with no DB write and no activity log entry.
11. `updateDocumentStatus` transition: when status changes, returns `{ updated: true }`; activity log entry has `action='status_changed'` and `payload.from_status`/`payload.to_status`.
12. `updateDocumentStatus` sets `payload.sent_at` when transitioning to `'sent'`.
13. `getDocument` returns `null` for a document belonging to a different `ownerId` (cross-owner isolation).
14. `listDocuments` filters by `deal_id` and returns only matching owner rows.
15. `DOCUMENT_TOOLS` is alphabetically sorted by `name` — `create_document` before `get_document` (AD-5).

Use the same assert/throw pattern as prior stories:
```typescript
function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`FAIL: ${message}`)
  console.log(`  PASS: ${message}`)
}
```

For service function tests that require a real Supabase client, use the mock-stub pattern from earlier stories: create minimal in-memory mock objects that satisfy the query builder interface, rather than hitting the real DB.

### Task 6 — Add npm test script
**File:** `package.json`

Add to the `"scripts"` section:
```json
"test:document-data-layer31": "npx ts-node lib/__tests__/documentDataLayer31.test.ts"
```

### Task 7 — CI triad
- `npx tsc --noEmit` — 0 errors.
- `npx eslint lib/crm/documentService.ts lib/ai/documentTools.ts lib/ai/toolRunner.ts` — 0 errors.
- `npm run test:document-data-layer31` — all assertions pass.

### Task 8 — Update story and sprint status
- Set this story's `status` frontmatter to `done`.
- Update `sprint-status.yaml`: `3-1-document-data-layer-status-lifecycle-and-versioning: done`, `epic-3: in-progress`.
- Update `last_updated`.

---

## Dev Notes

### Architecture Constraints

- **AD-1**: `@anthropic-ai/sdk` must not be imported outside `lib/ai/`. `documentTools.ts` is inside `lib/ai/` — SDK import is allowed there. `documentService.ts` is inside `lib/crm/` — do not import the SDK there.
- **AD-2**: All Supabase queries must include `.eq('owner_id', ownerId)` — never query `documents` without the owner scope. The migration's RLS policies are the DB-level guard; the service code adds an application-level guard as defence in depth.
- **AD-5**: `DOCUMENT_TOOLS` must be alphabetically sorted by `name`. `create_document` sorts before `get_document`. Do not break this order.
- **AD-11**: `lib/crm/documentService.ts` and `lib/ai/documentTools.ts` must both have `import 'server-only'` at line 1.
- **AD-13**: Only `createServerClient()` in service functions — never `createServiceClient()` on owner-data paths. The `documents` table is owner-data.
- **AD-14**: Activity log is append-only. `updateDocumentStatus` must not write a log entry on a no-op. `saveDocumentVersion` inserts a **new row** — it does not UPDATE the source row. The source row must remain byte-for-byte unchanged after a `saveDocumentVersion` call.

### Versioning Strategy — New Row, Not UPDATE

The append-only versioning rule (from the epics spec) means:
- `createDocument` → inserts row with `version=1`.
- `saveDocumentVersion` → inserts a NEW row with `version = source.version + 1`. The previous row is immutable.
- `updateDocumentStatus` → the one exception: status is mutated in-place on the current version row. This is intentional — status is not versioned content.
- **No** Postgres trigger is needed; the service function enforces this.

### Title Naming Convention
The required pattern from FR-20 is: `{ClientName}_{DocumentType}_{YYYY-MM-DD}_v{N}`.
- `ClientName`: from `input.client_name` (passed in from the caller who fetched the client record). Sanitize to remove spaces (replace with empty string or use camelCase — keep consistent). Example: `"Phu Long"` → `"PhuLong"`.
- `DocumentType`: capitalize the first letter of the type enum value. Example: `'proposal'` → `'Proposal'`.
- `YYYY-MM-DD`: the `created_at` date of that specific version row (not the current date at query time).
- `N`: the integer `version` number of that row.

### `saveDocumentVersion` — Copying Fields Forward
When inserting the new version row, copy all fields from the source row EXCEPT `id`, `version`, `title`, `content_md`, `created_by`, `created_at`, `updated_at` (these are set fresh). The `owner_id`, `deal_id`, `client_id`, `type`, `status`, and `file_url` carry forward from the source row unchanged.

### ts-node Test Pattern
```typescript
export {}; // must be first line — marks file as a module

// Inline all types — do NOT import from project lib/
type DocumentType = 'proposal' | 'contract' | 'brief' | 'sop' | 'report' | 'invoice' | 'onboarding' | 'other'
type DocumentStatus = 'draft' | 'review' | 'sent' | 'signed' | 'archived'

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`FAIL: ${message}`)
  console.log(`  PASS: ${message}`)
}
```

For service function tests, use lightweight mock Supabase clients following the patterns in `lib/__tests__/crmService22.test.ts` and `lib/__tests__/intelligenceFields25.test.ts`.

### `activityLogService.ts` Pattern
`logActivity` signature (from Story 2.1):
```typescript
logActivity(ownerId: string, entry: {
  entity_type: 'client' | 'deal' | 'document'
  entity_id: string
  action: string
  actor: 'ai' | 'user'
  payload: Record<string, unknown>
}): Promise<void>
```
This story introduces `entity_type: 'document'` for the first time. Confirm the `entity_type` column CHECK constraint in `activity_log` allows `'document'` — if the migration from Story 2.1 only allows `'client' | 'deal'`, add a migration to extend the constraint.

### Key Learnings From Prior Stories
- **Story 2.5 (intelligence fields)**: Always do compare-before-write before calling `logActivity`. Never write and log a no-op.
- **Story 2.2 (CRM service)**: Use `.select().single()` after an insert to get the full returned row — Supabase returns the inserted row when `.select()` is chained.
- **Story 0.8 (privacy)**: `documents` rows are Owner-deletable. The `ON DELETE CASCADE` from `owner_id → auth.users` in the migration satisfies the cascading delete requirement. Individual document rows can also be deleted by the owner (RLS DELETE policy is included in Task 1).
- **Story 2.1 (activity log)**: The `activity_log` table's `entity_type` column was originally seeded with `client | deal`. Check and extend it for `document` if needed — do this in the same migration as the `documents` table (Task 1) rather than a separate migration to minimize migration count.
- **AD-5 tool ordering**: Every tools array in this project is alphabetically sorted. `DOCUMENT_TOOLS` must follow the same invariant. Verify alphabetical order before committing.

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
