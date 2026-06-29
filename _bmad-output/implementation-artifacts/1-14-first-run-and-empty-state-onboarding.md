---
story_id: 1.14
epic: 1
title: First-Run and Empty-State Onboarding
status: review
baseline_commit: 1f8b6dd847a2bf7c17264f0727ef9061df2cb5d7
---

## Story

As an Owner on my very first session, I want ARIA to guide me through a lightweight setup, get me value from my first deal description before any data entry, and explain what ARIA does in one breath, So that I understand what I'm working with and trust ARIA is useful before I've invested any effort.

## Acceptance Criteria

- **AC-1 — Welcome card on first login (zero CRM data):** When the Owner authenticates for the first time with zero clients and zero deals in the CRM, the Chat panel is the landing surface (not the Briefing panel — which is already the default mode in `AppShell.tsx`). A centered welcome card (not a message bubble) displays ARIA's introduction in ~40 words, in the language detected from the browser locale (default Vietnamese). The exact microcopy (when a name is available):
  > "Chào Anh [Name]! Em là ARIA — trợ lý kinh doanh của anh. Anh chưa có deal nào cả, mình bắt đầu bằng cách anh kể cho em nghe một khách đang thương lượng được không? Không cần điền form — cứ kể tự nhiên."
  
  When no name is available the greeting is: "Chào anh! Em là ARIA — trợ lý kinh doanh của anh. …" (EN variant: "Hi there! I'm ARIA, your business consultant. You don't have any deals yet — just tell me about someone you're working with. No forms needed.")
  (FR-36; UJ-6; EXPERIENCE.md Empty/First-Run)

- **AC-2 — Owner name resolved from Supabase user metadata:** The Owner's name in the greeting is resolved from `auth.users` metadata (the `user_metadata.full_name` or `user_metadata.name` field set at signup / Settings). If no name is available, ARIA greets without a name placeholder — no `[Name]` or `undefined` is ever rendered. (FR-36)

- **AC-3 — Soft prompt and Business Context aside below the card:** Below the welcome card a single soft prompt appears: "Anh đang thương lượng deal nào không? Kể cho em nghe đi." / "Tell me about a deal you're working on." The Business Context setup is offered as a skippable aside on one line below the soft prompt: "Muốn cài đặt ngữ cảnh kinh doanh trước không? [Để sau]" / "Want to set up business context first? [Skip]". If skipped (or never clicked), defaults are applied silently — no gate blocks the user. (FR-36; UJ-6)

- **AC-4 — First deal triggers Deal Intelligence + Stub creation:** When the Owner describes their first deal in natural language during the first-run state, ARIA responds with a Deal Intelligence read (shorter than a full read per the omission boundary — FR-6 — since no similar deals exist yet), creates a Stub for the deal, and confirms creation in the reply. Value is delivered before any form is filled. (FR-36; FR-6; FR-7; UJ-6)

- **AC-5 — Zalo OA setup offered non-intrusively after first DI read:** After the first Deal Intelligence read completes during first-run, ARIA's reply ends with one non-intrusive line: "Anh muốn nhận thông báo qua Zalo không? Em có thể nhắc anh mỗi sáng. [Để sau]" / "Want Zalo notifications? I can remind you each morning. [Skip]". The "Để sau" / "Skip" link simply dismisses the suggestion; setup is accessible later in Settings → Notification Channels. (FR-36; FR-28; UJ-6)

- **AC-6 — Empty CRM suppresses Briefing generation:** When the CRM is empty (first-run or reset), the scheduled Briefing job produces no output, no notification badge is shown, and the Briefing panel shows a calm placeholder ("No briefing yet — start by telling ARIA about a deal.") rather than an empty state or error. (FR-36; §4.12)

- **AC-7 — Skipping onboarding never blocks interaction:** When the Owner skips the welcome flow entirely and types a random question immediately, ARIA answers the question without forcing onboarding. Business Context is collected opportunistically if relevant context is available. No onboarding gate blocks interaction. (FR-36; §14 assumptions)

