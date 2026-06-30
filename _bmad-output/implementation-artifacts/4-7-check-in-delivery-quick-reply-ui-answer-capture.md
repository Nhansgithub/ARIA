---
story: 4-7
title: Check-In Delivery, Quick-Reply UI & Answer Capture
status: done
epic: 4
sprint: 1
baseline_commit: c2efd6a
---

# Story 4.7: Check-In Delivery, Quick-Reply UI & Answer Capture

Status: ready-for-dev

## Story

As an Owner,
I want to receive proactive check-in prompts in-app with quick-reply buttons when I open the app,
so that keeping my pipeline current takes one tap with no context-switching.

## Acceptance Criteria

1. **Pending check-ins fetched on mount**: When `ChatPanel` mounts, it fetches `GET /api/check-ins/pending` and stores results in `pendingCheckIns` state.
2. **CheckInCard shown above input bar**: For each pending check-in, a `CheckInCard` is rendered between the transcript and `InputBar`; cards are stacked vertically when multiple pending.
3. **AI-generated question displayed**: Each card shows the deal title, an AI-generated (Haiku) question in Vietnamese (≤80 chars), and 3 quick-reply buttons: "Có" / "Không" / "Để sau".
4. **Prompt caching**: `prompt_template` field is populated on first generation; if already non-null, the cached value is returned without calling AI.
5. **Dismiss button (×)**: Tapping × sends `answer = 'skipped'` to `POST /api/check-ins/{id}/answer`, animates the card out, removes it from `pendingCheckIns`.
6. **Quick-reply answer**: Tapping "Có" / "Không" / "Để sau" calls `POST /api/check-ins/{id}/answer` with the corresponding value (`yes` / `no` / `later`), then the card animates out and is removed from state.
7. **DB update on answer**: `POST /api/check-ins/{id}/answer` sets `status = 'sent'` (or `'skipped'` for dismiss), `answered_at = now()`, `sent_at = now()`, `answer = { value: <string> }` on the `check_ins` row — scoped to `owner_id` (AD-2).
8. **Activity log written**: On each answer, an `activity_log` entry is inserted: `action = 'checkin_answered'`, `actor = 'owner'`, `entity_type = 'deal'`, `entity_id = deal_id`.
9. **Auth guard on both routes**: Unauthenticated requests to either API route return 401.
10. **AD-6 fallback**: If Haiku is unavailable during prompt generation, `generateCheckInPrompt` returns a static template string (not an error). The pending route still returns all cards.
11. **AD-2 owner scoping**: Both API routes include `.eq('owner_id', user.id)` on every DB query. No cross-owner data accessible.
12. **AD-11 server-only guard**: `lib/ai/checkInPromptService.ts` has `import 'server-only'` at line 1.
13. **Tests pass**: `npm run test:check-in-delivery47` exits 0 with all ≥60 assertions passing.
14. **CI chain intact**: `npm test` includes the new test and does not break any prior test.

## Tasks / Subtasks

- [ ] T1: Create `lib/ai/checkInPromptService.ts` (AC: 3, 4, 10, 12)
  - [ ] T1.1: Line 1: `import 'server-only'`
  - [ ] T1.2: Implement `generateCheckInPrompt(dealTitle, triggerType, today)` — calls `callAI()` with `ARIA_MODELS.economical` (Haiku), returns a short Vietnamese question string
  - [ ] T1.3: System prompt with `cache_control: { type: 'ephemeral' }` breakpoint (AD-5)
  - [ ] T1.4: Static fallback strings per trigger type when AI unavailable (AD-6 — see Dev Notes)
  - [ ] T1.5: Trim and truncate output to 80 chars max

- [ ] T2: Create `app/api/check-ins/pending/route.ts` (AC: 1, 3, 4, 9, 10, 11)
  - [ ] T2.1: Auth via `createServerClient()` — return 401 if no user
  - [ ] T2.2: Query `check_ins` filtered by `owner_id = user.id`, `status = 'pending'`, `due_date <= today`
  - [ ] T2.3: For each row, fetch deal title via separate query on `deals` table (`.eq('owner_id', user.id).eq('id', deal_id).select('title').single()`)
  - [ ] T2.4: Check `prompt_template` field: if non-null, reuse it; if null, call `generateCheckInPrompt`, then PATCH the `check_ins` row to persist it
  - [ ] T2.5: Return `CheckInCard[]` JSON array (see interface in Dev Notes)

