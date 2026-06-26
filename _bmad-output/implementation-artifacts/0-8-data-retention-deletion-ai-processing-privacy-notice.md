---
baseline_commit: 33d6177989defbbe22a50ebd982a9ddb6ad82da0
---

# Story 0.8: Data Retention, Deletion & AI-Processing Privacy Notice (PDPL)

Status: ready-for-dev

## Story

As an Owner, I want a data retention/deletion capability and a clear notice of what is sent to the AI provider, so that ARIA meets Vietnam's PDPL obligations for processing my clients' personal data. *(AD-10 items are pre-LAUNCH gates, but the build lands here so they are tracked from the start.)*

## Acceptance Criteria

**AC-1: One-time AI-processing privacy notice**

**Given** the Owner first reaches a point where client PII or a screenshot would be sent to the Anthropic API (first deal description or first image upload),
**When** that boundary is first crossed,
**Then** a one-time in-product privacy notice appears stating that deal/client content and images are processed by an external AI provider (Anthropic) to deliver ARIA's analysis, with a link to a fuller policy page; the Owner must explicitly acknowledge it (click/tap "Understood" or equivalent) before the AI call proceeds; the acknowledgement is recorded in the `settings` table (`ai_processing_notice_acknowledged_at timestamptz`); the notice is shown only once per owner — never again after acknowledgement. (AD-10; PRD §9.2)

**AC-2: Owner-deletable client and deal records**

**Given** owner-scoped data and uploaded screenshots exist in Postgres + Storage,
**When** the deletion policy is applied,
**Then** every Client, Deal, Document, and screenshot is Owner-deletable; a delete of a Client cascades (via DB `ON DELETE CASCADE`) to linked Deals and their screenshots; a delete of a Deal removes the deal row and its associated Storage objects (screenshots linked via `file_url`); no orphaned Storage objects remain after any deletion. (AD-10; AD-9)

**AC-3: Deletion via conversation or Settings — activity log & Storage cleanup**

**Given** the Owner requests deletion of a client or deal via conversation ("delete the Pho 24 deal") or via Settings,
**When** the deletion executes,
**Then** the record and its linked Storage screenshot objects are removed; the activity log records the deletion event with `action="client_deleted"` or `action="deal_deleted"` and `actor=user`; no orphaned Storage objects remain after the operation. (AD-10; AD-14)

**AC-4: Supabase Storage lifecycle policy for screenshots**

**Given** uploaded screenshots are stored in owner-scoped Supabase Storage paths (format: `{owner_id}/screenshots/{filename}`),
**When** the Storage lifecycle policy is configured,
**Then** a lifecycle rule is set so that screenshots are automatically expired/deleted after a configurable retention period (default: 90 days from upload); the policy is expressed in code or configuration committed to the repository — not applied by hand only. (AD-10; AD-9; PRD §9.2 / OQ-7)

**AC-5: Pre-launch PDPL compliance gates tracked**

**Given** the PDPL pre-launch obligations (Anthropic DPA executed; Cross-Border Data Transfer Impact Assessment filed with the Ministry of Public Security; full privacy policy page published at `/privacy`),
**When** the launch checklist is reviewed,
**Then** these three items are tracked as explicit pre-launch gates (OQ-10) — a `PDPL-LAUNCH-CHECKLIST.md` file in the repository root documents them with their current status; this file is the owner's single reference for PDPL compliance readiness; nothing in OQ-10 is required for development to proceed, but all three items must be marked complete before production launch. (AD-10)

**AC-6: Settings column for notice acknowledgement**

**Given** the `settings` table already exists with one row per owner,
**When** the migration for this story is applied,
**Then** the `settings` table gains a new column: `ai_processing_notice_acknowledged_at timestamptz DEFAULT NULL`; a `NULL` value means the notice has not yet been acknowledged; a non-null value means the owner has acknowledged and stores the timestamp of acknowledgement. (AD-10)

## Tasks / Subtasks

- [ ] **Task 1: DB migration — add `ai_processing_notice_acknowledged_at` to `settings`** (AC-1, AC-6)
  - [ ] Create migration file `supabase/migrations/20260626020000_pdpl_notice_column.sql`
  - [ ] Add column: `ALTER TABLE settings ADD COLUMN ai_processing_notice_acknowledged_at timestamptz DEFAULT NULL;`
  - [ ] Run `supabase db reset` locally to confirm the migration applies cleanly from scratch with no errors
  - [ ] Confirm `npx tsc --noEmit` passes after any TypeScript type updates to the Supabase client

