---
story_id: 2.1
epic: 2
title: Owner-Scoped Persistence with Append-Only Activity Log
status: ready-for-dev
baseline_commit: c2efd6a
---

## Story

As an **Owner**, I want every client, deal, and document change persisted under my account and recorded in an audit trail, so that ARIA always has a trustworthy history to reason from and I can trust nothing is lost or mixed with other data.

## What Already Exists (do NOT re-implement)

The following infrastructure was built in Epic 0 and is fully operational. Story 2.1 must NOT duplicate it:

- **`activity_log` table** — already created in `supabase/migrations/20260626000000_initial_schema.sql` with columns: `id`, `owner_id` (FK → auth.users), `entity_type` (enum: `client | deal | document | settings`), `entity_id`, `action`, `actor` (enum: `ai | user`), `payload jsonb`, `created_at`. No `updated_at` column (append-only by design).
- **Indexes** — `activity_log_owner_id_idx` and `activity_log_entity_type_id_idx` already exist.
- **RLS policies** — `activity_log_select_own` (SELECT) and `activity_log_insert_own` (INSERT) already applied in `supabase/migrations/20260626010000_rls_policies.sql`. No UPDATE or DELETE policies exist — the absence is intentional and enforces AD-14 via the anon/JWT path.
- **All tables have `owner_id` + RLS** — `clients`, `deals`, `documents`, `briefings`, `check_ins`, `settings` all have RLS enforced from Stories 0.2–0.3.
- **`is_stub` columns** — `clients.is_stub` and `deals.is_stub` exist from `20260627000000_stub_columns.sql`.
- **Existing `activity_log` writes** — `createClientStub()`, `createDealStub()` (in `lib/crm/stubService.ts`) and `updateIntelligenceFields()` (in `lib/crm/dealIntelligenceService.ts`) already insert to `activity_log` with correct `actor`, `action`, and `payload`.
- **`createServerClient()` discipline** — all existing `lib/crm/` and `app/api/` files use the correct client factory.

## Gap Analysis — What Story 2.1 Adds

Four things are missing that this story delivers:

1. **`logActivity()` service function** — an explicit, reusable `INSERT` helper that any tool or route can call to append an activity log entry. Currently every service that writes to `activity_log` does a raw `supabase.from('activity_log').insert(...)` inline. A shared helper eliminates duplication and ensures consistent payload shape.

2. **`getActivityLog()` query function** — a service to retrieve the activity history for a given `entity_id`, needed by Story 2.7 ("what changed on this deal recently?") and by ARIA's conversational summarization of deal history.

3. **`log_activity` Claude tool** — an explicit tool in `crmTools.ts` that ARIA can call during a CRM session to log a note or event not covered by a field write (e.g., a phone call noted by the Owner, a stage advancement note). Without this tool, ARIA has no way to append entries on demand.

4. **DB-level append-only trigger** — a Postgres trigger on `activity_log` that raises an exception on any `UPDATE` or `DELETE` attempt. The existing RLS approach only blocks the anon-key/JWT path; the service-role key has `BYPASSRLS` and would not be blocked by RLS alone. A trigger covers all paths including service-role (AD-14 hard invariant).

## Acceptance Criteria

- **AC-1 — Owner-scoped reads/writes (already covered, validate only):** Given the `clients`, `deals`, `documents`, `activity_log`, and `briefings` tables exist with `owner_id uuid` columns and RLS enabled, when any row is read or written via `createServerClient()` (anon key + user session), then Postgres RLS policies enforce that only rows matching the authenticated owner's `auth.uid()` are visible or writable — cross-owner access returns zero rows (AD-2, FR-30). This is verified by reading the existing RLS migration, not by re-creating anything.

- **AC-2 — No service-role on owner-data paths (already covered, validate only):** Given a request handler processes an owner data read or write, when it uses the Supabase client, then it uses `createServerClient()` only; `createServiceClient()` (service-role) does not appear in any file under `app/api/` or `lib/crm/` (AD-13).