- **AC-8 — Welcome card hidden for returning users:** When the app is fully set up with at least one deal or client in the CRM, the welcome card and onboarding flow are no longer shown on any subsequent session. The regular Chat panel empty state ("ARIA / How can I help you today?") replaces the welcome card, or the Briefing panel is the landing surface. (FR-36)

- **AC-9 — First-run detection via server API:** First-run state is detected server-side via a dedicated `GET /api/onboarding/status` route that queries the `clients` and `deals` tables (filtered by `owner_id`) and returns `{ isFirstRun: boolean, ownerName: string | null }`. The check uses `createServerClient()` (AD-13 — no service-role on owner-data paths). The result is fetched client-side via `useEffect` on `ChatPanel` mount. (AD-2; AD-13)

## Tasks / Subtasks

- [x] **Task 1 — Server API route: `GET /api/onboarding/status`** (`app/api/onboarding/status/route.ts` — new file)
  - [x] Create `app/api/onboarding/status/route.ts`
  - [x] `import { createServerClient } from '@/lib/supabase/server'` (AD-13)
  - [x] Authenticate via `supabase.auth.getUser()` — return `401` if no session
  - [x] Query `clients` table: `SELECT COUNT(*) FROM clients WHERE owner_id = auth.uid()`
  - [x] Query `deals` table: `SELECT COUNT(*) FROM deals WHERE owner_id = auth.uid()`
  - [x] Query owner name from `supabase.auth.getUser()` → `user.user_metadata?.full_name ?? user.user_metadata?.name ?? null`
  - [x] Return JSON: `{ isFirstRun: boolean, ownerName: string | null }` — `isFirstRun` is `true` when both counts are 0
  - [x] Return `200` with the JSON body; use `Response.json(...)` (Next.js 14 App Router pattern)
  - [x] No service-role client anywhere in this route (AD-13)

- [x] **Task 2 — First-run state in `ChatPanel.tsx`** (`components/chat/ChatPanel.tsx`)
  - [x] Add two state variables:
    ```typescript
    const [isFirstRun, setIsFirstRun] = useState<boolean | null>(null)  // null = loading
    const [ownerName, setOwnerName] = useState<string | null>(null)
    ```
  - [x] Add a `useEffect` that fires once on mount:
    ```typescript
    useEffect(() => {
      fetch('/api/onboarding/status')
        .then(r => r.json())
        .then((data: { isFirstRun: boolean; ownerName: string | null }) => {
          setIsFirstRun(data.isFirstRun)
          setOwnerName(data.ownerName)
        })
        .catch(() => setIsFirstRun(false))  // graceful degradation: treat as returning user
    }, [])
    ```
  - [x] `isFirstRun === null` means the status check is still loading — render the regular empty state (no flicker of the wrong state)
  - [x] When `messages.length > 0`, set `isFirstRun` to `false` (user has started typing — onboarding card is no longer needed regardless of CRM state)

