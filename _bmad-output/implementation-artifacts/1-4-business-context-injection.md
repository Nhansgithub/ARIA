---
story: 1.4
epic: 1
status: ready-for-dev
baseline_commit: ''
---

# Story 1.4: Business Context Injection

## Story

As an Owner, I want ARIA to load my Business Context (agency info, pricing rules, escalation thresholds) at the start of every session so its advice is grounded in my specific agency, so that every response is relevant without me re-explaining my situation in every conversation.

---

## Acceptance Criteria

**AC-1: Context injection on first AI call**

**Given** the Owner begins a new session or sends their first message,
**When** the orchestrator assembles the context for its first AI call,
**Then** the Business Context document (≤ ~2,000 tokens) is injected as part of the stable prompt prefix; no bulk CRM data is pre-loaded — CRM data is fetched on demand via tools. (FR-4; AD-3; AD-5)

**AC-2: Pricing benchmarks applied automatically**

**Given** the Business Context contains pricing benchmarks (e.g., web design 20–80M VND, app 60–150M VND, automation 20–60M/workflow VND),
**When** ARIA gives advice that touches pricing,
**Then** the response reflects these benchmarks without the Owner needing to state them. (FR-4; FR-13)

**AC-3: Settings panel — editable Business Context**

**Given** the Owner navigates to the Settings tab in the sidebar,
**When** the Settings panel loads,
**Then** the current Business Context is displayed in an editable textarea; saving changes persists the update and writes an activity_log entry with `actor='user'`. (FR-4)

**AC-4: Write function with activity logging (infrastructure for AI-initiated updates)**

**Given** a write function `updateBusinessContext(ownerId, content, actor)` exists,
**When** it is called with `actor='ai'` or `actor='user'`,
**Then** the settings row is upserted and an activity_log entry is written with the matching actor.
Note: ARIA-initiated calls to this function (AC-4 from spec) are triggered by future stories. This story only creates the write function and the settings panel write path.

**AC-5: Token budget enforcement and trim logging**

**Given** any AI call,
**When** the Business Context is assembled for injection,
**Then** the injected context stays within ~2,000 tokens (8,000 chars); if the stored content exceeds this, it is truncated before injection and a server-side warning is logged. (FR-4; §8 NFRs)

---

## Tasks / Subtasks

- [ ] **Task 1: Database migration — add `business_context` column to `settings` table** (AC-1, AC-3, AC-5)
  - [ ] Run SQL (Supabase dashboard or migration file): `ALTER TABLE settings ADD COLUMN IF NOT EXISTS business_context text;`
  - [ ] Verify activity_log `entity_type` handling: if it is a Postgres enum type, run `ALTER TYPE activity_log_entity_type ADD VALUE IF NOT EXISTS 'settings';` before inserting activity log rows; if it is a plain text column, no migration needed — insert 'settings' directly.
  - [ ] If creating a migration file, place at `supabase/migrations/YYYYMMDD_add_business_context.sql`

- [ ] **Task 2: Create `lib/businessContext/getBusinessContext.ts`** (AC-1, AC-5)
  - [ ] `import 'server-only'` at top (AD-11)
  - [ ] Export `const MAX_BUSINESS_CONTEXT_CHARS = 8_000` (≈ 2,000 tokens conservative budget)
  - [ ] Export `function trimToTokenBudget(content: string): string` — returns `content.slice(0, MAX_BUSINESS_CONTEXT_CHARS)` — pure, used by tests
  - [ ] Export `async function getBusinessContext(ownerId: string): Promise<string | null>`
    - Use `createServerClient()` (AD-13: never `createServiceClient()`)
    - Query `.from('settings').select('business_context').eq('owner_id', ownerId).single()`
    - If error is PGRST116 (no row): return `null` — new owner has no context yet
    - If any other error: `console.error('[ARIA/businessContext] fetch error', error)` then `return null` (AD-6: graceful degradation — AI call must proceed without context)
    - If `data?.business_context` is null/empty: return `null`
    - If content exceeds `MAX_BUSINESS_CONTEXT_CHARS`: log warning then `return trimToTokenBudget(content)`
    - Otherwise return content as-is

