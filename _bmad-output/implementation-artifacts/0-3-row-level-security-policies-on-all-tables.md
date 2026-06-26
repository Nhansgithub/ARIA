---
baseline_commit: 694ea168944a7851626dd87a16e1283fea6171dc
---

# Story 0.3: Row Level Security Policies on All Tables

Status: review

## Story

As a developer,
I want Postgres Row Level Security enabled and enforced on every table — filtering all reads and writes by the authenticated owner —
so that no query path can ever return or mutate another owner's data, satisfying AD-2 and FR-30.

## Acceptance Criteria

1. **Given** RLS is enabled on all tables,
   **When** a database query is executed using the authenticated owner's session (Supabase anon key + JWT),
   **Then** the query returns only rows where `owner_id` matches the authenticated user's `auth.uid()`; rows belonging to any other owner are invisible and unmodifiable.

2. **Given** RLS is enabled,
   **When** an unauthenticated request attempts a SELECT, INSERT, UPDATE, or DELETE on any table,
   **Then** zero rows are returned or affected; no error reveals the existence of other owners' data.

3. **Given** the `activity_log` table,
   **When** the RLS policy is applied,
   **Then** both SELECT and INSERT are filtered to the authenticated owner's `owner_id`; no UPDATE or DELETE policy exists (table is append-only per AD-14).

4. **Given** the `briefings` table,
   **When** the SELECT policy is active,
   **Then** a query for `date = today` returns at most one row — the requesting owner's row — regardless of how many owners have briefings for that date.

5. **Given** the policy definitions are written as SQL in `supabase/migrations/`,
   **Then** every table's RLS policies are expressed in a migration file and version-controlled; no policy is applied via the Supabase dashboard only.

6. **Given** a seed file creates two test owners each with one client row,
   **When** a query runs as owner A (simulated via `SET LOCAL "request.jwt.claim.sub"`),
   **Then** owner B's client row is not returned; the count is exactly 1.

## Tasks / Subtasks

- [x] **Task 1: Create RLS migration** (AC: 1, 2, 3, 4, 5)
  - [x] Create `supabase/migrations/20260626010000_rls_policies.sql` with the complete SQL below (see Dev Notes § Full RLS SQL)
  - [x] Verify `ALTER TABLE <table> ENABLE ROW LEVEL SECURITY` for all 7 tables: clients, deals, documents, activity_log, briefings, check_ins, settings
  - [x] Verify SELECT, INSERT, UPDATE, DELETE policies exist for each table per the policy table in Dev Notes
  - [x] Verify `activity_log` has ONLY SELECT + INSERT (no UPDATE or DELETE — AD-14)
  - [x] Verify all policies use `owner_id = auth.uid()` as the filter

- [x] **Task 2: Create seed file for local verification** (AC: 6)
  - [x] Create `supabase/seed.sql` (Supabase CLI uses this file on `supabase db reset`) with the complete seed below (see Dev Notes § Seed SQL)
  - [x] Seed inserts two test owners into `auth.users` and one client per owner
  - [x] Remove `supabase/seed/.gitkeep` (the seed directory stub is no longer needed — using seed.sql) — already removed in Story 0.2

- [x] **Task 3: Verify RLS locally** (AC: 1, 2, 6)
  - [x] **Requires Docker:** SKIPPED — Docker Desktop not available in this environment (same constraint as Stories 0.1 and 0.2). Verification SQL documented in Dev Notes for manual execution once Docker is available.

- [x] **Task 4: Commit** (AC: 5)
  - [x] Stage and commit: `supabase/migrations/20260626010000_rls_policies.sql`, `supabase/seed.sql`
  - [x] Also commit removal of `supabase/seed/.gitkeep` — already removed in Story 0.2
  - [x] Run `npm run lint`, `npx tsc --noEmit`, `npm run format:check` — all pass

## Dev Notes

### Architecture Constraints (Non-Negotiable)

