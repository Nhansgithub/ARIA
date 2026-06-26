---
story: 1.2
epic: 1
status: done
baseline_commit: ed419d4d059cbea7d7a69f752ae0c17369ac0562
---

# Story 1.2: Orchestrator — Intent Classification and Routing

## Story

As an Owner, I want every message I send to be classified into the right Interaction Mode and routed to the appropriate reasoning path, so that deal questions get deep analysis, document requests trigger elicitation, and ambiguous messages get a clarifying question rather than a wrong answer.

---

## Acceptance Criteria

**AC-1: Deal intelligence messages route to the high-judgment specialist**

**Given** the Owner sends a message describing a new or ongoing deal opportunity (e.g., "Vừa gặp một chủ F&B, họ muốn làm website"),
**When** the orchestrator classifies intent,
**Then** the message is classified as `deal_intelligence` and routed to the Deal Intelligence reasoning path with `ARIA_MODELS.highJudgment`, not the plain query or economical path. (FR-1; AD-1; AD-4)

**AC-2: CRM action messages route to the high-judgment specialist**

**Given** the Owner sends a message that creates or queries CRM records (e.g., "What deals are active?", "Create a deal for Viet Coffee"),
**When** the orchestrator classifies intent,
**Then** the message is classified as `crm_action` and routed to the CRM specialist path with `ARIA_MODELS.highJudgment`. (FR-1; AD-4)

**AC-3: Strategic questions route to the high-judgment specialist**

**Given** the Owner sends a business-level strategic question (e.g., "Should I lower my rates?", "Should I specialize in F&B?"),
**When** the orchestrator classifies intent,
**Then** the message is classified as `strategy` and routed to the Strategy Advisor path with `ARIA_MODELS.highJudgment`. (FR-1; AD-4)

**AC-4: General chat routes to the economical model**

**Given** the Owner sends a greeting or off-topic message (e.g., "Hi", "What's the weather?", "Thanks"),
**When** the orchestrator classifies intent,
**Then** the message is classified as `general_chat` and routed to the general chat path with `ARIA_MODELS.economical` (claude-haiku-4-5-20251001). (FR-1; AD-4)

**AC-5: Prompt-cache assembly discipline on every orchestrator call**

**Given** any AI call from the orchestrator (classification step or specialist step),
**When** the call is assembled,
**Then** the stable prefix (system prompt with `cache_control: { type: "ephemeral" }`, then business context if present with a second `cache_control` breakpoint) comes before the volatile content (conversation turns, user message); no timestamps, UUIDs, or per-request IDs appear before the last breakpoint. (AD-5)

**AC-6: All AI calls are server-side only**

**Given** any orchestrator or specialist AI call,
**When** the call is made,
**Then** it runs server-side only inside `lib/ai/`; the client never touches the Claude API directly; the Anthropic SDK is never imported outside `lib/ai/`. (AD-1; AD-3)

**AC-7: Classification failure falls back silently to `general_chat`**

**Given** the orchestrator's `callAI()` classification call returns `status: "degraded"` or `status: "error"`,
**When** the fallback is applied,
**Then** the route handler silently treats the intent as `general_chat` using `ARIA_MODELS.economical`; no error is surfaced to the user; the upstream streaming response continues normally. (AD-6)

**AC-8: Specialist system prompts are intent-specific**

**Given** the orchestrator has classified the intent and chosen a specialist,
**When** `streamChat()` is called,
**Then** the `systemPrompt` argument is the specialist system prompt for the classified intent bucket (not the old flat `CHAT_SYSTEM_PROMPT`); each bucket has its own system prompt tuned for that reasoning domain. (FR-1; AD-1)

---

## Tasks / Subtasks

