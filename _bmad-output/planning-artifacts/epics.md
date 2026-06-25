---
stepsCompleted: [step-01-validate-prerequisites, step-02-design-epics, step-03-create-stories]
inputDocuments:
  - PRD.md (v2.0, final)
  - ARCHITECTURE-SPINE.md (final, AD-1..AD-14)
  - ux/DESIGN.md (final)
  - ux/EXPERIENCE.md (final)
status: final
updated: 2026-06-25
---

# ARIA — Epic Breakdown

## Overview

Complete epic and story breakdown for ARIA, decomposing the PRD (v2.0), Architecture Spine (AD-1..AD-14), and UX contracts (DESIGN.md / EXPERIENCE.md) into implementable, dependency-ordered stories with Given/When/Then acceptance criteria for the Developer agent.

**MVP = Epics 0–5.** Each epic is standalone (delivers value without requiring a later epic) and enables the next. Order: **0 Foundation → 1 Consultant Core → 2 CRM & Memory → 3 Documents → 4 Briefing & Proactivity → 5 Delivery Channels.**

## Requirements Inventory

### Functional Requirements (PRD §4)

FR-1 intent classification & routing · FR-2 bilingual detection & mirroring · FR-3 guidance-stance enforcement · FR-4 Business Context injection · FR-5 graceful degradation · FR-6 four-layer Deal-Intelligence synthesis · FR-7 conversational stub creation · FR-8 AI-maintained Intelligence Fields · FR-9 vision/screenshot extraction · FR-10 similar-deal matching · FR-11 decision-maker tracking · FR-12 stall diagnosis · FR-13 pricing-floor awareness · FR-14 synthesized deal/client status · FR-15 stage-aware next-action · FR-16 stale-deal & follow-up cadence · FR-17 scheduled templated check-ins · FR-18 configurable cadence & answer capture · FR-19 elicitation-first doc creation · FR-20 generation/versioning/storage · FR-21 PDF export · FR-22 missing-document detection · FR-23 specific reasoned strategic advice · FR-24 pattern-detected structural advice · FR-25 scheduled daily briefing + caching · FR-26 briefing structure & detection · FR-27 briefing surfaces (panel + on-demand) · FR-28 Zalo OA chat push · FR-29 email fallback & urgency notification · FR-30 owner-scoped persistence + activity log · FR-31 conversational data maintenance · FR-32 three-mode layout · FR-33 chat interface essentials · FR-34 email/password auth · FR-35 conversation context management · FR-36 guided first-run/empty-state · FR-37 stub lifecycle & de-duplication · FR-38 in-app delivery & notification.

### Non-Functional Requirements (PRD §8–9)

AI latency (streaming, ~3s first-token target); reliability / graceful degradation (AD-6 envelope); **cost discipline & model routing** (AD-4) + **prompt-caching discipline** (AD-5) + per-DI context budget; observability (per-call token logging); bilingual quality (idiomatic Vietnamese); safety (no autonomous client send); privacy & **Vietnam PDPL** posture (AD-10); **owner_id + RLS** (AD-2) and auth/service-role boundary (AD-13); CRM write integrity / append-only log (AD-14).

### UX Design Requirements

Focused-Dark visual system (DESIGN.md) + three-mode shell, voice/tone, state patterns (empty/degraded/streaming/offline), accessibility floor, and Key Flows UJ-1..UJ-6 (EXPERIENCE.md). Both spines win on conflict.

### FR Coverage Map

- **Epic 0 — Foundation:** FR-34. *(Enabler for AD-2 owner_id+RLS, AD-13 auth boundary, AD-11 secrets, AD-5 token-logging, and the persistence substrate every later FR builds on.)*
- **Epic 1 — Consultant Core:** FR-1, FR-2, FR-3, FR-4, FR-5, FR-6, FR-7, FR-9, FR-11, FR-12, FR-13, FR-23, FR-24, FR-32, FR-33, FR-35, FR-36.
- **Epic 2 — CRM & Memory:** FR-8, FR-10, FR-30, FR-31, FR-37.
- **Epic 3 — Documents:** FR-19, FR-20, FR-21, FR-22.
- **Epic 4 — Briefing & Proactivity:** FR-14, FR-15, FR-16, FR-17, FR-18, FR-25, FR-26, FR-27.
- **Epic 5 — Delivery Channels:** FR-28, FR-29, FR-38.

*All 38 FRs mapped. Note: Epic 1 delivers a working consultant using Epic 0's basic persistence + conversational stub creation (FR-7); Epic 2 then makes memory "smart" (auto-maintained fields FR-8, matching FR-10, lifecycle FR-37) — Epic 1 stands alone without Epic 2.*

## Epic List

### Epic 0: Foundation
A deployed, secure, owner-scoped application skeleton — Next.js 14 + Supabase (schema with `owner_id` + RLS on every table), email/password auth, the auth/service-role boundary, server-side secret custody, and a token-logging/observability scaffold. Enables every later epic. **FRs covered:** FR-34 (+ AD-2, AD-11, AD-13, AD-5 observability).

### Epic 1: Consultant Core
The brain. The Owner holds a real consultant conversation — asks, gets reasoned advice, and gets a Deal-Intelligence *read* (including by pasting a Zalo screenshot) — in a working chat UI that teaches, mirrors language, degrades gracefully, and onboards a brand-new user from an empty state. **FRs covered:** FR-1, FR-2, FR-3, FR-4, FR-5, FR-6, FR-7, FR-9, FR-11, FR-12, FR-13, FR-23, FR-24, FR-32, FR-33, FR-35, FR-36.

### Epic 2: CRM & Memory
ARIA gets smarter about each client over time without manual maintenance — auto-maintained Intelligence Fields, similar-deal matching, stub lifecycle & de-duplication, and an append-only activity log. **FRs covered:** FR-8, FR-10, FR-30, FR-31, FR-37.

### Epic 3: Documents
The Owner produces, views, versions, and exports business documents through elicitation-first conversation. **FRs covered:** FR-19, FR-20, FR-21, FR-22.

### Epic 4: Briefing & Proactivity
ARIA runs the pipeline proactively — daily briefing, stale/overdue detection, and scheduled templated check-ins — so nothing slips. **FRs covered:** FR-14, FR-15, FR-16, FR-17, FR-18, FR-25, FR-26, FR-27.

### Epic 5: Delivery Channels
Proactive content reaches the Owner reliably across in-app (authoritative), Zalo OA chat (best-effort), and email (guaranteed). **FRs covered:** FR-28, FR-29, FR-38.

---
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
### Story 0.8: Data Retention, Deletion & AI-Processing Privacy Notice (AD-10, PDPL)

As an Owner, I want a data retention/deletion capability and a clear notice of what is sent to the AI provider, So that ARIA meets Vietnam's PDPL obligations for processing my clients' personal data. *(AD-10 items are pre-LAUNCH gates, but the build lands here so they are tracked from the start.)*

**Acceptance Criteria:**

**Given** the Owner first reaches a point where client PII or a screenshot would be sent to the Anthropic API,
**When** that boundary is first crossed (first deal description or first image upload),
**Then** a one-time in-product privacy notice states that deal/client content and images are processed by an external AI provider (Anthropic) to deliver ARIA's analysis, with a link to a fuller policy; the Owner acknowledges it once and the acknowledgement is recorded. (AD-10; PRD §9.2)

**Given** owner-scoped data and uploaded screenshots in Postgres + Storage,
**When** the retention policy is applied,
**Then** every Client, Deal, Document, and screenshot is Owner-deletable; a delete removes the row(s) and the associated Storage object(s); a Storage lifecycle policy is configured for screenshots. (AD-10; AD-9)

**Given** the Owner requests deletion of a client or deal via conversation or Settings,
**When** the deletion executes,
**Then** the record and its linked screenshots are removed (or hard-archived per policy), the activity log records the deletion with `actor=user`, and no orphaned Storage objects remain. (AD-10; AD-14)

**Given** the PDPL pre-launch obligations (Anthropic DPA executed; Cross-Border Data Transfer Impact Assessment filed with the Ministry of Public Security; full privacy policy published),
**When** the launch checklist is reviewed,
**Then** these are tracked as explicit pre-launch gates (OQ-10) — not required to begin building, but blocking production launch. (AD-10)

---

## Epic 1: Consultant Core

**Goal:** The Owner holds a real consultant conversation — asks, gets reasoned advice, and gets a Deal-Intelligence read (including pasting a Zalo screenshot) — in a working chat UI that teaches, mirrors language, degrades gracefully, and onboards from an empty state.

---

### Story 1.1: Chat UI Shell — Markdown Rendering, Streaming, Stop, and Copy

As an Owner, I want a fully functional chat interface that renders ARIA's responses as formatted text, streams replies in real time, lets me stop generation, and lets me copy any message, So that every subsequent epic can deliver readable, interactive responses from day one.

**Acceptance Criteria:**

**Given** the Owner is authenticated and on the Chat panel,
**When** ARIA sends a response containing Markdown (headers, bullets, bold, tables, inline code, fenced code blocks),
**Then** the rendered output displays formatted content — not raw Markdown symbols — using Plus Jakarta Sans for prose and JetBrains Mono for code blocks, consistent with DESIGN.md tokens. (FR-32, FR-33)

**Given** ARIA is generating a response,
**When** the first token arrives,
**Then** a blinking streaming cursor appears at the end of the in-progress text and the Send button is replaced by a "Stop" button (square-stop icon, label "Dừng lại" / "Stop", `#F87171` color, 44px min touch target). The input field is disabled during streaming. (FR-33; EXPERIENCE.md Stop Generation)

**Given** the Owner taps/clicks "Stop" while ARIA is streaming,
**When** the action completes,
**Then** the partial response is committed to the transcript with a "(stopped)" suffix in `textMuted` color, the Stop button reverts to Send, and the input field re-enables immediately. (FR-33)

**Given** an ARIA message is longer than 400 rendered characters,
**When** the message is displayed,
**Then** only the first ~400 chars are shown with a "Read more" affordance; tapping "Read more" expands the full message; the expanded state persists for that message within the session. (FR-33; §8 NFRs)

**Given** the Owner hovers over (desktop) or long-presses (mobile) any ARIA message,
**When** the copy affordance appears,
**Then** clicking/tapping it copies the message as plain text (no Markdown syntax); the icon briefly shows a checkmark for 1.5s; no toast is shown. (FR-33; EXPERIENCE.md Copy)

**Given** the Owner is on a mobile viewport (< 768px),
**When** the Chat panel renders,
**Then** the layout is single-column with the input bar pinned to the bottom; the sidebar is hidden and replaced by a bottom tab bar. (FR-32; DESIGN.md §4)

**Given** any ARIA message,
**When** a timestamp is rendered,
**Then** it shows "HH:mm" for same-day messages and "ddd HH:mm" for older ones, in `textMuted` style, below the bubble and always visible (not only on hover). (EXPERIENCE.md Chat Message)

**Given** the user bubble,
**When** rendered,
**Then** it is right-aligned with background `#1C2440`, radius `12px 12px 4px 12px`; the ARIA bubble is left-aligned with background `#141A2E`, a `2px solid #14B8A6` left-border accent, and radius `12px 12px 12px 4px`. (DESIGN.md §7.1)

---

### Story 1.2: Orchestrator — Intent Classification and Routing

As an Owner, I want every message I send to be classified into the right Interaction Mode and routed to the appropriate reasoning path, So that deal questions get deep analysis, document requests trigger elicitation, and ambiguous messages get a clarifying question rather than a wrong answer.

**Acceptance Criteria:**

**Given** the Owner sends a message describing a new or ongoing deal opportunity (e.g., "Vừa gặp một chủ F&B, họ muốn làm website"),
**When** the orchestrator classifies intent,
**Then** the message is routed to the Deal Intelligence reasoning path, not the plain Query path. (FR-1; AD-1)

**Given** the Owner sends a document request (e.g., "Draft a proposal for the Hanoi restaurant"),
**When** the orchestrator classifies intent,
**Then** the message is routed to the Document elicitation flow; no document is generated without elicitation. (FR-1; §4.5)

**Given** the Owner asks a pipeline or status question (e.g., "What deals are active?"),
**When** the orchestrator classifies intent,
**Then** the message is routed to the Sales/Pipeline reasoning path using the economical model (Haiku), not the high-judgment model. (FR-1; AD-4)

**Given** the Owner sends a business-level strategic question (e.g., "Should I lower my rates?"),
**When** the orchestrator classifies intent,
**Then** the message is routed to the Strategy Advisor path using the high-judgment model (Sonnet). (FR-1; AD-4)

**Given** the Owner sends an ambiguous message that fits multiple Interaction Modes,
**When** the orchestrator cannot confidently classify intent,
**Then** ARIA responds with a single clarifying question rather than guessing or defaulting to the wrong path. (FR-1)

**Given** any AI call from the orchestrator,
**When** the call is assembled,
**Then** the stable prefix (system prompt → tool definitions → Business Context) carries a `cache_control` breakpoint; volatile content (per-deal data, conversation turns) comes after the stable prefix. (AD-5)

**Given** any orchestrator or specialist AI call,
**When** the call is made,
**Then** it runs server-side only; the client never calls the Claude API directly. (AD-1; AD-3)

---

### Story 1.3: Bilingual Detection and Language Mirroring

As an Owner, I want ARIA to detect whether I write in Vietnamese or English and respond in the same language within the same conversation, So that I can switch languages naturally without configuring anything.

**Acceptance Criteria:**

**Given** the Owner sends a message in Vietnamese (e.g., "Khách hàng này có vẻ phức tạp lắm"),
**When** ARIA responds,
**Then** the response is in Vietnamese, using B2B-appropriate register (addressing the Owner as "Anh", acknowledging problems obliquely, no urgency language). (FR-2; §10)

**Given** the Owner sends a message in English (e.g., "What should I do with this stalled deal?"),
**When** ARIA responds,
**Then** the response is in English, direct and analytical, recommendation first, evidence second; no filler phrases ("Great question!", "Certainly!"). (FR-2; §10)

**Given** the Owner switches language mid-conversation (one message Vietnamese, the next English),
**When** ARIA responds to each message,
**Then** each response mirrors the language of that specific message, not the earlier ones. (FR-2)

**Given** ARIA is generating a client-facing document draft,
**When** the draft is produced,
**Then** it defaults to the Client's `language_pref` field (default Vietnamese), regardless of the Owner's current message language. (FR-2; addendum §B.1)

**Given** the app shell `<html>` element,
**When** rendered,
**Then** the `lang` attribute reflects the current UI display language (default `vi`); inline spans of the opposite language carry the appropriate `lang` attribute for screen-reader support. (EXPERIENCE.md Foundation)

---

### Story 1.4: Business Context Injection