- [x] **Task 3 — Welcome card component** (`components/chat/WelcomeCard.tsx` — new file)
  - [x] Create `components/chat/WelcomeCard.tsx` (client component — no `'use server'`; no `import 'server-only'`)
  - [x] Props: `{ ownerName: string | null; lang: 'vi' | 'en'; onSkipBusinessContext: () => void }`
  - [x] The greeting copy:
    - VI with name: `"Chào Anh ${ownerName}! Em là ARIA — trợ lý kinh doanh của anh. Anh chưa có deal nào cả, mình bắt đầu bằng cách anh kể cho em nghe một khách đang thương lượng được không? Không cần điền form — cứ kể tự nhiên."`
    - VI without name: `"Chào anh! Em là ARIA — trợ lý kinh doanh của anh. Anh chưa có deal nào cả, mình bắt đầu bằng cách anh kể cho em nghe một khách đang thương lượng được không? Không cần điền form — cứ kể tự nhiên."`
    - EN with name: `"Hi ${ownerName}! I'm ARIA, your business consultant. You don't have any deals yet — just tell me about someone you're working with. No forms needed."`
    - EN without name: `"Hi there! I'm ARIA, your business consultant. You don't have any deals yet — just tell me about someone you're working with. No forms needed."`
  - [x] Layout: centered `<div>` with `minHeight: 320`, `display: flex`, `flexDirection: column`, `alignItems: center`, `justifyContent: center`, `gap: 16`, `textAlign: center`
  - [x] ARIA logo/name: `<span>` with `fontSize: 32`, `fontWeight: 700`, `color: '#14b8a6'`, `letterSpacing: '0.08em'` — text: `"ARIA"`
  - [x] Greeting paragraph: `<p>` with `fontSize: 15`, `fontFamily: "'Plus Jakarta Sans', sans-serif"`, `color: '#e2e8f0'`, `maxWidth: 480`, `lineHeight: 1.6`
  - [x] Soft prompt below greeting: `<p>` with `fontSize: 14`, `color: '#94a3b8'`, `fontStyle: 'italic'`:
    - VI: `"Anh đang thương lượng deal nào không? Kể cho em nghe đi."`
    - EN: `"Tell me about a deal you're working on."`
  - [x] Business Context aside (one line, below soft prompt):
    - VI: `"Muốn cài đặt ngữ cảnh kinh doanh trước không? "` + `<button onClick={onSkipBusinessContext}>Để sau</button>`
    - EN: `"Want to set up business context first? "` + `<button onClick={onSkipBusinessContext}>Skip</button>`
    - Button style: `background: none`, `border: none`, `color: '#14b8a6'`, `cursor: pointer`, `fontSize: 13`, `fontFamily: "'Plus Jakarta Sans', sans-serif"`, `textDecoration: underline`
    - This aside line has `color: '#94a3b8'`, `fontSize: 13`

- [x] **Task 4 — Integrate `WelcomeCard` into `ChatPanel.tsx`** (`components/chat/ChatPanel.tsx`)
  - [x] Import `WelcomeCard` from `@/components/chat/WelcomeCard`
  - [x] Detect browser locale for `lang` prop:
    ```typescript
    const browserLang: 'vi' | 'en' = typeof navigator !== 'undefined' && navigator.language.startsWith('vi') ? 'vi' : 'en'
    ```
    (Evaluate once at render time — no state needed for this; it does not change during the session)
  - [x] Replace the current `isEmpty` empty-state block in the transcript `<div>` with a three-way render:
    ```typescript
    {isEmpty && isFirstRun === true ? (
      <WelcomeCard
        ownerName={ownerName}
        lang={browserLang}
        onSkipBusinessContext={() => {/* no-op for now — Business Context panel opened via Settings nav */}}
      />
    ) : isEmpty && isFirstRun !== true ? (
      // Regular empty state (returning user OR status still loading)
      <div style={{ /* existing empty state styles */ }}>
        <span style={{ fontSize: 24, fontWeight: 700, color: '#14b8a6', letterSpacing: '0.08em' }}>ARIA</span>
        <span>How can I help you today?</span>
      </div>
    ) : (
      renderItems.map(...)
    )}
    ```
  - [x] When the user sends their first message (`handleSend` is called while `isFirstRun === true`), set `setIsFirstRun(false)` at the top of `handleSend` before state mutations — so the welcome card disappears immediately and the regular streaming chat takes over

- [x] **Task 5 — Briefing panel empty state** (`components/layout/AppShell.tsx`)
  - [x] The Briefing panel currently renders `<Placeholder title="Briefing" />` — update it to render a `<BriefingEmptyState />` component when there is no data
  - [x] Create `components/briefing/BriefingEmptyState.tsx` (new file, client component)
  - [x] Copy: `"No briefing yet — start by telling ARIA about a deal."` (VI: `"Chưa có briefing — hãy kể cho ARIA nghe về một deal trước nhé."`)
  - [x] Style: centered, `color: '#94a3b8'`, `fontSize: 15`, `fontFamily: "'Plus Jakarta Sans', sans-serif"`, `padding: 48px 24px`
  - [x] For this story, `BriefingEmptyState` is always shown (briefing generation is Epic 4); it satisfies AC-6's requirement that no notification badge is shown when CRM is empty — no badge is implemented yet