- [ ] **Task 2: Privacy notice gate — server-side check before every AI call that transmits PII** (AC-1)
  - [ ] Create `lib/privacy/checkPrivacyNotice.ts` (server-only module with `import 'server-only'`)
  - [ ] Export `async function requirePrivacyAcknowledgement(ownerId: string): Promise<boolean>` — reads `settings.ai_processing_notice_acknowledged_at` via `createServerClient()`; returns `true` if acknowledged, `false` if not
  - [ ] In any route handler or Server Action that would trigger an AI call with owner data, call `requirePrivacyAcknowledgement()` first; if it returns `false`, return a structured response `{ requiresAcknowledgement: true }` to the client instead of making the AI call
  - [ ] Create `app/api/privacy/acknowledge/route.ts` — a POST handler that sets `ai_processing_notice_acknowledged_at = now()` in `settings` for the authenticated owner; uses `createServerClient()` (never service-role); returns 200 on success
  - [ ] The route must validate the session via `supabase.auth.getUser()` and return 401 if no session

- [ ] **Task 3: Privacy notice UI component** (AC-1)
  - [ ] Create `components/PrivacyNoticeModal.tsx` — a modal/dialog that:
    - Displays the notice: "Your deal and client information (including any screenshots) is processed by Anthropic, an external AI provider, to generate ARIA's analysis. [Read our full Privacy Policy →]" (Vietnamese: "Thông tin deal và khách hàng của anh (bao gồm ảnh chụp màn hình) được xử lý bởi Anthropic, nhà cung cấp AI bên ngoài, để tạo phân tích của ARIA. [Xem Chính sách bảo mật đầy đủ →]")
    - Has a single CTA button: "Understood / Tôi hiểu rồi" (not dismissible by clicking outside or pressing Escape — must be explicit acknowledgement)
    - Links to `/privacy` for the full policy
    - Is not shown again after acknowledgement
  - [ ] Wire the modal: on first AI-generating action, if the server returns `{ requiresAcknowledgement: true }`, show the modal; on confirmation, POST to `/api/privacy/acknowledge`, then retry the original AI action
  - [ ] The modal must meet the accessibility floor: focusable, keyboard-navigable, visible contrast ratio

- [ ] **Task 4: Data deletion — server-side delete service** (AC-2, AC-3)
  - [ ] Create `services/deleteService.ts` (server-only, `import 'server-only'`)
  - [ ] Export `async function deleteClient(ownerId: string, clientId: string): Promise<void>`:
    - Fetch all deals for the client (filtered by `owner_id`) to get their `file_url` values
    - Delete associated Storage objects from Supabase Storage (path pattern: `{owner_id}/screenshots/...`)
    - Delete the client row (CASCADE in the schema handles linked deals, documents, check_ins, activity_log rows)
    - Append an activity log entry: `{ entity_type: 'client', entity_id: clientId, action: 'client_deleted', actor: 'user', payload: { client_name } }`
    - Note: `activity_log` entries for the deleted client are intentionally retained (they are linked by `entity_id` UUID, not a FK with CASCADE) — this preserves audit history per AD-14
  - [ ] Export `async function deleteDeal(ownerId: string, dealId: string): Promise<void>`:
    - Fetch the deal row to get `file_url` (screenshot Storage path)
    - Delete the Storage object if `file_url` is non-null
    - Delete the deal row (CASCADE handles linked documents, check_ins)
    - Append activity log entry: `{ entity_type: 'deal', entity_id: dealId, action: 'deal_deleted', actor: 'user', payload: { deal_title } }`
  - [ ] Both functions must use `createServerClient()` scoped to the owner's session — never `createServiceClient()`
  - [ ] Both functions must throw a structured error (not an unhandled exception) if the Storage delete fails — log the error and still attempt the DB delete (Storage orphan is recoverable; DB row un-deletion is not)