As an Owner, I want ARIA to load my Business Context (agency info, pricing, rules) at the start of every session so its advice is grounded in my specific agency, So that every response is relevant without me re-explaining my situation in every conversation.

**Acceptance Criteria:**

**Given** the Owner begins a new session or sends their first message,
**When** the orchestrator assembles the context for its first AI call,
**Then** the Business Context document (≤ ~2,000 tokens) is injected as part of the stable prompt prefix; no bulk CRM data is pre-loaded — CRM data is fetched on demand via tools. (FR-4; AD-3; AD-5)

**Given** the Business Context contains pricing benchmarks (e.g., web design 20–80M VND, app 60–150M VND, automation 20–60M/workflow VND),
**When** ARIA gives advice that touches pricing,
**Then** the response reflects these benchmarks without the Owner needing to state them. (FR-4; FR-13; addendum §G)

**Given** the Owner navigates to Settings → Business Context,
**When** the Settings panel loads,
**Then** the current Business Context is displayed in an editable form; saving changes persists the update and logs an activity entry with `actor=user`. (FR-4)

**Given** ARIA updates the Business Context as part of a conversation (e.g., after learning the Owner's typical deposit rate),
**When** the update is written,
**Then** it is logged in the activity log with `actor=ai` and the change payload; the Owner is notified of the update in ARIA's reply. (FR-4; AD-14)

**Given** any AI call,
**When** the token budget for Business Context is assembled,
**Then** the injected context stays within ~2,000 tokens; if the stored Business Context exceeds this, it is summarized/trimmed before injection, and the trim is logged. (FR-4; §8 NFRs)

---

### Story 1.5: Guidance Stance Enforcement

As an Owner, I want every piece of advice or Deal Intelligence response from ARIA to explain the reasoning behind it and end with a concrete recommended next step, So that I learn business principles and always know what to do next, even when I have no prior business background.

**Acceptance Criteria:**

**Given** the Owner asks an Advice-mode question (e.g., "Should I lower my rates?"),
**When** ARIA responds,
**Then** the response names a specific recommendation (not just options), states the principle or evidence behind it, and ends with a concrete next step. (FR-3; §4.6)

**Given** the Owner asks a Deal Intelligence question about a specific deal,
**When** ARIA responds,
**Then** the response explains its reasoning out loud ("Based on your last 3 F&B deals…" / "From the domain pattern…") and ends with a single recommended next action. (FR-3; FR-6)

**Given** the Owner states a plan that ARIA detects is likely counterproductive (e.g., discounting a deal where the real objection is a trust gap),
**When** ARIA responds,
**Then** ARIA challenges the plan directly, names the actual issue, and explains the principle at stake — it does not silently accept the flawed premise. (FR-3; addendum §G)

**Given** the Owner explicitly signals they only want information (e.g., "Just tell me the deal status, no advice"),
**When** ARIA responds,
**Then** the response provides the information concisely without appending a next-step recommendation. (FR-3; SM-C3)

**Given** any advisory response in Query mode (pipeline status, field lookup),
**When** rendered,
**Then** the response is terse — it does not pad with guidance that was not needed; over-explanation is a failure mode. (FR-3; SM-C3; §8)

---

### Story 1.6: Graceful Degradation Envelope and UI Banner

As an Owner, I want ARIA to always return something useful — even when the Claude API is unavailable — and to tell me clearly when AI synthesis is offline, So that I am never left with an unhandled error or an infinite spinner.

**Acceptance Criteria:**

**Given** the Claude API returns an error, times out (> ~10s to first token), or is rate-limited,
**When** the degradation condition is detected,
**Then** a full-width degraded-AI banner appears at the top of the main panel with the exact copy: "AI synthesis is temporarily unavailable — showing raw data. Analysis will resume when the connection recovers." (VI: "AI tạm thời không khả dụng — đang hiển thị dữ liệu thô."); the banner uses `rgba(245,158,11,0.12)` background, `1px solid rgba(245,158,11,0.40)` border, `#FBBF24` text, and a Lucide `AlertTriangle` icon (color is not the sole indicator). (FR-5; AD-6; DESIGN.md §7.8)

**Given** the Owner sends a message while the AI is degraded,
**When** ARIA processes the request,
**Then** the response returns available structured CRM data (deal status, fields, last activity) formatted as plain text — no AI synthesis, no recommendations — with a "Retry" link inline. (FR-5; AD-6)

**Given** the daily Briefing generation fails due to API unavailability,
**When** the Briefing panel loads,
**Then** the last successfully cached Briefing is displayed with a sub-banner: "Dữ liệu từ [time]" / "Data from [time]." (FR-5; AD-6)

**Given** any AI-backed operation,
**When** an error occurs,
**Then** no interaction results in an unhandled exception or an indefinite spinner; the degradation envelope (`{ status: ok | degraded | error, data, degraded_reason? }`) is returned and the UI renders accordingly. (AD-6)

**Given** the API recovers after a degraded period,
**When** recovery is detected,
**Then** the banner auto-dismisses without user action; the Owner does not need to manually clear the degraded state. (FR-5; EXPERIENCE.md Degraded State)

**Given** a network-lost error (mid-message),
**When** the error occurs,
**Then** a toast appears (VI: "Mất kết nối. Thử lại không, Anh?" / EN: "Lost connection. Retry?") with a [Retry] CTA; the message text is preserved in the input bar. (EXPERIENCE.md Error)

---

### Story 1.7: Conversational Stub Creation

As an Owner, I want ARIA to automatically create a Client and Deal record in the CRM the moment I mention a new client in conversation, confirm it did so, and ask no more than 2 targeted follow-up questions, So that I never need to manually open a form and my CRM stays current as I talk.

**Acceptance Criteria:**

**Given** the Owner describes a client or deal not in the CRM (e.g., "Tôi vừa gặp một chủ chuỗi F&B — muốn làm website và automation"),
**When** ARIA detects no existing Client matching the described entity,
**Then** ARIA calls `create_client_stub` and `create_deal_stub` (addendum §C) in the background, creates correctly linked records (deal → client), and confirms creation in the reply. (FR-7; AD-1)

**Given** a Stub is being created,
**When** ARIA confirms creation,
**Then** the confirmation message is clear (VI: "Em đã tạo hồ sơ cho [client name] và deal [deal description]") and ARIA asks no more than 2 targeted gap-filling questions in the same turn. (FR-7; EXPERIENCE.md Stub creation microcopy)

**Given** the Owner mentions a client name that closely matches an existing CRM Client,
**When** ARIA processes the mention,
**Then** ARIA offers to link the new deal to the existing Client rather than creating a duplicate — it asks for confirmation before creating any new entity. (FR-37)

**Given** a Stub is created,
**When** it is persisted,
**Then** the record is marked with `stub` status in the status pill (`#F59E0B` accent color, label "Chưa đủ thông tin / Incomplete"), it is excluded from similar-deal pattern matching until minimally enriched, and the activity log records the creation with `actor=ai`. (FR-37; AD-14; EXPERIENCE.md Status Pill)

**Given** an un-enriched Stub that has been idle beyond a configurable period,
**When** the Stub is surfaced in a Deal Intelligence read or Briefing,
**Then** it is flagged for completion or archival; the Owner can merge or discard it via conversation. (FR-37)

---

### Story 1.8: Deal Intelligence — Four-Layer Synthesis with Omission Boundary

As an Owner, I want ARIA to deliver a full consultant's read — across four layers of reasoning — whenever I mention a deal, omitting only sections that genuinely cannot be populated yet, So that I always get actionable judgment, not just data retrieval.

**Acceptance Criteria:**

**Given** the Owner mentions an existing deal with client history and at least one similar past deal,
**When** ARIA produces the Deal Intelligence read,
**Then** the read is structured as: understanding / real need / risk flags / opportunity signals / prediction / recommended approach / documents needed / next action — and ARIA explicitly states when it is drawing on pattern matching ("Based on your last 3 F&B website deals…"). (FR-6; AD-4)

**Given** a new lead with only two sentences of context and no similar deals,
**When** ARIA produces the Deal Intelligence read,
**Then** the read is shorter — only sections with actual data or inferable content are included — but two elements are always present: a one-line *understanding* and a *next action*. ARIA states it is reasoning from domain knowledge, not pattern history. (FR-6 omission boundary)

**Given** any Deal Intelligence read,
**When** risk flags are present,
**Then** each flag carries a severity (HIGH / MEDIUM / LOW) and a reason; severity HIGH is rendered with `#F87171` color and a Lucide `AlertTriangle` icon (color is not the sole indicator). (FR-6; DESIGN.md §7.2)

**Given** Deal Intelligence is triggered,
**When** the AI call is routed,
**Then** it always uses the high-judgment model (Sonnet 4.6); Deal Intelligence is never downgraded to the economical tier regardless of session state or cost pressure. (AD-4; §8)

**Given** an existing deal with Intelligence Fields already populated (`inferred_real_need`, `risk_flags`, `opportunity_signals`, `predicted_outcome`, `prediction_reason`),
**When** ARIA produces a new Deal Intelligence read with updated signals,
**Then** only fields with genuinely changed values are updated in the CRM; a no-op write logs nothing; changed fields are logged in the activity log with `actor=ai` and the change payload. (FR-6; AD-14)

**Given** a Deal Intelligence read that references similar deals,
**When** those links are presented,
**Then** each linked deal includes a `similarity_reason` stated explicitly in the response. (FR-6; FR-10)

**Given** the Owner asks for a Deal Intelligence read and the CRM has Client context available,
**When** ARIA assembles the context for the AI call,
**Then** only the specific client, deal, and similar-deal records are fetched via tools — not the entire CRM; the per-DI-call context budget defined in AD-5/OQ-11 is respected. (FR-6; AD-3; AD-5)

---

### Story 1.9: Vision Input — Screenshot Extraction and CRM Integration

As an Owner, I want to paste or upload a Zalo conversation screenshot and have ARIA extract the deal context from it, fold that into its read, and update the CRM record, So that I never have to manually transcribe Zalo threads.

**Acceptance Criteria:**

**Given** the Owner pastes an image (`Ctrl+V` / `Cmd+V`) or attaches one via the paperclip icon on the Chat panel,
**When** the image is staged,
**Then** a thumbnail preview appears in the input bar above the text field with an "×" remove button; the Owner can send it together with a text message. (FR-9; FR-33; EXPERIENCE.md Image Upload/Paste)

**Given** the Owner sends a message with an attached image,
**When** the message is submitted,
**Then** the image is uploaded to owner-scoped Supabase Storage (AD-9; AD-2), then sent to the vision extraction path using `extract_from_image` (addendum §C) on the high-judgment, vision-capable model (Sonnet 4.6). (FR-9; AD-4; AD-9)

**Given** a legible screenshot of a Zalo conversation,
**When** ARIA processes it,
**Then** extracted text and deal context (client name, stated need, budget mentions, contact name) are reflected in ARIA's response and written to the relevant CRM fields; the activity log records the extraction with `actor=ai`. (FR-9; AD-14)

**Given** a partially unreadable image (blurry, clipped, low contrast),
**When** ARIA processes it,
**Then** ARIA explicitly states what it could and could not extract (e.g., "Em không đọc được phần tên công ty trong ảnh") and asks the Owner to confirm the missing fields — it does not silently guess. (FR-9; UJ-2 edge case)

**Given** an image whose content has already been extracted and written to the CRM,
**When** subsequent turns of the same conversation are processed,
**Then** the raw image bytes are not re-sent to the API; only the extracted structured context is referenced in the conversation context. (FR-9; FR-35; AD-9)

**Given** an uploaded image that exceeds 10 MB,
**When** the Owner attempts to attach it,
**Then** an inline error appears under the attachment preview: "Ảnh quá lớn (max 10 MB)" / "Image too large (max 10 MB)" and the attachment is removed; no upload attempt is made. (EXPERIENCE.md Error)

**Given** an image to be extracted,
**When** it is sent to the API,
**Then** it is compressed to a long edge of ≤ ~1568px before the API call; per-extraction token counts are logged for cost observability. (AD-9; §8 Observability)

---

### Story 1.10: Decision-Maker Tracking and Stall Diagnosis

As an Owner, I want ARIA to surface the decision-maker question early in any deal and, when a deal goes quiet, give me a diagnosis of why — not just a "stale" flag — with a culturally appropriate re-engagement message ready to use, So that I do not waste time chasing the wrong contact and I know how to re-engage effectively.

**Acceptance Criteria:**

**Given** a new deal has been created (via Stub or explicit description) and the `decision_maker` field on the Client is unknown,
**When** ARIA delivers the Deal Intelligence read for that deal,
**Then** the read includes a DECISION-MAKER: UNKNOWN risk flag and ARIA asks the Owner to identify the actual approver. (FR-11; addendum §B.1; addendum §G)

**Given** the Owner's contact on a deal is identified as non-final-approver (e.g., a project manager, not the business owner),
**When** ARIA includes this in the read,
**Then** it is flagged as a risk with a reason ("The decision will be made above your current contact"). (FR-11)

**Given** a deal with no logged activity for ≥ 7 days and active status,
**When** ARIA surfaces the deal in conversation or Deal Intelligence,
**Then** ARIA produces a stall diagnosis naming a probable cause — one of: trust gap / budget not yet allocated / internal approval pending / seasonal — and incorporates the Client's industry and relevant seasonal context (e.g., "With F&B clients, silence after 4 days often means internal approval, not lost interest"). (FR-12; addendum §G)

**Given** a stall diagnosis is produced,
**When** ARIA presents it,
**Then** ARIA offers to draft a warm, non-pressuring Zalo follow-up in Vietnamese register — indirect, relationship-preserving, no Western urgency language ("ASAP", "cuối cùng rồi"); the draft is offered, not auto-sent. (FR-12; §9.1; §10)

**Given** ARIA has domain knowledge that a stalled F&B deal in Q1 may be affected by post-Tết cash flow,
**When** the deal matches this pattern,
**Then** the stall diagnosis incorporates this seasonal context explicitly with a reason. (FR-12; addendum §G)

---

### Story 1.11: Pricing-Floor Awareness

As an Owner, I want ARIA to flag when a price I'm considering falls below the sustainable floor for that service type and offer value-framing guidance before I discount, So that I stop underpricing my work.

**Acceptance Criteria:**

**Given** the Owner proposes or discusses a price for a deal of a known Service Type,
**When** the proposed price is below the benchmark floor for that service type stored in Business Context,
**Then** ARIA flags it with a clear message (VI: "Giá anh đề xuất thấp hơn mức thường thấy cho loại dự án này (~30–50M VND). Trước khi giảm giá, mình xem lại giá trị anh mang lại cho họ nhé?") before any discount advice is offered. (FR-13; EXPERIENCE.md Pricing floor microcopy)

**Given** ARIA flags a below-floor price,
**When** the guidance is provided,
**Then** the response frames pricing around value delivered to the client, not cost incurred by the Owner; it does not immediately accept the premise that discounting is the right move. (FR-13; FR-23; addendum §G)

**Given** the initial seed pricing benchmarks (web 20–80M VND, app 60–150M VND, automation 20–60M/workflow VND) are stored in Business Context,
**When** the Owner edits them in Settings → Business Context,
**Then** the updated benchmarks are saved and used in all subsequent pricing checks; changes are logged to the activity log with `actor=user`. (FR-13; §14 assumptions)

**Given** a service type that does not have a benchmark set in Business Context,
**When** the Owner proposes a price for that service type,
**Then** ARIA does not flag it as below-floor but may note the absence of a benchmark and offer to set one. (FR-13)

---

### Story 1.12: Strategy Advisor and Cross-Deal Pattern Detection

As an Owner, I want ARIA to give me specific, reasoned strategic advice when I ask business questions — and to proactively surface structural patterns it detects across multiple deals even when I haven't asked — So that I learn from my own data, not just general advice.

**Acceptance Criteria:**

**Given** the Owner asks a business-level strategic question (e.g., "I keep losing deals on price — should I lower my rates?"),
**When** ARIA responds via the Strategy path,
**Then** it names a specific recommendation (not just options), backs it with a reason anchored in the Owner's own deal data or Vietnamese SME domain knowledge, and challenges the premise if the underlying cause is likely not what the Owner stated (e.g., price objection after enthusiasm = trust gap, not budget). (FR-23; §4.6; addendum §G)

**Given** the Owner asks a positioning or niche question (e.g., "Should I specialize in F&B or keep it general?"),
**When** ARIA responds,
**Then** the response is grounded in the Owner's own pipeline data (service type distribution, win/loss patterns) as well as domain knowledge about Vietnamese SME verticals; uncertainty is acknowledged honestly when data is insufficient. (FR-23)

**Given** ARIA detects a cross-deal pattern — defined as **≥3 deals sharing a trait (same `service_type`, same lost stage, or same `risk_flag`) within a rolling 90-day window** (e.g., 3 consecutive proposal-stage losses, or 3 deals of one service type flagged for scope creep),
**When** the pattern threshold is met,
**Then** ARIA surfaces it proactively with a specific structural recommendation — even if the Owner did not ask — framed as "I've noticed across your recent deals…" (FR-24)

**Given** a strategy response is generated,
**When** routed,
**Then** it always uses the high-judgment model (Sonnet 4.6). (AD-4)

**Given** the Owner's stated plan is likely counterproductive (e.g., sending a proposal before discovering the decision-maker),
**When** ARIA detects the error,
**Then** ARIA says so directly and explains why, rather than complying silently. (FR-3; FR-23)

---

### Story 1.13: Conversation Context Management and Start New Topic

As an Owner, I want long-running conversations to stay within limits without losing my business data, and to be able to start a fresh topic without losing my CRM records, So that ARIA stays coherent over long sessions and I'm in control of context resets.

**Acceptance Criteria:**

**Given** a conversation where the reconstructed context (Business Context + tool-fetched entities + recent turns) exceeds ~40,000 tokens,
**When** the next AI call is assembled,
**Then** older turns beyond the last ~10 verbatim turns are summarized server-side; the transcript view still shows full history with a visual divider: a full-width `#2A3350` rule labeled "Earlier messages summarized for context efficiency" in `textMuted`. (FR-35; AD-12; EXPERIENCE.md Long-Conversation Context Handling)

**Given** the Owner starts a new session after a previous one,
**When** the new session begins,
**Then** context is reconstructed from the CRM (Intelligence Fields, activity log) and Business Context injection — not from re-reading old transcripts; durable state lives in the CRM, not in chat history. (FR-35; AD-3)

**Given** the Owner triggers "Start new topic" (via the ··· overflow menu or `Ctrl/Cmd+Shift+N`),
**When** the action executes,
**Then** the in-memory conversation context is cleared (reset to Business Context + system prompt only); CRM data, activity log, and all past transcript messages are retained; a full-width divider appears in the transcript labeled "New topic started — [time]" in `textMuted`; a non-modal tooltip "Context cleared — CRM data kept" fades after 2s. (FR-33; FR-35; AD-12; EXPERIENCE.md Start New Topic)

**Given** "Start new topic" is triggered,
**When** the action executes,
**Then** no CRM record, document, deal, or client data is deleted or modified. (FR-35)

**Given** an extracted image whose content has already been written to the CRM,
**When** subsequent conversation turns reference the same deal,
**Then** the raw image bytes are not re-included in the AI call context; only the extracted structured fields are referenced. (FR-35; AD-9)

**Given** the "Start new topic" affordance,
**When** no conversation content exists yet (empty chat),
**Then** the affordance is not shown (it only appears after a conversation has content). (EXPERIENCE.md Input Bar §7.5)

---

### Story 1.14: First-Run and Empty-State Onboarding

As an Owner on my very first session, I want ARIA to guide me through a lightweight setup, get me value from my first deal description before any data entry, and explain what ARIA does in one breath, So that I understand what I'm working with and trust ARIA is useful before I've invested any effort.

**Acceptance Criteria:**

**Given** the Owner authenticates for the first time with zero clients and zero deals in the CRM,
**When** the app loads,
**Then** the Chat panel is the landing surface (not the Briefing panel); a centered welcome card (not a message bubble) displays ARIA's introduction in ~40 words, in the language detected from the browser locale (default Vietnamese). The exact microcopy: "Chào Anh Nhan! Em là ARIA — trợ lý kinh doanh của anh. Anh chưa có deal nào cả, mình bắt đầu bằng cách anh kể cho em nghe một khách đang thương lượng được không? Không cần điền form — cứ kể tự nhiên." (FR-36; UJ-6; EXPERIENCE.md Empty/First-Run)
**And** the Owner's name in the greeting is resolved from the Owner profile (Supabase `auth.users` metadata / Settings); if no name is available, ARIA greets without it ("Chào anh!" / "Hi there") rather than rendering a placeholder. (FR-36)

**Given** the welcome card is displayed,
**When** the Owner sees it,
**Then** a single soft prompt appears below the card: "Anh đang thương lượng deal nào không? Kể cho em nghe đi." / "Tell me about a deal you're working on." The Business Context setup is offered as a skippable aside on one line; if skipped, defaults are applied silently. (FR-36; UJ-6)

**Given** the Owner describes their first deal in natural language during first-run,
**When** ARIA responds,
**Then** it delivers a Deal Intelligence read (shorter than a full read per the omission boundary — FR-6 — since no similar deals exist yet), creates a Stub for the deal, and confirms creation in the reply. Value is delivered before any form is filled. (FR-36; FR-6; FR-7; UJ-6)

**Given** the first Deal Intelligence read has completed during first-run,
**When** ARIA responds,
**Then** ARIA offers the Zalo OA setup in one non-intrusive line: "Anh muốn nhận thông báo qua Zalo không? Em có thể nhắc anh mỗi sáng." with a skippable "Để sau" option; setup is accessible later in Settings → Notification Channels. (FR-36; FR-28; UJ-6)

**Given** the CRM is empty (first-run or reset),
**When** the scheduled Briefing job runs,
**Then** no Briefing is generated, no check-ins fire, and no empty Briefing panel or notification badge is shown. (FR-36; §4.12)

**Given** the Owner skips the welcome flow entirely and types a random question immediately,
**When** ARIA processes it,
**Then** ARIA answers the question without forcing onboarding; Business Context is collected opportunistically from the answer if relevant context is available. No onboarding gate blocks interaction. (FR-36; §14 assumptions)

**Given** the app is fully set up with at least one deal in the CRM,
**When** the Owner opens the app on a subsequent session,
**Then** the welcome card and onboarding flow are no longer shown; the Briefing panel (if unseen) or Chat panel is the landing surface. (FR-36)
## Epic 2: CRM & Memory

**Goal:** Establish the durable, owner-scoped data layer that lets ARIA get smarter about each client over time — through an append-only activity log, AI-maintained intelligence fields, similar-deal matching, conversational data maintenance, and a governed stub lifecycle — all without any manual maintenance by the Owner.

---

### Story 2.1: Owner-Scoped Persistence with Append-Only Activity Log

As an **Owner**, I want every client, deal, and document change persisted under my account and recorded in an audit trail, so that ARIA always has a trustworthy history to reason from and I can trust nothing is lost or mixed with other data.

**Acceptance Criteria:**

**Given** the `clients`, `deals`, `documents`, `activity_log`, and `briefings` tables are created with an `owner_id uuid` column (FK → authenticated user), **when** any row is inserted or updated, **then** Postgres RLS policies enforce that the row is only readable and writable by the authenticated owner whose `owner_id` matches — cross-owner access returns zero rows (AD-2, FR-30).

**Given** a request handler processes an owner data read or write, **when** it uses the Supabase client, **then** it uses the owner's RLS-enforced session token, never the service-role key (AD-13).

**Given** ARIA creates or updates a client, deal, or document record, **when** the write changes a material field (stage, status, intelligence field, note, relationship_stage, priority, value_estimate), **then** an `activity_log` row is appended with: `entity_type`, `entity_id`, `action` (descriptive string e.g. `"stage_changed"`), `actor` (`ai` or `user`), `payload` (jsonb capturing old + new value of the changed field), `created_at`, and `owner_id` (FR-30, AD-14).

**Given** ARIA writes an intelligence field update that produces the same value already stored (no material change), **when** the tool call completes, **then** no activity log row is written — the log remains append-only and records only genuine changes (AD-14).

**Given** the Owner creates or updates a client or deal via conversation, **when** the write succeeds, **then** the activity log records `actor=user`; when ARIA performs the same write autonomously, the log records `actor=ai` (FR-30, AD-14).

**Given** the activity log table exists, **when** any code path attempts to delete or update an existing `activity_log` row, **then** the operation is rejected — either by a DB trigger or by the absence of any delete/update surface in the tool layer (AD-14 append-only invariant).

---

### Story 2.2: Core CRM Tool Surface — Create, Read, Update via Conversation

As an **Owner**, I want to create, retrieve, and update full client and deal records entirely through conversation, so that I never need to open a form to maintain my pipeline.

**Acceptance Criteria:**

**Given** the CRM tool surface is wired to the orchestrator (AD-1), **when** ARIA calls `create_client_stub(name, company, known_fields)`, **then** a client row is persisted with `owner_id`, `is_stub=true`, and the supplied fields; ARIA's reply confirms creation and names the record (FR-31, FR-7).

**Given** the CRM tool surface is wired, **when** ARIA calls `create_deal_stub(client_id, fields)`, **then** a deal row is persisted with `owner_id`, linked `client_id`, `is_stub=true`, and supplied fields; the activity log records `action="deal_stub_created"`, `actor=ai` (FR-31, AD-14).

**Given** a client or deal exists, **when** ARIA calls `update_deal(id, fields)` or `update_client(id, fields)` with one or more changed fields, **then** only the supplied fields are updated (no clobber of other fields); if any updated field is an AI-maintained intelligence field, the update carries `actor=ai` in the activity log; if the field was last set by a human (`actor=user`), the new AI value does not silently overwrite it — ARIA proposes the update in its reply and writes it only after no conflicting human value exists or after the Owner confirms (AD-14).

**Given** the Owner types "update the Hanoi restaurant deal — they pushed the timeline to August" in chat, **when** the orchestrator processes the message, **then** ARIA calls `update_deal` with the relevant fields, confirms the update in its reply, and the activity log records the change with `actor=user` (since the information came from the Owner) (FR-31).

**Given** a client or deal record exists, **when** ARIA calls `get_client(id|name)` or `get_deal(id|title)`, **then** the tool returns the full record filtered by the caller's `owner_id`; no fields from another owner are present (AD-2).

**Given** the Owner asks "what are all my active deals?" in chat, **when** the orchestrator calls `list_deals(filters)` with `stage != closed`, **then** only deals with the Owner's `owner_id` are returned; the reply is prose synthesis, not a field dump (FR-31, FR-14).

**Given** ARIA creates or updates a record, **when** `log_activity(entity, action, note)` is called explicitly (e.g. for a note or stage advancement not covered by a field write), **then** an activity log row is appended with the correct `actor`, `entity_type`, `entity_id`, and `payload` (FR-30, AD-14).

---

### Story 2.3: Stub Lifecycle — Deduplication, Enrichment Gate, and Archival

As **ARIA**, I want to manage stubs — checking for duplicates before creating, blocking un-enriched stubs from matching, and surfacing stale stubs for archival — so that the CRM stays clean and pattern-matching is never corrupted by thin records.

**Acceptance Criteria:**

**Given** the Owner mentions a new client or deal by name, **when** ARIA is about to call `create_client_stub` or `create_deal_stub`, **then** ARIA first calls `list_deals` or `get_client` to check for an existing record with a similar name/company; if a likely match is found, ARIA proposes linking to the existing record rather than creating a duplicate, and creation proceeds only if the Owner confirms it is a different entity (FR-37, AD-14 stub→full is a state transition not a new record).

**Given** a stub record exists with `is_stub=true`, **when** `find_similar_deals` is called to populate pattern-matching context (used in Deal Intelligence or Story 2.4), **then** records with `is_stub=true` are excluded from the results — un-enriched stubs do not influence the similar-deal read (FR-37, FR-10).

**Given** a stub has `is_stub=true` and has not been updated (no activity log entry against it) for longer than the configurable idle threshold (default: 14 days), **when** the briefing scheduler or an inline conversation check runs, **then** the stub is flagged for completion or archival; ARIA surfaces the flag to the Owner conversationally ("I have a stub for [name] with no updates in 14 days — complete it, keep it, or archive it?") (FR-37).

**Given** a stub has been enriched with minimally required fields — `client_stated_need`, `service_type`, `stage`, and `value_estimate` present and non-null — **when** ARIA or the Owner provides these fields, **then** `is_stub` is set to `false` (the promotion is a state transition on the same record, not a new insert), and the activity log records `action="stub_promoted"`, `actor` set to whichever party provided the final fields (FR-37, AD-14).

**Given** the Owner says "discard the stub for Viet Coffee" via conversation, **when** ARIA processes the request, **then** ARIA calls `update_deal` or `update_client` to set `status=archived` (not delete), confirms the action in its reply, and the activity log records `action="stub_archived"`, `actor=user` (FR-37, AD-14 — archival not deletion preserves the log).

**Given** the Owner says "merge the Pho 24 stub with the existing Pho 24 Hanoi record" via conversation, **when** ARIA processes the request, **then** ARIA proposes which fields to carry over from the stub onto the existing record, the Owner confirms, ARIA calls `update_deal`/`update_client` with the merged fields on the target record, and the stub is archived — no duplicate persists (FR-37).

---

### Story 2.4: Similar-Deal Matching with Stated Similarity Reason

As **ARIA**, I want to find past deals similar to the current one by service type and client industry/size, and attach a stated similarity reason, so that Deal Intelligence reads are grounded in real pattern evidence rather than generic domain knowledge alone.

**Acceptance Criteria:**

**Given** a deal's `service_type` and the client's `industry` and `company_size` are known, **when** the Deal Intelligence specialist calls `find_similar_deals(service_type, industry, size)`, **then** the tool queries the `deals` table filtered by `owner_id`, `service_type`, and optionally `industry`/`company_size`; only records with `is_stub=false` are returned; each result includes `deal_id`, `title`, `predicted_outcome`, `risk_flags`, and a `similarity_reason` field explaining why the match is relevant (FR-10, FR-37).

**Given** `find_similar_deals` returns one or more results, **when** ARIA includes them in the Deal Intelligence read, **then** ARIA explicitly states the pattern basis in its response (e.g. "Based on your last 3 F&B web-design deals…") and the `similar_deals` jsonb field on the current deal is updated with the matched `deal_id`s and their `similarity_reason`s (FR-10, AD-14).

**Given** no matching non-stub deals exist for the current service type and industry, **when** `find_similar_deals` returns an empty result, **then** ARIA reasons from domain knowledge and explicitly says so in its response ("No similar past deals — reasoning from domain knowledge") — the `similar_deals` field on the deal is set to an empty array, not left null (FR-10, FR-6).

**Given** similar deals are populated on a deal record, **when** ARIA later updates the `similar_deals` field with the same list of `deal_id`s and `similarity_reason`s (no material change), **then** no activity log row is written (AD-14 idempotent writes log nothing on no-op).

**Given** similar deals are populated and the activity log entry was previously written, **when** a new similar deal is identified and added to the list, **then** the activity log records `action="similar_deals_updated"`, `actor=ai`, with `payload` showing the added entry (AD-14).

---

### Story 2.5: AI-Maintained Intelligence Fields — Idempotent Updates with Provenance

As **ARIA**, I want to update deal and client intelligence fields automatically after a Deal Intelligence session, with full provenance and idempotency, so that the Owner's records improve over time without any manual effort and without clobbering human edits.

**Acceptance Criteria:**

**Given** a Deal Intelligence session has produced new signals (new `inferred_real_need`, changed `risk_flags`, updated `opportunity_signals`, revised `predicted_outcome`/`prediction_reason`), **when** the session concludes and ARIA calls `update_deal(id, fields)`, **then** all changed intelligence fields are written in a single call; the activity log records one entry per changed field (or one entry for the batch) with `actor=ai`, `action="intelligence_fields_updated"`, and `payload` containing the old and new values (FR-8, AD-14).

**Given** a Deal Intelligence session produces intelligence field values identical to those already stored, **when** ARIA calls `update_deal` with those values, **then** no database write occurs (or the write is skipped before execution) and no activity log row is appended — the update is a no-op (AD-14 idempotent AI writes).

**Given** the Owner has previously set `inferred_real_need` to a specific value via conversation (`actor=user` in the log), **when** a subsequent AI session would overwrite it with a different value, **then** ARIA does not silently overwrite it; instead ARIA proposes the new inference in its response ("I now read their real need as X — want me to update the record?") and writes only after the Owner confirms (AD-14 human edits not silently overwritten).

**Given** a Deal Intelligence session extracts new signals about a client's `communication_style` or `known_hesitations`, **when** ARIA calls `update_client(id, fields)` with the updated values, **then** the client record is updated, the activity log records `actor=ai`, and the same idempotency and human-edit-protection rules apply as for deal fields (FR-8, AD-14).

**Given** a Deal Intelligence session is run multiple times for the same deal with the same conversation input (e.g. a retry), **when** each run attempts to write intelligence fields, **then** only the first run that produces a change writes to the log; subsequent identical writes are no-ops — the log does not accumulate duplicate entries for the same change (AD-14).

**Given** intelligence fields are written with `actor=ai`, **when** the activity log entry is inspected, **then** it includes a `source` field naming the originating reasoning path (e.g. `"deal_intelligence"`, `"proactive_checkin"`) so the provenance is auditable (AD-14).

---

### Story 2.6: Conversational Data Maintenance — Full Client and Deal Lifecycle via Chat

As an **Owner**, I want to create, advance, and correct any client or deal entirely through natural language conversation — including stage transitions, field corrections, and relationship notes — so that I never need to open a data-entry form to keep my CRM current.

**Acceptance Criteria:**

**Given** the Owner types a description of a new client and deal in chat (e.g. "Just met an F&B chain owner who wants a website and maybe automation, budget unclear"), **when** the orchestrator processes the message, **then** ARIA calls `create_client_stub` and `create_deal_stub`, confirms creation in its reply ("I've created a stub for [name] linked to a new deal"), and asks no more than 2 gap-filling questions in the same turn (FR-31, FR-7).

**Given** a deal exists in stage "Discovery," **when** the Owner says "the Hanoi restaurant signed off on scope, moving to proposal" in chat, **then** ARIA calls `update_deal` to advance the stage, the old stage is appended to `stage_history` (jsonb), the activity log records `action="stage_changed"`, `actor=user`, and ARIA confirms the transition and recommends the next document or action (FR-31, AD-14).

**Given** a client or deal record has incorrect information, **when** the Owner says "actually their budget is 80 million VND, not 50" in chat, **then** ARIA calls `update_deal` with the corrected `value_estimate`, the activity log records `actor=user`, and ARIA confirms the correction in its reply (FR-31).

**Given** the Owner wants to check the full conversational maintenance lifecycle without ever opening a UI form, **when** a complete sequence of create → enrich → stage-advance → correct → close is performed via chat messages alone, **then** all state transitions are reflected in the DB and activity log, and no form submission is required at any step (FR-31).

**Given** a minimal manual edit surface exists in the UI (e.g. an inline field editor on a client/deal detail view), **when** the Owner uses it to edit a field, **then** the same `update_client`/`update_deal` tool path is invoked and the activity log records `actor=user` — the manual surface reuses the same write path, it is not a separate code path (FR-31 assumption: manual surface exists but is never on the critical path).

**Given** the Owner closes a deal via conversation ("mark the Pho 24 deal as won"), **when** ARIA processes the message, **then** ARIA calls `update_deal` to set `stage="Won"`, `predicted_outcome="likely_win"`, appends to `stage_history`, writes an activity log entry with `actor=user`, and offers to create a win-note or next document (FR-31, AD-14).

---

### Story 2.7: Intelligence Field Persistence Across Sessions (Context Reconstruction)

As **ARIA**, I want intelligence fields and activity history persisted in the CRM to be the sole durable record of what is known about a deal or client, so that every new session reconstructs full context from the DB rather than relying on chat transcript memory.

**Acceptance Criteria:**

**Given** a Deal Intelligence session has concluded and intelligence fields have been written to the deal record, **when** the Owner starts a new conversation session (new browser tab, next-day open, or "Start new topic"), **then** ARIA reconstructs deal context by calling `get_deal` and `get_client` via tools and has access to all previously written intelligence fields — without re-reading any prior conversation transcript (AD-3, FR-35).

**Given** a new session begins and the orchestrator loads Business Context (≤~2,000 tokens per AD-3/FR-4), **when** the Owner asks about a specific deal, **then** ARIA fetches only that deal and its client via tools (not the entire CRM) and the reconstructed context fits within the per-DI-call context budget (AD-3, AD-5).

**Given** `similar_deals` is populated on a deal record from a prior session, **when** a new Deal Intelligence session runs for the same deal, **then** ARIA calls `find_similar_deals` again to get fresh matches (in case new deals have been added) but also reads the stored `similar_deals` field as a prior-session baseline — if results are unchanged, no new activity log entry is written (AD-14 idempotency).

**Given** the `activity_log` contains a history of field changes for a deal, **when** ARIA is asked "what has changed on this deal recently?" in conversation, **then** ARIA queries the activity log for that `entity_id` and summarizes the material changes in chronological order — the log is the source of truth, not the chat history (AD-3, FR-30).

**Given** the activity log contains entries with `actor=ai` and `actor=user`, **when** ARIA summarizes deal history, **then** it correctly attributes each change (e.g. "You updated the budget on June 10; I revised the risk flags after our session on June 12") so the Owner understands who changed what (FR-30, AD-14).

**Given** the "Start new topic" action is triggered in the chat UI, **when** conversation context is cleared, **then** all CRM data (clients, deals, documents, activity log, intelligence fields) remains fully intact in the database — only the in-memory conversation window is reset (AD-3, FR-35).
## Epic 3: Documents

**Goal:** The Owner can produce, view, version, and export business documents through an elicitation-first conversation — ARIA never generates a full document without outline approval, every save is a retained version, and ARIA teaches which document the deal needs and why.

---

### Story 3.1: Document Data Layer, Status Lifecycle, and Versioning

As an Owner, I want every document I create to be persisted with a full version history and a clear status lifecycle, so that I always have a traceable, recoverable record of every draft and its current state.

**Acceptance Criteria:**

**Given** the `documents` table defined in addendum.md §B.3 does not yet exist,
**When** the Epic 3 migration runs,
**Then** the table is created with columns: `id`, `owner_id` (FK → auth user, AD-2), `deal_id` (FK nullable), `client_id` (FK nullable), `type` (enum: `proposal | contract | brief | sop | report | invoice | onboarding | other`), `title` (text), `status` (enum: `draft | review | sent | signed | archived`), `content_md` (text), `file_url` (text, nullable — Storage path to PDF), `version` (int, default 1), `created_by` (enum: `ai | human`), `created_at`, `updated_at`.
**And** a Postgres RLS policy exists on `documents` that allows SELECT/INSERT/UPDATE/DELETE only where `owner_id = auth.uid()`, enforcing AD-2 owner-scoping with no service-role bypass on owner-data paths (AD-13).

**Given** a `documents` row exists for the authenticated owner,
**When** ARIA or the Owner modifies `content_md` (via the `create_document` or an edit action),
**Then** a new row is inserted (not an UPDATE to the existing row) with `version = previous_version + 1`, all other fields copied forward, and the previous row retained unchanged — implementing AD-14's append-only versioning model.
**And** the new row's `created_by` is set to `ai` if the modification originated from an AI tool call, or `human` if the Owner typed it directly.

**Given** a document exists at version N,
**When** the Owner or a tool sets `status` to any value in the lifecycle (`draft → review → sent → signed | archived`),
**Then** the status change is applied to the current version row,
**And** an `activity_log` entry is written with `entity_type=document`, `entity_id`, `action="status_changed"`, `actor` (ai|user), `payload={from_status, to_status}` — satisfying FR-20 and AD-14 (material changes logged, no-op writes log nothing).

**Given** a document's `status` is updated to `sent`,
**When** the activity log entry is written,
**Then** it includes `payload.sent_at` timestamp and the `actor` value reflects whether the change was triggered by the Owner or by ARIA.

**Given** a document naming requirement (FR-20),
**When** a document is saved (new or versioned),
**Then** its `title` follows the pattern `{ClientName}_{DocumentType}_{YYYY-MM-DD}_v{N}` where `YYYY-MM-DD` is the creation date of this version and `N` is the integer version number — e.g. `PhuLong_Proposal_2026-06-25_v1`.

**Given** the Owner queries for documents linked to a specific deal or client,
**When** the query executes,
**Then** only documents with matching `deal_id` or `client_id` **and** `owner_id = auth.uid()` are returned — no cross-owner data is reachable (AD-2).

---

### Story 3.2: Elicitation → Outline → Generate Flow

As an Owner, I want ARIA to ask me targeted questions and present a draft outline for my approval before writing a full document, so that I never receive an off-target document and always feel in control of what gets produced.

**Acceptance Criteria:**

**Given** the Owner sends a message that the Orchestrator classifies as a document-creation request (FR-1, e.g. "Draft a proposal for the Hanoi restaurant client" / "Soạn đề xuất cho khách nhà hàng Hà Nội"),
**When** the Orchestrator routes to the Document specialist (AD-4: elicitation uses Haiku; drafting uses Sonnet),
**Then** ARIA does NOT generate a full document — it first calls `get_deal` and `get_client` via the CRM tool surface to retrieve existing context (AD-1, AD-3).

**Given** ARIA has fetched deal and client context and identified missing information required for the requested document type (cross-referencing the template fields in addendum.md §E),
**When** ARIA responds,
**Then** it asks no more than 3 targeted questions in that turn (FR-19) — the questions are ranked by criticality (e.g. budget confirmed? decision-maker? timeline?) and framed in the Owner's current language (FR-2, e.g. Vietnamese if the Owner's message was Vietnamese).
**And** if all required information is already present in the deal/client record, ARIA skips elicitation and proceeds directly to the outline step.

