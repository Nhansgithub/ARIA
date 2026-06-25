## Epic 0: Foundation

**Goal:** A deployed, secure, owner-scoped application skeleton — with auth, schema, RLS, secret custody, and AI-call scaffolding — that every later epic builds on without revisiting infrastructure.

---

### Story 0.1: Project Scaffold, CI, and Vercel Deploy

As a developer, I want a Next.js 14 (App Router) monorepo scaffolded, connected to a Vercel project, and running a baseline CI pipeline, so that all later stories have a stable, deployable home from the first commit.

**Acceptance Criteria:**

**Given** a fresh repository,
**When** the scaffold is created,
**Then** the project uses Next.js 14 with the App Router, TypeScript strict mode, ESLint, and Prettier configured at root.

**Given** the repository is connected to Vercel,
**When** a commit is pushed to `main`,
**Then** Vercel automatically builds and deploys the app to a preview/production URL with no manual step.

**Given** a CI workflow file is present (GitHub Actions or equivalent),
**When** a pull request is opened,
**Then** CI runs `tsc --noEmit`, ESLint, and (once any test exists) the test suite; the pipeline fails visibly if any check fails.

**Given** the project structure,
**Then** the following top-level directories exist and are empty/stub-ready: `app/` (Next.js routes), `lib/` (shared utilities), `supabase/` (migrations + seed), `components/` (UI), `services/` (server-only service modules); no business logic lives in `app/` directly.

**Given** the deployment runs,
**When** the root URL is visited,
**Then** a minimal placeholder page renders (e.g. "ARIA — coming soon") confirming a successful end-to-end deploy; no auth or data is required at this stage.

---

### Story 0.2: Supabase Project, Schema, and owner_id on Every Table

As a developer, I want the Supabase project provisioned and the full v0 schema from addendum §B applied via versioned migrations — with `owner_id uuid` on every table and a foreign-key reference to `auth.users` — so that every later epic has a persistence substrate that is owner-scoped by design (AD-2).

**Acceptance Criteria:**

**Given** a Supabase project is created (staging + production environments),
**When** the migration is applied,
**Then** the following tables exist with at minimum the columns defined in addendum §B: `clients`, `deals`, `documents`, `activity_log`, `briefings`, `check_ins`, `settings`.

**Given** the schema is applied,
**Then** every table carries an `owner_id uuid NOT NULL` column with a foreign key referencing `auth.users(id)` and an index on `owner_id` for query performance (AD-2).

**Given** the `briefings` table,
**Then** a `UNIQUE(owner_id, date)` constraint exists, preventing duplicate daily briefings per owner (AD-7).

**Given** the `check_ins` table,
**Then** a composite uniqueness guard (e.g. unique partial index or constraint) prevents more than one pending check-in per `(owner_id, deal_id)` per cadence window (AD-7).

**Given** the migrations directory (`supabase/migrations/`),
**Then** every schema change is expressed as a numbered, up-only SQL migration file; no schema change is applied by hand outside migrations; the migration history is committed to the repository.

**Given** a developer runs the Supabase CLI locally,
**Then** `supabase db reset` applies all migrations cleanly from scratch with no errors.

---

### Story 0.3: Row Level Security Policies on All Tables

As a developer, I want Postgres Row Level Security enabled and enforced on every table — filtering all reads and writes by the authenticated owner — so that no query path can ever return or mutate another owner's data, satisfying AD-2 and FR-30.

**Acceptance Criteria:**

**Given** RLS is enabled on all tables,
**When** a database query is executed using the authenticated owner's session (Supabase anon key + JWT),
**Then** the query returns only rows where `owner_id` matches the authenticated user's `auth.uid()`; rows belonging to any other owner are invisible and unmodifiable.

**Given** RLS is enabled,
**When** an unauthenticated request attempts a SELECT, INSERT, UPDATE, or DELETE on any table,
**Then** zero rows are returned or affected; no error reveals the existence of other owners' data.

**Given** the `activity_log` table,
**When** the RLS policy is applied,
**Then** both SELECT and INSERT are filtered to the authenticated owner's `owner_id` so the log cannot be read or poisoned cross-owner.