- [ ] **Task 3: Create `lib/businessContext/updateBusinessContext.ts`** (AC-3, AC-4)
  - [ ] `import 'server-only'` at top (AD-11)
  - [ ] Export `async function updateBusinessContext(ownerId: string, content: string, actor: 'ai' | 'user'): Promise<void>`
    - Use `createServerClient()` (AD-13)
    - Upsert: `.from('settings').upsert({ owner_id: ownerId, business_context: content }, { onConflict: 'owner_id' })`
    - If upsert errors: throw the error
    - Insert activity log (AD-14 append-only): `.from('activity_log').insert({ owner_id: ownerId, entity_type: 'settings', entity_id: ownerId, action: 'business_context_updated', actor, payload: { length: content.length } })`
    - Activity log failure is NON-FATAL — log it with `console.error` but do NOT throw (the update itself succeeded)

- [ ] **Task 4: Update `app/api/chat/route.ts` to fetch and inject Business Context** (AC-1, AC-5)
  - [ ] Import `getBusinessContext` from `@/lib/businessContext/getBusinessContext`
  - [ ] Run `getBusinessContext` and `classifyIntent` in PARALLEL (reduces TTFB): `const [businessContext, classification] = await Promise.all([getBusinessContext(user.id), classifyIntent(messages)])`
  - [ ] Pass `businessContext: businessContext ?? undefined` to `streamChat()` — pass `undefined` (not `null`) so the existing guard `if (options.businessContext)` in streamChat.ts works correctly
  - [ ] Do NOT modify `streamChat.ts` — the `businessContext` option and its injection logic already exist and are correct (see Dev Notes)

- [ ] **Task 5: Create `app/api/business-context/route.ts`** (AC-3)
  - [ ] GET handler: Returns `{ businessContext: string | null }`. Auth check → fetch from settings → return.
  - [ ] PUT handler: Body `{ businessContext: string }`. Auth check → validate (non-empty string, max 20,000 chars raw input limit) → `updateBusinessContext(user.id, body.businessContext, 'user')` → return 200.
  - [ ] Both handlers use `createServerClient()` for auth (AD-13). The PUT handler can also reuse `updateBusinessContext` which already uses `createServerClient()` internally.

- [ ] **Task 6: Create `components/settings/BusinessContextPanel.tsx`** (AC-2, AC-3)
  - [ ] `'use client'` at top
  - [ ] Uses `useEffect` to fetch `/api/business-context` on mount (GET)
  - [ ] Renders a `<textarea>` with the current content (placeholder text if null — see Dev Notes for default template)
  - [ ] Save button: PUT to `/api/business-context` with updated content; show loading state; show success/error feedback
  - [ ] Style consistent with app dark theme (background `#141a2e`, text `#e2e8f0`, border `#2a3350`), matching existing components
  - [ ] A status line below the textarea showing char count (e.g., "1,234 / 8,000 chars") — visual budget indicator

- [ ] **Task 7: Wire BusinessContextPanel into `components/layout/AppShell.tsx`** (AC-3)
  - [ ] Import `BusinessContextPanel` from `@/components/settings/BusinessContextPanel`
  - [ ] Replace `{mode === 'settings' && <Placeholder title="Settings" />}` with `{mode === 'settings' && <BusinessContextPanel />}`
  - [ ] Preserve all other AppShell behaviour exactly — do NOT change nav items, layout, or other modes

- [ ] **Task 8: Write unit tests in `lib/__tests__/businessContext.test.ts`** (AC-5)
  - [ ] Test: `trimToTokenBudget('')` → `''` (empty string)
  - [ ] Test: `trimToTokenBudget('x'.repeat(8000))` → `'x'.repeat(8000)` (exactly at limit, no trim)
  - [ ] Test: `trimToTokenBudget('x'.repeat(8001)).length` → `8000` (trimmed)
  - [ ] Test: `trimToTokenBudget('x'.repeat(20000)).length` → `8000` (large input)
  - [ ] Inline the `trimToTokenBudget` logic in the test (same ts-node standalone pattern as prior tests)
  - [ ] Add `npx ts-node lib/__tests__/businessContext.test.ts` to `package.json` test script

- [ ] **Task 9: CI triad** (all ACs)
  - [ ] `npm run test` — all tests pass (41 + new businessContext tests)
  - [ ] `npm run lint` — no warnings
  - [ ] `npx tsc --noEmit` — no type errors
  - [ ] `npm run format:check` — no formatting issues
  - [ ] `npm run build` — Next.js build succeeds

---

## Dev Notes