**Given** the Owner answers the elicitation questions (in one or multiple turns until all critical fields are resolved),
**When** ARIA is ready to proceed,
**Then** ARIA presents a numbered draft outline — title + one-line description per section — and explicitly asks for approval before generating the full document (FR-19):
- Vietnamese: "Outline này ổn không anh? Anh có muốn thêm hoặc bỏ phần nào không?"
- English: "Does this outline work? Any sections to add or remove?"

**Given** the Owner requests a change to the outline (e.g. "Add a section on workflow"),
**When** ARIA receives the revision request,
**Then** ARIA updates the outline and re-presents it for confirmation — no full document is generated until the Owner gives explicit approval (FR-19 invariant: full generation is always gated on outline approval).

**Given** the Owner explicitly approves the outline (e.g. "OK, go ahead" / "Được rồi, viết đi"),
**When** ARIA generates the full document,
**Then** the generation call is routed to Sonnet (AD-4: document drafting = high-judgment tier),
**And** the document language follows the Client's `language_pref` (default Vietnamese for Vietnamese-market clients, FR-2),
**And** the content follows the relevant template scaffold from addendum.md §E (e.g. Proposal: Understanding → Deliverables → How We Work → Timeline → Investment → Next Step),
**And** the document is written in ARIA's client-facing Vietnamese register when applicable: warm, relationship-preserving, appropriately hierarchical (Anh/Chị for the client), no urgency language (PRD §10).

