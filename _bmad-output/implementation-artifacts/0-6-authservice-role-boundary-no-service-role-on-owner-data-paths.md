---
baseline_commit: 8bfde0bb8a66f7d9db9bfad7c7a7fe43af4bdc40
---

# Story 0.6: Auth/Service-Role Boundary — No Service-Role on Owner-Data Paths (AD-13)

Status: review

## Story

As a developer, I want a verified, enforced convention — backed by a lint rule or integration test — that no request handler serving owner data uses the Supabase service-role client, so that the RLS enforcement established in Stories 0.3–0.4 cannot be silently bypassed in future epics (AD-13).

## Acceptance Criteria

1. **Given** two Supabase client factories exist in `lib/supabase/`:
   - `createServerClient()` — creates a Supabase client using the anon key + the authenticated user's session (for owner-data paths);
   - `createServiceClient()` — creates a Supabase client using the service-role key (for system/scheduler paths only),
   **Then** these are the only two factories; no other code constructs a Supabase client directly.

2. **Given** a request handler in `app/api/` or a Server Action,
   **When** it accesses owner data (any of: `clients`, `deals`, `documents`, `activity_log`, `briefings`, `check_ins`),
   **Then** it uses `createServerClient()` exclusively; use of `createServiceClient()` in any owner-data handler causes a test or lint failure.

3. **Given** an ESLint rule or custom lint check is configured,
   **When** `createServiceClient` is imported in any file under `app/api/` or `app/` (except explicitly allowlisted scheduler/system paths),
   **Then** the lint check reports an error; CI fails.

4. **Given** a scheduled Edge Function that legitimately needs service-role access (e.g. the briefing job acting for a known owner),
   **When** it runs,
   **Then** it uses `createServiceClient()` but immediately scopes every query to a specific `owner_id`; this is documented in a code comment referencing AD-13.

5. **Given** an integration test,
   **When** a request is made to any owner-data API route without a valid session,
   **Then** the route returns HTTP 401; no row is returned; confirming that the service-role path is not the fallback for unauthenticated requests.

## Tasks / Subtasks

- [x] **Task 1: Add `createServiceClient()` to `lib/supabase/server.ts`** (AC: 1)
  - [x] Added `createServiceClient()` export to `lib/supabase/server.ts` — uses `NEXT_PUBLIC_SUPABASE_URL` and `getSupabaseServiceRoleKey()` from `lib/secrets.ts`
  - [x] Uses `@supabase/supabase-js` `createClient` directly (stateless; no cookies)
  - [x] `autoRefreshToken: false`, `persistSession: false` — service client never manages user sessions
  - [x] AD-13 comment directly on the factory

- [x] **Task 2: Create ESLint rule to block `createServiceClient` in `app/` paths** (AC: 2, 3)
  - [x] Added `overrides` block to `.eslintrc.json` with `no-restricted-imports` rule
  - [x] Rule covers `app/**/*.ts`, `app/**/*.tsx`; error message references AD-13
  - [x] Verified: dummy test file `app/_lint_test_delete_me.ts` importing `createServiceClient` caused lint error; rule fires correctly
  - [x] Dummy file overwritten with placeholder export (cannot delete via bash — see Completion Notes)

- [x] **Task 3: Add `SUPABASE_URL` to `lib/supabase/server.ts`** (AC: 1)
  - [x] Uses `process.env.NEXT_PUBLIC_SUPABASE_URL` — the value is public-safe; no separate server alias needed. Documented in Completion Notes.

- [x] **Task 4: Create integration test for unauthenticated 401** (AC: 5)
  - [x] No owner-data API routes exist yet. Documented in Completion Notes.

- [x] **Task 5: CI checks and commit** (AC: all)
  - [x] `npm run lint` — passes (no-restricted-imports rule active)
  - [x] `npx tsc --noEmit` — passes
  - [x] `npm run format:check` — passes

## Dev Notes

### Architecture Constraints (Non-Negotiable)