- [ ] T3: Create `app/api/check-ins/[id]/answer/route.ts` (AC: 6, 7, 8, 9, 11)
  - [ ] T3.1: Auth via `createServerClient()` — return 401 if no user
  - [ ] T3.2: Parse body `{ answer: 'yes' | 'no' | 'later' | 'skipped' }`; return 400 on invalid value
  - [ ] T3.3: `supabase.from('check_ins').update({ status: answer === 'skipped' ? 'skipped' : 'sent', answered_at: new Date().toISOString(), sent_at: new Date().toISOString(), answer: { value: answer } }).eq('owner_id', user.id).eq('id', id)`
  - [ ] T3.4: Write activity log: `logActivity(user.id, { entity_type: 'deal', entity_id: dealId, action: 'checkin_answered', actor: 'owner', payload: { answer, check_in_id: id } })`
  - [ ] T3.5: Fetch `deal_id` from the `check_ins` row before updating (needed for logActivity)
  - [ ] T3.6: Return `{ ok: true }`

- [ ] T4: Create `components/chat/CheckInCard.tsx` (AC: 2, 3, 5, 6)
  - [ ] T4.1: `'use client'` at line 1
  - [ ] T4.2: Props: `checkIn: CheckInCard`, `onDismiss: (id: string) => void`
  - [ ] T4.3: Show deal title, AI question, 3 buttons (Có / Không / Để sau), dismiss (×) button
  - [ ] T4.4: On button tap: call `POST /api/check-ins/{id}/answer`, call `onDismiss(id)` on success
  - [ ] T4.5: On dismiss (×): call `POST /api/check-ins/{id}/answer` with `{ answer: 'skipped' }`, call `onDismiss(id)`
  - [ ] T4.6: Amber (#f59e0b) left border — style consistent with TodayCard in `BriefingPanel.tsx`
  - [ ] T4.7: Disable all buttons while fetch in-flight (prevent double submit)

- [ ] T5: Modify `components/chat/ChatPanel.tsx` (AC: 1, 2)
  - [ ] T5.1: Add `pendingCheckIns` state: `useState<CheckInCardData[]>([])`
  - [ ] T5.2: Add `useEffect` on mount: fetch `/api/check-ins/pending`, set state; on error silently continue (AD-6)
  - [ ] T5.3: Render `CheckInCard` components just above the `InputBar` div when `pendingCheckIns.length > 0`
  - [ ] T5.4: `onDismiss` handler: `setPendingCheckIns(prev => prev.filter(c => c.id !== id))`
  - [ ] T5.5: Import `CheckInCard` and `CheckInCardData` type

- [ ] T6: Create `lib/__tests__/checkInDelivery47.test.ts` (AC: 13)
  - [ ] T6.1: Line 1: `export {}`; import only `fs` and `path`; use `process.cwd()` never `__dirname`
  - [ ] T6.2: NEVER import from project `lib/` — inline all logic
  - [ ] T6.3: Write T1–T60 tests (see Test Coverage section)
  - [ ] T6.4: Summary block: `process.exit(1)` if any failed

- [ ] T7: Update `package.json` (AC: 13, 14)
  - [ ] T7.1: Add `"test:check-in-delivery47": "npx ts-node lib/__tests__/checkInDelivery47.test.ts"`
  - [ ] T7.2: Append `&& npx ts-node lib/__tests__/checkInDelivery47.test.ts` to the `"test"` CI chain

## Dev Notes

### Exact Interfaces

```typescript
// Used in: app/api/check-ins/pending/route.ts (return type) and ChatPanel.tsx + CheckInCard.tsx (prop type)
// Define in: components/chat/CheckInCard.tsx (exported) OR a shared types file
export interface CheckInCardData {
  id: string                // check_ins.id
  deal_id: string           // check_ins.deal_id
  deal_title: string        // fetched from deals.title
  trigger_type: 'stale_7d' | 'pre_action_due' | 'cadence_followup'
  due_date: string          // YYYY-MM-DD
  prompt: string            // AI-generated or cached from prompt_template
}
```

### `lib/ai/checkInPromptService.ts` — Complete Implementation

```typescript
import 'server-only'
import { callAI } from '@/lib/ai/callAI'
import { ARIA_MODELS } from '@/lib/ai/models'

type TriggerType = 'stale_7d' | 'pre_action_due' | 'cadence_followup'

// AD-6 static fallbacks — returned when AI is unavailable
const STATIC_FALLBACKS: Record<TriggerType, (title: string) => string> = {
  stale_7d: (t) => `Giao dịch ${t} chưa có hoạt động 7 ngày. Bạn có kế hoạch gì tiếp theo?`,
  pre_action_due: (t) => `Hành động cho ${t} đến hạn ngày mai. Bạn đã chuẩn bị chưa?`,
  cadence_followup: (t) => `Đã đến lúc theo dõi ${t}. Bạn muốn ARIA hỗ trợ gì?`,
}

// AD-5: system prompt is stable prefix — cache_control applied inside callAI() automatically
// when systemPrompt is passed. No additional wrapping needed.
const SYSTEM_PROMPT = `Bạn là trợ lý kinh doanh AI viết câu hỏi check-in ngắn gọn bằng tiếng Việt.
Trả về CHỈ một câu hỏi, không có giải thích, không có tiêu đề, không có dấu nháy.
Tối đa 80 ký tự.`

export async function generateCheckInPrompt(
  dealTitle: string,
  triggerType: TriggerType,
  today: string,
): Promise<string> {
  const triggerContext: Record<TriggerType, string> = {
    stale_7d: 'Giao dịch đã không có hoạt động trong 7 ngày',
    pre_action_due: 'Hành động tiếp theo đến hạn vào ngày mai',
    cadence_followup: 'Đến lúc theo dõi theo lịch định kỳ',
  }

  const userMessage = `Deal: "${dealTitle}"
Tình huống: ${triggerContext[triggerType]}
Ngày hôm nay: ${today}
Viết một câu hỏi check-in ngắn cho chủ doanh nghiệp về deal này.`

  const result = await callAI({
    model: ARIA_MODELS.economical,
    specialist: 'check-in-prompt',
    systemPrompt: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
    maxTokens: 120,
    timeoutMs: 8_000,
  })

  if (result.status !== 'ok' || !result.data) {
    // AD-6: graceful fallback — never throw
    return STATIC_FALLBACKS[triggerType](dealTitle).slice(0, 80)
  }

  const trimmed = result.data.trim().replace(/^["']|["']$/g, '').slice(0, 80)
  return trimmed || STATIC_FALLBACKS[triggerType](dealTitle).slice(0, 80)
}
```

**Key points:**
- `callAI` already applies `cache_control: { type: 'ephemeral' }` to `systemPrompt` (see `lib/ai/callAI.ts` line 47). No extra wrapping needed.
- Model: `ARIA_MODELS.economical` = `'claude-haiku-4-5-20251001'` (AD-4 — routine generation)
- Never throws — always returns a string (AD-6)

### `app/api/check-ins/pending/route.ts` — Complete Implementation

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { generateCheckInPrompt } from '@/lib/ai/checkInPromptService'

// AD-13: owner-initiated route — createServerClient() (RLS-enforced, cookie-based JWT)
// NOT createServiceClient() — this serves owner data

export async function GET(_request: NextRequest): Promise<NextResponse> {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const today = new Date().toISOString().split('T')[0]!

  // Fetch pending check-ins due today or earlier (AD-2: owner scoped)
  const { data: checkIns, error } = await supabase
    .from('check_ins')
    .select('id, deal_id, trigger_type, due_date, prompt_template')
    .eq('owner_id', user.id)
    .eq('status', 'pending')
    .lte('due_date', today)
    .order('due_date', { ascending: true })
    .limit(10)

  if (error) {
    console.error('[ARIA/check-ins/pending] fetch error:', error.message)
    return NextResponse.json({ error: 'fetch_error' }, { status: 500 })
  }

  const cards = []

  for (const ci of checkIns ?? []) {
    // Fetch deal title (AD-2: owner scoped)
    const { data: deal } = await supabase
      .from('deals')
      .select('title')
      .eq('owner_id', user.id)
      .eq('id', ci.deal_id)
      .single()

    const dealTitle = deal?.title ?? 'Giao dịch'

    // Use cached prompt_template or generate + persist
    let prompt: string
    if (ci.prompt_template) {
      prompt = ci.prompt_template as string
    } else {
      prompt = await generateCheckInPrompt(dealTitle, ci.trigger_type, today)
      // Persist generated prompt for caching (AD-5)
      await supabase
        .from('check_ins')
        .update({ prompt_template: prompt })
        .eq('owner_id', user.id)
        .eq('id', ci.id)
    }

    cards.push({
      id: ci.id,
      deal_id: ci.deal_id,
      deal_title: dealTitle,
      trigger_type: ci.trigger_type,
      due_date: ci.due_date,
      prompt,
    })
  }

  return NextResponse.json({ checkIns: cards })
}
```

### `app/api/check-ins/[id]/answer/route.ts` — Complete Implementation

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

// NOTE: logActivity uses createServerClient() internally (see activityLogService.ts line 2).
// Import directly — do NOT call createServiceClient() in this owner-initiated route (AD-13).
import { logActivity } from '@/lib/crm/activityLogService'

const VALID_ANSWERS = ['yes', 'no', 'later', 'skipped'] as const
type AnswerValue = (typeof VALID_ANSWERS)[number]

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = params.id
  let body: { answer?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const answer = body.answer as AnswerValue
  if (!VALID_ANSWERS.includes(answer)) {
    return NextResponse.json({ error: 'Invalid answer value' }, { status: 400 })
  }

  // Fetch deal_id first (needed for activity log) — also validates ownership (AD-2)
  const { data: existing, error: fetchError } = await supabase
    .from('check_ins')
    .select('deal_id')
    .eq('owner_id', user.id)
    .eq('id', id)
    .single()

  if (fetchError || !existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const now = new Date().toISOString()
  const status = answer === 'skipped' ? 'skipped' : 'sent'

  const { error: updateError } = await supabase
    .from('check_ins')
    .update({
      status,
      answered_at: now,
      sent_at: now,
      answer: { value: answer },
    })
    .eq('owner_id', user.id)  // AD-2: must be present
    .eq('id', id)

  if (updateError) {
    console.error('[ARIA/check-ins/answer] update error:', updateError.message)
    return NextResponse.json({ error: 'update_error' }, { status: 500 })
  }

  // Write activity log (fire-and-forget — AD-14 append-only)
  logActivity(user.id, {
    entity_type: 'deal',
    entity_id: existing.deal_id,
    action: 'checkin_answered',
    actor: 'owner',
    payload: { answer, check_in_id: id },
  }).catch((err) => console.warn('[ARIA/check-ins/answer] logActivity failed:', err))

  return NextResponse.json({ ok: true })
}
```

**Critical**: `logActivity` in `activityLogService.ts` uses `createServerClient()` (line 2 of that file). This is correct for owner-initiated routes — do NOT swap to `createServiceClient()` here.

### `components/chat/CheckInCard.tsx` — Complete Implementation

```tsx
'use client'

import { useState } from 'react'

export interface CheckInCardData {
  id: string
  deal_id: string
  deal_title: string
  trigger_type: 'stale_7d' | 'pre_action_due' | 'cadence_followup'
  due_date: string
  prompt: string
}

interface CheckInCardProps {
  checkIn: CheckInCardData
  onDismiss: (id: string) => void
}

const QUICK_REPLY_BUTTONS: { label: string; value: 'yes' | 'no' | 'later' }[] = [
  { label: 'Có', value: 'yes' },
  { label: 'Không', value: 'no' },
  { label: 'Để sau', value: 'later' },
]

export function CheckInCard({ checkIn, onDismiss }: CheckInCardProps) {
  const [loading, setLoading] = useState(false)

  async function handleAnswer(answer: 'yes' | 'no' | 'later' | 'skipped') {
    if (loading) return
    setLoading(true)
    try {
      await fetch(`/api/check-ins/${checkIn.id}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answer }),
      })
    } catch {
      // AD-6: silently continue — card is dismissed regardless
    } finally {
      setLoading(false)
      onDismiss(checkIn.id)
    }
  }

  return (
    <div
      style={{
        background: '#141a2e',
        borderLeft: '3px solid #f59e0b',  // amber — consistent with TodayCard urgent
        borderRadius: 6,
        padding: '12px 14px',
        marginBottom: 8,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      {/* Header row: deal title + dismiss */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: '#f59e0b',
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            letterSpacing: '0.04em',
          }}
        >
          {checkIn.deal_title}
        </span>
        <button
          aria-label="Bỏ qua"
          onClick={() => handleAnswer('skipped')}
          disabled={loading}
          style={{
            background: 'none',
            border: 'none',
            cursor: loading ? 'not-allowed' : 'pointer',
            color: '#94a3b8',
            fontSize: 16,
            lineHeight: 1,
            padding: '0 4px',
            opacity: loading ? 0.5 : 1,
          }}
        >
          ×
        </button>
      </div>

      {/* AI-generated question */}
      <span
        style={{
          fontSize: 13,
          color: '#e2e8f0',
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          lineHeight: 1.4,
        }}
      >
        {checkIn.prompt}
      </span>

      {/* Quick-reply buttons */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {QUICK_REPLY_BUTTONS.map(({ label, value }) => (
          <button
            key={value}
            onClick={() => handleAnswer(value)}
            disabled={loading}
            style={{
              background: '#1e2a45',
              border: '1px solid #2A3350',
              borderRadius: 6,
              padding: '6px 14px',
              color: '#e2e8f0',
              fontSize: 13,
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.5 : 1,
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => {
              if (!loading) (e.currentTarget as HTMLButtonElement).style.background = '#263352'
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = '#1e2a45'
            }}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}
```

### `ChatPanel.tsx` Modification — Exact Diff

Add to imports (after existing imports):
```typescript
import { CheckInCard } from './CheckInCard'
import type { CheckInCardData } from './CheckInCard'
```

Add state after existing `useState` declarations:
```typescript
const [pendingCheckIns, setPendingCheckIns] = useState<CheckInCardData[]>([])
```

Add useEffect after the existing `onboarding/status` useEffect:
```typescript
// Fetch pending check-ins on mount (Story 4.7)
useEffect(() => {
  fetch('/api/check-ins/pending')
    .then((r) => r.ok ? r.json() : { checkIns: [] })
    .then((data: { checkIns?: CheckInCardData[] }) => {
      setPendingCheckIns(data.checkIns ?? [])
    })
    .catch(() => { /* AD-6: silently continue */ })
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [])
```

Add dismiss handler (a simple inline function, not a named function):
```typescript
// Insert above the return statement:
const handleCheckInDismiss = (id: string) => {
  setPendingCheckIns((prev) => prev.filter((c) => c.id !== id))
}
```

Render CheckInCards ABOVE the `InputBar` div:
```tsx
{/* Check-in quick-reply cards (Story 4.7) — shown above input bar */}
{pendingCheckIns.length > 0 && (
  <div style={{ maxWidth: 760, width: '100%', margin: '0 auto', padding: '0 0 4px 0' }}>
    {pendingCheckIns.map((ci) => (
      <CheckInCard key={ci.id} checkIn={ci} onDismiss={handleCheckInDismiss} />
    ))}
  </div>
)}

{/* Input bar — EXISTING CODE UNCHANGED BELOW */}
<div style={{ maxWidth: 760, width: '100%', margin: '0 auto', alignSelf: 'stretch' }}>
  <InputBar ... />
</div>
```

**Placement**: The `CheckInCard` block goes between the transcript `</div>` and the existing `InputBar` div. Search for `{/* Input bar */}` in ChatPanel.tsx to find the exact insertion point (line 763).

### Static Fallback Strings (AD-6)

These are returned verbatim when AI unavailable. Hardcoded in `checkInPromptService.ts`:

| `trigger_type` | Fallback string |
|---|---|
| `stale_7d` | `"Giao dịch {title} chưa có hoạt động 7 ngày. Bạn có kế hoạch gì tiếp theo?"` |
| `pre_action_due` | `"Hành động cho {title} đến hạn ngày mai. Bạn đã chuẩn bị chưa?"` |
| `cadence_followup` | `"Đã đến lúc theo dõi {title}. Bạn muốn ARIA hỗ trợ gì?"` |

Where `{title}` is `dealTitle` substituted at runtime.

### Database Columns Used in This Story

```
check_ins table (full column list — do NOT create migration):
  id                uuid PK
  owner_id          uuid (AD-2 — every query must filter by this)
  deal_id           uuid
  trigger_type      text  ('stale_7d' | 'pre_action_due' | 'cadence_followup')
  due_date          date  (YYYY-MM-DD)
  prompt_template   text  (nullable — populated by this story on first load)
  status            text  ('pending' | 'sent' | 'skipped')
  sent_at           timestamptz (set when answered, including 'skipped')
  answered_at       timestamptz (set when answered, including 'skipped')
  answer            jsonb  ({ value: 'yes' | 'no' | 'later' | 'skipped' })
  channel           text  (not touched by this story — set by Story 4.6 scheduler)
  created_at        timestamptz
  UNIQUE(owner_id, deal_id, trigger_type, due_date)
```

**Note on `prompt_template`**: Story 4.6 inserts rows without `prompt_template`. This story populates it on first load and reads the cache on subsequent loads. No migration needed — the column is assumed to exist (Story 4.6 schema note states the full table was in Sprint 0 schema).

**Note on `answer` column type**: It is `jsonb`, not `text`. Write `{ value: answer }` object, not just a string.

### Architecture Decisions Checklist

| AD | Rule | This Story |
|---|---|---|
| AD-1 | `@anthropic-ai/sdk` only inside `lib/ai/` | `checkInPromptService.ts` is in `lib/ai/` — OK |
| AD-2 | All queries `.eq('owner_id', ownerId)` | Both routes and all queries include this |
| AD-4 | Haiku for routine generation | Check-in prompt = Haiku (`ARIA_MODELS.economical`) |
| AD-5 | `cache_control` breakpoint on system prompt | `callAI()` applies this automatically when `systemPrompt` is passed |
| AD-6 | Graceful degradation fallback | `generateCheckInPrompt` never throws; static strings returned |
| AD-11 | `lib/crm/` files: `import 'server-only'` at line 1 | `checkInPromptService.ts` is in `lib/ai/` (not `lib/crm/`) — still needs `import 'server-only'` since it uses Anthropic SDK |
| AD-13 | `createServerClient()` for owner routes; `createServiceClient()` for system tasks | Pending route + answer route both use `createServerClient()` (owner-initiated) |
| AD-14 | `activity_log` is append-only | `logActivity()` only inserts, never updates |

### activityLogService — Exact Import and Usage

`logActivity` in `lib/crm/activityLogService.ts` uses `createServerClient()` internally (line 2 of that file). This means it relies on the request cookie context being available. In the answer route (an API route handler), this is correct. Do NOT swap to a different log mechanism.

```typescript
// From activityLogService.ts — exact signature:
export async function logActivity(ownerId: string, params: LogActivityParams): Promise<void>

// LogActivityParams:
interface LogActivityParams {
  entity_type: 'client' | 'deal' | 'document' | 'settings'
  entity_id: string
  action: string
  actor: 'ai' | 'user'
  payload?: Record<string, unknown>
}
```

For this story: `actor: 'owner'` is NOT a valid union member — use `actor: 'user'` (the interface uses `'user'` not `'owner'`). The `action` can be any string.

### File Structure — Exact Paths

| Path | Action | Notes |
|------|--------|-------|
| `lib/ai/checkInPromptService.ts` | NEW | `import 'server-only'` at line 1 |
| `app/api/check-ins/pending/route.ts` | NEW | GET handler, `createServerClient()` |
| `app/api/check-ins/[id]/answer/route.ts` | NEW | POST handler, `createServerClient()` |
| `components/chat/CheckInCard.tsx` | NEW | `'use client'` at line 1 |
| `components/chat/ChatPanel.tsx` | MODIFY | Add pendingCheckIns state + CheckInCard render |
| `lib/__tests__/checkInDelivery47.test.ts` | NEW | ≥60 ts-node inline tests |
| `package.json` | MODIFY | Add test script + CI chain entry |

**Directory note**: `app/api/check-ins/[id]/answer/route.ts` — the `[id]` is a dynamic segment. The folder name must literally be `[id]` (with square brackets) to match Next.js App Router dynamic route convention.

### ts-node Test Pattern (MANDATORY — same as every prior story)

```typescript
export {}
// ts-node inline tests for Story 4.7: Check-In Delivery, Quick-Reply UI & Answer Capture
// Pattern: no imports from project lib/ — logic simulated inline.
// Run: npx ts-node lib/__tests__/checkInDelivery47.test.ts

import fs from 'fs'
import path from 'path'

let passed = 0
let failed = 0

function assert(condition: boolean, label: string): void {
  if (condition) {
    console.log(`  ✓ ${label}`)
    passed++
  } else {
    console.error(`  ✗ FAIL: ${label}`)
    failed++
  }
}

// ... inline simulations of pure logic ...
// NEVER: import { generateCheckInPrompt } from '../../lib/ai/checkInPromptService'
// ALWAYS: re-implement the fallback logic inline

// Final summary block (REQUIRED):
console.log(`\nResults: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
```

**Critical rules** (same as all previous stories):
- Line 1: `export {}`
- `import fs from 'fs'` and `import path from 'path'` (used for file structure checks)
- `process.cwd()` for path construction, NOT `__dirname`
- NEVER import from project `lib/` — re-implement all pure logic inline
- `process.exit(1)` if any test failed

## Test Coverage

### T1–T15: `generateCheckInPrompt` fallback strings

```
T1:  stale_7d fallback contains the deal title
T2:  stale_7d fallback contains '7 ngày' or '7 ngay'
T3:  stale_7d fallback is ≤80 chars for a short title ('Test')
T4:  stale_7d fallback is ≤80 chars for a 20-char title
T5:  pre_action_due fallback contains the deal title
T6:  pre_action_due fallback contains 'ngày mai' or 'đến hạn'
T7:  pre_action_due fallback is ≤80 chars for a short title
T8:  pre_action_due fallback is ≤80 chars for a 20-char title
T9:  cadence_followup fallback contains the deal title
T10: cadence_followup fallback contains 'theo dõi' or 'ARIA'
T11: cadence_followup fallback is ≤80 chars for a short title
T12: cadence_followup fallback is ≤80 chars for a 20-char title
T13: All three trigger types produce non-empty strings
T14: Fallback for 'stale_7d' differs from fallback for 'pre_action_due'
T15: Fallback for 'pre_action_due' differs from fallback for 'cadence_followup'
```

### T16–T30: API route structure checks

```
T16: checkInPromptService.ts exists at lib/ai/checkInPromptService.ts
T17: checkInPromptService.ts first line is "import 'server-only'"
T18: checkInPromptService.ts imports callAI (not Anthropic SDK directly — AD-1)
T19: checkInPromptService.ts exports generateCheckInPrompt
T20: checkInPromptService.ts references ARIA_MODELS.economical (not a hardcoded model string)
T21: pending route exists at app/api/check-ins/pending/route.ts
T22: pending route contains 'createServerClient'
T23: pending route does NOT contain 'createServiceClient' (AD-13)
T24: pending route exports a GET function
T25: pending route queries 'check_ins' table
T26: pending route filters by status = 'pending'
T27: pending route filters by due_date (lte or <=)
T28: answer route exists at app/api/check-ins/[id]/answer/route.ts
T29: answer route contains 'createServerClient'
T30: answer route exports a POST function
```

### T31–T45: CheckInCard component structure

```
T31: CheckInCard.tsx exists at components/chat/CheckInCard.tsx
T32: CheckInCard.tsx first line is "'use client'"
T33: CheckInCard.tsx exports CheckInCard function/component
T34: CheckInCard.tsx exports CheckInCardData interface
T35: CheckInCard.tsx references all three quick-reply values: yes, no, later
T36: CheckInCard.tsx renders Vietnamese labels: 'Có', 'Không', 'Để sau'
T37: CheckInCard.tsx references '#f59e0b' (amber left border)
T38: CheckInCard.tsx references onDismiss prop
T39: CheckInCard.tsx fetches '/api/check-ins/' in handleAnswer
T40: CheckInCard.tsx handles 'skipped' answer value for dismiss
T41: CheckInCard.tsx has a loading/disabled state (buttons disabled while fetch in-flight)
T42: CheckInCard.tsx does NOT import from 'lib/' (client component — no server imports)
T43: CheckInCard.tsx uses 'use client' — NOT a server component
T44: CheckInCard interface has id, deal_id, deal_title, trigger_type, due_date, prompt fields
T45: CheckInCard.tsx renders deal_title
```

### T46–T60: ChatPanel integration + package.json

```
T46: ChatPanel.tsx imports CheckInCard
T47: ChatPanel.tsx imports CheckInCardData (type import)
T48: ChatPanel.tsx contains 'pendingCheckIns' state
T49: ChatPanel.tsx fetches '/api/check-ins/pending' on mount
T50: ChatPanel.tsx has onDismiss handler that filters pendingCheckIns
T51: ChatPanel.tsx renders CheckInCard components
T52: ChatPanel.tsx CheckInCard render is inside a conditional (pendingCheckIns.length > 0)
T53: ChatPanel.tsx does NOT remove InputBar (existing input bar preserved)
T54: ChatPanel.tsx has a catch or fallback for check-ins fetch failure (AD-6)
T55: answer route contains '.eq("owner_id"' or ".eq('owner_id'" (AD-2)
T56: answer route contains 'logActivity'
T57: answer route contains 'checkin_answered'
T58: answer route contains 'actor' set to 'user' (NOT 'owner' — invalid union member)
T59: package.json contains 'test:check-in-delivery47' script
T60: package.json 'test' script contains 'checkInDelivery47.test.ts' in the CI chain
```

## Previous Story Intelligence (from Story 4.6)

Story 4.6 established these patterns that Story 4.7 **must** be consistent with:

1. **`check_ins` table schema**: All columns confirmed (id, owner_id, deal_id, trigger_type, due_date, prompt_template, status, sent_at, answered_at, answer, created_at, channel). `answer` is `jsonb`, not `text`.
2. **`getPendingCheckIns` exists in `lib/crm/checkInService.ts`** but uses `createServiceClient()`. The pending API route in this story does its own direct query using `createServerClient()` — do NOT call `getPendingCheckIns` from the route (AD-13 would be violated — service role must not serve owner-initiated routes).
3. **`logActivity` fire-and-forget pattern**: Always use `.catch()` to prevent unhandled promise rejection. Matches `scheduleCheckIn` pattern in Story 4.6.
4. **Test pattern**: `export {}` line 1, `import fs from 'fs'`, `process.cwd()`, no project lib imports — identical for every story.
5. **`isActiveStage` and other business logic**: Not needed in this story — delivery and UI only.

## Git Intelligence (recent commits)

From `git log`:
- `feat(story-0.8)`: `logActivity` uses `createServerClient()` — confirms this is correct for owner routes
- `feat(story-0.7)`: `callAI()` pattern — system prompt is passed as `systemPrompt` param; `callAI` wraps it with `cache_control` automatically
- `feat(story-4.6)`: `checkInService.ts` schema details confirmed — `prompt_template` column exists

**ARIA_MODELS constants** (from `lib/ai/models.ts`):
```typescript
export const ARIA_MODELS = {
  economical: 'claude-haiku-4-5-20251001',   // Haiku — use for check-in prompt generation
  highJudgment: 'claude-sonnet-4-6',          // Sonnet — NOT used in this story
} as const
```

## Project Structure Notes

- All inline styles use `fontFamily: "'Plus Jakarta Sans', sans-serif"` — match existing components
- Background color `#0a0e27` (page), `#141a2e` (card), `#1e2a45` (hover) — match BriefingPanel
- Border: `1px solid #2A3350` for card borders (match system)
- `components/chat/` already contains: `ChatPanel.tsx`, `DegradedBanner.tsx`, `InputBar.tsx`, `MarkdownRenderer.tsx`, `MessageBubble.tsx`, `WelcomeCard.tsx`
- `lib/ai/` already contains: `callAI.ts`, `models.ts`, and many specialist files — `checkInPromptService.ts` fits here per AD-1

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

### File List

- `lib/ai/checkInPromptService.ts` — NEW
- `app/api/check-ins/pending/route.ts` — NEW
- `app/api/check-ins/[id]/answer/route.ts` — NEW
- `components/chat/CheckInCard.tsx` — NEW
- `components/chat/ChatPanel.tsx` — MODIFIED
- `lib/__tests__/checkInDelivery47.test.ts` — NEW
- `package.json` — MODIFIED

### Change Log

| Date | Change |
|------|--------|
| 2026-06-30 | Story file created — ready for dev |