- [ ] **Task 5: API routes for deletion** (AC-2, AC-3)
  - [ ] Create `app/api/clients/[id]/route.ts` — DELETE handler that:
    - Validates session via `supabase.auth.getUser()`, returns 401 if absent
    - Validates `clientId` belongs to the authenticated owner (RLS will enforce this, but do an explicit check to return 403 not an opaque DB error)
    - Calls `deleteClient(ownerId, clientId)`
    - Returns 204 on success
  - [ ] Create `app/api/deals/[id]/route.ts` — DELETE handler with the same pattern, calling `deleteDeal(ownerId, dealId)`
  - [ ] Both routes must return structured JSON error bodies on failure (not naked 500s)

- [ ] **Task 6: Supabase Storage lifecycle policy for screenshots** (AC-4)
  - [ ] Create `supabase/storage-lifecycle.md` documenting the intended lifecycle policy for the `screenshots` bucket:
    - Retention: 90 days from upload (configurable)
    - Objects that have already been extracted and written to the CRM can be deleted earlier (extraction is the durable record)
    - Policy must be applied via Supabase dashboard or CLI (document the exact steps); if Supabase Storage lifecycle policies are configurable via `supabase/config.toml` or a seed script, implement it there instead
  - [ ] Create the `screenshots` Storage bucket configuration (public: false, owner-scoped paths: `{owner_id}/screenshots/`) in `supabase/seed.sql` or the Storage config if not already present
  - [ ] If Supabase Storage's built-in lifecycle API is not yet available (check current Supabase version), document the fallback: a `pg_cron` job querying `storage.objects` where `created_at < now() - interval '90 days'` and deleting via the Storage API — stub the job but mark it as requiring Epic 4's scheduler setup

- [ ] **Task 7: PDPL pre-launch checklist file** (AC-5)
  - [ ] Create `PDPL-LAUNCH-CHECKLIST.md` at the project root (this is a compliance tracking file, not auto-generated docs)
  - [ ] File must contain three explicit gates with status fields:
    1. Anthropic DPA executed — status: PENDING
    2. Cross-Border Data Transfer Impact Assessment (CDTIA) filed with Ministry of Public Security, naming Anthropic as foreign processor — status: PENDING
    3. Full privacy policy page published at `/privacy` — status: PENDING
  - [ ] Add a stub route `app/(public)/privacy/page.tsx` that renders a placeholder privacy policy page (no auth required, publicly accessible); stub copy: "Privacy Policy — Full policy coming before public launch."

- [ ] **Task 8: CI checks** (all ACs)
  - [ ] `supabase db reset` applies all migrations cleanly from scratch with no errors
  - [ ] `npm run lint` passes
  - [ ] `npx tsc --noEmit` passes
  - [ ] `npm run format:check` passes

## Dev Notes

### Architecture Constraints (Non-Negotiable)

**AD-10 — PII handling & Vietnam PDPL posture:**
Governing law is Vietnam's PDPL (Decree 356/2025, effective 2026-01-01). The Owner is data controller, ARIA the processor. Required before go-live: (1) Anthropic DPA executed; (2) Cross-Border Data Transfer Impact Assessment filed with the Ministry of Public Security; (3) in-product privacy notice; (4) retention/delete policy enforced in Postgres + Storage. These are gating items for launch, tracked as OQ-10. The build for items (3) and (4) happens in this story; legal items (1) and (2) are operational prerequisites tracked in `PDPL-LAUNCH-CHECKLIST.md`.

**AD-2 — Owner-scoping + Row Level Security:**
Every delete operation must go through the authenticated owner's RLS-enforced session. Use `createServerClient()` exclusively — never `createServiceClient()` — for any operation that touches owner data. The existing `ON DELETE CASCADE` on the schema already handles referential cleanup for child rows; Storage objects are not in Postgres and must be cleaned up explicitly in `deleteService.ts`.

**AD-9 — Vision pipeline and Storage:**
Screenshots are stored at owner-scoped paths (`{owner_id}/screenshots/{filename}`). Deletion must target the Storage object at the path stored in the deal's `file_url` column. Once extracted, the raw image is the disposable artifact; the extracted CRM fields are the durable record.

**AD-13 — Auth boundary:**
No deletion route handler may use `createServiceClient()`. All owner-data deletes must flow through the authenticated session, confirmed by `supabase.auth.getUser()` returning a valid user. A missing session returns 401; an `owner_id` mismatch (which RLS would block) returns 403.

