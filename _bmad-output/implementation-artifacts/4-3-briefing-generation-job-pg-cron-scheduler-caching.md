---
story: 4-3
title: Briefing Generation Job — pg_cron Scheduler & Caching
status: done
epic: 4
sprint: 1
---

# Story 4-3: Briefing Generation Job — pg_cron Scheduler & Caching

## Summary

Implements the daily briefing generation engine:
- `lib/crm/briefingService.ts` — server-only service: `getBriefing()` (cache read), `generateBriefingForOwner()` (AI generation + upsert)
- `app/api/cron/briefing/route.ts` — protected cron endpoint (Bearer secret), calls generation per owner
- `supabase/migrations/20260629040000_pg_cron_briefing_job.sql` — pg_cron schedule + pg_net call

AI generation uses Haiku (AD-4), prompt caching via `callAI()` stable-prefix pattern (AD-5).
Idempotency: `UNIQUE(owner_id, date)` constraint + pre-check on existing row (AD-7).
Degraded fallback: previous-day briefing + `status: 'degraded'` overlay when API unavailable (AD-6).

## Scope

- **FR-25**: Scheduled generation at 07:00 Vietnam time; cached result served instantly
- **FR-36**: Empty CRM guard — no write/no AI call if zero active deals
- **AD-7**: pg_cron at `'0 0 * * *'` (UTC midnight = 07:00 ICT), UNIQUE constraint is idempotency guard
- **AD-4**: Haiku for briefing generation (structured, predictable)
- **AD-5**: `callAI()` stable-prefix caching — system prompt + business context are cache_control breakpoints
- **AD-6**: On API failure, return previous day's cached briefing with `status: 'degraded'`
- **AD-13**: `createServiceClient()` used in cron path (system task, not owner request); `createServerClient()` for read path

## Files Created / Modified

- `lib/crm/briefingService.ts` — NEW: generation + cache read service
- `app/api/cron/briefing/route.ts` — NEW: cron-protected endpoint
- `supabase/migrations/20260629040000_pg_cron_briefing_job.sql` — NEW: pg_cron schedule via pg_net
- `lib/__tests__/briefingGenerationJob43.test.ts` — NEW: inline ts-node tests
- `package.json` — add `test:briefing-job43` script + CI chain entry

## Architecture Decisions

- **AD-11**: `import 'server-only'` at line 1 of all lib files
- **AD-2**: All DB queries include `.eq('owner_id', ownerId)`
- **CRON_SECRET**: Server-only env var (no `NEXT_PUBLIC_` prefix) — never logged
- **Upsert on refresh**: `ON CONFLICT (owner_id, date) DO UPDATE` — update row on forceRefresh; idempotent on re-run
- **Degraded fallback**: previous day's briefing served from DB, never written as 'degraded' to briefings table (status is a virtual field in the service return type)
- **Business context**: read from `settings.business_context` via service client (stable, cached by `callAI()`)
- **flags column**: stores `{ deal_count, doc_count, doc_pending_count }` for observability

## Acceptance Criteria

1. `GET /api/cron/briefing` with valid `Authorization: Bearer {CRON_SECRET}` → 200, generates briefing
2. `GET /api/cron/briefing` with no auth / wrong secret → 401
3. Briefing for `(owner_id, date)` already exists → early return, no AI call
4. Zero active deals → no write, no AI call, returns 204
5. AI failure → return previous day's briefing with `status: 'degraded'`; if no previous → 204
6. `getBriefing(ownerId, date)` returns cached row or null
7. Forced refresh (`forceRefresh=true`) → re-generates and upserts
8. pg_cron job fires at 00:00 UTC (07:00 ICT) via pg_net

### Review Findings

- [x] [Review][P1-fixed] `generateBriefingsForAllOwners` fetched all deal owners; `limit(500)` silently dropped active owners — Added `.eq('is_stub', false).not('stage', 'in', ...)` filter + raised limit to 10,000
- [x] [Review][P1-fixed] HTTP 204 with JSON body is invalid — changed to 200 (preserves skip reason for observability)
- [x] [Review][P1-fixed] `cron.unschedule()` with `WHERE EXISTS` invalid pg_cron syntax — wrapped in `DO $$ BEGIN ... EXCEPTION WHEN OTHERS THEN NULL; END $$`
- [x] [Review][P1-fixed] `net.http_post` against GET route → 405 Method Not Allowed — changed to `net.http_get`
- [x] [Review][P2-fixed] Empty `businessContext || undefined` behavior — added comment explaining cache breakpoint skip
- [x] [Review][P2-deferred] TOCTOU race under concurrent cron calls — upsert prevents double-writes; extra AI cost acceptable for MVP cadence
- [x] [Review][P2-deferred] Missing UPDATE RLS policy — documented that all briefing writes use `createServiceClient()` (bypasses RLS); future user-facing refresh path must maintain this
- [x] [Review][P3-fixed] Tests now assert GET handler and `net.http_get` in migration