- [x] **Task 1: Create `lib/ai/orchestrator.ts`** (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7)
  - [x] Add `import 'server-only'` at the top of the file
  - [x] Define the `IntentBucket` union type: `'deal_intelligence' | 'crm_action' | 'strategy' | 'general_chat'`
  - [x] Define the `ClassificationResult` interface (see Dev Notes for exact shape)
  - [x] Write the `ORCHESTRATOR_SYSTEM_PROMPT` constant — a compact classification-only system prompt (see Dev Notes for exact text)
  - [x] Implement `classifyIntent(messages: ChatTurn[]): Promise<ClassificationResult>` using `callAI()` with `ARIA_MODELS.economical` and a max token budget of 50 (classification output is tiny)
  - [x] Parse the JSON response from `callAI()` into `ClassificationResult`; on any parse error or non-ok status, fall back to `{ intent: 'general_chat', confidence: 0 }` silently (AC-7)
  - [x] Export `classifyIntent` and `SPECIALIST_SYSTEM_PROMPTS` (the map from bucket to system prompt string)
  - [x] Export `IntentBucket` and `ClassificationResult` types

- [x] **Task 2: Define specialist system prompts** (AC-8)
  - [x] Define `SPECIALIST_SYSTEM_PROMPTS` as a `Record<IntentBucket, string>` constant in `lib/ai/orchestrator.ts`
  - [x] Write the `deal_intelligence` specialist system prompt (see Dev Notes for exact text)
  - [x] Write the `crm_action` specialist system prompt (see Dev Notes for exact text)
  - [x] Write the `strategy` specialist system prompt (see Dev Notes for exact text)
  - [x] Write the `general_chat` specialist system prompt (see Dev Notes for exact text)

- [x] **Task 3: Define the model routing map** (AC-1, AC-2, AC-3, AC-4)
  - [x] Define `INTENT_MODEL_MAP` as a `Record<IntentBucket, AriaModel>` constant in `lib/ai/orchestrator.ts`
  - [x] Wire `deal_intelligence`, `crm_action`, `strategy` → `ARIA_MODELS.highJudgment`
  - [x] Wire `general_chat` → `ARIA_MODELS.economical`

- [x] **Task 4: Update `app/api/chat/route.ts`** (AC-1 through AC-8)
  - [x] Import `classifyIntent`, `SPECIALIST_SYSTEM_PROMPTS`, `INTENT_MODEL_MAP` from `@/lib/ai/orchestrator`
  - [x] Remove the old flat `CHAT_SYSTEM_PROMPT` constant
  - [x] After the privacy gate and before calling `streamChat()`, call `classifyIntent(messages)` to get the intent bucket
  - [x] Pass `SPECIALIST_SYSTEM_PROMPTS[result.intent]` as `systemPrompt` and `INTENT_MODEL_MAP[result.intent]` as `model` to `streamChat()`
  - [x] Ensure the orchestrator `callAI()` call uses `ARIA_MODELS.economical` (fast, cheap classification) — the model choice happens inside `classifyIntent()`
  - [x] Verify no Anthropic SDK import exists directly in `route.ts` (AD-1 guard)

- [x] **Task 5: Update `lib/ai/streamChat.ts` to accept a `model` parameter** (AC-1 through AC-4)
  - [x] Add `model: AriaModel` to the `StreamChatOptions` interface
  - [x] Replace the hardcoded `ARIA_MODELS.highJudgment` in the `client.messages.stream()` call with `options.model`
  - [x] Update the token log to use `options.model` instead of the hardcoded constant
  - [x] Ensure `specialist` in the log uses the intent bucket name (passed as a new `specialist` option or derived from model)

- [x] **Task 6: Export orchestrator from `lib/ai/index.ts`** (AC-6)
  - [x] Add `export { classifyIntent, SPECIALIST_SYSTEM_PROMPTS, INTENT_MODEL_MAP } from './orchestrator'`
  - [x] Add `export type { IntentBucket, ClassificationResult } from './orchestrator'`

- [x] **Task 7: Write unit tests** (all ACs)
  - [x] Test `classifyIntent` mock: given a mocked `callAI` returning `{ status: 'ok', data: '{"intent":"deal_intelligence"}' }`, assert result is `{ intent: 'deal_intelligence', confidence: 1 }`
  - [x] Test fallback: given mocked `callAI` returning `{ status: 'degraded', ... }`, assert result falls back to `{ intent: 'general_chat', confidence: 0 }`
  - [x] Test fallback: given mocked `callAI` returning invalid JSON, assert result falls back to `{ intent: 'general_chat', confidence: 0 }`
  - [x] Test model map: assert `INTENT_MODEL_MAP.deal_intelligence === ARIA_MODELS.highJudgment`
  - [x] Test model map: assert `INTENT_MODEL_MAP.general_chat === ARIA_MODELS.economical`