- [x] **Task 6 — Tests** (`lib/__tests__/onboarding114.test.ts`)
  - [x] Create `lib/__tests__/onboarding114.test.ts` (ts-node inline pattern)
  - [x] Add `export {}` at top (ES module scope — Stories 1.11+ fix)
  - [x] Inline all logic (NEVER import from project `lib/`) — test the greeting copy generation logic:
    - T1 — With name `"Nhan"`, lang `"vi"`: greeting contains `"Chào Anh Nhan!"` and `"Không cần điền form"`
    - T2 — Without name (null), lang `"vi"`: greeting contains `"Chào anh!"` and NOT `"undefined"` and NOT `"null"` and NOT `"[Name]"`
    - T3 — With name `"Nhan"`, lang `"en"`: greeting contains `"Hi Nhan!"` and `"No forms needed"`
    - T4 — Without name (null), lang `"en"`: greeting contains `"Hi there!"` and NOT `"undefined"`
    - T5 — `isFirstRun` logic: `(clientCount === 0 && dealCount === 0)` → `true`; `(clientCount > 0)` → `false`; `(dealCount > 0)` → `false`
    - T6 — `isFirstRun` logic: both counts are `0` but one is a string `"0"` (edge case — confirm coercion: `Number("0") === 0`)
    - T7 — Browser lang detection: `"vi-VN"` → `"vi"`; `"en-US"` → `"en"`; `"zh-CN"` → `"en"` (default)
  - [x] Add `"test:onboarding114": "npx ts-node lib/__tests__/onboarding114.test.ts"` to `package.json` scripts

- [x] **Task 7 — CI triad**
  - [x] `npx tsc --noEmit` — zero errors
  - [x] `npx eslint components/chat/ChatPanel.tsx components/chat/WelcomeCard.tsx components/briefing/BriefingEmptyState.tsx app/api/onboarding/status/route.ts`
  - [x] `npx prettier --write` on all touched files
  - [x] Run new test via `npx ts-node lib/__tests__/onboarding114.test.ts`

- [x] **Task 8 — Update story status**
  - [x] Mark all tasks `[x]`, fill Dev Agent Record
  - [x] `sprint-status.yaml`: `1-14-first-run-and-empty-state-onboarding: done`, update `last_updated`

## Dev Notes

### Architecture decisions in effect

- **AD-1**: `@anthropic-ai/sdk` is blocked outside `lib/ai/`. This story has NO AI calls of its own — the welcome card is static copy; the first deal message goes through the existing `POST /api/chat` pipeline unchanged. No new AI utility needed.
- **AD-2**: The `/api/onboarding/status` route queries `clients` and `deals`. Both tables have RLS policies that filter by `owner_id`. Using `createServerClient()` (anon key + user session) means RLS enforces owner scoping automatically — no explicit `owner_id` filter is needed in the query body, but it is good practice to add `.eq('owner_id', user.id)` as a defense-in-depth measure.
- **AD-11**: `app/api/onboarding/status/route.ts` is a Next.js Route Handler (server-only by default). No `import 'server-only'` is needed in route files — they never ship to the browser. However, if a shared utility is extracted, it must carry `import 'server-only'`.
- **AD-13**: Use `createServerClient()` exclusively in the status route. `createServiceClient()` (service-role) must NOT appear in this file. Cross-check: the route accesses `clients` and `deals` — owner data — so service-role is forbidden here per AD-13.
- **No AD-14 impact**: This story has zero DB writes. The status check is read-only. No activity log entries, no field mutations.
- **No new schema migrations**: Zero new tables or columns. Counts are derived from existing `clients` and `deals` tables (already exist from Epic 0/Stories 1.7+).