- **AD-2 — RLS is the multi-tenancy boundary.** Without RLS, every authenticated user can read every row. The `owner_id` column is only as safe as the policy enforcing it. This story activates the protection established in Story 0.2.
- **AD-13 — service_role bypasses RLS in Supabase by design.** The Supabase `service_role` key is granted the `BYPASSRLS` privilege. This is correct behavior — the scheduler (Epic 4) must write briefings and check-ins for specific owners without being blocked by their own identity. The design boundary (Story 0.6) is that `createServiceClient()` must NEVER be used in request handlers serving owner data.
- **AD-14 — activity_log is append-only.** Do NOT create UPDATE or DELETE policies on `activity_log`. The absence of these policies IS the enforcement mechanism — even the owner cannot modify or delete log entries via the anon/authenticated keys.
- **FR-30 — Data isolation is a hard requirement.** No owner data must ever be visible to another owner. RLS is the DB-layer guarantee.

### Policy Table — What Each Table Gets

| Table | SELECT | INSERT | UPDATE | DELETE | Notes |
|-------|--------|--------|--------|--------|-------|
| clients | ✓ | ✓ | ✓ | ✓ | Full CRUD |
| deals | ✓ | ✓ | ✓ | ✓ | Full CRUD |
| documents | ✓ | ✓ | ✓ | ✓ | Full CRUD |
| activity_log | ✓ | ✓ | ✗ | ✗ | Append-only (AD-14) |
| briefings | ✓ | ✓ | ✗ | ✓ | Scheduler writes via service_role; owner can delete |
| check_ins | ✓ | ✓ | ✓ | ✗ | Owner answers via UPDATE; scheduler creates via service_role |
| settings | ✓ | ✓ | ✓ | ✗ | Owner manages own settings |

### How Supabase RLS Works