- [x] **Task 8: CI triad** (all ACs)
  - [x] `npm run lint` — passes with no warnings
  - [x] `npx tsc --noEmit` — passes with no errors
  - [x] `npm run format:check` — passes
  - [x] `npm run build` — Next.js build completes without error

---

## Dev Notes

### Architecture Constraints (Non-Negotiable)

**AD-1 — All SDK usage in `lib/ai/` only:**
`lib/ai/orchestrator.ts` is the home for the orchestrator logic. `app/api/chat/route.ts` calls orchestrator functions but never imports from `@anthropic-ai/sdk` directly. The existing ESLint guard from Story 0.6 blocks this. Violating this causes a lint failure.

**AD-3 — Server-side only:**
`lib/ai/orchestrator.ts` begins with `import 'server-only'`. This prevents accidental client bundling. The same pattern is used by `callAI.ts` and `streamChat.ts`.

**AD-4 — Model routing by intent:**
The classification call itself uses `ARIA_MODELS.economical` — it is a cheap, fast, small-token call. The downstream `streamChat()` uses the model the orchestrator selects. This is the cost discipline: pay Haiku to decide, pay Sonnet only when needed.

**AD-5 — Prompt-cache assembly:**
The classification call goes through `callAI()` which already enforces cache-friendly assembly (system → business context → volatile turns). No change to `callAI.ts` is needed — just call it correctly from `classifyIntent()`. For the downstream `streamChat()` call, the system prompt is now the specialist prompt (stable, cacheable). The cache breakpoints established in Story 1.1 are preserved.

**AD-6 — Graceful degradation on classification failure:**
If `classifyIntent()` gets a degraded/error envelope from `callAI()`, it must silently return `{ intent: 'general_chat', confidence: 0 }`. Never throw, never propagate the error to the user. The upstream streaming response will proceed as `general_chat`.

**ESLint guard:**
`@anthropic-ai/sdk` is blocked in `app/**` and all `lib/**` outside `lib/ai/**`. Do not violate this. `lib/ai/orchestrator.ts` may import from `lib/ai/callAI.ts` freely since it is inside `lib/ai/`.

---

### `lib/ai/orchestrator.ts` — Exact Implementation Pattern

```typescript
import 'server-only'
import { callAI } from './callAI'
import { ARIA_MODELS } from './models'
import type { AriaModel } from './models'
import type { ChatTurn } from './streamChat'

// ── Types ──────────────────────────────────────────────────────────────────

export type IntentBucket =
  | 'deal_intelligence'
  | 'crm_action'
  | 'strategy'
  | 'general_chat'

export interface ClassificationResult {
  intent: IntentBucket
  /** 0 = fallback/unknown; 1 = high confidence from model */
  confidence: number
}

// ── Classification system prompt ──────────────────────────────────────────
// Kept small and stable so it cache-hits on every call (AD-5).

const ORCHESTRATOR_SYSTEM_PROMPT = `You are ARIA's intent classifier. Classify the user's latest message into exactly one of these buckets and respond with valid JSON only — no explanation, no markdown fences.

Buckets:
- deal_intelligence: questions about a specific deal, new lead description, deal analysis, Zalo screenshot context, decision-maker questions
- crm_action: creating/updating/querying clients or deals via conversation, pipeline status, "what are my active deals?"
- strategy: cross-deal business strategy, pricing philosophy, niche/positioning questions, "should I lower my rates?"
- general_chat: greetings, off-topic, ambiguous, unclear intent, anything that doesn't fit the above