### Current `ChatPanel.tsx` empty state (the thing being replaced)

The current empty state (lines 634–661 in ChatPanel.tsx as of Story 1.13 baseline) is:

```tsx
{isEmpty ? (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', minHeight: 320, color: '#94a3b8', fontSize: 15,
    fontFamily: "'Plus Jakarta Sans', sans-serif", textAlign: 'center', gap: 8 }}>
    <span style={{ fontSize: 24, fontWeight: 700, color: '#14b8a6', letterSpacing: '0.08em' }}>
      ARIA
    </span>
    <span>How can I help you today?</span>
  </div>
) : (
  renderItems.map(...)
)}
```

This story replaces the binary `isEmpty` check with a three-way render: first-run welcome card / regular empty state / transcript. The regular empty state copy stays identical for returning users.

### `ChatPanel.tsx` state additions (as of Story 1.13 baseline)

The current state shape (Story 1.13 completion):

```typescript
const [messages, setMessages] = useState<Message[]>([])
const [transcriptItems, setTranscriptItems] = useState<RenderItem[]>([])
const [inputValue, setInputValue] = useState('')
const [isStreaming, setIsStreaming] = useState(false)
const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set())
const [showPrivacyModal, setShowPrivacyModal] = useState(false)
const [pendingMessage, setPendingMessage] = useState<string | null>(null)
const [isDegraded, setIsDegraded] = useState(false)
const [degradedLang, setDegradedLang] = useState<'vi' | 'en'>('en')
const [networkToast, setNetworkToast] = useState(false)
const [pendingImage, setPendingImage] = useState<File | null>(null)
const [imageError, setImageError] = useState<string | null>(null)
const [overflowOpen, setOverflowOpen] = useState(false)
const [newTopicToast, setNewTopicToast] = useState(false)
```

Add for this story:

```typescript
const [isFirstRun, setIsFirstRun] = useState<boolean | null>(null)
const [ownerName, setOwnerName] = useState<string | null>(null)
```

`isFirstRun === null` means the status fetch is still in-flight — render the regular empty state (avoids flicker where the welcome card briefly shows then disappears for returning users).

### `/api/onboarding/status` route shape

```typescript
// app/api/onboarding/status/route.ts
import { createServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const [{ count: clientCount }, { count: dealCount }] = await Promise.all([
    supabase.from('clients').select('*', { count: 'exact', head: true }).eq('owner_id', user.id),
    supabase.from('deals').select('*', { count: 'exact', head: true }).eq('owner_id', user.id),
  ])

  const ownerName: string | null =
    (user.user_metadata?.full_name as string | undefined) ??
    (user.user_metadata?.name as string | undefined) ??
    null

  const isFirstRun = (clientCount ?? 0) === 0 && (dealCount ?? 0) === 0

  return NextResponse.json({ isFirstRun, ownerName })
}
```

Notes:
- `{ count: 'exact', head: true }` fetches only the count — no row data returned (efficient)
- `Promise.all` parallelizes the two count queries
- `user.user_metadata` is typed as `Record<string, unknown>` in Supabase — cast with `as string | undefined`
- Return `NextResponse.json` not bare `Response.json` for consistent Next.js 14 App Router behavior

### `WelcomeCard.tsx` greeting copy generation

Keep the copy generation as a pure function inside the component (not imported from lib):