**AD-14 — Append-only activity log:**
Activity log entries referencing deleted entities are intentionally retained — they are referenced by `entity_id` UUID with no FK CASCADE to `clients` or `deals`. The log records the deletion event (`action="client_deleted"` / `action="deal_deleted"`) but existing prior entries for that entity are kept as the audit trail. This is by design; do not add ON DELETE CASCADE to `activity_log.entity_id`.

**AD-11 — Secret custody:**
No new secrets are introduced in this story. The `createServerClient()` pattern from `lib/supabase/` already handles session-scoped access. The Storage delete uses the Supabase Storage API via the server client, which inherits the owner's session.

### Implementation Details

**Schema — `settings` table addition:**

Migration file: `supabase/migrations/20260626020000_pdpl_notice_column.sql`

```sql
-- Add PDPL acknowledgement timestamp to settings (AD-10, Story 0.8)
-- NULL = not yet acknowledged; non-null = acknowledged at that timestamp
ALTER TABLE settings
  ADD COLUMN ai_processing_notice_acknowledged_at timestamptz DEFAULT NULL;
```

No RLS change needed — existing `settings_select_own` and `settings_update_own` policies already cover this column.

**File structure to create:**

```
lib/
  privacy/
    checkPrivacyNotice.ts    ← server-only; reads settings.ai_processing_notice_acknowledged_at
services/
  deleteService.ts           ← server-only; orchestrates DB delete + Storage cleanup
components/
  PrivacyNoticeModal.tsx     ← client component; blocks AI call until acknowledged
app/
  api/
    privacy/
      acknowledge/
        route.ts             ← POST; sets acknowledged_at = now()
    clients/
      [id]/
        route.ts             ← DELETE; calls deleteService.deleteClient()
    deals/
      [id]/
        route.ts             ← DELETE; calls deleteService.deleteDeal()
  (public)/
    privacy/
      page.tsx               ← Publicly accessible privacy policy stub (no auth)
PDPL-LAUNCH-CHECKLIST.md    ← Project root; compliance gate tracker
supabase/
  migrations/
    20260626020000_pdpl_notice_column.sql
  storage-lifecycle.md       ← Documents the screenshots bucket lifecycle policy
```

**`checkPrivacyNotice.ts` — function signature:**

```typescript
import 'server-only'
import { createServerClient } from '@/lib/supabase/server'

/**
 * Returns true if the owner has acknowledged the AI-processing privacy notice.
 * Returns false if not yet acknowledged (notice must be shown before AI call proceeds).
 */
export async function isPrivacyNoticeAcknowledged(ownerId: string): Promise<boolean> {
  const supabase = createServerClient()
  const { data } = await supabase
    .from('settings')
    .select('ai_processing_notice_acknowledged_at')
    .eq('owner_id', ownerId)
    .single()
  return data?.ai_processing_notice_acknowledged_at != null
}
```

**`deleteService.ts` — key patterns:**

```typescript
import 'server-only'
import { createServerClient } from '@/lib/supabase/server'

export async function deleteDeal(ownerId: string, dealId: string): Promise<void> {
  const supabase = createServerClient()

  // 1. Fetch file_url before deletion
  const { data: deal } = await supabase
    .from('deals')
    .select('title, file_url')
    .eq('id', dealId)
    .eq('owner_id', ownerId)  // belt-and-suspenders; RLS enforces this too
    .single()

  // 2. Delete Storage object (best-effort — log error but don't abort DB delete)
  if (deal?.file_url) {
    const { error: storageError } = await supabase.storage
      .from('screenshots')
      .remove([deal.file_url])
    if (storageError) {
      console.error('[deleteService] Storage delete failed, continuing with DB delete:', storageError)
    }
  }

  // 3. Delete DB row (CASCADE handles linked documents, check_ins)
  await supabase.from('deals').delete().eq('id', dealId).eq('owner_id', ownerId)

  // 4. Append activity log (activity_log rows referencing this deal_id are intentionally kept)
  await supabase.from('activity_log').insert({
    owner_id: ownerId,
    entity_type: 'deal',
    entity_id: dealId,
    action: 'deal_deleted',
    actor: 'user',
    payload: { deal_title: deal?.title ?? dealId },
  })
}
```

The `deleteClient` function follows the same pattern but first collects all deal `file_url` values before the cascade delete removes the deals.