Respond with exactly: {"intent":"<bucket>","confidence":<0.0-1.0>}`

// ── Specialist system prompts ──────────────────────────────────────────────
// Each prompt is the stable system instruction for that reasoning domain.
// These are passed as systemPrompt to streamChat(), which applies cache_control.

export const SPECIALIST_SYSTEM_PROMPTS: Record<IntentBucket, string> = {
  deal_intelligence: `You are ARIA, an AI business consultant for a Vietnamese service agency founder. 
You specialize in Deal Intelligence: reading between the lines of deal conversations to surface the real need, risk flags, and opportunity signals.
When analyzing a deal, reason out loud — name your evidence, cite patterns if you have them, and always end with a concrete next action.
Answer in the same language as the user's message (Vietnamese or English).
Use B2B-appropriate register: direct, analytical, no filler phrases.`,

  crm_action: `You are ARIA, an AI business consultant for a Vietnamese service agency founder.
You specialize in CRM actions: creating, updating, and querying client and deal records through conversation.
When the user describes a new client or deal, confirm what you're about to create and ask no more than 2 targeted gap-filling questions.
When retrieving pipeline information, present it concisely — no padding, no unrequested advice.
Answer in the same language as the user's message (Vietnamese or English).`,

  strategy: `You are ARIA, an AI business consultant for a Vietnamese service agency founder.
You specialize in strategic advice: pricing, positioning, service mix, and cross-deal pattern detection.
Always name a specific recommendation (not just options), back it with a reason from the owner's data or Vietnamese SME domain knowledge, and challenge the premise if it is likely counterproductive.
End every advisory response with a concrete next step.
Answer in the same language as the user's message (Vietnamese or English).
Use direct, analytical tone — no filler phrases ("Great question!", "Certainly!").`,

  general_chat: `You are ARIA, an AI business consultant for a Vietnamese service agency founder.
Answer helpfully and concisely in the same language as the user's message (Vietnamese or English).
Be warm but direct. If the message seems related to the owner's business, gently redirect toward a more specific question ARIA can help with.`,
}

// ── Model routing map ──────────────────────────────────────────────────────

export const INTENT_MODEL_MAP: Record<IntentBucket, AriaModel> = {
  deal_intelligence: ARIA_MODELS.highJudgment,
  crm_action:        ARIA_MODELS.highJudgment,
  strategy:          ARIA_MODELS.highJudgment,
  general_chat:      ARIA_MODELS.economical,
}

// ── Classification function ────────────────────────────────────────────────

/**
 * Classifies the intent of the latest user message using the economical model.
 * Never throws — any failure silently returns the general_chat fallback (AD-6).
 */