**Given** the `briefings` table,
**When** the SELECT policy is active,
**Then** a query for `date = today` returns at most one row — the row for the requesting owner — regardless of how many owners have briefings for that date.

**Given** the policy definitions are written as SQL in `supabase/migrations/`,
**Then** every table's RLS policies (SELECT, INSERT, UPDATE, DELETE where applicable) are expressed in migration files and version-controlled; no policy is applied via the Supabase dashboard only.

**Given** a test or manual verification step,
**When** two seeded test owners each have one client row, and a query runs as owner A,
**Then** owner B's client row is not returned; the test passes deterministically.

---

### Story 0.4: Email/Password Authentication and Protected Session (FR-34)

As an Owner, I want to sign up and sign in with email and password — and have my session enforced on every route — so that unauthenticated access to ARIA is denied and all data operations are automatically scoped to my account (FR-34, AD-13).

**Acceptance Criteria:**

**Given** the `/auth/login` page is rendered,
**When** the Owner submits a valid email and password,
**Then** Supabase Auth creates a session; the Owner is redirected to the app's authenticated home route; the session cookie/token is set.

**Given** the `/auth/signup` page is rendered,
**When** the Owner submits a new valid email and password,
**Then** Supabase Auth creates the user record in `auth.users`; the Owner may be asked to confirm their email (configurable); on confirmation/completion the Owner is redirected to the authenticated home route.

**Given** a user is not authenticated,
**When** any authenticated route (e.g. `/`, `/chat`, `/settings`) is requested,
**Then** the request is redirected to `/auth/login`; no owner data is returned in the response.

**Given** the Owner has an active session,
**When** an API route handler or Server Action is called,
**Then** the handler retrieves the session via `supabase.auth.getUser()` (not from a client-passed token); the handler rejects the request with 401 if no valid session is found.

**Given** the Owner logs out,
**When** the logout action is invoked,
**Then** the Supabase session is destroyed server-side; subsequent requests to authenticated routes redirect to login.

**Given** a valid session exists,
**When** the session JWT is decoded,
**Then** `auth.uid()` matches the `owner_id` used by RLS policies — confirming the auth boundary is intact (AD-13).

---

### Story 0.5: Server-Side Secret Custody (AD-11)

As a developer, I want all third-party credentials — Anthropic API key, Supabase service-role key, Zalo OA credentials, and SMTP creds — stored exclusively in server-side environment variables, never accessible to the client, so that AD-11 is satisfied from the first commit.

**Acceptance Criteria:**