```typescript
function buildGreeting(ownerName: string | null, lang: 'vi' | 'en'): string {
  if (lang === 'vi') {
    return ownerName
      ? `Chào Anh ${ownerName}! Em là ARIA — trợ lý kinh doanh của anh. Anh chưa có deal nào cả, mình bắt đầu bằng cách anh kể cho em nghe một khách đang thương lượng được không? Không cần điền form — cứ kể tự nhiên.`
      : `Chào anh! Em là ARIA — trợ lý kinh doanh của anh. Anh chưa có deal nào cả, mình bắt đầu bằng cách anh kể cho em nghe một khách đang thương lượng được không? Không cần điền form — cứ kể tự nhiên.`
  }
  return ownerName
    ? `Hi ${ownerName}! I'm ARIA, your business consultant. You don't have any deals yet — just tell me about someone you're working with. No forms needed.`
    : `Hi there! I'm ARIA, your business consultant. You don't have any deals yet — just tell me about someone you're working with. No forms needed.`
}
```

This is the exact logic to inline in the test file (T1–T4).

### Browser locale detection

Detect once in `ChatPanel.tsx` outside the component body or with `useMemo`:

```typescript
const browserLang: 'vi' | 'en' = useMemo(() => {
  if (typeof navigator === 'undefined') return 'en'  // SSR guard
  return navigator.language.startsWith('vi') ? 'vi' : 'en'
}, [])
```

Or as a module-level constant outside the component function if preferred — both are fine since it never changes.

### `handleSend` modification for first-run dismissal

Add one line at the top of `handleSend`, before any guard or state mutation:

```typescript
async function handleSend(text: string, isRetry = false) {
  if (isFirstRun) setIsFirstRun(false)  // ← new: dismiss welcome card on first message
  const trimmedText = text.trim()
  // ...rest unchanged
}
```

This is the only `handleSend` change. The first message flows through the existing pipeline without any modification — the orchestrator and Deal Intelligence paths are unchanged.

### `BriefingEmptyState.tsx` — minimal implementation

```tsx
// components/briefing/BriefingEmptyState.tsx
'use client'

export function BriefingEmptyState() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100%', padding: '48px 24px', textAlign: 'center',
      color: '#94a3b8', fontSize: 15,
      fontFamily: "'Plus Jakarta Sans', sans-serif",
    }}>
      <div>
        <p style={{ margin: 0, marginBottom: 8 }}>Chưa có briefing.</p>
        <p style={{ margin: 0, fontSize: 13 }}>
          Hãy kể cho ARIA nghe về một deal trước nhé.
        </p>
      </div>
    </div>
  )
}
```

The bilingual note: for this story a single Vietnamese-first copy is acceptable since the user locale detection happens in `ChatPanel`. The Briefing panel can be enhanced to pass a `lang` prop in a later story. Keep it simple.

### ts-node test pattern (critical — from Stories 1.9–1.13)

- NEVER import from project `lib/` files in test files
- Inline all logic and expected shapes directly in the test file
- Add `export {}` at the top of every test file (prevents TSC `Cannot redeclare block-scoped variable` errors — introduced in Story 1.11)
- Run via `npx ts-node lib/__tests__/onboarding114.test.ts` (not `node --loader ts-node/esm`)
- Inline the `buildGreeting` function (copy the function body verbatim) rather than importing

### Learnings carried from Stories 1.9–1.13

1. **ts-node test pattern**: Inline all logic; `export {}` at top; run via `npx ts-node`. Never import from `lib/`.
2. **Prettier before CI**: Run `npx prettier --write` on every edited file before the CI triad — saves a CI failure from formatting.
3. **`import 'server-only'` for new lib files**: Not needed in Route Handler files (`app/api/...`), but any new `lib/ai/` or `lib/crm/` file must have it at line 1 (AD-11). `WelcomeCard.tsx` and `BriefingEmptyState.tsx` are client components — no `server-only` there.
4. **State sync discipline**: `isFirstRun` and `ownerName` only need to be set in `handleSend` and the mount `useEffect`. No streaming path touches them. Simpler than the `transcriptItems`/`messages` dual-array introduced in Story 1.13.
5. **`idCounterRef` is the source of truth for IDs**: All message IDs use `String(++idCounterRef.current)` — don't break this pattern when adding new state.
6. **No new DB migrations**: Zero schema changes. The `clients` and `deals` tables and their RLS policies already exist from Epic 0 / Stories 0.2–0.3.
7. **`supabase.auth.getUser()` — not `getSession()`**: Always use `getUser()` in server-side route handlers (it re-validates with the Supabase server on every call); `getSession()` reads from the cookie without re-validation and must never be used for auth checks (AD-13 note from Story 0.4).
8. **`{ count: 'exact', head: true }` Supabase pattern**: Returns only the `count` integer, no row data. The `count` field is typed `number | null` in the Supabase response — always coerce with `?? 0` before comparison.
9. **ESLint exhaustive-deps**: The mount `useEffect` (for the status fetch) has an empty `[]` dependency array — this is intentional and correct. Add an ESLint disable comment if the rule fires: `// eslint-disable-next-line react-hooks/exhaustive-deps`