- **AD-13 — Auth boundary.** The service-role key bypasses RLS. It must NEVER be used in request handlers that serve owner data. Only schedulers/system tasks (which know the exact `owner_id` they're acting for) may use it, and even then they must scope every query to a specific `owner_id`.
- **Story 0.5 dependency.** `getSupabaseServiceRoleKey()` is in `lib/secrets.ts` (Story 0.5). Import it here.
- **`createServerClient()` already exists** in `lib/supabase/server.ts` (Story 0.4). This story only ADDS `createServiceClient()` to the same file.

### `createServiceClient()` Implementation

```typescript
import { createClient } from '@supabase/supabase-js'
import { getSupabaseServiceRoleKey } from '@/lib/secrets'

// AD-13: service-role key bypasses RLS.
// NEVER use this factory in request handlers serving owner data.
// Use only in scheduler/system tasks that scope queries to a known owner_id.
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    getSupabaseServiceRoleKey(),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}
```

Notes:
- `autoRefreshToken: false` and `persistSession: false` — the service client is stateless and must not try to manage user sessions.
- Uses `@supabase/supabase-js` `createClient` directly (not `@supabase/ssr`'s `createServerClient`) — no cookie handling needed.
- `NEXT_PUBLIC_SUPABASE_URL` is safe to read server-side even though it has the NEXT_PUBLIC_ prefix.

### ESLint `no-restricted-imports` Rule

Add to `.eslintrc.json` (or extend `eslintrc` if it's in `package.json`):

```json
{
  "overrides": [
    {
      "files": ["app/**/*.ts", "app/**/*.tsx"],
      "rules": {
        "no-restricted-imports": [
          "error",
          {
            "paths": [
              {
                "name": "@/lib/supabase/server",
                "importNames": ["createServiceClient"],
                "message": "AD-13: createServiceClient() bypasses RLS. Do not use in app/ request handlers. Use createServerClient() instead."
              }
            ]
          }
        ]
      }
    }
  ]
}
```

Check current ESLint config location: look for `.eslintrc.json`, `.eslintrc.js`, or `eslintConfig` in `package.json`. Next.js 14 projects typically have `.eslintrc.json` at root.

### AC-4: Scheduler Edge Functions

Scheduler Edge Functions (Epic 4+) will live in `supabase/functions/` — outside `app/`. They are NOT covered by the lint rule. When they're implemented, each one must:
1. Import `createServiceClient` from `lib/supabase/server` (allowed — not in `app/`)
2. Scope every query: `.eq('owner_id', knownOwnerId)` (even though service-role bypasses RLS, the explicit filter is defense-in-depth)
3. Include a comment: `// AD-13: service-role — scoped to owner_id=${ownerId}`

### AC-5: Integration Test

No API routes serving owner data exist yet. The 401 gate will be implemented in Epic 1 when the first owner-data API route is created. The middleware (Story 0.4) is the primary guard:
- Unauthenticated requests to any route are redirected to `/auth/login` by the middleware BEFORE the route handler executes.
- When API routes are added, they must also call `createServerClient().auth.getUser()` and return `NextResponse.json({ error: 'Unauthorized' }, { status: 401 })` on null user (not rely solely on the middleware redirect).

### Current `lib/supabase/server.ts` (Story 0.4)

```typescript
import { createServerClient as createSupabaseSSRClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export function createServerClient() {
  const cookieStore = cookies()
  return createSupabaseSSRClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: { ... }
    }
  )
}
```

Add `createServiceClient()` AFTER the existing `createServerClient()` export in this same file.

### Current ESLint Config

Check for `.eslintrc.json` at project root. Next.js scaffold creates one. It likely contains:
```json
{
  "extends": "next/core-web-vitals"
}
```

Add an `overrides` block for the `no-restricted-imports` rule.

### Story 0.4 and 0.5 Learnings

- `.env.*` files blocked by deny rules.
- CI checks must pass (`lint`, `tsc --noEmit`, `format:check`) before commit.
- No Docker available for local Supabase testing.

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6 (dev-story)

### Debug Log References

None — implementation straightforward.

### Completion Notes List

- `NEXT_PUBLIC_SUPABASE_URL` used in `createServiceClient()` — it's the same Supabase project URL used by the anon client. Safe server-side. No separate server-alias env var needed.
- Lint rule verification: created `app/_lint_test_delete_me.ts` to verify rule fires. It caused the expected lint error. File was then overwritten with a placeholder `export {}` because the Bash `rm` command is blocked by permission policy. The placeholder must be deleted manually before or after this commit (it contains no application logic).
- AC-5 (integration test for 401): No owner-data API routes exist yet. The middleware (Story 0.4) is the primary unauthenticated-request guard. When the first API route is added in Epic 1, it must call `createServerClient().auth.getUser()` and return `{ status: 401 }` on null user.
- `createServiceClient()` from `lib/supabase/server.ts` is importable from `lib/`, `supabase/functions/`, and any non-`app/` path — only `app/` paths are lint-restricted.

### File List

- `lib/supabase/server.ts` (MODIFIED — added `createServiceClient()`)
- `.eslintrc.json` (MODIFIED — added `no-restricted-imports` override for `app/`)
- `app/_lint_test_delete_me.ts` (NEW — placeholder, delete manually)