**Given** the Vercel project configuration,
**When** environment variables are set,
**Then** the following variables exist as server-only (not `NEXT_PUBLIC_`): `ANTHROPIC_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ZALO_OA_APP_ID`, `ZALO_OA_APP_SECRET`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`; none of these are prefixed `NEXT_PUBLIC_`.

**Given** the Next.js application bundle is built,
**When** the client-side JavaScript bundle is inspected (e.g. `next build` + bundle analysis),
**Then** none of the server-only secret variable names or their values appear in any file served to the browser.

**Given** any server-side route handler, Server Action, or Edge Function,
**When** a secret is accessed,
**Then** it is read from `process.env` only within server-side code; no secret is passed as a prop, returned in an API response body, or written to a log line.

**Given** the `SUPABASE_SERVICE_ROLE_KEY`,
**When** it is used in code,
**Then** it appears only in narrowly scoped, audited system tasks (e.g. a scheduled Edge Function acting for a known owner) and is never used in a request handler that serves owner data — enforcing the service-role/owner-data boundary of AD-13.

**Given** a `.env.example` file is committed,
**Then** it lists every required environment variable with a placeholder value and a comment describing its purpose; the actual `.env.local` file is listed in `.gitignore` and never committed.

**Given** the Zalo OA refresh token (which must be encrypted at rest per AD-11),
**When** the token storage schema is created,
**Then** the `settings` table carries an `encrypted_zalo_refresh_token` column (or equivalent); the encryption/decryption function uses a server-side key; the plaintext token is never stored in Postgres directly.

---

### Story 0.6: Auth/Service-Role Boundary — No Service-Role on Owner-Data Paths (AD-13)

As a developer, I want a verified, enforced convention — backed by a lint rule or integration test — that no request handler serving owner data uses the Supabase service-role client, so that the RLS enforcement established in Stories 0.3–0.4 cannot be silently bypassed in future epics (AD-13).

**Acceptance Criteria:**

**Given** two Supabase client factories exist in `lib/supabase/`:
- `createServerClient()` — creates a Supabase client using the anon key + the authenticated user's session (for owner-data paths);
- `createServiceClient()` — creates a Supabase client using the service-role key (for system/scheduler paths only),
**Then** these are the only two factories; no other code constructs a Supabase client directly.

**Given** a request handler in `app/api/` or a Server Action,
**When** it accesses owner data (any of: `clients`, `deals`, `documents`, `activity_log`, `briefings`, `check_ins`),
**Then** it uses `createServerClient()` exclusively; use of `createServiceClient()` in any owner-data handler causes a test or lint failure.

**Given** an ESLint rule or custom lint check is configured,
**When** `createServiceClient` is imported in any file under `app/api/` or `app/` (except explicitly allowlisted scheduler/system paths),
**Then** the lint check reports an error; CI fails.

**Given** a scheduled Edge Function that legitimately needs service-role access (e.g. the briefing job acting for a known owner),
**When** it runs,
**Then** it uses `createServiceClient()` but immediately scopes every query to a specific `owner_id` (i.e. it does not issue unfiltered cross-owner queries); this is documented in a code comment referencing AD-13.

**Given** an integration test,
**When** a request is made to any owner-data API route without a valid session,
**Then** the route returns HTTP 401; no row is returned; confirming that the service-role path is not the fallback for unauthenticated requests.

---

### Story 0.7: AI-Call Wrapper — Token Logging, Cache Contract, and Degradation Envelope (AD-5, AD-6)

As a developer, I want a single shared `callAI()` utility that wraps every Anthropic API call — enforcing the prompt-cache-friendly assembly order, logging per-call token counts, and returning the standard degradation envelope — so that all later epics inherit cost observability, cache hits, and consistent failure behavior from day one (AD-5, AD-6).

**Acceptance Criteria:**

**Given** a file `lib/ai/callAI.ts` (or equivalent) is the sole entry point for Anthropic API calls,
**When** any server-side code needs to call Claude,
**Then** it imports and calls `callAI()`; no epic directly instantiates the Anthropic SDK client outside this module.

**Given** `callAI()` is invoked,
**When** it assembles the prompt,
**Then** it constructs the messages array in this exact order: (1) system prompt with `cache_control: { type: "ephemeral" }` breakpoint, (2) tool definitions (deterministically ordered, same list every call for a given specialist), (3) Business Context block (when provided) with a second `cache_control` breakpoint, (4) per-call volatile content (fetched CRM entities, conversation turns, user message); no timestamps, UUIDs, or per-request IDs appear before the last breakpoint (AD-5).

**Given** an API call completes (success or error),
**When** the response includes a `usage` object,
**Then** `callAI()` logs the following to the console (and to a structured log sink when one exists): `{ model, specialist, input_tokens, output_tokens, cache_read_input_tokens, cache_creation_input_tokens, latency_ms, call_id }`; cache-hit confirmation is visible via `cache_read_input_tokens > 0` (AD-5).

**Given** `callAI()` is invoked and the Anthropic API returns an error, times out (default timeout: 10 s to first token), or returns a rate-limit response,
**When** the error is caught,
**Then** `callAI()` returns a typed object `{ status: "degraded" | "error", data: null, degraded_reason: string }` — never throws an unhandled exception to the caller (AD-6).

**Given** `callAI()` returns a successful response,
**Then** it returns `{ status: "ok", data: <assistant message content> }` — the same envelope shape as the degraded case, so callers handle both branches uniformly.

**Given** a unit test for `callAI()`,
**When** the Anthropic SDK is mocked to throw a network error,
**Then** the wrapper returns `{ status: "degraded", data: null, degraded_reason: "Network error" }` without throwing; the test passes.

**Given** a unit test for the prompt assembly,
**When** `callAI()` is called with a system prompt, tool list, Business Context, and a user message,
**Then** the assembled messages array has the stable prefix (system + tools + Business Context) before the volatile user turn; the order is asserted in the test.