export async function classifyIntent(messages: ChatTurn[]): Promise<ClassificationResult> {
  const FALLBACK: ClassificationResult = { intent: 'general_chat', confidence: 0 }

  try {
    const result = await callAI({
      model: ARIA_MODELS.economical,          // AD-4: cheap/fast for classification
      specialist: 'orchestrator_classify',
      systemPrompt: ORCHESTRATOR_SYSTEM_PROMPT,
      messages: messages as import('@anthropic-ai/sdk').MessageParam[],
      maxTokens: 50,                           // Classification output is tiny
      timeoutMs: 5_000,                        // Fail fast — user is waiting to stream
    })

    if (result.status !== 'ok' || !result.data) {
      return FALLBACK                          // AD-6: degraded → silent fallback
    }

    // Strip markdown fences if the model ignored instructions
    const raw = result.data.replace(/```json\n?|```/g, '').trim()
    const parsed = JSON.parse(raw) as { intent?: unknown; confidence?: unknown }

    const VALID_BUCKETS: IntentBucket[] = [
      'deal_intelligence',
      'crm_action',
      'strategy',
      'general_chat',
    ]

    const intent = parsed.intent as IntentBucket
    if (!VALID_BUCKETS.includes(intent)) return FALLBACK

    const confidence = typeof parsed.confidence === 'number' ? parsed.confidence : 1

    return { intent, confidence }
  } catch {
    return FALLBACK                            // AD-6: parse error → silent fallback
  }
}
```

**Key implementation notes:**

1. `callAI()` already enforces the cache-assembly order (AD-5) — `classifyIntent` just calls it.
2. The `maxTokens: 50` cap keeps classification cheap (classification JSON is ~30 chars).
3. The `timeoutMs: 5_000` ensures the classification step doesn't block the user more than 5 seconds — they're waiting for the stream to start.
4. The `messages` array passed to `callAI()` must be cast since `ChatTurn` and `Anthropic.MessageParam` share the same shape but different type provenance. A simple `as` cast is fine here because `ChatTurn` is structurally identical to `{ role: 'user'|'assistant', content: string }`.

---

### `lib/ai/streamChat.ts` — Required Change

The current `streamChat.ts` hardcodes `ARIA_MODELS.highJudgment`. Add `model` and `specialist` to the options interface so the route handler can pass the orchestrator's selection:

**Change `StreamChatOptions` interface:**

```typescript
export interface StreamChatOptions {
  model: AriaModel           // NEW — was hardcoded to highJudgment
  specialist: string         // NEW — used for token log (e.g. 'deal_intelligence')
  systemPrompt: string
  businessContext?: string
  messages: ChatTurn[]
}
```

**Change inside `ReadableStream.start()`:**

Replace:
```typescript
model: ARIA_MODELS.highJudgment,
```

With:
```typescript
model: options.model,
```

**Change the token log line:**

Replace:
```typescript
model: ARIA_MODELS.highJudgment,
specialist: 'chat',
```

With:
```typescript
model: options.model,
specialist: options.specialist,
```

Add the `AriaModel` import from `./models` if not already present.

---

### `app/api/chat/route.ts` — Required Change

Replace the current flat prompt + direct `streamChat()` call with the orchestrator intercept:

```typescript
import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { isPrivacyNoticeAcknowledged } from '@/lib/privacy/checkPrivacyNotice'
import { streamChat } from '@/lib/ai/streamChat'
import { classifyIntent, SPECIALIST_SYSTEM_PROMPTS, INTENT_MODEL_MAP } from '@/lib/ai/orchestrator'
import type { ChatTurn } from '@/lib/ai/streamChat'

// NOTE: CHAT_SYSTEM_PROMPT is removed — each intent bucket now has its own
// specialist prompt defined in lib/ai/orchestrator.ts.