- **AC-3 — `logActivity()` service helper:** Given `lib/crm/activityLogService.ts` is created, when `logActivity(ownerId, params)` is called with `{ entity_type, entity_id, action, actor, payload? }`, then it inserts one row into `activity_log` and throws on DB error; it never silently swallows failures (callers decide whether to catch) (FR-30, AD-14).

- **AC-4 — `getActivityLog()` query function:** Given `getActivityLog(ownerId, { entity_id, entity_type?, limit? })` is called, when the function runs, then it returns rows from `activity_log` filtered by `owner_id` AND `entity_id`, ordered by `created_at DESC`, with an optional `limit` cap (default 20); only the calling owner's rows are returned (AD-2, FR-30).

- **AC-5 — `log_activity` Claude tool wired:** Given the `log_activity` tool is added to `CRM_STUB_TOOLS` in `lib/ai/crmTools.ts`, when ARIA calls it with `{ entity_type, entity_id, action, actor, payload? }` during a `crm_action` session, then `toolRunner.ts` routes it to `logActivity()` from `activityLogService.ts`; the tool returns `{ logged: true }` on success or `{ logged: false, error: string }` on failure (AD-14, FR-30).

- **AC-6 — Append-only DB trigger (hard invariant):** Given a new migration `supabase/migrations/20260629000000_activity_log_append_only_trigger.sql` is applied, when any code path (including service-role) attempts `UPDATE` or `DELETE` on `activity_log`, then Postgres raises: `ERROR: activity_log is append-only — UPDATE and DELETE are forbidden (AD-14)`. The trigger covers both operations. `INSERT` and `SELECT` are unaffected (AD-14).

- **AC-7 — No-op writes log nothing (existing behavior, verified by test):** Given ARIA calls `updateIntelligenceFields()` with field values identical to those already stored, when the function completes, then `changedFields` is empty, no DB write occurs, and no new `activity_log` row is appended. This is already implemented; the test confirms the existing behavior with the new `logActivity()` helper in scope.

- **AC-8 — `actor` attribution (existing behavior, verified by test):** Given ARIA performs an autonomous write, when the activity log row is inspected, then `actor = 'ai'`; when the Owner provides the information driving the write, then `actor = 'user'`. This attribution already exists in `stubService.ts` and `dealIntelligenceService.ts`; the test confirms the `logActivity()` helper accepts and passes both values without mutation.

## Tasks / Subtasks

- [x] **Task 1 — New migration: append-only trigger** (`supabase/migrations/20260629000000_activity_log_append_only_trigger.sql` — new file)
  - [x] Create the migration file
  - [x] Write a `BEFORE UPDATE OR DELETE` trigger function named `enforce_activity_log_append_only()` that raises `EXCEPTION 'activity_log is append-only — UPDATE and DELETE are forbidden (AD-14)'`
  - [x] Attach the trigger to `activity_log` with `CREATE TRIGGER activity_log_no_update_delete BEFORE UPDATE OR DELETE ON activity_log FOR EACH ROW EXECUTE FUNCTION enforce_activity_log_append_only()`
  - [x] No `DROP TRIGGER IF EXISTS` needed — this is a new table with no prior trigger