**Given** the full document has been generated,
**When** ARIA saves it via `create_document`,
**Then** a `documents` row is created with `status=draft`, `version=1`, `created_by=ai`, and the `title` in `{ClientName}_{DocumentType}_{YYYY-MM-DD}_v1` format (FR-20),
**And** an `activity_log` entry is written with `action="document_created"`, `actor=ai`.

**Given** the document is saved,
**When** ARIA responds in Chat,
**Then** ARIA explains in one sentence why this document matters at this deal stage (guidance stance, FR-3, FR-22 teaching rationale) — e.g.: "Em đã lưu đề xuất này. Đây là bước quan trọng vì đề xuất rõ ràng giúp anh kiểm soát kỳ vọng của khách trước khi ký hợp đồng."
**And** the panel switches to the Document Viewer (FR-32, UJ-4) displaying the newly created document.

---

### Story 3.3: Document Viewer — Read, Edit, and Version History

As an Owner, I want a dedicated document viewer where I can read, edit, change status, and browse version history, so that I have full visibility and control over my document vault without leaving the app.

**Acceptance Criteria:**

**Given** a Document is created (Story 3.2) or retrieved from the Docs nav list,
**When** the main panel switches to Document Viewer mode (FR-32),
**Then** the viewer header displays: document `title` (editable inline), a status pill showing the current `status` with label in Vietnamese/English (draft=Nháp, review=Đang xét, sent=Đã gửi, signed=Đã ký, archived=Lưu trữ), a linked deal/client chip (tappable — opens deal context in Chat), and a version selector showing the current version number (e.g. "v3").