### What Already Exists — DO NOT Re-implement

Both `lib/ai/streamChat.ts` and `lib/ai/callAI.ts` already support `businessContext?: string` with correct AD-5 caching:

```typescript
// streamChat.ts (already implemented — DO NOT CHANGE)
if (options.businessContext) {
  messages.push({
    role: 'user',
    content: [
      {
        type: 'text',
        text: `<business_context>\n${options.businessContext}\n</business_context>`,
        cache_control: { type: 'ephemeral' },  // second cache breakpoint
      },
    ],
  })
  messages.push({ role: 'assistant', content: 'Understood.' })
}
```

The cache architecture (AD-5) with businessContext becomes:
```
system block 1: specialist prompt       ← cache_control: ephemeral (stable)
system block 2: language directive      ← no cache_control (volatile)
messages[0]: <business_context>…        ← cache_control: ephemeral (stable per session)
messages[1]: 'Understood.'              ← assistant ack (required for alternating pattern)
messages[2..N]: actual conversation     ← volatile
```

The business context is the SECOND cache breakpoint. It caches on first call and hits on every subsequent call in the same session (as long as the content doesn't change). This is correct and load-bearing for cost targets.

### Settings Table — Existing Pattern

`checkPrivacyNotice.ts` shows the exact query pattern for `settings`:

```typescript
const { data, error } = await supabase
  .from('settings')
  .select('business_context')
  .eq('owner_id', ownerId)
  .single()
// PGRST116 = no rows → new owner with no settings row yet
if (error && error.code !== 'PGRST116') throw error
```

Use `upsert` with `{ onConflict: 'owner_id' }` for writes — the settings table uses `owner_id` as its conflict key (one row per owner).

### Token Budget Enforcement

~2,000 tokens corresponds to approximately 8,000 characters for mixed Vietnamese/English content (Vietnamese is slightly denser than English in tokens/char ratio; 8,000 chars is a safe conservative cap).

**Do NOT use the Anthropic tokenizer** — it requires an API call and adds latency. Character count is sufficient for MVP. Epic 2+ can add AI-based summarization if needed.

```typescript
export const MAX_BUSINESS_CONTEXT_CHARS = 8_000

export function trimToTokenBudget(content: string): string {
  return content.slice(0, MAX_BUSINESS_CONTEXT_CHARS)
}
```

Log when trimming (server-side only — AD-11):
```typescript
console.warn(`[ARIA/businessContext] trimmed ${content.length} → ${MAX_BUSINESS_CONTEXT_CHARS} chars for owner ${ownerId}`)
```

### Route.ts — Parallel Fetch Pattern

The current `route.ts` runs `classifyIntent()` before any other work. With businessContext, we can fetch both in parallel to avoid adding latency:

```typescript
// BEFORE (Story 1.3 state)
const classification = await classifyIntent(messages)
const stream = streamChat({ ..., /* no businessContext */ })

// AFTER (this story)
const [businessContext, classification] = await Promise.all([
  getBusinessContext(user.id),    // Supabase read — ~50ms
  classifyIntent(messages),       // AI call — up to 5s
])
// Since classifyIntent is the slow path, getBusinessContext adds zero wall-clock time.

const stream = streamChat({
  model: INTENT_MODEL_MAP[classification.intent],
  specialist: classification.intent,
  systemPrompt: SPECIALIST_SYSTEM_PROMPTS[classification.intent],
  messages,
  detectedLang,
  businessContext: businessContext ?? undefined,
})
```

### Activity Log — entity_type Consideration

The `activity_log` table schema (addendum §B.4): `entity_type(enum client|deal|document)`. Business context updates don't fit any existing type.

**Before writing activity log**, check if `entity_type` is a Postgres enum:
1. Run in Supabase SQL editor: `SELECT typname FROM pg_type WHERE typname LIKE '%entity_type%';`
2. If it IS an enum: run `ALTER TYPE activity_log_entity_type ADD VALUE IF NOT EXISTS 'settings';` (include in migration)
3. If it is NOT an enum (text column with check constraint or no constraint): just insert `'settings'` directly

If the migration cannot be run before code deployment, use `'document'` as a fallback entity_type for now and add a TODO comment — it's non-critical (audit trail is approximate).

### BusinessContextPanel.tsx — Placeholder Template

When business context is null (new owner), the textarea should show a helpful placeholder (not empty). This is placeholder text, NOT default content — it is NOT saved automatically:

```
placeholder={`My agency overview:
- Services: [web design, web apps, automation, etc.]
- Typical pricing: web design 20-80M VND, apps 60-150M VND
- Target clients: [SMEs in F&B / retail / professional services]

Pricing rules:
- Always request 30-50% deposit on signing
- Price floor for web design: 20M VND

Follow-up cadences:
- Warm leads: follow up within 3 days if no response
- Cold leads after proposal: 1 week then 1 month

My agency's strengths:
- [describe what you do best]`}
```

### AppShell.tsx — Exact Change Required

The ONLY change to AppShell is replacing the settings Placeholder:

```typescript
// BEFORE:
{mode === 'settings' && <Placeholder title="Settings" />}

// AFTER:
{mode === 'settings' && <BusinessContextPanel />}
```

Do NOT change nav items, layout constants, logout form, mode state, or any other part of AppShell.

### API Route for Business Context

`app/api/business-context/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { updateBusinessContext } from '@/lib/businessContext/updateBusinessContext'

export async function GET() {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('settings')
    .select('business_context')
    .eq('owner_id', user.id)
    .single()

  if (error && error.code !== 'PGRST116') {
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 })
  }

  return NextResponse.json({ businessContext: data?.business_context ?? null })
}

export async function PUT(req: NextRequest) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const content = body.businessContext
  if (typeof content !== 'string') {
    return NextResponse.json({ error: 'businessContext must be a string' }, { status: 400 })
  }
  // Raw input limit — trimming to token budget happens in getBusinessContext at read time
  if (content.length > 20_000) {
    return NextResponse.json({ error: 'Business context too long (max 20,000 chars)' }, { status: 400 })
  }

  try {
    await updateBusinessContext(user.id, content, 'user')
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[PUT /api/business-context]', err)
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 })
  }
}
```

### AD-11 / AD-13 Reminders

- Both `getBusinessContext.ts` and `updateBusinessContext.ts` MUST have `import 'server-only'` at the top (prevents client bundle inclusion)
- Both MUST use `createServerClient()` — NEVER `createServiceClient()` (AD-13)
- `BusinessContextPanel.tsx` is a client component (`'use client'`) — it calls the API route, NOT Supabase directly

### Previous Story Learnings

From Stories 1.1–1.3:
1. **ts-node test pattern**: Test files at `lib/__tests__/*.test.ts`, run via `npx ts-node`. Self-contained — inline pure logic, no imports from `server-only` modules. For `trimToTokenBudget` (pure function), inline it in the test.
2. **ESLint**: After modifying files, check for unused imports. Run `npm run lint` before commit.
3. **Prettier**: Run `npm run format:check` before commit; use `npm run format` to auto-fix.
4. **TypeScript strict**: `businessContext` in `streamChat.ts` expects `string | undefined`, not `string | null`. Pass `businessContext ?? undefined`.
5. **Parallel CI steps**: `npm run lint && npm run format:check` can run together; `npm run build` includes tsc.

### Files NOT Changed by This Story

- `lib/ai/streamChat.ts` — businessContext injection already implemented correctly
- `lib/ai/callAI.ts` — businessContext injection already implemented correctly
- `lib/ai/orchestrator.ts` — no changes to specialist prompts or classification
- `middleware.ts` — `/settings` and `/api/business-context` are already protected (non-public routes redirect to login)
- `app/layout.tsx` — no changes

---

## Dev Agent Record

### Agent Model Used

(to be filled by dev agent)

### Debug Log References

(none yet)

### Completion Notes List

(none yet)

### File List

**New files:**
- `lib/businessContext/getBusinessContext.ts`
- `lib/businessContext/updateBusinessContext.ts`
- `lib/__tests__/businessContext.test.ts`
- `app/api/business-context/route.ts`
- `components/settings/BusinessContextPanel.tsx`

**Modified files:**
- `app/api/chat/route.ts` — fetch businessContext in parallel with classifyIntent; pass to streamChat
- `components/layout/AppShell.tsx` — replace settings Placeholder with BusinessContextPanel
- `package.json` — add businessContext test to test script

**Database (manual or migration file):**
- `settings` table: ADD COLUMN `business_context text`
- `activity_log`: ADD VALUE 'settings' to entity_type enum (if enum)

### Change Log

(to be filled by dev agent)