- [x] **Task 2 — `lib/crm/activityLogService.ts`** (new file)
  - [x] Add `import 'server-only'` at line 1 (AD-11)
  - [x] Add `import { createServerClient } from '@/lib/supabase/server'` (AD-13)
  - [x] Export `LogActivityParams` interface:
    ```typescript
    export interface LogActivityParams {
      entity_type: 'client' | 'deal' | 'document' | 'settings'
      entity_id: string
      action: string
      actor: 'ai' | 'user'
      payload?: Record<string, unknown>
    }
    ```
  - [x] Export `async function logActivity(ownerId: string, params: LogActivityParams): Promise<void>` — does a single `supabase.from('activity_log').insert({ owner_id: ownerId, ...params })` and throws `new Error(...)` if `error` is returned (never swallows)
  - [x] Export `ActivityLogRow` interface (matches DB columns):
    ```typescript
    export interface ActivityLogRow {
      id: string
      owner_id: string
      entity_type: string
      entity_id: string
      action: string
      actor: string
      payload: Record<string, unknown>
      created_at: string
    }
    ```
  - [x] Export `async function getActivityLog(ownerId: string, params: { entity_id: string; entity_type?: string; limit?: number }): Promise<ActivityLogRow[]>` — queries `activity_log` with `.eq('owner_id', ownerId).eq('entity_id', params.entity_id)`, optional `.eq('entity_type', params.entity_type)` when provided, `.order('created_at', { ascending: false })`, `.limit(params.limit ?? 20)`; throws on DB error

- [x] **Task 3 — Add `log_activity` tool to `lib/ai/crmTools.ts`**
  - [x] Append a new entry to the `CRM_STUB_TOOLS` array (after the existing three tools):
    ```typescript
    {
      name: 'log_activity',
      description: 'Append an activity log entry for a client, deal, or document event not covered by a field write — e.g. a phone call noted by the Owner, a stage-change note, or a custom action.',
      input_schema: {
        type: 'object' as const,
        properties: {
          entity_type: {
            type: 'string',
            enum: ['client', 'deal', 'document', 'settings'],
            description: 'The type of entity this log entry is about',
          },
          entity_id: { type: 'string', description: 'UUID of the entity' },
          action: {
            type: 'string',
            description: 'Descriptive action string e.g. "phone_call_noted", "stage_changed", "note_added"',
          },
          actor: {
            type: 'string',
            enum: ['ai', 'user'],
            description: '"user" when the Owner provided the information; "ai" when ARIA acted autonomously',
          },
          payload: {
            type: 'object',
            description: 'Optional jsonb payload capturing relevant context (old/new values, note text, etc.)',
          },
        },
        required: ['entity_type', 'entity_id', 'action', 'actor'] as readonly string[],
      },
    }
    ```

- [x] **Task 4 — Wire `log_activity` in `lib/ai/toolRunner.ts`**
  - [x] Import `logActivity` from `@/lib/crm/activityLogService` (add to import block at top of file)
  - [x] In the tool dispatch switch/if block, add a case for `'log_activity'`:
    ```typescript
    if (toolName === 'log_activity') {
      const { entity_type, entity_id, action, actor, payload } = input as {
        entity_type: 'client' | 'deal' | 'document' | 'settings'
        entity_id: string
        action: string
        actor: 'ai' | 'user'
        payload?: Record<string, unknown>
      }
      try {
        await logActivity(ownerId, { entity_type, entity_id, action, actor, payload })
        return { logged: true }
      } catch (e) {
        return { logged: false, error: e instanceof Error ? e.message : 'unknown' }
      }
    }
    ```
  - [x] Read `toolRunner.ts` first to understand the exact dispatch pattern before editing