**Given** the Owner is in the Document Viewer,
**When** they tap "Edit",
**Then** the body switches to a markdown textarea ({typography.mono}) and the Owner can modify `content_md`.
**And** on 2-second idle or explicit "Save" press, the system creates a new version row (Story 3.1 versioning rule: insert new row, `version = N+1`, `created_by=human`),
**And** the header version selector silently updates to the new version number,
**And** an `activity_log` entry is written with `action="document_edited"`, `actor=user`.

**Given** the Owner selects a different version from the version selector in the header,
**When** the selection is made,
**Then** the viewer body renders the `content_md` of the selected version (read-only) — the user is not editing a past version but previewing it.

**Given** the Owner taps "History" in the viewer toolbar,
**When** the slide-over opens,
**Then** it lists all versions of the document in reverse chronological order, each showing: version number, `created_by` (displayed as "ARIA" or "You"), and `created_at` timestamp.
**And** clicking any version entry shows a side-by-side diff of that version vs the previous one, with added lines highlighted in {colors.success} tint and removed lines in {colors.danger} tint (EXPERIENCE.md Document Viewer rules).

**Given** the Owner taps "Change Status" in the viewer toolbar,
**When** the inline dropdown opens (no modal),
**Then** it shows only legally forward-moving transitions: draft → review → sent → signed | archived (plus "archive" from any state).
**And** selecting "Sent" prompts: "Ghi vào lịch sử hoạt động không?" / "Log to activity feed?" with [Yes (default)] [No] chips.
**And** on confirmation, `status` is updated and an `activity_log` entry is written (FR-20 lifecycle + AD-14).

**Given** the Owner taps "Ask ARIA about this doc" in the viewer toolbar,
**When** the action fires,
**Then** the viewer closes, the Chat panel opens, and the input bar is pre-populated with "Tell me about [document title]" (editable, not auto-sent — Owner agency preserved per EXPERIENCE.md).

**Given** the Docs nav item is tapped,
**When** the panel opens,
**Then** it shows a filterable list of all documents belonging to the Owner, with columns: title, type, status pill, linked client/deal, last-modified date — filterable by status and client.
**And** tapping any document in the list opens the Document Viewer for that document.

---

### Story 3.4: PDF Export to Storage

As an Owner, I want to export any document to a styled PDF that is saved to storage and downloadable, so that I can send a professional-looking file to my client without leaving ARIA.

**Acceptance Criteria:**

**Given** a document exists in the Document Viewer with any status,
**When** the Owner taps "Export PDF" in the toolbar,
**Then** the server generates a PDF from the document's `content_md` using the configured PDF renderer (html-pdf-node / Puppeteer, addendum.md §A) — no AI call is made at any point during PDF export (FR-21, PRD §8 "What never hits the API").

**Given** the PDF generation request is received server-side,
**When** generation completes,
**Then** the PDF is uploaded to Supabase Storage under an owner-scoped path (AD-2, AD-9) — e.g. `owner_id/documents/{document_id}_v{N}.pdf`,
**And** the `documents` row for the current version has its `file_url` field updated to the Storage path,
**And** an `activity_log` entry is written with `action="pdf_exported"`, `actor=user`, `payload={version, file_url}`.

**Given** the PDF has been saved to Storage,
**When** the server returns the response to the client,
**Then** the file is offered as a download with the filename `{ClientName}_{DocumentType}_{YYYY-MM-DD}_v{N}.pdf` matching the document's title convention (FR-20, FR-21),
**And** the "Export PDF" button in the viewer shows a spinner during generation and returns to its default state on completion — other viewer actions (Edit, Change Status, History) remain enabled during export.

**Given** PDF generation fails (server error, renderer crash),
**When** the failure response reaches the client,
**Then** a toast is shown: "Xuất PDF thất bại — thử lại" / "PDF export failed — try again" (EXPERIENCE.md Error states),
**And** no partial file is stored in Storage,
**And** `file_url` on the document row is not updated.

**Given** a PDF has been previously exported for a document version (i.e. `file_url` is non-null),
**When** the Owner taps "Export PDF" again on the same version,
**Then** the system re-generates and overwrites the existing Storage object (idempotent export — AD-7 idempotency principle applied to storage ops),
**And** a fresh download is offered.

**Given** the PDF is styled (FR-21 branding placeholder),
**When** the PDF is rendered,
**Then** it applies the v1 brand placeholder (ARIA logo placeholder, color palette header/footer, agency name from Business Context) — full branding is deferred to the UX branding step per the assumption in PRD §4.5 (FR-21).

---

### Story 3.5: Missing-Document Detection and Teaching

As an Owner, I want ARIA to detect when a deal's stage implies a document should exist but doesn't, and explain why that document matters now, so that I never silently miss a critical step in the client relationship.

**Acceptance Criteria:**

**Given** the missing-document detection logic runs (triggered during: daily Briefing generation, a Deal Intelligence read for a specific deal, or any pipeline status query for that deal),
**When** ARIA evaluates a deal's current `stage` against the expected document set for that `service_type` and `stage`,
**Then** ARIA identifies a "missing document" when: a deal's stage is at or past the threshold for a document type AND no `documents` row exists for that `(deal_id, type)` with `status` in `(draft, review, sent, signed)`.

The default detection rules are:
- Stage contains "proposal" / "đề xuất" / "sent" AND no `proposal` document → flag.
- Stage contains "contract" / "hợp đồng" / "signed" / "SOW" AND no `contract` document → flag.
- Stage contains "brief" / "discovery confirmed" / "kickoff" AND no `brief` document → flag.
- Stage contains "onboarding" / "started" AND no `onboarding` document → flag.

**Given** a missing-document flag is detected for a deal,
**When** ARIA surfaces it in a Briefing "Documents Pending" section or in a Chat reply,
**Then** the flag includes: the document type missing, the deal name, and a one-line teaching rationale explaining why this document matters now (FR-22 guidance stance) — the rationale is specific to the document type:
- Proposal missing after proposal stage: "Đề xuất bằng văn bản giúp anh kiểm soát kỳ vọng và có căn cứ để theo dõi — không có nó, khách dễ hiểu sai phạm vi." / "A written proposal sets expectations and creates an accountability baseline — without it, scope misalignment is hard to catch early."
- Contract missing after contract stage: "Hợp đồng bảo vệ cả hai bên nếu có tranh chấp về phạm vi hoặc thanh toán — anh nên có bản ký trước khi bắt đầu." / "A signed contract protects both parties if scope or payment disputes arise — you should have it before work begins."
- Brief missing at kickoff: "Brief giúp cả team và khách đồng thuận về mục tiêu trước khi thực hiện — thiếu nó thường dẫn đến scope creep." / "A project brief aligns everyone on goals before execution — missing it is the most common cause of scope creep."

**Given** a missing-document flag is surfaced in Chat,
**When** ARIA presents the flag,
**Then** ARIA appends a single offer to create the document: "Anh có muốn em soạn [document type] này không?" / "Shall I draft the [document type] now?" — tapping or responding Yes routes directly into the elicitation flow (Story 3.2).

**Given** a deal already has a document of the required type,
**When** detection runs,
**Then** no flag is generated for that type on that deal — detection is idempotent.

**Given** a deal is in `archived` or `likely_lost` / `at_risk` predicted state with no recent activity,
**When** missing-document detection runs,
**Then** no new missing-document flags are surfaced for that deal — flags are suppressed for inactive/closed deals to avoid noise.

**Given** detection runs server-side as part of Briefing generation (Epic 4) or a Deal Intelligence call,
**When** flags are generated,
**Then** each flag is written to `briefings.flags` (jsonb) or returned inline in the Chat response — no separate `document_flags` table is needed in Epic 3 (kept simple; the Briefing epic owns the flag persistence structure).

---

### Story 3.6: Inline Document Edit and Conversational Re-Generation

As an Owner, I want to ask ARIA to revise a document in conversation — or edit it directly in the viewer — so that I can iterate on a draft without starting the elicitation flow from scratch.

**Acceptance Criteria:**

**Given** a document is open in the Document Viewer with `status=draft` or `status=review`,
**When** the Owner sends a message in Chat referencing the open document (e.g. "Make the investment section shorter" / "Rút gọn phần ngân sách lại"),
**Then** ARIA identifies this as a document-revision request (not a new document request), fetches the current version's `content_md` via `get_document`, and applies the targeted revision using Sonnet (AD-4: document drafting tier),
**And** ARIA does NOT re-run the full elicitation→outline→generate flow — the outline approval gate (Story 3.2) only applies to initial document creation, not to revision of an approved document.

**Given** ARIA has generated the revised content,
**When** the revision is saved,
**Then** a new version row is created (`version = N+1`, `created_by=ai`) following Story 3.1 versioning rules,
**And** the Document Viewer's header version selector updates to the new version,
**And** an `activity_log` entry is written with `action="document_revised"`, `actor=ai`, `payload={from_version, to_version, revision_instruction}`.

**Given** the revision is complete,
**When** ARIA responds in Chat,
**Then** ARIA briefly describes what changed (e.g. "Em đã rút gọn phần ngân sách từ 3 đoạn xuống còn 1. Anh xem lại nhé." / "I've condensed the investment section from 3 paragraphs to 1. Take a look."),
**And** ARIA does not re-explain the teaching rationale already given at document creation (SM-C3: do not over-explain to the expert).

**Given** the Owner directly edits `content_md` in the viewer's Edit mode (Story 3.3),
**When** an autosave or explicit Save fires,
**Then** the new version is saved with `created_by=human` (Story 3.1),
**And** subsequent conversational revision requests from ARIA operate on this latest human-edited version — human edits are not silently overwritten (AD-14: human edits win over AI proposals).

**Given** a document with `status=sent`, `status=signed`, or `status=archived`,
**When** the Owner attempts to edit it (via Edit mode or conversational revision),
**Then** ARIA presents a confirmation: "Tài liệu này đã được gửi/ký. Anh có chắc muốn sửa không? Em sẽ lưu phiên bản mới." / "This document has already been sent/signed. Are you sure you want to edit? A new version will be saved.",
**And** on confirmation the edit proceeds with a new version row; the previously sent/signed version is preserved unchanged (append-only history, AD-14).

**Given** a document revision request is made while the Claude API is unavailable (FR-5, AD-6),
**When** the orchestrator detects the API failure,
**Then** ARIA returns a degraded response: "AI tạm thời không khả dụng — không thể sửa tài liệu lúc này. Anh có thể chỉnh trực tiếp trong trình xem." / "AI synthesis unavailable — can't revise the document right now. You can edit it directly in the viewer.",
**And** the Document Viewer's Edit mode remains fully functional (no AI required for direct edits).
## Epic 4: Briefing & Proactivity

**Goal:** ARIA runs the proactive intelligence pipeline so nothing slips — generating a cached daily Briefing, detecting stale deals and missing actions, surfacing ranked priorities to the Owner, and prompting for deal updates on a configurable schedule with answer capture.

---

### Story 4.1: Pipeline Status Synthesis & Stage-Aware Next-Action

As an Owner, I want ARIA to return a synthesized deal/client status with a stage-appropriate next-action recommendation when I ask about my pipeline, so that I get a consultant's read instead of a raw data dump.

**Acceptance Criteria:**

**FR-14 — Synthesized status reply**

Given the Owner asks "What's the status of my pipeline?" or "How is [deal name] going?",
When ARIA fetches the relevant deals via `list_deals` or `get_deal` (Haiku-routed, AD-4),
Then the reply is prose synthesis — not a field listing — and includes for each deal: client name, current stage, value estimate, days since last activity, and a concrete next action.
And the response never returns a raw JSON or field dump to the chat interface.

Given a deal has had no logged activity for more than 7 days,
Then the reply explicitly states the number of days idle and surfaces the deal as requiring attention (FR-16 precursor, covered fully in Story 4.2).

**FR-15 — Stage-aware next-action**

Given the Owner asks "What should I do next with the Phở 24 deal?",
When ARIA determines the deal's current stage (e.g. "Proposal sent") and service type,
Then the recommended action is specific to that stage — e.g. for "Proposal sent" it recommends a follow-up, not "schedule a discovery call."
And the recommendation differs appropriately between a deal at "Discovery" vs "Proposal sent" vs "Contract review."

Given a deal's stage field contains free-text that does not match a canonical label (e.g. "Đang chờ anh xem lại"),
When ARIA interprets the stage,
Then it reasons contextually from the text and service type rather than rejecting or flagging an error — the stage is never rejected as invalid (AD-1, FR-15 free-text requirement).

Given the Owner asks for status in Vietnamese ("Tình hình deal nào đang tốt nhất?"),
When ARIA responds,
Then the entire response is in Vietnamese, including stage labels and recommended actions (FR-2 bilingual mirroring).

**Guidance stance (FR-3)**

Given the Owner asks what to do next on a deal at "Proposal sent" for 6 days,
Then ARIA includes the reasoning behind the recommendation (e.g. "Với dịch vụ web design, proposal thường cần follow-up sau 3–5 ngày để giữ momentum") and ends with a single concrete next step.

**Graceful degradation (AD-6, FR-5)**

Given the Claude API is unavailable when the Owner requests pipeline status,
When ARIA cannot perform synthesis,
Then it returns structured CRM data (stage, value, last activity date) with the degraded notice: "AI synthesis is temporarily unavailable — showing raw data" / "AI tạm thời không khả dụng — đang hiển thị dữ liệu thô."
And the response envelope carries `status: degraded` per AD-6.

**Model routing (AD-4)**

Given any pipeline status or next-action query,
When the request does not involve Deal Intelligence (FR-6 four-layer synthesis),
Then the AI call is routed to Haiku (economical tier) — not Sonnet — and this is verifiable via token-usage observability logs.

---

### Story 4.2: Stale-Deal Detection & Follow-Up Cadence Engine