**Privacy notice modal — gating pattern:**

The notice gate operates at the API layer: when the `/api/chat` (or equivalent) route receives a message that would trigger an AI call, it calls `isPrivacyNoticeAcknowledged(ownerId)` before calling `callAI()`. If not acknowledged, it returns:

```json
{ "requiresAcknowledgement": true, "status": "awaiting_privacy_ack" }
```

The client receives this, shows `PrivacyNoticeModal`, the Owner clicks "Tôi hiểu rồi", the client POSTs to `/api/privacy/acknowledge`, receives 200, then re-submits the original message. This is a client-driven retry — no message is queued or auto-retried server-side.

**Storage path convention:**

Screenshots uploaded by owners follow the path: `{owner_id}/screenshots/{uuid}-{original_filename}`. The `deal.file_url` column stores this full path (not a signed URL). The `deleteService` passes this path directly to `supabase.storage.from('screenshots').remove([path])`.

**Supabase Storage bucket setup (if not already done):**

If the `screenshots` bucket does not yet exist, create it in a seed or migration helper:
```sql
-- This cannot run in a SQL migration (Supabase Storage is managed separately)
-- Document in supabase/storage-lifecycle.md: create bucket 'screenshots', public=false
```

Bucket creation via CLI: `supabase storage create screenshots --no-public`. Document this step in `supabase/storage-lifecycle.md` as a one-time setup step required before the app can upload images.

**Privacy policy stub route:**

The `/privacy` route must be accessible without authentication (it is a public legal document). Place it in `app/(public)/privacy/page.tsx` outside the authenticated layout. The stub content is:

```
Privacy Policy

ARIA processes your business data (client records, deal descriptions, and screenshots) using Anthropic's Claude AI to generate analysis and recommendations. Your data is protected under Vietnam's Personal Data Protection Law (Decree 356/2025).

Full policy coming before public launch.
```

**TypeScript type for `settings` with new column:**

If the project uses a generated Supabase type file (`types/supabase.ts` or similar), regenerate it after applying the migration: `supabase gen types typescript --local > types/supabase.ts`. If not using generated types, add the column to any hand-written `Settings` interface in `lib/types.ts` (or equivalent).

### Previous Story Learnings Applied

From **Story 0.6** (auth/service-role boundary) and **Story 0.7** (AI call wrapper):

1. **`createServerClient()` is the only client for owner-data paths.** The delete service and privacy acknowledgement routes must use `createServerClient()` exclusively. Use of `createServiceClient()` in these handlers would cause the ESLint lint rule added in Story 0.6 to fail CI. Confirm by running `npm run lint` before committing.

2. **`server-only` guard on every server module.** All new modules under `lib/` and `services/` must begin with `import 'server-only'`. This was the pattern established in Story 0.5 (`lib/secrets.ts`) and followed in Story 0.7 (`lib/ai/callAI.ts`). Any module missing this guard can be accidentally bundled into the client build.

3. **Session validation pattern.** Every API route validates the session via `supabase.auth.getUser()` (not from a client-passed token) and returns 401 if no valid session. This pattern was established in Story 0.4 and enforced in all subsequent route handlers. Do not skip this step in the deletion or acknowledgement routes.

4. **CI triad must pass before commit.** Run in sequence: `npm run lint`, `npx tsc --noEmit`, `npm run format:check`. Additionally for this story: `supabase db reset` to confirm the new migration applies cleanly.

5. **No Docker / local Supabase needed for unit tests.** The `checkPrivacyNotice.ts` and `deleteService.ts` modules can be tested by mocking `createServerClient()`. The Storage delete path should be tested with a mock that simulates both success and failure (the error-logging-but-not-aborting pattern in Task 4 must be verified).

6. **Permissions block file deletion in the shell.** If any temporary test files are created under `app/`, use the overwrite-with-stub pattern from Story 0.7 rather than deleting; or use paths outside `app/` for temporary lint verification.

7. **Migration numbering.** The last migration was `20260626010000_rls_policies.sql`. This story's migration is `20260626020000_pdpl_notice_column.sql`. Verify no other migration file uses this timestamp before committing.

## Dev Agent Record

### Agent Model Used

### Debug Log References

None

### Completion Notes List

(none yet)

### File List

(none yet)