- [x] **Task 5 — Tests** (`lib/__tests__/activityLog21.test.ts` — new file)
  - [x] Add `export {}` at top (ES module scope)
  - [x] Inline all logic — NEVER import from project `lib/` (ts-node test pattern)
  - [x] T1 — `LogActivityParams` shape: construct a valid params object with all required fields; assert that `entity_type`, `entity_id`, `action`, `actor` are all present and `payload` is optional (type-level shape check — no DB call)
  - [x] T2 — `actor` values: assert that the `actor` field only accepts `'ai'` or `'user'`; a third value `'system'` is NOT a valid actor in the schema (inline type check)
  - [x] T3 — `getActivityLog` default limit: inline the limit logic `params.limit ?? 20` — assert that when `limit` is undefined, the effective limit is `20`; when `limit = 5`, the effective limit is `5`
  - [x] T4 — No-op detection: inline the `hasChanged` logic from `dealIntelligenceService.ts` — assert that `hasChanged('foo', 'foo')` returns `false` and `hasChanged('foo', 'bar')` returns `true` (JSON-equality)
  - [x] T5 — No-op detection with jsonb: assert that `hasChanged([{flag:'A'}], [{flag:'A'}])` returns `false` (deep JSON equality); `hasChanged([{flag:'A'}], [{flag:'B'}])` returns `true`
  - [x] T6 — `log_activity` tool input validation: inline the input type guard — given a raw object `{ entity_type: 'deal', entity_id: 'uuid-here', action: 'note_added', actor: 'user', payload: { note: 'called' } }`, assert all required fields are present and `payload` is an object
  - [x] T7 — Append-only: assert that a constructed `ActivityLogRow` has no `updated_at` field (simulate: `const row = { id: '1', owner_id: '2', entity_type: 'deal', entity_id: '3', action: 'x', actor: 'ai', payload: {}, created_at: '2026-06-29' }; assert !('updated_at' in row)`)
  - [x] Add `"test:activity-log21": "npx ts-node lib/__tests__/activityLog21.test.ts"` to `package.json` scripts

- [x] **Task 6 — CI triad**
  - [x] `npx tsc --noEmit` — zero errors
  - [x] `npx eslint lib/crm/activityLogService.ts lib/ai/crmTools.ts lib/ai/toolRunner.ts lib/__tests__/activityLog21.test.ts`
  - [x] `npx prettier --write` on all touched files
  - [x] `npx ts-node lib/__tests__/activityLog21.test.ts` — all tests pass

- [x] **Task 7 — Update story status**
  - [x] Mark all tasks `[x]`, fill Dev Agent Record
  - [x] `sprint-status.yaml`: `2-1-owner-scoped-persistence-with-append-only-activity-log: done`, update `last_updated`

## Dev Notes

### Architecture decisions in effect

- **AD-2**: All `lib/crm/` queries must `.eq('owner_id', ownerId)` as a defense-in-depth filter on top of RLS. RLS alone is correct, but explicit filter is belt-and-suspenders per existing pattern in all Epic 0–1 services.
- **AD-11**: `lib/crm/activityLogService.ts` is a server-only module — add `import 'server-only'` at line 1. This is NOT needed in route handler files (`app/api/...`) which are server-only by default.
- **AD-13**: Use `createServerClient()` (anon key + user session) in `activityLogService.ts`. `createServiceClient()` (service-role key) must NOT appear. The activity log is owner data — service-role is for scheduler/system paths only.
- **AD-14**: The append-only invariant is now enforced at two layers: (a) RLS has no UPDATE/DELETE policies (anon/JWT path), (b) new DB trigger fires on any UPDATE/DELETE regardless of caller key (including service-role). Both layers must remain intact.
- **No new schema changes to `activity_log`**: The table schema is final from Epic 0. Story 2.1 only adds a trigger to the existing table and a `logActivity()` service wrapper — no column additions, no enum changes.
- **`entity_type` enum includes `'settings'`**: Added in `20260626040000_activity_log_settings_entity.sql`. The `LogActivityParams` interface must include `'settings'` as a valid `entity_type` value.

### Existing `lib/crm/` pattern to follow exactly

Every existing service in `lib/crm/` starts:

```typescript
import 'server-only'
import { createServerClient } from '@/lib/supabase/server'
```

And every query includes `.eq('owner_id', ownerId)` as explicit filter. Match this pattern exactly in `activityLogService.ts`.

### Migration file placement