As an Owner, I want ARIA to automatically detect deals with no activity for more than 7 days and apply the proposal follow-up cadence (3-day and 7-day reminders), so that no deal goes cold silently.

**Acceptance Criteria:**

**Depends on:** Story 4.1 (deal status synthesis tooling established).

**FR-16 — Stale-deal detection (>7 days)**

Given a deal has had no `activity_log` entry for more than 7 calendar days,
When ARIA evaluates the deal (during briefing generation or on conversational request),
Then the deal is classified as stale and its `stale_since` field is populated with the date of the last activity.
And a stale deal is surfaced in the Briefing "Slow-Moving Deals" section (Story 4.4 will render it; this story ensures the detection and field population).
And a stale deal is raised in conversation when the Owner asks about that deal or the pipeline.

Given a deal transitions from having activity to crossing the 7-day threshold,
When its staleness is detected,
Then the `stale_since` date is set once and not overwritten on subsequent detections — staleness onset is idempotent (AD-14 idempotent AI writes).

**FR-16 — Proposal follow-up cadence**

Given a deal is at stage "Proposal sent" (or any stage ARIA interprets as equivalent) and has no logged Owner response from the client,
When 3 calendar days have elapsed since the proposal stage was entered,
Then the deal is flagged for a first follow-up reminder.
And this flag is represented as a `next_action` update on the deal record with `next_action_due` set to the cadence-calculated date.

Given the first follow-up reminder has been generated and 7 days total have elapsed since the proposal stage with no response,
Then the deal is flagged for a second follow-up reminder ("Nhắc lần 2 — cân nhắc đóng hoặc lưu trữ deal này").

Given the Owner explicitly logs a client response (any activity on the deal from actor: user),
Then the follow-up cadence resets and no further cadence reminders fire for that window.

**Configurable cadence**

Given the Owner has configured custom follow-up intervals in Settings (e.g. 5 days first / 10 days second),
When cadence dates are calculated,
Then the custom intervals are used instead of the defaults (3/7 days).
And if no custom value is set, defaults of 3 and 7 days apply (FR-16).

**Empty CRM guard (FR-36, AD-7)**

Given the CRM contains zero active deals,
When any stale-detection or cadence logic runs,
Then no reminders, flags, or activity entries are written — the function exits cleanly.

**Activity log (FR-30, AD-14)**

Given staleness is detected or a cadence flag is set,
When the deal record is updated,
Then an activity log entry is written with `actor: ai`, `action: stale_detected` or `action: follow_up_cadence_flagged`, and the relevant payload (days idle, cadence step).
And if the re-run produces no change (deal was already stale with the same date), no duplicate log entry is written.

---

### Story 4.3: Briefing Generation Job — pg_cron Scheduler & Caching

As an Owner, I want ARIA to generate my daily Briefing automatically each morning and cache it so it is ready instantly when I open the app, so that I never wait for generation on app-open.

**Acceptance Criteria:**

**Depends on:** Story 4.2 (stale-deal detection fields available for briefing inputs).

**FR-25, AD-7 — Scheduled generation**

Given a `pg_cron` job is configured to run at approximately 07:00 Asia/Ho_Chi_Minh (OQ-8/OQ-12 tuning dial, default value),
When the job fires,
Then it invokes the Briefing Edge Function for the Owner.
And the job runs in `Asia/Ho_Chi_Minh` timezone per AD-7.

Given the job fires and a briefing record already exists for `(owner_id, date)` in the `briefings` table,
When the Edge Function checks for an existing record,
Then it exits without re-generating — the uniqueness constraint on `(owner_id, date)` is the idempotency guard (AD-7 no-double-generate).
And no duplicate `briefings` row is created regardless of how many times the job fires on the same day.

Given the job fires and no briefing record exists for today,
When the Edge Function runs,
Then it queries: active deals (status not archived/lost), pending documents (status draft|review), and the last 24-hour activity log — and nothing more (FR-25 scoped query).

**FR-36, AD-7 — Empty CRM guard**

Given the Owner has zero active deals in the CRM,
When the scheduled briefing job fires,
Then no briefing record is written and no AI call is made.
And the in-app surface shows the guided empty state rather than an empty briefing panel (FR-36, UJ-6).

**FR-25 — Caching behavior**

Given a briefing for today has been generated and cached (exists in `briefings` table with `generated_at` timestamp),
When the Owner opens the app or requests the briefing via `get_briefing(date)`,
Then the cached record is returned immediately without triggering a new AI generation call.
And the briefing panel footer shows "Generated [HH:mm] · Refresh" reflecting `generated_at`.

Given the Owner taps "Refresh" in the briefing panel footer,
When the refresh request is received,
Then a new AI generation call is made, the `briefings` row for today is updated (not duplicated), and `generated_at` is updated to the refresh time.

**AD-4 — Model routing**

Given a briefing generation call is made,
When the AI synthesis runs,
Then it is routed to Haiku (economical tier) — briefing generation is structured and predictable (AD-4 routing table).
And this is verifiable via per-call token-usage logs (§8 Observability).

**AD-5 — Prompt caching**

Given the system prompt + tool definitions + Business Context (stable prefix) are byte-stable across briefing calls,
When the Edge Function assembles the prompt,
Then the stable prefix carries a `cache_control` breakpoint; volatile data (deal list, activity log, current date) is appended after it.
And cache hit is verified via `usage.cache_read_input_tokens > 0` in the observability log for non-first calls on the same day.

**AD-6 — Degraded fallback**

Given the Claude API is unavailable when the scheduled job fires,
When generation fails (timeout > ~10s, rate-limit, or API error),
Then the job does not write a failed/empty briefing row; instead the previous day's cached briefing (if any) is served with the sub-banner "Dữ liệu từ [time]" / "Data from [time]."
And the response envelope carries `status: degraded` (AD-6).

**RLS & owner-scoping (AD-2, AD-13)**

Given the Edge Function runs as a scheduled system task for a known owner,
When it reads and writes briefing data,
Then all Supabase queries are scoped to the correct `owner_id`.
And the service-role key is used only for this audited scheduled path — never for owner-initiated client requests (AD-13).

---

### Story 4.4: Briefing Structure, Detection Logic & Ranking

As an Owner, I want the daily Briefing to follow a fixed structure with intelligently ranked "Today" items and correctly categorized pipeline, document, and slow-deal sections, so that the most important actions are always surfaced first.

**Acceptance Criteria:**

**Depends on:** Story 4.3 (briefing generation job exists and caches a `content_md` + `flags` payload).

**FR-26 — Fixed briefing structure**

Given a briefing is generated,
When the AI compiles the sections,
Then the output follows this fixed section order: (1) Today — max 3 ranked items, (2) Pipeline Snapshot, (3) Documents Pending, (4) This Week's Focus, (5) Slow-Moving Deals.
And no section is omitted even if empty — empty sections render a concise "Không có gì mới" / "Nothing to note" placeholder.

**FR-26 — "Today" max 3, ranked**

Given more than 3 items qualify for the "Today" section,
When ranking is applied,
Then items are ranked in this priority order: (1) overdue actions (`next_action_due` < today), (2) due-today actions (`next_action_due` = today), (3) proposal-cadence reminders (3-day/7-day follow-up flags), (4) high-priority stale deals (priority = high AND stale_since is set).
And within the same tier, deals with higher `priority` (high > medium > low) rank first; `value_estimate` is the tie-breaker within the same priority level.
And exactly 3 items (or fewer if fewer qualify) appear in "Today"; remaining qualifying items appear only in their relevant section (Pipeline or Slow-Moving Deals).

**FR-26 — Slow-moving deals detection**

Given a deal has `stale_since` set (no activity > 7 days, established in Story 4.2),
When the briefing compiles the "Slow-Moving Deals" section,
Then the deal appears with its days-stale count (computed as today minus `stale_since`).
And the section is absent from "Today" unless it also qualifies by the ranking criteria above.

**FR-22 — Missing-document detection**

Given a deal's stage implies a document should exist (e.g. stage = "Proposal sent" with no linked document of type `proposal`),
When the briefing's "Documents Pending" section is compiled,
Then that deal is listed with a one-line rationale (e.g. "Đề xuất chưa được tạo cho deal này — cần trước khi follow-up").
And the detection covers: proposal expected at/after "Proposal sent" stage; contract expected at/after "Contract review" stage.

**FR-26 — "Pipeline Snapshot"**

Given the briefing is generated,
When the Pipeline Snapshot section is compiled,
Then it contains: active deal count, total estimated value (sum of `value_estimate` on non-archived/lost deals), and a brief stage distribution (e.g. "3 deals — 1 discovery, 1 proposal, 1 contract review").
And it is written as a prose sentence, not a table or bullet list.

**FR-26 — "This Week's Focus"**

Given the briefing is generated and the pipeline shows a cross-deal pattern (multiple deals in the same stage, a cluster of stale deals, or a concentration of due actions),
When the "This Week's Focus" section is compiled,
Then it contains exactly one strategic note synthesized across the pipeline (not a per-deal item) — e.g. "You have 3 deals in proposal stage at once; follow up on all three before Friday or momentum drops."
And when no salient cross-deal pattern exists, the section renders a brief "Tuần này chưa có điểm nhấn chiến lược" / "No standout strategic focus this week" placeholder rather than being omitted.
And the note is produced by the same Haiku briefing call (AD-4) using the already-fetched deal set — no additional AI call.

**Missing-document detection is a shared service**

Given missing-document detection is also used by Deal Intelligence and pipeline reads (Story 3.5),
When this briefing section computes missing-doc flags,
Then it calls the same shared detection function (e.g. `lib/services/missingDocs`) as Story 3.5 — the rule is implemented once, not duplicated across Epic 3 and Epic 4.

**Flags payload**

Given the briefing is stored in the `briefings` table,
When the `flags` JSONB column is written,
Then it contains a structured list of flagged items suitable for the notification badge count (FR-38): each flag carries `type` (overdue|stale|missing_doc|cadence_reminder), `deal_id`, `severity` (high|medium), and a short `label` string.
And the count of `severity: high` flags is what drives the unread badge count on the Briefing nav item (UJ-1, FR-38).

---

### Story 4.5: Briefing Panel UI — App-Open, On-Demand & Item-to-Chat Pre-Queue

As an Owner, I want to see the daily Briefing as the landing screen when I open the app, access it on demand, and tap any item to open Chat with that deal pre-queued, so that I can act on my priorities in one flow.

**Acceptance Criteria:**

**Depends on:** Story 4.4 (briefing `content_md` and `flags` data available); Story 4.3 (cache layer); Epic 0 shell and Epic 1 Chat panel.

**FR-27, UJ-1 — App-open behavior**

Given the Owner opens the app and a briefing for today exists and has not been seen (no session has navigated to `/briefing` today),
When the app shell loads,
Then the Briefing panel is the landing surface — not Chat.
And the panel renders within 1.5 seconds using skeleton rows matching section structure while data loads (EXPERIENCE.md loading state).

Given the Owner opens the app and the CRM has zero deals (first-run / empty state, FR-36),
When the app shell loads,
Then the Briefing panel is suppressed; Chat loads with the guided welcome instead.
And no empty briefing skeleton or error state is shown.

**FR-27 — Dismissal and return**

Given the Briefing panel is showing,
When the Owner taps "Chat" in the left nav (desktop) or bottom tab bar (mobile),
Then the panel switches to Chat and the Briefing is marked as seen.
And the Briefing nav item notification badge count decrements by the number of high-urgency flags that were addressed or scrolled past (EXPERIENCE.md nav switching behavior).

**FR-27 — On-demand access**

Given the Owner is in Chat and says "Show me today's briefing" or navigates to `/briefing`,
When the request is handled,
Then the Briefing panel opens and displays the cached briefing for today.
And if no briefing exists for today (scheduler not yet run), a "Generating…" skeleton is shown and generation is triggered on demand.

**FR-27, UJ-1 — Briefing item → Chat pre-queue**

Given the Owner taps a "Today" item in the Briefing panel,
When the tap is registered,
Then the app switches to Chat mode.
And the input bar is pre-populated with a composed message referencing the deal (e.g. "Phở 24 — đề xuất của em gửi 4 ngày rồi mà chưa thấy họ phản hồi. ARIA nghĩ sao?"), editable by the Owner.
And the message is NOT auto-sent — the Owner must press Send (EXPERIENCE.md pre-queue behavior, owner agency).

Given the Owner taps the "Ask ARIA about this" footer of any Deal card in the Briefing,
When the tap is registered,
Then the same pre-queue behavior fires: Chat opens, input bar populated, not auto-sent.

**Briefing panel sections rendering (FR-26, EXPERIENCE.md)**

Given the briefing `content_md` is loaded,
When the Briefing panel renders,
Then Section 1 "Today" shows at most 3 ranked items — each with: title, one-line rationale, recommended action, and a tappable area.
And the first "Today" item carries an amber (`{colors.accent}`) left border accent (urgency-ranked first); others carry teal (`{colors.primary}`) left border (DESIGN.md §7.2 briefing card).
And Section 5 "Slow-Moving Deals" shows each stale deal with its days-stale count in a `{colors.warning}` badge.

**FR-27 — Refresh**

Given the Owner taps "Refresh" in the Briefing panel footer,
When the refresh completes,
Then the panel re-renders with updated content and the footer shows the new `generated_at` time.
And the "Refresh" link is disabled (spinner) during generation and re-enabled on completion or failure.

**Notification badge (FR-38)**

Given the briefing has been generated and contains at least one `severity: high` flag,
When the Owner has not yet opened the Briefing panel in this session,
Then the Briefing nav item shows an amber badge with the count of unaddressed high-urgency items.
And the badge count clears when the Owner opens Briefing and scrolls past the flagged items (EXPERIENCE.md nav switching).

**Degraded state (AD-6, FR-5)**

Given the API is unavailable and no briefing was generated for today,
When the Owner opens the app,
Then the last available cached briefing is shown with a sub-banner "Dữ liệu từ [time]" / "Data from [time]."
And if no cached briefing exists at all (first day, no prior generation), the Chat empty state is shown instead.

---

### Story 4.6: Proactive Check-in Scheduler — Trigger Criteria & Job

As an Owner, I want ARIA to automatically schedule and send proactive check-in prompts for deals that have gone quiet or have an imminent action due, so that my pipeline stays current without me having to remember to update it.

**Acceptance Criteria:**

**Depends on:** Story 4.3 (pg_cron + Edge Function pattern established); Story 4.2 (stale-deal fields populated).

**FR-17, AD-7 — Scheduled job**

Given a `pg_cron` job is configured to evaluate check-in eligibility on a regular cadence (default: once daily, configurable via OQ-12),
When the job fires,
Then it evaluates all active deals for the Owner against the trigger criteria.
And the job is idempotent: a re-fire within the same cadence window does not create a duplicate `check_ins` row for the same `(deal_id, cadence_window)` — the dedupe key on the `check_ins` table enforces this (AD-7, addendum §B.6).

