---
baseline_commit: ""
---

# Story 0.6: Auth/Service-Role Boundary — No Service-Role on Owner-Data Paths (AD-13)

Status: ready-for-dev

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

- [ ] **Task 1: Add `createServiceClient()` to `lib/supabase/server.ts`** (AC: 1)
  - [ ] Add `createServiceClient()` export to `lib/supabase/server.ts` — uses `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (via `getSupabaseServiceRoleKey()` from `lib/secrets.ts`)
  - [ ] `createServiceClient()` does NOT use cookies — it authenticates via the service-role key directly
  - [ ] Add a code comment on `createServiceClient()` referencing AD-13: "service-role — NEVER use in owner-data request handlers"
  - [ ] `lib/supabase/server.ts` already imports from `next/headers` for `createServerClient()` — `createServiceClient()` must NOT use `next/headers` (it's stateless)

- [ ] **Task 2: Create ESLint rule to block `createServiceClient` in `app/` paths** (AC: 2, 3)
  - [ ] Create `.eslintrc.json` (or update `eslint.config.js` if present) with a `no-restricted-imports` rule
  - [ ] The rule must block `import { createServiceClient } from '@/lib/supabase/server'` (and any other import of `createServiceClient`) in files matching `app/**/*.ts`, `app/**/*.tsx`
  - [ ] Allowlist explicitly: no current files in `app/` legitimately use `createServiceClient`
  - [ ] Note: scheduler Edge Functions live in `supabase/functions/` (not `app/`) — they are NOT blocked
  - [ ] Verify the lint rule fires: create a dummy test file, see it fail lint, then remove it

- [ ] **Task 3: Add `SUPABASE_URL` env var to `lib/supabase/server.ts`** (AC: 1)
  - [ ] `createServiceClient()` needs `SUPABASE_URL` (the service-role URL, same as `NEXT_PUBLIC_SUPABASE_URL` in value but accessed server-side)
  - [ ] Read from `process.env.NEXT_PUBLIC_SUPABASE_URL` — this is safe for server-side use even though NEXT_PUBLIC_ values are also public
  - [ ] OR add a server-side alias `SUPABASE_URL` to the secrets list; document the choice in Completion Notes

- [ ] **Task 4: Create integration test for unauthenticated 401** (AC: 5)
  - [ ] Since jest is not installed and no API routes exist yet, this AC cannot be tested end-to-end
  - [ ] Document in Completion Notes: "No owner-data API routes exist yet; 401 gate will be verified when first API route is added in Epic 1. Pattern established: all future routes must call `createServerClient().auth.getUser()` and return 401 on null user."
  - [ ] The middleware (Story 0.4) already enforces authentication at the edge for all routes — this is the primary guard

- [ ] **Task 5: CI checks and commit** (AC: all)
  - [ ] Run `npm run lint` — must pass including new ESLint rule
  - [ ] Run `npx tsc --noEmit` — must pass
  - [ ] Run `npm run format:check` — must pass
  - [ ] Commit all modified files

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

claude-sonnet-4-6 (create-story)

### Debug Log References

### Completion Notes List

### File List