The new migration must be named `20260629000000_activity_log_append_only_trigger.sql` (timestamp prefix matching today's date). Place it in `supabase/migrations/`. Existing migrations in that directory:

- `20260626000000_initial_schema.sql`
- `20260626010000_rls_policies.sql`
- `20260626020000_pdpl_notice_column.sql`
- `20260626030000_deal_file_url.sql`
- `20260626040000_activity_log_settings_entity.sql`
- `20260627000000_stub_columns.sql`
- `20260628000000_screenshots_bucket.sql`

The trigger migration must be idempotent-safe. Use `CREATE OR REPLACE FUNCTION` and `DROP TRIGGER IF EXISTS` before `CREATE TRIGGER` to avoid errors on `supabase db reset`:

```sql
-- supabase/migrations/20260629000000_activity_log_append_only_trigger.sql
-- Enforces AD-14 append-only invariant on activity_log at the DB level.
-- This blocks UPDATE and DELETE from ALL callers including service-role (BYPASSRLS).
-- RLS already prevents anon-key UPDATE/DELETE (no policies defined).
-- This trigger adds a second layer covering the service-role path.

CREATE OR REPLACE FUNCTION enforce_activity_log_append_only()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'activity_log is append-only — UPDATE and DELETE are forbidden (AD-14)';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS activity_log_no_update_delete ON activity_log;

CREATE TRIGGER activity_log_no_update_delete
  BEFORE UPDATE OR DELETE ON activity_log
  FOR EACH ROW
  EXECUTE FUNCTION enforce_activity_log_append_only();
```

### `toolRunner.ts` — read before editing

Read `lib/ai/toolRunner.ts` fully before Task 4. The dispatch pattern uses a series of `if (toolName === '...')` blocks (not a switch statement). The `ownerId` parameter is already threaded through from `agentWithTools.ts`. Locate the block for `'find_similar_clients'` as a reference for the exact shape to add `'log_activity'` alongside.

### `activityLogService.ts` full implementation shape

```typescript
import 'server-only'
import { createServerClient } from '@/lib/supabase/server'

export interface LogActivityParams {
  entity_type: 'client' | 'deal' | 'document' | 'settings'
  entity_id: string
  action: string
  actor: 'ai' | 'user'
  payload?: Record<string, unknown>
}

export interface ActivityLogRow {
  id: string
  owner_id: string
  entity_type: string
  entity_id: string
  action: string
  actor: string
  payload: Record<string, unknown>
  created_at: string
  // NOTE: no updated_at — this table is append-only (AD-14)
}

export async function logActivity(ownerId: string, params: LogActivityParams): Promise<void> {
  const supabase = createServerClient()
  const { error } = await supabase.from('activity_log').insert({
    owner_id: ownerId,
    entity_type: params.entity_type,
    entity_id: params.entity_id,
    action: params.action,
    actor: params.actor,
    payload: params.payload ?? {},
  })
  if (error) throw new Error(`logActivity failed: ${error.message}`)
}

export async function getActivityLog(
  ownerId: string,
  params: { entity_id: string; entity_type?: string; limit?: number }
): Promise<ActivityLogRow[]> {
  const supabase = createServerClient()
  let q = supabase
    .from('activity_log')
    .select('id, owner_id, entity_type, entity_id, action, actor, payload, created_at')
    .eq('owner_id', ownerId)
    .eq('entity_id', params.entity_id)
    .order('created_at', { ascending: false })
    .limit(params.limit ?? 20)

  if (params.entity_type) {
    q = q.eq('entity_type', params.entity_type)
  }

  const { data, error } = await q
  if (error) throw new Error(`getActivityLog failed: ${error.message}`)
  return (data ?? []) as ActivityLogRow[]
}
```

### ts-node test pattern (critical — carry-forward from all Epic 1 stories)

- NEVER import from project `lib/` files in test files
- Inline all logic and types directly in the test file
- Add `export {}` at the very top of every test file (prevents `Cannot redeclare block-scoped variable` TSC errors — introduced Story 1.11)
- Run via `npx ts-node lib/__tests__/activityLog21.test.ts` (not `node --loader ts-node/esm`)
- Inline the `hasChanged` logic (copy the body from `dealIntelligenceService.ts` verbatim) rather than importing

### Learnings carried from Epic 1 stories

1. **`import 'server-only'` for new `lib/crm/` files**: Every new file in `lib/crm/` must have `import 'server-only'` at line 1 (AD-11). Not needed in `app/api/` route files.
2. **Prettier before CI**: Run `npx prettier --write` on every edited file before the CI triad — saves a CI failure from formatting.
3. **`export {}` at top of test files**: Mandatory since Story 1.11.
4. **`supabase.auth.getUser()` — not `getSession()`**: In route handlers; but `activityLogService.ts` receives `ownerId` as a parameter from the caller (who already validated the session) — it does NOT call `auth.getUser()` internally. This is consistent with all existing `lib/crm/` services.
5. **Throw, don't swallow, in service layer**: `logActivity()` throws on error; callers can wrap in try/catch if needed. The `toolRunner.ts` handler for `log_activity` wraps in try/catch and returns `{ logged: false, error: ... }` — this is the correct error surfacing path.
6. **No new enum values needed**: The `entity_type` enum already includes `client`, `deal`, `document`, `settings` (from the initial schema + migration `20260626040000`). No migration needed to add new values.

### Files to create / modify

**New files:**
- `supabase/migrations/20260629000000_activity_log_append_only_trigger.sql`
- `lib/crm/activityLogService.ts`
- `lib/__tests__/activityLog21.test.ts`

**Modified files:**
- `lib/ai/crmTools.ts` — append `log_activity` tool to `CRM_STUB_TOOLS` array
- `lib/ai/toolRunner.ts` — add `log_activity` dispatch case; import `logActivity`
- `package.json` — add `test:activity-log21` script

**Unchanged (validate only):**
- `supabase/migrations/20260626000000_initial_schema.sql` — `activity_log` table already correct
- `supabase/migrations/20260626010000_rls_policies.sql` — RLS policies already correct
- `lib/crm/stubService.ts` — already writes to `activity_log` correctly
- `lib/crm/dealIntelligenceService.ts` — already writes to `activity_log` correctly

## Dev Agent Record

### Debug Log

No issues encountered. All files passed prettier on first run (activityLogService.ts and toolRunner.ts were already formatted correctly). The test file received one prettier reformat (line-wrapping on the invalidActor assertion). TSC and ESLint were clean on first run.

### Completion Notes

- Migration uses `CREATE OR REPLACE FUNCTION` + `DROP TRIGGER IF EXISTS` for idempotency on `supabase db reset`.
- `activityLogService.ts` follows the exact pattern of existing `lib/crm/` services: `import 'server-only'` at line 1, `createServerClient()`, explicit `.eq('owner_id', ownerId)` filter on every query.
- `log_activity` dispatch in `toolRunner.ts` uses an inner try/catch (separate from the outer block) so DB errors return `{ logged: false, error: ... }` rather than propagating as tool errors — this matches AC-5.
- 10 tests pass (7 specified + 3 bonus sub-cases for T3b, T4b, T5b).
- Note: story task said "No `DROP TRIGGER IF EXISTS` needed" but Dev Notes template included it for idempotency — the idempotent form was used as it is safer for `supabase db reset`.

### File List

**New files:**
- `supabase/migrations/20260629000000_activity_log_append_only_trigger.sql`
- `lib/crm/activityLogService.ts`
- `lib/__tests__/activityLog21.test.ts`

**Modified files:**
- `lib/ai/crmTools.ts` — appended `log_activity` tool to `CRM_STUB_TOOLS` array
- `lib/ai/toolRunner.ts` — added `logActivity` import + `log_activity` dispatch branch
- `package.json` — added `test:activity-log21` script

### Change Log

| Date | Change |
|------|--------|
| 2026-06-29 | Story file created, scope scoped to gap analysis — DB trigger + activityLogService + log_activity tool |