**FR-17 — Trigger criteria (defaults)**

Given a deal is active (not archived or lost),
When the trigger evaluation runs,
Then a check-in is eligible if ALL of the following are true:
- (a) No activity has been logged for ≥ 3 days AND deal priority = high, OR no activity for ≥ 5 days AND priority = medium or low; AND
- (b) There is no pending (unanswered) `check_ins` record already in the `check_ins` table for this deal; AND
- (c) The daily global check-in cap has not been reached (default: 3 check-ins/day per owner, configurable in Settings, SM-C1).

Given a deal has a `next_action_due` date that is today or in the past (overdue),
Then it is also eligible regardless of the inactivity-day threshold (FR-17 "approaching a due action" criterion).
And the due/overdue path is evaluated independently of the inactivity path — a deal can qualify via either.

**FR-36 — Empty CRM guard**

Given the Owner has zero active deals,
When the check-in evaluation job fires,
Then no `check_ins` rows are created and no AI calls are made.

**Check-in record creation**

Given a deal is eligible for a check-in,
When the job selects the check-in prompt template (see Story 4.7 for answer capture),
Then a `check_ins` row is inserted with: `owner_id`, `deal_id`, `prompt_template` (populated with deal name and last activity reference), `sent_at` (current timestamp), `channel: in_app`, `status: pending`.
And the row for Zalo/email delivery is also created with the appropriate channel if set up (actual external push is Epic 5; this story creates the authoritative in-app record per AD-8).

**Global cap enforcement (SM-C1)**

Given 3 check-in records have already been created today for the owner (or the configured cap value),
When the evaluation job processes additional eligible deals,
Then no further check-in rows are created for that day.
And the highest-priority eligible deals are selected first (priority: high > medium > low, then `value_estimate` as tie-breaker).

**RLS & owner-scoping (AD-2)**

Given the check-in job runs,
When it reads from `deals` and writes to `check_ins`,
Then all operations are scoped to the correct `owner_id`.
And RLS policies are enforced; no cross-owner data is readable or writable (AD-13 — service-role used only for this audited scheduled path).

**Activity log (FR-30, AD-14)**

Given a check-in row is created,
When the insert succeeds,
Then an `activity_log` entry is written with `actor: ai`, `action: checkin_scheduled`, `entity_type: deal`, `entity_id: deal_id`.
And if a re-run finds an existing pending check-in for the same deal in the same window, no duplicate log entry is written.

---

### Story 4.7: Check-in Delivery, Quick-Reply UI & Answer Capture

As an Owner, I want to receive proactive check-in prompts in-app with quick-reply chips, tap one answer to update the deal, and have ARIA capture free-text answers too, so that keeping my pipeline current takes one tap.

**Acceptance Criteria:**

**Depends on:** Story 4.6 (check-in records created in `check_ins` table with `status: pending`).

**FR-17, UJ-3, EXPERIENCE.md — In-app check-in delivery**

Given a `check_ins` row with `status: pending` and `channel: in_app` exists for a deal,
When the Owner opens or returns to the Chat panel,
Then an ARIA-initiated message appears in the Chat transcript referencing the specific deal and the last known state.
And the message includes 2–3 quick-reply chips appropriate to the deal's stage (e.g. "Họ phản hồi rồi" / "They responded", "Vẫn đang chờ" / "Still waiting", "Cần nhắc thêm" / "Needs a nudge") per the UJ-3 example.
And the Briefing nav item notification badge increments by 1 for the new pending check-in (FR-38, EXPERIENCE.md notification dot vs badge).

**FR-18, EXPERIENCE.md — Quick-reply chip interaction**

Given the check-in message is displayed with chips,
When the Owner taps a chip,
Then the chip becomes selected (teal fill, DESIGN.md §7.7 selected state) and the chip value is sent as a user message immediately without a secondary Send tap.
And the other chips are disabled (opacity 0.5, cursor not-allowed).
And the `check_ins` row is updated: `answered_at` = now, `answer` = `{ type: quick_reply, value: <chip_label> }`, `status: answered`.

Given the Owner types a free-text reply instead of tapping a chip,
When the first keystroke is registered,
Then the chips disappear and the Owner's typed reply is processed as the answer.
And the `check_ins` row is updated with `answer: { type: free_text, value: <text> }`, `status: answered`.

**FR-18 — Answer capture → field updates**

Given the Owner has answered a check-in (quick-reply or free-text),
When ARIA processes the answer (Haiku-routed, AD-4 — structured extraction, not Deal Intelligence),
Then the relevant deal fields are updated based on the answer content:
- A "responded" answer: `next_action` updated to reflect the follow-up needed; stage may advance if the answer implies it.
- A "still waiting" answer: `next_action_due` extended by the cadence interval; no stage change.
- A "needs nudge" answer: a follow-up draft is offered (ARIA asks one clarifying question or offers a Zalo message template).
And all field changes are written to `activity_log` with `actor: ai`, `action: checkin_answered`, and the answer payload.

Given the answer implies a stage change (e.g. "Cần xem lại hợp đồng" → "Contract review"),
When ARIA updates the deal,
Then `stage` is updated, `stage_history` receives a new entry with timestamp and actor, and the activity log records the change (FR-30, AD-14).
And ARIA's follow-on response confirms the update and offers a next step (FR-3 guidance stance).

**FR-18 — Answer capture → Intelligence Fields (AI-maintained)**

Given the Owner's check-in answer contains new signals (e.g. "Họ muốn giảm giá"),
When ARIA processes the answer,
Then relevant Intelligence Fields are updated: `risk_flags`, `opportunity_signals`, or `inferred_real_need` as appropriate.
And each Intelligence Field update is logged with `actor: ai` (AD-14 idempotent AI writes — no duplicate entry if the field value is unchanged).

**Bilingual check-in messages (FR-2)**

Given the Owner's last message before the check-in was in Vietnamese,
When the check-in message is rendered,
Then the prompt text and chip labels are in Vietnamese.
And if the Owner's context is English, the prompt and chips are in English.
And both language variants are shown in the acceptance example: Vietnamese ("Deal Phở 24 — có gì mới từ thứ Ba không?") and English ("Phở 24 proposal — any movement since Tuesday?") per EXPERIENCE.md microcopy.

**Skip / dismiss**

Given the Owner ignores a check-in message (does not answer or dismiss),
When the next cadence window fires (Story 4.6 evaluation),
Then the existing pending check-in is detected (Story 4.6 AC: no duplicate if pending exists) and no second check-in is created for the same deal.
And after 2 consecutive missed windows, the deal's priority is elevated in the next Briefing "Today" ranking (EXPERIENCE.md cadence guardrails — urgency escalation path, not a separate notification blast).

**In-app record as authoritative (AD-8)**

Given any check-in is delivered,
When it is stored,
Then the `check_ins` table record is the authoritative copy regardless of Zalo/email delivery status (AD-8).
And the in-app message is always shown on app open even if external delivery failed (FR-38).

---

### Story 4.8: Check-in Cadence Configuration & Per-Deal Pause

As an Owner, I want to configure global check-in frequency, adjust the inactivity thresholds, and pause check-ins per deal or globally, so that proactive prompts are helpful rather than noise.

**Acceptance Criteria:**

**Depends on:** Story 4.7 (check-in system operational).

**FR-18 — Settings surface (EXPERIENCE.md §IA → Settings Panel)**

Given the Owner navigates to Settings → Check-in Cadence,
When the settings panel renders,
Then it displays the current values for:
- Global daily cap (default: 3; input: number, min 1, max 10).
- High-priority inactivity threshold (default: 3 days; input: number, min 1).
- Standard inactivity threshold (default: 5 days; input: number, min 1).
- Global check-ins enabled/disabled toggle.
And all inputs have visible `<label>` elements (EXPERIENCE.md accessibility floor).

Given the Owner saves a changed cadence value,
When the save is confirmed,
Then the new value is persisted to the `settings` / `business_context` record (addendum §B.7) scoped to `owner_id`.
And future check-in evaluation jobs (Story 4.6) read these values instead of the hardcoded defaults.
And an `activity_log` entry is written with `actor: user`, `action: cadence_setting_changed`, and the before/after values.

**FR-18 — Per-deal pause**

Given the Owner says "Pause check-ins for the Phở 24 deal" in Chat,
When ARIA handles the request,
Then the corresponding `deals` record (or a per-deal flag column in `deals` or `check_ins` config) is updated to `checkin_paused: true`.
And the Story 4.6 evaluation skips that deal when `checkin_paused = true`.
And ARIA confirms the pause in its reply and tells the Owner how to re-enable it ("Anh có thể bật lại bằng cách nói 'Bật lại check-in cho Phở 24'").

Given the Owner says "Resume check-ins for the Phở 24 deal" in Chat,
When ARIA handles the request,
Then `checkin_paused` is set to false for that deal and confirmation is given.

**FR-18 — Global pause**

Given the Owner toggles "Check-ins disabled" in Settings,
When the toggle is saved,
Then the Story 4.6 scheduled job creates no new check-in rows while the toggle is off.
And existing pending check-in messages in Chat remain visible but no new ones are injected.

**Cadence validation**

Given the Owner sets the high-priority threshold to a value greater than or equal to the standard threshold,
When the save is attempted,
Then ARIA or the UI surfaces an inline validation message: "High-priority threshold should be shorter than the standard threshold — e.g. 3 days vs 5 days" / "Ngưỡng ưu tiên cao nên ngắn hơn ngưỡng thông thường."
And the save is blocked until the values are corrected.

**RLS (AD-2)**

Given the Owner saves cadence settings,
When the write occurs,
Then the `settings` row is scoped to the authenticated `owner_id` and RLS enforcement prevents any cross-owner read or write.
## Epic 5: Delivery Channels

Goal: Proactive content (Briefings, Check-ins, urgency alerts) reaches the Owner reliably — written to in-app first (authoritative), pushed to Zalo OA chat (best-effort), and guaranteed by email — so no item is ever silently dropped.

---

### Story 5.1: In-App Delivery Record & Notification Indicator

As an Owner, I want every proactive item (Briefing, Check-in, urgency alert) to be immediately visible in the app with an unread count badge, So that I never miss a time-sensitive update even if no external channel is configured.

**Acceptance Criteria:**

**Given** the scheduler generates a daily Briefing or fires a check-in (Epic 4),
**When** the delivery service runs,
**Then** the proactive item is written as an in-app record to the `briefings` or `check_ins` table (with `channel = in_app`, `status = pending`) before any external channel is attempted — this write is the authoritative record per AD-8.

**Given** an in-app proactive record exists with `status = pending`,
**When** the Owner opens the app,
**Then** the Briefing panel (for a Briefing) or an ARIA-initiated message card in Chat (for a Check-in) is visible on next open, independent of whether Zalo or email delivery succeeded or failed (FR-38).

**Given** one or more high-urgency items are unaddressed (a deal with an overdue action in "Today," or a check-in for a high-priority deal),
**When** the Owner is on any panel,
**Then** the Briefing nav item shows an `{colors.accent}`-filled badge pill with the integer count of unaddressed high-urgency items; the count does not include low-urgency updates (FR-38, EXPERIENCE.md §IA Shell).

**Given** the Owner opens the Briefing panel and scrolls past all flagged high-urgency items, or taps a Check-in quick-reply chip resolving it,
**When** the item transitions to `status = answered` or the Briefing is marked seen,
**Then** the badge count decrements accordingly; reaching zero removes the badge entirely.

**Given** a high-urgency item arrives while the Owner is actively in the Chat panel,
**When** the in-app record is written,
**Then** a dismissible in-app banner also appears at the top of the Chat panel listing the urgency reason (EXPERIENCE.md Proactive Notifications §In-app).

**Given** Zalo OA is not yet set up and email delivery is also unavailable,
**When** the scheduler fires,
**Then** the in-app record is still written and the badge increments — the Owner is never left with no indicator (FR-38).

**Given** there are zero eligible deals (empty CRM or all deals paused),
**When** the scheduler fires,
**Then** no in-app record is created and the badge remains absent (FR-36, AD-7 idempotency).

**Implementation notes:**
- The in-app write must complete and commit before any Zalo or email call is made; external-channel failure must never roll back the in-app record (AD-8).
- The `briefings` table carries a unique constraint on `(owner_id, date)`; `check_ins` carry a per-`(deal_id, cadence_window)` dedupe key to ensure idempotency on job re-fire (AD-7).
- Badge count is derived from a query on unaddressed high-urgency in-app records; it is not a denormalized counter that can drift (FR-38).

---

### Story 5.2: Email Delivery — Briefing and Check-in Formats

As an Owner, I want the daily Briefing and proactive Check-ins delivered to my email inbox in a clear, actionable format, So that I have a reliable, always-available copy of every proactive item even before Zalo is configured.

**Acceptance Criteria:**

**Given** the delivery service has written an in-app record for a Briefing (Story 5.1 complete),
**When** Zalo OA is not yet set up OR Zalo delivery is unconfirmed (Story 5.4 not yet built or Zalo channel skipped),
**Then** an email is sent to the Owner's registered address carrying the full Briefing content — same sections as the in-app Briefing panel: Today (max 3 items with rationale and recommended action), Pipeline Snapshot, Documents Pending, This Week's Focus, Slow-Moving Deals (FR-29, AD-8).

**Given** a Briefing email is composed,
**When** the email is sent,
**Then** the subject line is "ARIA Tóm tắt — [DD/MM/YYYY]" (Vietnamese) / "ARIA Briefing — [YYYY-MM-DD]" (English) matching the Owner's UI language preference; the body is plain-text with structured section headings (no HTML required in v1); a footer contains an unsubscribe link for email compliance (EXPERIENCE.md §Email).

**Given** the delivery service has written an in-app check-in record for a specific deal,
**When** Zalo is not set up or delivery is unconfirmed,
**Then** a check-in email is sent to the Owner's address with: the deal name, the check-in question text (bilingual where configured), and numbered reply options "Trả lời 1, 2, hoặc 3 trong app ARIA" / "Reply 1, 2, or 3 in the ARIA app" — making clear that v1 email is outbound-only and answers are captured in-app (FR-29, addendum §F).

**Given** either the Briefing or a check-in has already been sent by email for a given `(owner_id, date/window)`,
**When** the scheduler re-fires or retries,
**Then** a duplicate email is NOT sent — the email send is guarded by the same idempotency key as the in-app record (AD-7).

**Given** the email provider returns a delivery error (e.g., invalid address, provider outage),
**When** the send attempt fails,
**Then** the failure is logged to the `activity_log` with `actor = ai`, `action = email_delivery_failed`; the in-app record remains intact (the Owner can still see the item in-app); no silent drop occurs (AD-8).