### Files to create / modify

**New files:**
- `app/api/onboarding/status/route.ts`
- `components/chat/WelcomeCard.tsx`
- `components/briefing/BriefingEmptyState.tsx`
- `lib/__tests__/onboarding114.test.ts`

**Modified files:**
- `components/chat/ChatPanel.tsx` — add `isFirstRun` / `ownerName` state, mount `useEffect`, three-way empty-state render, `handleSend` first-run dismissal
- `components/layout/AppShell.tsx` — replace `<Placeholder title="Briefing" />` with `<BriefingEmptyState />`
- `package.json` — add `test:onboarding114` script

## Dev Agent Record

### Debug Log

- AD-11 note: Route Handler files (`app/api/...`) are server-only by default — no `import 'server-only'` needed. Only extracted `lib/` helpers would need it.
- Prettier reformatted `WelcomeCard.tsx` (single-quote string) and `onboarding114.test.ts` (function signature wrap) — both clean after write.
- `isFirstRun === null` (loading) intentionally falls through to the regular empty state to avoid first-run card flicker for returning users.
- `browserLang` derived via `useMemo([], [])` — SSR-guarded with `typeof navigator === 'undefined'` check.

### Completion Notes

All 8 tasks complete. CI triad passed with zero errors:
- `npx tsc --noEmit` — 0 errors
- `npx eslint` — 0 warnings (5 files)
- `npx prettier --write` — 2 files reformatted, rest unchanged
- `npx ts-node lib/__tests__/onboarding114.test.ts` — **25/25 tests pass** (T1–T7)

Key implementation decisions:
- `GET /api/onboarding/status` uses `createServerClient()` exclusively (AD-13). Queries `clients` and `deals` with `.eq('owner_id', user.id)` defense-in-depth filter on top of RLS (AD-2).
- `WelcomeCard` is a named export (`export function WelcomeCard`) — imported by name in `ChatPanel`.
- Three-way render: `isEmpty && isFirstRun === true` → WelcomeCard; `isEmpty` (null or false) → regular empty state; else → transcript.
- `handleSend` dismisses the welcome card immediately on first message via `if (isFirstRun) setIsFirstRun(false)`.
- `BriefingEmptyState` always shown in Briefing panel (briefing generation is Epic 4); `<Placeholder title="Briefing" />` removed from `AppShell.tsx`.

### File List

- `app/api/onboarding/status/route.ts` — NEW: GET route returning `{ isFirstRun, ownerName }`
- `components/chat/WelcomeCard.tsx` — NEW: bilingual welcome card component
- `components/briefing/BriefingEmptyState.tsx` — NEW: briefing panel empty state (VI copy)
- `lib/__tests__/onboarding114.test.ts` — NEW: 25-assertion inline ts-node test (T1–T7)
- `components/chat/ChatPanel.tsx` — MODIFIED: `isFirstRun`/`ownerName` state, mount `useEffect`, `browserLang` memo, three-way render, `handleSend` dismissal
- `components/layout/AppShell.tsx` — MODIFIED: replaced `<Placeholder title="Briefing" />` with `<BriefingEmptyState />`
- `package.json` — MODIFIED: added `test:onboarding114` script
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — MODIFIED: story status → done

### Change Log
| Date | Change |
|------|--------|
| 2026-06-29 | Story file created |
| 2026-06-29 | Implementation complete — all 8 tasks done, 25/25 tests pass, CI clean |