export async function POST(req: NextRequest) {
  const supabase = createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // AD-10: privacy gate — every AI call requires prior acknowledgement
  const acknowledged = await isPrivacyNoticeAcknowledged(user.id)
  if (!acknowledged) {
    return new Response(
      JSON.stringify({ requiresAcknowledgement: true, status: 'awaiting_privacy_ack' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const body = await req.json()
  const messages = body.messages as ChatTurn[]

  // AD-1: Orchestrator intercept — classify intent before streaming
  // Uses callAI() (non-streaming, economical model) — never throws (AD-6)
  const classification = await classifyIntent(messages)

  // Route to specialist: system prompt + model selected by orchestrator
  const stream = streamChat({
    model: INTENT_MODEL_MAP[classification.intent],
    specialist: classification.intent,
    systemPrompt: SPECIALIST_SYSTEM_PROMPTS[classification.intent],
    messages,
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
```

---

### `lib/ai/index.ts` — Additions

Add these exports alongside the existing ones:

```typescript
export { classifyIntent, SPECIALIST_SYSTEM_PROMPTS, INTENT_MODEL_MAP } from './orchestrator'
export type { IntentBucket, ClassificationResult } from './orchestrator'
```

---

### Specialist System Prompts — Rationale

| Bucket | Model | Rationale |
|---|---|---|
| `deal_intelligence` | `highJudgment` (Sonnet) | Reasoning-heavy: four-layer synthesis, risk analysis, pattern detection. Never downgrade (AD-4). |
| `crm_action` | `highJudgment` (Sonnet) | Must correctly parse entity names, disambiguate, and call tools accurately. Accuracy > cost. |
| `strategy` | `highJudgment` (Sonnet) | Requires deep domain knowledge and challenge of wrong premises (FR-23). Always Sonnet (AD-4). |
| `general_chat` | `economical` (Haiku) | Greetings, off-topic, simple clarifications. Speed + cost wins here. |

---

### How to Test Classification Logic Manually

Since `classifyIntent` uses `callAI()` which hits the real Anthropic API in integration, the recommended approach is:

**Unit tests (mock `callAI`):**

```typescript
// __tests__/lib/ai/orchestrator.test.ts
import { jest } from '@jest/globals'

jest.mock('@/lib/ai/callAI', () => ({
  callAI: jest.fn(),
}))

import { classifyIntent, INTENT_MODEL_MAP, ARIA_MODELS } from '@/lib/ai/orchestrator'
import { callAI } from '@/lib/ai/callAI'

describe('classifyIntent', () => {
  it('returns deal_intelligence for a deal description', async () => {
    (callAI as jest.Mock).mockResolvedValue({
      status: 'ok',
      data: '{"intent":"deal_intelligence","confidence":0.95}',
    })
    const result = await classifyIntent([
      { role: 'user', content: 'Vừa gặp một chủ F&B, họ muốn làm website' },
    ])
    expect(result.intent).toBe('deal_intelligence')
    expect(result.confidence).toBe(0.95)
  })

  it('falls back to general_chat on degraded callAI', async () => {
    (callAI as jest.Mock).mockResolvedValue({
      status: 'degraded',
      data: null,
      degraded_reason: 'timeout',
    })
    const result = await classifyIntent([{ role: 'user', content: 'hi' }])
    expect(result.intent).toBe('general_chat')
    expect(result.confidence).toBe(0)
  })

  it('falls back to general_chat on invalid JSON', async () => {
    (callAI as jest.Mock).mockResolvedValue({ status: 'ok', data: 'not json' })
    const result = await classifyIntent([{ role: 'user', content: 'hello' }])
    expect(result.intent).toBe('general_chat')
    expect(result.confidence).toBe(0)
  })

  it('falls back to general_chat on unknown bucket', async () => {
    (callAI as jest.Mock).mockResolvedValue({
      status: 'ok',
      data: '{"intent":"unknown_bucket","confidence":0.9}',
    })
    const result = await classifyIntent([{ role: 'user', content: 'hello' }])
    expect(result.intent).toBe('general_chat')
  })
})

describe('INTENT_MODEL_MAP', () => {
  it('routes high-judgment intents to Sonnet', () => {
    expect(INTENT_MODEL_MAP.deal_intelligence).toBe(ARIA_MODELS.highJudgment)
    expect(INTENT_MODEL_MAP.crm_action).toBe(ARIA_MODELS.highJudgment)
    expect(INTENT_MODEL_MAP.strategy).toBe(ARIA_MODELS.highJudgment)
  })

  it('routes general_chat to the economical model', () => {
    expect(INTENT_MODEL_MAP.general_chat).toBe(ARIA_MODELS.economical)
  })
})
```

**Manual smoke test (browser):**

1. Start the app (`npm run dev`)
2. Open the chat and send: "Vừa gặp một chủ F&B, họ muốn làm website"
   - Expected: server logs show `specialist: 'deal_intelligence'` and `model: 'claude-sonnet-4-6'`
3. Send: "Hi, how are you?"
   - Expected: server logs show `specialist: 'general_chat'` and `model: 'claude-haiku-4-5-20251001'`
4. Send: "Should I lower my rates?"
   - Expected: server logs show `specialist: 'strategy'` and `model: 'claude-sonnet-4-6'`

Check `[ARIA/stream]` console output after each response.

---

### File Structure

Files to create:
```
lib/
  ai/
    orchestrator.ts           ← NEW: classifyIntent(), SPECIALIST_SYSTEM_PROMPTS, INTENT_MODEL_MAP
```

Files to modify:
```
lib/
  ai/
    streamChat.ts             ← Add `model` and `specialist` to StreamChatOptions; remove hardcoded model
    index.ts                  ← Add orchestrator exports
app/
  api/
    chat/
      route.ts                ← Remove CHAT_SYSTEM_PROMPT; add classifyIntent intercept
```

Files to create (tests):
```
__tests__/
  lib/
    ai/
      orchestrator.test.ts    ← Unit tests for classifyIntent and model map
```

---

### CI Triad Reminder

Run in this exact sequence before committing:

```bash
npm run lint
npx tsc --noEmit
npm run format:check
npm run build
```

The build step catches Next.js route handler boundary violations (e.g., accidentally importing server-only modules in a client context) that TypeScript alone cannot catch. Do not skip it.

---

### Previous Story Learnings Applied

**From Story 0.7 (`callAI()` wrapper):**

1. `callAI()` returns `AIEnvelope<string>` — always check `result.status` before using `result.data`. The orchestrator classification must check `result.status !== 'ok'` and fall back before parsing.
2. Token logging is automatic inside `callAI()` — the classification step will log `specialist: 'orchestrator_classify'` with its own token counts. No additional logging is needed in `classifyIntent`.
3. `timeoutMs` defaults to 10,000ms in `callAI()`. Override it to 5,000ms in the classification call — users are waiting for the stream to start and a 10s classification timeout is unacceptable UX.
4. The `callAI()` export in `lib/ai/index.ts` is already available — import from `./callAI` (relative) inside `orchestrator.ts` since both files are in `lib/ai/`.

**From Story 1.1 (`streamChat()` and the route handler):**

5. `streamChat()` currently has `model: ARIA_MODELS.highJudgment` hardcoded. The `model` parameter must be added to `StreamChatOptions` for this story. This is a breaking interface change — update the single call site in `route.ts` at the same time.
6. The privacy gate (`isPrivacyNoticeAcknowledged`) lives between auth check and the AI call in `route.ts`. The orchestrator intercept goes after the privacy gate — never classify intent before the privacy gate is satisfied.
7. The route handler currently uses `const messages = body.messages as ChatTurn[]`. This cast and the `ChatTurn` type remain unchanged — `classifyIntent` accepts `ChatTurn[]` which is structurally compatible.
8. The streaming response headers (`Content-Type: text/plain; charset=utf-8`, `Cache-Control: no-cache`, `X-Content-Type-Options: nosniff`) are unchanged — only the upstream setup changes.

**From Story 0.6 (ESLint boundary):**

9. The ESLint guard blocks `createServiceClient` in `app/api/` and `@anthropic-ai/sdk` outside `lib/ai/`. After this story, `route.ts` must still import zero Anthropic SDK symbols directly. All SDK usage stays in `lib/ai/callAI.ts` and `lib/ai/streamChat.ts`.

---

### What This Story Does NOT Implement

The following are in scope for later stories and must not be pre-implemented here:

- **Story 1.3:** Bilingual detection — the specialist prompts include "answer in the same language as the user" as a placeholder; the actual `franc` / heuristic detection is Story 1.3.
- **Story 1.4:** Business Context injection — `streamChat()` accepts `businessContext?` but it remains unset in this story; Story 1.4 populates it from the DB.
- **Story 1.5:** Guidance stance enforcement — specialist prompts include tone guidance as a placeholder; the full enforcement layer is Story 1.5.
- **Story 1.6:** Degraded AI banner — the UI-level degradation banner is Story 1.6; in this story, the silent `general_chat` fallback (AC-7) is the only degradation handling needed.
- **Story 1.7:** Conversational stub creation — the `crm_action` specialist prompt routes correctly but has no tools yet; tools are wired in Story 2.2.
- **Story 1.8:** Deal Intelligence four-layer synthesis — the `deal_intelligence` specialist prompt exists but the full four-layer response structure is Story 1.8.
- **Story 3.2:** Document elicitation flow — a `document_request` bucket is intentionally absent from this story's intent classification. Documents are added to the orchestrator in Story 3.2 when the full elicitation flow is ready. Do not add it here.
- **Conversation persistence:** Messages remain in-memory only. No conversations table exists yet. Context is reconstructed from the messages array on each request.

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- Lint fail: `ARIA_MODELS` imported in `streamChat.ts` but not used after model moved to options. Fix: removed unused import.
- Test fail: ts-node ESM module resolution — test importing from `lib/ai/orchestrator` (has `server-only`) caused `ERR_MODULE_NOT_FOUND`. Fix: rewrote test as fully self-contained (inlines all constants and pure logic), matching the pattern of existing `callAI.test.ts`.

### Completion Notes List

- `classifyIntent` uses `callAI()` with `maxTokens: 50` and `timeoutMs: 5_000` — cheap, fast classification step.
- All four specialist system prompts include "Answer in the same language as the user's message" as a placeholder for Story 1.3's bilingual detection.
- Test at `lib/__tests__/orchestrator.test.ts` (not `__tests__/lib/ai/`) — same directory as other ts-node tests to preserve ts-node CommonJS resolution.
- 13 tests pass covering: parsing, fallback, model routing, and specialist prompt presence.

### File List

**New files:**
- `lib/ai/orchestrator.ts`
- `lib/__tests__/orchestrator.test.ts`

**Modified files:**
- `lib/ai/streamChat.ts` — add `model: AriaModel` and `specialist: string` to `StreamChatOptions`; remove unused `ARIA_MODELS` import
- `lib/ai/index.ts` — add orchestrator exports
- `app/api/chat/route.ts` — remove flat `CHAT_SYSTEM_PROMPT`; add `classifyIntent` intercept
- `package.json` — update test script to include orchestrator test

### Change Log

| Date | Change |
|---|---|
| 2026-06-26 | Created `lib/ai/orchestrator.ts` with `classifyIntent`, `SPECIALIST_SYSTEM_PROMPTS`, `INTENT_MODEL_MAP` |
| 2026-06-26 | Updated `streamChat.ts` to accept `model` and `specialist` parameters |
| 2026-06-26 | Updated `route.ts` to use orchestrator intercept before streaming |
| 2026-06-26 | Added orchestrator exports to `lib/ai/index.ts` |
| 2026-06-26 | Added 13-test suite in `lib/__tests__/orchestrator.test.ts` |
| 2026-06-26 | Fixed unused `ARIA_MODELS` import in `streamChat.ts` (lint) |
| 2026-06-26 | Rewrote test as self-contained to fix ts-node ESM module resolution |
| 2026-06-26 | Code review applied: confidence default 0, clamp, message slice, FALLBACK clone, fence regex |

---

## Senior Developer Review (AI)

**Review Date:** 2026-06-26
**Outcome:** Changes Requested
**Reviewers:** Blind Hunter, Edge Case Hunter, Acceptance Auditor

### Review Follow-ups (AI)

- [x] [Review][Patch] Confidence defaults to 1 on missing field — should be 0 (semantically unknown) [orchestrator.ts:106] — update test A4
- [x] [Review][Patch] Confidence not clamped to [0,1] — add Math.min/Math.max guard [orchestrator.ts:106]
- [x] [Review][Patch] Full conversation history forwarded to classifier — slice to last 3 messages [orchestrator.ts:87]
- [x] [Review][Patch] FALLBACK returned by reference — clone on return to prevent mutation [orchestrator.ts]
- [x] [Review][Patch] Markdown fence regex fragile — improve to handle ` ```json ` with spaces/uppercase [orchestrator.ts:102]
- [x] [Review][Defer] req.json() body not validated — null messages crashes route [route.ts:33] — deferred, pre-existing
- [x] [Review][Defer] Empty messages array crashes Anthropic API — no guard in streamChat [streamChat.ts] — deferred, pre-existing
- [x] [Review][Defer] Classifier serializes before stream — user sees latency [orchestrator.ts] — deferred, architectural
- [x] [Review][Defer] max_tokens hardcoded 4096 in streamChat regardless of model — deferred, pre-existing Story 1.1
- [x] [Review][Defer] No rate-limit before AI calls — deferred, out of scope
- [x] [Review][Defer] streamChat error sentinel visible to user — deferred, pre-existing Story 1.1
- [x] [Review][Defer] businessContext synthetic 'Understood.' turn concerns — deferred, pre-existing Story 1.1