**Given** a high-urgency Briefing item exists (overdue action, high-priority deal),
**When** the Briefing email is sent,
**Then** the subject line is prefixed with "[Cần xử lý]" / "[Action needed]" to signal urgency (FR-29).

**Implementation notes:**
- Email delivery uses the configured transactional provider (Resend/SendGrid via Vercel environment, AD-11 — credentials server-side only).
- Email content is generated from the same structured data used to render the in-app Briefing; no separate AI call is made for email formatting.
- The `check_ins` record `channel` field logs `email` when the email path fires; if both in-app and email records exist for the same check-in, they share the same `check_ins.id` with multiple channel log entries.

---

### Story 5.3: Zalo OA Setup — Owner Follow & Token Refresh Job

As an Owner, I want a guided one-time setup to connect my Zalo Official Account and have the system automatically keep its access token fresh, So that ARIA can send proactive messages to my Zalo without interruption from token expiry.

**Acceptance Criteria:**

**Given** the Owner is in Settings → Notification Channels and Zalo OA is not yet connected,
**When** they view the panel,
**Then** a non-blocking info card reads "Zalo OA chưa kết nối — thông báo chủ động chỉ qua email và in-app." with a "Kết nối Zalo OA" CTA; proactive delivery still works via in-app and email (FR-38, EXPERIENCE.md §Zalo Not Set Up).

**Given** the Owner taps "Kết nối Zalo OA",
**When** the setup flow begins,
**Then** ARIA presents step-by-step instructions: (1) confirm the OA `app_id` and `secret_key` are entered or pre-configured (server-side, AD-11); (2) provide the Owner's Zalo `user_id` (the numeric ID linked to their personal Zalo account that will follow the OA); (3) confirm the Owner has followed the OA in their Zalo app (one-time action, required for OA chat to reach them as a follower) (FR-28, addendum §F).

**Given** the Owner completes the follow-setup steps and submits,
**When** ARIA validates the connection by calling the Zalo OA token endpoint (`POST https://oauth.zaloapp.com/v4/oa/access_token`) with the provided credentials,
**Then** on success: the access token and refresh token are stored encrypted, server-side only (AD-11); the Zalo setup status is marked `connected`; the UI confirms "Zalo OA đã kết nối — ARIA sẽ gửi thông báo qua Zalo."; on failure: a clear error is shown ("Không thể kết nối — kiểm tra App ID / Secret Key") and no partial state is saved.

**Given** the Zalo OA is connected and the `pg_cron` token-refresh job is running (AD-7),
**When** approximately 55 minutes have elapsed since the last token issue (5 minutes before the 1-hour expiry),
**Then** the refresh job calls the Zalo token endpoint with the stored refresh token; on success, the new access token and (if rotated) refresh token replace the stored values, encrypted, server-side (AD-11); the `activity_log` records `action = zalo_token_refreshed`.

**Given** the token-refresh job fires but the refresh token has expired (valid for 3 months from Zalo) or the request fails,
**When** the refresh attempt returns an error,
**Then** the Zalo setup status is set to `token_expired`; the delivery service falls back to email for subsequent sends (AD-8); the Owner is shown a non-blocking in-app notification "Kết nối Zalo OA cần được kết nối lại" with a link to Settings → Notification Channels.

**Given** the Owner is in the first-run flow (FR-36) after their first Deal Intelligence read,
**When** ARIA offers Zalo setup ("Anh muốn nhận thông báo qua Zalo không? Em có thể nhắc anh mỗi sáng."),
**Then** tapping "Để sau" skips setup without error; the in-app+email channels remain active; the setup offer does not reappear in conversation (only in Settings) (EXPERIENCE.md §UJ-6).

**Given** OQ-13 (Zalo OA app registration) has not been completed (OA not yet approved by Zalo),
**When** a developer or operator attempts to run this story,
**Then** the story is blocked — OA registration with Zalo is a prerequisite; the story's definition of done explicitly requires a working OA `app_id` and API approval.

**Implementation notes:**
- The `pg_cron` refresh job runs every 55 minutes in `Asia/Ho_Chi_Minh` time (AD-7); it is idempotent — if the current token is still valid with > 10 minutes remaining, it skips the refresh call and logs a no-op.
- Zalo `app_id`, `secret_key`, encrypted access token, and refresh token are stored in the server environment/secrets store; they are never sent to the client or logged in plaintext (AD-11).
- The `check_ins` and `briefings` tables gain a `zalo_status` field (`not_configured | sent | failed | token_expired`) to support delivery-orchestration logic in Story 5.5.

---

### Story 5.4: Zalo OA Chat Send with Quick-Reply-as-Numbered-Text

As an Owner, I want Briefings and Check-ins pushed to my Zalo as conversational messages, with check-in options presented as numbered choices since Zalo doesn't support button UI, So that I can respond directly in Zalo with a simple number without switching to the ARIA app.

**Acceptance Criteria:**

**Given** the Zalo OA is connected and the access token is valid (Story 5.3 complete),
**When** the delivery service processes a Briefing for the day,
**Then** ARIA calls `POST /v2.0/oa/message` with the Owner's Zalo `user_id` and the Briefing content formatted as plain text (no markdown — Zalo OA chat is text-only) with section headers as plain labels; content exceeding Zalo's OA message character limit is truncated and appended with "Xem đầy đủ trong app ARIA" / "See full briefing in ARIA app" (FR-28, EXPERIENCE.md §Zalo OA).

**Given** a check-in message is being sent via Zalo OA chat,
**When** the message is composed,
**Then** quick-reply chip options are converted to numbered text below the question body:
- Vietnamese example: "Deal Phở 24 — có gì mới từ thứ Ba không?\n1. Họ phản hồi rồi\n2. Vẫn đang chờ\n3. Cần nhắc thêm\nTrả lời bằng số 1, 2, hoặc 3."
- English example: "Phở 24 proposal — any movement since Tuesday?\n1. They responded\n2. Still waiting\n3. Needs a nudge\nReply with 1, 2, or 3."
No Zalo button or template component is used (FR-28, addendum §F — Zalo OA chat does not support button UI).

**Given** the Zalo API call to send the message returns a successful HTTP response (2xx with a message ID),
**When** the delivery service receives the response,
**Then** the `check_ins` or `briefings` record's `zalo_status` is set to `sent`; the `activity_log` records `action = zalo_message_sent` with the Zalo message ID; no email fallback fires for this item.

**Given** the Zalo API call fails (non-2xx response, network error, or messaging-window rejection),
**When** the delivery service receives the error,
**Then** the `zalo_status` is set to `failed`; the email fallback fires automatically carrying the same content (FR-28 design-for-failure, AD-8); the in-app record remains unaffected; the failure is logged to `activity_log`.

**Given** an inbound Zalo reply arrives (Owner sends "1", "2", or "3" back to the OA),
**When** the Zalo webhook receives the message (v1: inbound webhook is plumbing-only),
**Then** v1 logs the raw payload to `activity_log`; full inbound capture and check-in answer processing via Zalo replies is deferred post-v1 (addendum §F — "Replies/inbound from Zalo: webhook for later"); the Owner is instructed in the Zalo message to reply in the ARIA app for full processing in v1.

**Given** the access token has expired and the refresh job has not yet run (edge case between refresh cycles),
**When** the send call returns a 401/auth error,
**Then** the delivery service marks `zalo_status = token_expired`, triggers an immediate token refresh attempt (one retry), and if that fails, fires the email fallback; no proactive item is dropped (AD-8).

**Given** the OA quality grade drops to "Low" (hypothetical — near-zero risk for a private single-user OA),
**When** the Zalo API returns a quota-exceeded or grade-blocked error,
**Then** the same design-for-failure path applies: `zalo_status = failed`, email fallback fires, Owner is notified in-app.

**Implementation notes:**
- Zalo send calls use the server-side access token only; the token is never passed to the Next.js client (AD-11).
- Message text generation for Zalo reuses the content already generated for the in-app record — no additional AI call; formatting is a pure string transformation (strip markdown, number chips, truncate).
- OQ-5 operational validation (confirm unsolicited push behavior under the 48h messaging window) is a prerequisite for this story's sign-off; the story's definition of done requires at least one end-to-end test send to a real OA follower.

---

### Story 5.5: Delivery Orchestration — In-App → Zalo → Email Priority/Fallback

As an Owner, I want every proactive item delivered through a consistent priority sequence — in-app always, then Zalo if set up, then email as the guaranteed backstop — with no item ever dropped and no duplicate sends, So that I can rely on receiving every Briefing and Check-in regardless of which channels are configured or available.

**Acceptance Criteria:**

**Given** the Briefing scheduler or check-in job fires for an eligible owner (AD-7 idempotency guardrails active),
**When** the delivery orchestrator runs,
**Then** it executes exactly this sequence per AD-8:
1. Write in-app record (authoritative) — Story 5.1; this write must succeed before proceeding.
2. If Zalo OA status is `connected` AND access token is valid: attempt Zalo send (Story 5.4).
3. If Zalo send is unconfirmed (status `failed`, `token_expired`, or `not_configured`) OR Zalo OA status is not `connected`: send email (Story 5.2).
4. If Zalo send succeeded: email is NOT sent (no duplicate content delivery).

**Given** the orchestrator completes for a given `(owner_id, item_id)`,
**When** the result is recorded,
**Then** the item's delivery record shows exactly which channels were attempted and their outcomes (`in_app: written`, `zalo: sent|failed|skipped`, `email: sent|skipped|failed`); no combination results in zero delivery — in-app is always written (FR-38, AD-8).

**Given** a Briefing was already sent today (idempotency check: `briefings` unique on `(owner_id, date)`),
**When** the scheduler re-fires (restart, duplicate trigger),
**Then** the orchestrator detects the existing record and skips all channel sends; no duplicate in-app record, no duplicate Zalo message, no duplicate email (AD-7).

**Given** a check-in was already sent for a `(deal_id, cadence_window)` pair,
**When** the job re-fires,
**Then** the orchestrator detects the deduplication key and skips; the existing in-app record and any external sends are left intact (AD-7).

**Given** a transient failure occurs during email send (SMTP timeout) after Zalo already failed,
**When** both external channels have failed,
**Then** the in-app record persists as the Owner's guaranteed access point; the failure is logged; no silent drop occurs; a retry of the email send may be attempted on the next job tick using the existing in-app record as source of truth (AD-8).

**Given** the global daily check-in cap is reached (default: 3 check-in messages per day, SM-C1),
**When** additional check-ins would otherwise fire,
**Then** the orchestrator suppresses them until the next calendar day; the cap applies across all channels combined, not per-channel (EXPERIENCE.md §Cadence Guardrails).

**Given** Zalo OA is set up AND the access token is valid AND the email-only path has been the default for several days (Zalo had been `not_configured`),
**When** Zalo setup is completed mid-day,
**Then** existing already-delivered items are NOT re-sent via Zalo; only new items from the next scheduler tick go through the full Zalo path.

**Given** the Owner has set Zalo to disabled in Settings → Notification Channels,
**When** the orchestrator runs,
**Then** the Zalo step is skipped entirely (no send attempt) and email fires as the external channel; the in-app record is always written regardless (FR-38).

**Implementation notes:**
- The orchestrator is implemented as a Supabase Edge Function invoked by `pg_cron` (AD-7); it is stateless and reconstructs delivery state solely from the database records.
- The orchestration logic is a single server-side function; it is NOT split across the Next.js API and the Edge Function to avoid partial execution on network partition.
- Secrets (Zalo token, SMTP credentials, Anthropic key) are accessed from the server environment only; the Edge Function never passes them to any client surface (AD-11).
- OQ-5 (Zalo OA push validation) and OQ-13 (OA registration) must be resolved before this story's Zalo path can be end-to-end tested; the email-only path is independently testable.

---

### Story 5.6: Delivery Channel Settings & Zalo-Not-Set-Up Graceful State

As an Owner, I want clear Settings controls for my notification channels and a graceful in-app experience when Zalo is not yet configured, So that I always understand which channels are active and can manage them without breaking the proactive delivery flow.

**Acceptance Criteria:**

**Given** the Owner navigates to Settings → Notification Channels,
**When** the panel loads,
**Then** they see the status of each channel:
- **In-app:** always active, shown as "Luôn bật" / "Always on" (non-toggleable — in-app is the authoritative channel, FR-38, AD-8).
- **Zalo OA:** connection status (`connected` / `not connected` / `token expired`); "Connect" or "Reconnect" CTA as appropriate (Story 5.3).
- **Email:** configured address shown; toggle to enable/disable email fallback (default: enabled); disabling shows a warning "Nếu Zalo thất bại sẽ không có kênh dự phòng" / "If Zalo fails there will be no fallback channel."

**Given** Zalo OA status is `not_configured` or `token_expired`,
**When** the first check-in is delivered in-app,
**Then** a one-time note is appended to that check-in message: "Bật Zalo OA trong Cài đặt để nhận tin nhắn này qua Zalo." — this note is shown only once per Owner lifetime (not on every check-in) and is dismissed after the Owner views it (EXPERIENCE.md §Zalo Not Set Up).

**Given** Zalo OA status is `not_configured`,
**When** the Owner is in Settings → Notification Channels,
**Then** the panel shows a non-blocking info card "Zalo OA chưa kết nối — thông báo chủ động chỉ qua email và in-app." with a "Kết nối Zalo OA" CTA, consistent with EXPERIENCE.md.

**Given** the Owner toggles email off AND Zalo is not configured or in `token_expired` state,
**When** the toggle is submitted,
**Then** the system displays a blocking confirmation dialog: "Nếu tắt email và Zalo chưa kết nối, anh sẽ chỉ thấy thông báo trong app. Tiếp tục không?" — if confirmed, email is disabled; in-app delivery continues as the sole channel (FR-38 ensures in-app is always authoritative regardless).

**Given** the Owner enables email after it was disabled,
**When** the next Briefing or check-in fires,
**Then** the email path is active again; no backfill of previously missed emails is sent.

**Given** check-in cadence is configurable per FR-18,
**When** the Owner adjusts the global cadence or pauses check-ins for a specific deal in Settings → Check-in Cadence,
**Then** the `pg_cron` job respects the updated flag on the next tick; paused deals produce no in-app record, no Zalo send, and no email send for check-ins (AD-7, FR-18).

**Implementation notes:**
- Settings state is persisted in the `settings / business_context` table (addendum §B.7), owner-scoped with RLS (AD-2).
- The in-app channel toggle is UI-only (always active) — there is no server-side flag to disable in-app delivery; this prevents any path that could result in zero delivery channels.
- This story has no new scheduler or send logic; it wires UI controls into flags that the orchestrator (Story 5.5) already reads.