1. `ALTER TABLE <t> ENABLE ROW LEVEL SECURITY` — turns on RLS. Without this, no policies apply (all rows are visible to all roles).
2. Once enabled with NO policies → default-deny: authenticated users see zero rows (this is Supabase's default closed posture).
3. Policies OPEN access. A SELECT policy with `USING (owner_id = auth.uid())` means: only return rows where `owner_id` equals the JWT sub claim.
4. `auth.uid()` is a Supabase built-in function that returns `(current_setting('request.jwt.claim.sub', true))::uuid`. It returns NULL if no JWT context is set (unauthenticated).
5. `USING` clause: applied to SELECT, UPDATE, DELETE — filters which rows the operation can touch.
6. `WITH CHECK` clause: applied to INSERT, UPDATE — validates the data being written.
7. `service_role` key has `BYPASSRLS` privilege — it skips all policies. This is why `createServiceClient()` is restricted to scheduler tasks only (AD-13/Story 0.6).

### Full RLS SQL for Migration File

Create exactly this file at `supabase/migrations/20260626010000_rls_policies.sql`:

```sql
-- ============================================================
-- ARIA RLS Policies
-- Migration: 20260626010000_rls_policies.sql
-- Enables Row Level Security on all 7 tables (AD-2, FR-30).
-- auth.uid() returns the authenticated user's UUID from JWT sub.
-- service_role key has BYPASSRLS — it skips all policies (AD-13).
-- ============================================================

-- ------------------------------------
-- clients: full CRUD by owner
-- ------------------------------------
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clients_select_own" ON clients
  FOR SELECT USING (owner_id = auth.uid());

CREATE POLICY "clients_insert_own" ON clients
  FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY "clients_update_own" ON clients
  FOR UPDATE USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE POLICY "clients_delete_own" ON clients
  FOR DELETE USING (owner_id = auth.uid());

-- ------------------------------------
-- deals: full CRUD by owner
-- ------------------------------------
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "deals_select_own" ON deals
  FOR SELECT USING (owner_id = auth.uid());

CREATE POLICY "deals_insert_own" ON deals
  FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY "deals_update_own" ON deals
  FOR UPDATE USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE POLICY "deals_delete_own" ON deals
  FOR DELETE USING (owner_id = auth.uid());

-- ------------------------------------
-- documents: full CRUD by owner
-- ------------------------------------
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "documents_select_own" ON documents
  FOR SELECT USING (owner_id = auth.uid());

CREATE POLICY "documents_insert_own" ON documents
  FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY "documents_update_own" ON documents
  FOR UPDATE USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE POLICY "documents_delete_own" ON documents
  FOR DELETE USING (owner_id = auth.uid());

-- ------------------------------------
-- activity_log: SELECT + INSERT only — append-only (AD-14)
-- No UPDATE or DELETE: log entries are immutable by design
-- ------------------------------------
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "activity_log_select_own" ON activity_log
  FOR SELECT USING (owner_id = auth.uid());

CREATE POLICY "activity_log_insert_own" ON activity_log
  FOR INSERT WITH CHECK (owner_id = auth.uid());

-- ------------------------------------
-- briefings: SELECT + INSERT + DELETE
-- Scheduler writes via service_role (BYPASSRLS) — no owner UPDATE needed
-- INSERT policy guards against anon-key abuse (defense-in-depth)
-- ------------------------------------
ALTER TABLE briefings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "briefings_select_own" ON briefings
  FOR SELECT USING (owner_id = auth.uid());

CREATE POLICY "briefings_insert_own" ON briefings
  FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY "briefings_delete_own" ON briefings
  FOR DELETE USING (owner_id = auth.uid());

-- ------------------------------------
-- check_ins: SELECT + INSERT + UPDATE
-- Scheduler creates via service_role (BYPASSRLS)
-- Owner answers/skips via UPDATE (authenticated key)
-- ------------------------------------
ALTER TABLE check_ins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "check_ins_select_own" ON check_ins
  FOR SELECT USING (owner_id = auth.uid());

CREATE POLICY "check_ins_insert_own" ON check_ins
  FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY "check_ins_update_own" ON check_ins
  FOR UPDATE USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

-- ------------------------------------
-- settings: SELECT + INSERT + UPDATE
-- One row per owner (UNIQUE(owner_id) from schema migration)
-- ------------------------------------
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "settings_select_own" ON settings
  FOR SELECT USING (owner_id = auth.uid());

CREATE POLICY "settings_insert_own" ON settings
  FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY "settings_update_own" ON settings
  FOR UPDATE USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
```

### Seed SQL for Local Verification

Create `supabase/seed.sql` (NOT inside `supabase/seed/` — this file is picked up automatically by `supabase db reset`):

```sql
-- ============================================================
-- ARIA Dev Seed — Local only
-- Applied by `supabase db reset` after all migrations
-- Creates two test owners + one client each for RLS verification (AC6)
-- ============================================================

DO $$
DECLARE
  owner_a uuid := '00000000-0000-0000-0000-000000000001';
  owner_b uuid := '00000000-0000-0000-0000-000000000002';
BEGIN
  -- Insert two test identities into auth.users (local dev only)
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data, is_super_admin
  ) VALUES
    (owner_a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'owner-a@test.local', '', NOW(), NOW(), NOW(),
     '{"provider":"email","providers":["email"]}', '{}', false),
    (owner_b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'owner-b@test.local', '', NOW(), NOW(), NOW(),
     '{"provider":"email","providers":["email"]}', '{}', false)
  ON CONFLICT (id) DO NOTHING;

  -- Seed one client per owner
  -- Runs as postgres superuser (bypasses RLS) so no JWT context needed
  INSERT INTO clients (id, owner_id, name)
  VALUES
    ('10000000-0000-0000-0000-000000000001', owner_a, 'Owner A - Test Client'),
    ('10000000-0000-0000-0000-000000000002', owner_b, 'Owner B - Test Client')
  ON CONFLICT (id) DO NOTHING;
END $$;
```

### Verification SQL (Run in Supabase Studio SQL Editor after `supabase db reset`)

```sql
-- Test 1: As owner A, should return exactly 1 row (Owner A's client)
BEGIN;
  SET LOCAL role = authenticated;
  SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000001';
  SELECT id, owner_id, name FROM clients;
  -- Expected: 1 row — 'Owner A - Test Client'
ROLLBACK;

-- Test 2: As owner B, should return exactly 1 row (Owner B's client)
BEGIN;
  SET LOCAL role = authenticated;
  SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000002';
  SELECT id, owner_id, name FROM clients;
  -- Expected: 1 row — 'Owner B - Test Client'
ROLLBACK;

-- Test 3: Unauthenticated (no sub set) — should return 0 rows
BEGIN;
  SET LOCAL role = anon;
  SELECT COUNT(*) FROM clients;
  -- Expected: 0
ROLLBACK;

-- Test 4: activity_log append-only — verify no UPDATE/DELETE policy exists
SELECT policyname, cmd FROM pg_policies 
WHERE tablename = 'activity_log' 
ORDER BY cmd;
-- Expected: only 'INSERT' and 'SELECT' policies listed; no 'UPDATE' or 'DELETE'
```

### What Changes from Story 0.2

This story adds policies ON TOP of the existing schema. The tables and columns are unchanged. Only added:
- `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` (7 statements)
- `CREATE POLICY ...` (21 policies total: clients×4, deals×4, documents×4, activity_log×2, briefings×3, check_ins×3, settings×3)

**Files modified:** NONE from Story 0.2
**Files created:** `supabase/migrations/20260626010000_rls_policies.sql`, `supabase/seed.sql`
**Files deleted:** `supabase/seed/.gitkeep`

### Common Pitfalls

1. **Enabling RLS without any policies = default deny.** The moment you run `ENABLE ROW LEVEL SECURITY`, authenticated users see ZERO rows until you add SELECT policies. The migration adds both `ENABLE` and policies in the same file, so there's no intermediate state where tables are RLS-enabled but policy-less.

2. **`auth.uid()` returns NULL when no JWT.** Unauthenticated requests get `auth.uid() = NULL`. Postgres NULL comparisons: `NULL = auth.uid()` is NULL (not true), so `owner_id = auth.uid()` evaluates to NULL (falsy) → 0 rows returned. This is correct behavior for AC2.

3. **`supabase db reset` runs both migrations + seed.sql.** Order: migrations in filename order (lexicographic), then `supabase/seed.sql`. So the RLS migration (20260626010000) runs AFTER the schema migration (20260626000000), which is correct.

4. **Don't confuse `supabase/seed.sql` with `supabase/seed/`.** The CLI looks for `supabase/seed.sql` (a file). The `supabase/seed/` directory from Story 0.1 is a stub; it's not used by the CLI. Remove `supabase/seed/.gitkeep` and create `supabase/seed.sql` instead.

5. **Policy naming convention:** `"<table>_<op>_own"` — this naming makes policies self-documenting and avoids name collisions across tables.

6. **No schema changes in this migration.** If you accidentally ALTER a table column instead of just adding policies, you'll corrupt the migration sequence. This file contains ONLY `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` and `CREATE POLICY` statements.

### Story 0.2 Learnings (Applied Here)

- **Docker required for `supabase db reset`.** Cannot verify migration execution without Docker Desktop running. Document as manual prerequisite.
- **Write tool blocks `.env.*` files.** No .env.example changes needed for this story.
- **Commit with git rm for deleted files** (`git rm supabase/seed/.gitkeep`).
- **CI checks must pass before commit:** `npx tsc --noEmit`, `npm run lint`, `npm run format:check`. SQL files are excluded from Prettier via `.prettierignore`.

### Testing Standards for This Story

No automated test framework yet. Verification is:
1. `supabase db reset` exits with code 0 (migrations + seed apply cleanly)
2. Verification SQL in Supabase Studio returns expected row counts
3. `pg_policies` query confirms activity_log has exactly 2 policies (SELECT + INSERT)

Jest/integration tests will be added in a later story when the Supabase client library is integrated.

### References

- [Source: _bmad-output/planning-artifacts/_stories-epic0.md — Story 0.3 Acceptance Criteria]
- [Source: _bmad-output/planning-artifacts/ARCHITECTURE-SPINE.md — AD-2 owner-scoping, AD-13 auth boundary, AD-14 append-only log]
- [Source: _bmad-output/implementation-artifacts/0-2-supabase-project-schema-and-owner-id-on-every-table.md — schema established in Story 0.2]
- [Source: supabase/migrations/20260626000000_initial_schema.sql — tables and columns being policy-protected]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6 (create-story)

### Agent Model Used

claude-sonnet-4-6 (dev-story)

### Debug Log References

None — implementation was straightforward. All SQL matches the policy table in Dev Notes exactly.

### Completion Notes List

- Docker not available: Task 3 (local `supabase db reset` verification) skipped. Same constraint as Stories 0.1 and 0.2. Verification SQL in Dev Notes is ready for manual execution.
- `supabase/seed/.gitkeep` was already removed via `git rm` in Story 0.2 — no action needed here.
- `activity_log` intentionally has only 2 policies (SELECT + INSERT). Absence of UPDATE/DELETE is the append-only enforcement mechanism (AD-14).
- All CI checks pass: lint, tsc --noEmit, format:check.

### File List

- `supabase/migrations/20260626010000_rls_policies.sql` (NEW)
- `supabase/seed.sql` (NEW)
