---
story: 1.1
epic: 1
status: done
baseline_commit: c2efd6a6ade5402913cd2210c48e68cd71ad970c
---

# Story 1.1: Chat UI Shell — Markdown Rendering, Streaming, Stop, and Copy

Status: done

## Story

As an Owner, I want a fully functional chat interface that renders ARIA's responses as formatted text, streams replies in real time, lets me stop generation, and lets me copy any message, so that every subsequent epic can deliver readable, interactive responses from day one.

## Acceptance Criteria

**AC-1: Markdown rendering with design-system typography**

**Given** the Owner is authenticated and on the Chat panel,
**When** ARIA sends a response containing Markdown (headers, bullets, bold, tables, inline code, fenced code blocks),
**Then** the rendered output displays formatted content — not raw Markdown symbols — using Plus Jakarta Sans for prose and JetBrains Mono for code blocks, consistent with DESIGN.md tokens. (FR-32, FR-33)

**AC-2: Streaming cursor and Stop button appearance**

**Given** ARIA is generating a response,
**When** the first token arrives,
**Then** a blinking streaming cursor appears at the end of the in-progress text and the Send button is replaced by a "Stop" button (Lucide `Square` icon, label "Dừng lại" / "Stop", `#F87171` color, 44px min touch target). The input field is disabled during streaming. (FR-33; EXPERIENCE.md Stop Generation)

**AC-3: Stop generation commits partial response**

**Given** the Owner taps/clicks "Stop" while ARIA is streaming,
**When** the action completes,
**Then** the partial response is committed to the transcript with a "(stopped)" suffix in `#94A3B8` (`textMuted`) color, the Stop button reverts to Send, and the input field re-enables immediately. (FR-33; EXPERIENCE.md Stop Generation)

**AC-4: Long-message collapse with "Read more"**

**Given** an ARIA message is longer than 400 rendered characters,
**When** the message is displayed,
**Then** only the first ~400 chars are shown with a "Read more" affordance; tapping "Read more" expands the full message; the expanded state persists for that message within the session. (FR-33; §8 NFRs)

**AC-5: Copy to plain text with checkmark confirmation**

**Given** the Owner hovers over (desktop) or long-presses (mobile) any ARIA message,
**When** the copy affordance appears,
**Then** clicking/tapping it copies the message as plain text (no Markdown syntax); the icon briefly shows a Lucide `Check` checkmark for 1.5s; no toast is shown. (FR-33; EXPERIENCE.md Copy)

**AC-6: Mobile-responsive layout**

**Given** the Owner is on a mobile viewport (< 768px),
**When** the Chat panel renders,
**Then** the layout is single-column with the input bar pinned to the bottom; the sidebar is hidden and replaced by a bottom tab bar. (FR-32; DESIGN.md §4)

**AC-7: Message timestamps**

**Given** any ARIA or user message,
**When** a timestamp is rendered,
**Then** it shows "HH:mm" for same-day messages and "ddd HH:mm" for older ones, in `#94A3B8` (`textMuted`) style, below the bubble and always visible (not only on hover). (EXPERIENCE.md Chat Message)

**AC-8: Bubble styling per design system**

**Given** any message bubble,
**When** rendered,
**Then** the user bubble is right-aligned with background `#1C2440`, radius `12px 12px 4px 12px`; the ARIA bubble is left-aligned with background `#141A2E`, a `2px solid #14B8A6` left-border accent, and radius `12px 12px 12px 4px`. (DESIGN.md §7.1)

**AC-9: Privacy notice gate before first AI call**

**Given** the Owner sends a message for the first time in a session that would trigger an Anthropic API call,
**When** the server checks for privacy notice acknowledgement,
**Then** if `ai_processing_notice_acknowledged_at` is NULL in `settings`, the server returns `{ requiresAcknowledgement: true }`, the `PrivacyNoticeModal` from Story 0.8 is shown, and the AI call is not made until the Owner acknowledges. After acknowledgement, the original message is re-submitted automatically. (AD-10; Story 0.8)

**AC-10: Degradation envelope on streaming errors**

**Given** the streaming API call returns an error, times out (> ~10s to first token), or is rate-limited,
**When** the error is caught by the route handler,
**Then** the stream terminates with a graceful error message inline in the chat ("Something went wrong. [Retry]") rather than hanging or crashing; the Send button re-enables; no unhandled exception propagates to the client. (AD-6; FR-5)

**AC-11: Input bar — send, newline, disabled state**

**Given** the chat input bar is rendered,
**When** the Owner interacts with it,
**Then** `Enter` sends the message, `Shift+Enter` inserts a newline, the textarea auto-grows from 1 to max 5 lines; the input bar is disabled (non-interactive, visually dimmed) while ARIA is streaming. (EXPERIENCE.md Interaction Primitives; DESIGN.md §7.5)

**AC-12: Three-mode shell layout with sidebar**

**Given** the authenticated app shell renders at desktop viewport (≥ 1024px),
**When** the Chat panel is the active mode,
**Then** a left sidebar (240px) shows the ARIA wordmark and nav items (Chat, Briefing, Documents, Settings), and the main panel fills the remainder with the chat transcript and input bar. (FR-32; DESIGN.md §4)

---

## Tasks / Subtasks

- [x] **Task 1: Install `react-markdown` and configure rendering** (AC-1)
  - [x] Run `npm install react-markdown remark-gfm` — `react-markdown` is not in `package.json` yet; `remark-gfm` enables GitHub-Flavored Markdown (tables, strikethrough, task lists)
  - [x] Optionally install `react-syntax-highlighter` (or equivalent) for fenced code block syntax highlighting
  - [x] Create `components/chat/MarkdownRenderer.tsx` — a thin wrapper around `ReactMarkdown` that:
    - Uses `remark-gfm` plugin
    - Maps `code` component to JetBrains Mono on `#0A0E27` background with `#2A3350` border (DESIGN.md §3 — Markdown Rendering in Chat)
    - Maps `h1`, `h2`, `h3` to Plus Jakarta Sans at the correct sizes from DESIGN.md §3 type scale
    - Maps `p` to 15px / 1.65 line-height `#E2E8F0`
    - Never renders raw markdown symbols in output

- [x] **Task 2: Create the streaming route handler** (AC-2, AC-3, AC-9, AC-10)
  - [x] Create `app/api/chat/route.ts` — a Next.js Route Handler (not a Server Action — Server Actions do not support streaming)
  - [x] The handler accepts `POST` with body `{ messages: Array<{ role: 'user'|'assistant', content: string }>, conversationId?: string }`
  - [x] Validate the session via `supabase.auth.getUser()` (same pattern as all prior route handlers); return 401 if missing
  - [x] Call `isPrivacyNoticeAcknowledged(ownerId)` from `lib/privacy/checkPrivacyNotice.ts` (Story 0.8); if not acknowledged return `{ requiresAcknowledgement: true, status: 'awaiting_privacy_ack' }` with HTTP 200 (not an error; the client handles this as a modal trigger)
  - [x] Construct the streaming client within `lib/ai/streamChat.ts` (server-only module, `import 'server-only'`) — this keeps all Anthropic SDK usage inside `lib/ai/` as required by AD-1
  - [x] Apply the prompt-cache-friendly assembly order (AD-5): system prompt with `cache_control`, then business context with `cache_control`, then volatile conversation turns
  - [x] Use `ARIA_MODELS.highJudgment` (`claude-sonnet-4-6`) for the chat specialist in this story
  - [x] Stream the response as a `ReadableStream` with `Content-Type: text/plain; charset=utf-8`
  - [x] Handle errors gracefully: error sentinel written to stream before closing (AD-6)
  - [x] Log token usage after stream closes via `stream.finalMessage()`

- [x] **Task 3: Create the chat page and layout shell** (AC-6, AC-12)
  - [x] Convert `app/page.tsx` from placeholder to render `AppShell`
  - [x] Update `app/layout.tsx` with globals.css import (`lang="vi"` already set)
  - [x] Create `components/layout/AppShell.tsx` — three-mode shell with sidebar, main panel, bottom tab bar
  - [x] In this story, only Chat panel is functional; Briefing/Documents/Settings show placeholder

- [x] **Task 4: Create the ChatPanel component** (AC-1, AC-2, AC-3, AC-4, AC-5, AC-7, AC-8, AC-11)
  - [x] Create `components/chat/ChatPanel.tsx` — manages messages state, isStreaming, expandedMessages
  - [x] Create `components/chat/MessageBubble.tsx` — user/ARIA bubbles with design tokens, timestamps, copy button, "(stopped)" suffix
  - [x] Implement the collapse rule (AC-4) — > 400 chars → maxHeight clamp + gradient fade + "Read more"
  - [x] Streaming cursor (`aria-streaming-cursor` CSS class, `prefers-reduced-motion` handled)
  - [x] `aria-live="polite"` on ARIA message container

- [x] **Task 5: Create the InputBar component** (AC-2, AC-3, AC-11)
  - [x] Create `components/chat/InputBar.tsx` — textarea auto-grow, Enter/Shift+Enter, Escape stop, Send/Stop toggle

- [x] **Task 6: Wire streaming send in ChatPanel** (AC-2, AC-3, AC-10)
  - [x] `handleSend(text, isRetry)` — builds API payload, adds user+assistant slots to state, streams response
  - [x] `handleStop()` — aborts AbortController, marks message stopped
  - [x] Auto-scroll transcript on messages change

- [x] **Task 7: Integrate PrivacyNoticeModal** (AC-9)
  - [x] Privacy modal shown when server returns `{ requiresAcknowledgement: true }`
  - [x] On acknowledge: re-calls `handleSend` with `isRetry=true` (user message already in state)

- [x] **Task 8: Install fonts and configure global styles** (AC-1, AC-8)
  - [x] Created `app/globals.css` with Google Fonts import, base body styles, streaming cursor, responsive sidebar classes
  - [x] `lang="vi"` on html element (already present in layout.tsx)

- [x] **Task 9: CI checks** (all ACs)
  - [x] `npm run lint` passes
  - [x] `npx tsc --noEmit` passes
  - [x] `npm run format:check` passes
  - [x] `npm run build` completes without error

---

## Dev Notes

### Architecture Constraints (Non-Negotiable)

**AD-1 — Orchestrator + tool-calling paradigm:**
The client (`ChatPanel`) never calls the Claude API directly. All AI calls run server-side via `app/api/chat/route.ts`. In this story, the route handler acts as a placeholder orchestrator (no intent classification yet — that is Story 1.2). The route handler must import the streaming helper from `lib/ai/` exclusively — not from `app/`. This keeps the ESLint guard from Story 0.6 meaningful: `createServiceClient` is disallowed in `app/api/`, and all Anthropic SDK usage stays in `lib/ai/`.

**AD-5 — Prompt-caching discipline:**
Even in this foundational story, the streaming route handler must assemble the prompt in cache-friendly order: (1) system prompt with `cache_control: { type: "ephemeral" }`, (2) Business Context block (placeholder for now — can be an empty string or the default system copy) with a second `cache_control` breakpoint, (3) volatile conversation turns (no timestamps or UUIDs before the last breakpoint). This order must be established now so Story 1.4 (Business Context Injection) can simply plug in the real context without changing the assembly order.

**AD-6 — Graceful degradation envelope:**
The streaming route handler must not let an API error or timeout result in a hanging client. The standard `AIEnvelope` type from `lib/ai/callAI.ts` does not apply directly to streaming responses, but the same *intent* applies: always write something to the stream and close it cleanly, even on error. See the streaming implementation pattern below.

**AD-10 — Privacy notice gate:**
Every message that would trigger an Anthropic API call must first check `isPrivacyNoticeAcknowledged(ownerId)` from `lib/privacy/checkPrivacyNotice.ts`. This is the same function established in Story 0.8. The gate lives in the route handler (server side), not in the client — the client only shows the modal when the server signals it is needed.

**AD-13 — Auth boundary:**
The route handler must use `createServerClient()` (never `createServiceClient()`) for any Supabase access. The session is validated via `supabase.auth.getUser()` before any other processing.

**AD-11 — Secret custody:**
The Anthropic API key is read from `process.env.ANTHROPIC_API_KEY` via `getAnthropicApiKey()` in `lib/secrets.ts`. The streaming route handler uses `lib/ai/streamChat.ts` which calls `getAnthropicApiKey()` internally — the key never travels to the client.

### Streaming Implementation Pattern

`callAI()` in `lib/ai/callAI.ts` does non-streaming (`client.messages.create()`). For streaming, create a new server-only module `lib/ai/streamChat.ts`:

```typescript
import 'server-only'
import Anthropic from '@anthropic-ai/sdk'
import { getAnthropicApiKey } from '@/lib/secrets'
import { ARIA_MODELS } from './models'

export interface StreamChatOptions {
  systemPrompt: string
  businessContext?: string
  messages: Anthropic.MessageParam[]
}

/**
 * Returns a ReadableStream of text chunks for use in a Next.js Route Handler.
 * Uses client.messages.stream() from the Anthropic SDK.
 * Caller is responsible for piping this stream to the HTTP response.
 */
export function streamChat(options: StreamChatOptions): ReadableStream<Uint8Array> {
  const client = new Anthropic({ apiKey: getAnthropicApiKey() })
  const encoder = new TextEncoder()

  const system: Anthropic.TextBlockParam[] = [
    {
      type: 'text',
      text: options.systemPrompt,
      cache_control: { type: 'ephemeral' },
    },
  ]

  const messages: Anthropic.MessageParam[] = []

  if (options.businessContext) {
    messages.push({
      role: 'user',
      content: [
        {
          type: 'text',
          text: `<business_context>\n${options.businessContext}\n</business_context>`,
          cache_control: { type: 'ephemeral' },
        },
      ],
    })
    messages.push({ role: 'assistant', content: 'Understood.' })
  }

  messages.push(...options.messages)

  return new ReadableStream({
    async start(controller) {
      try {
        const stream = client.messages.stream(
          {
            model: ARIA_MODELS.highJudgment,
            max_tokens: 4096,
            system,
            messages,
          },
          {
            headers: { 'anthropic-beta': 'prompt-caching-2024-07-31' },
          }
        )

        for await (const chunk of stream) {
          if (
            chunk.type === 'content_block_delta' &&
            chunk.delta.type === 'text_delta'
          ) {
            controller.enqueue(encoder.encode(chunk.delta.text))
          }
        }

        // Log token usage after stream completes (AD-5 observability)
        const finalMessage = await stream.finalMessage()
        const usage = finalMessage.usage
        console.log('[ARIA/stream]', JSON.stringify({
          model: ARIA_MODELS.highJudgment,
          specialist: 'chat',
          input_tokens: usage.input_tokens,
          output_tokens: usage.output_tokens,
          cache_read_input_tokens: (usage as Record<string, unknown>).cache_read_input_tokens ?? 0,
          cache_creation_input_tokens: (usage as Record<string, unknown>).cache_creation_input_tokens ?? 0,
        }))

        controller.close()
      } catch (err) {
        // AD-6: never leave the client hanging — write an error sentinel and close
        const errMsg = err instanceof Error ? err.message : 'Unknown error'
        controller.enqueue(
          encoder.encode(`\n\n[ARIA error: ${errMsg}]`)
        )
        controller.close()
      }
    },
  })
}
```

**Route handler (`app/api/chat/route.ts`) pattern:**

```typescript
import { createServerClient } from '@/lib/supabase/server'
import { isPrivacyNoticeAcknowledged } from '@/lib/privacy/checkPrivacyNotice'
import { streamChat } from '@/lib/ai/streamChat'
import { NextRequest } from 'next/server'

const CHAT_SYSTEM_PROMPT = `You are ARIA, an AI business consultant for a Vietnamese service agency founder. 
Answer helpfully in the same language as the user's message (Vietnamese or English). 
Be direct, analytical, and explain your reasoning.`

export async function POST(req: NextRequest) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }

  const acknowledged = await isPrivacyNoticeAcknowledged(user.id)
  if (!acknowledged) {
    return new Response(
      JSON.stringify({ requiresAcknowledgement: true, status: 'awaiting_privacy_ack' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const body = await req.json()
  const { messages } = body

  const stream = streamChat({
    systemPrompt: CHAT_SYSTEM_PROMPT,
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

### Client-Side Streaming Read Pattern

In `ChatPanel`, reading the stream:

```typescript
const response = await fetch('/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ messages: apiMessages }),
  signal: abortControllerRef.current.signal, // AbortController for Stop
})

if (!response.ok) { /* handle error */ return }

const body = await response.json().catch(() => null)
if (body?.requiresAcknowledgement) {
  setShowPrivacyModal(true)
  setPendingMessage(text)
  setIsStreaming(false)
  return
}

// Streaming path
const reader = response.body!.getReader()
const decoder = new TextDecoder()

while (true) {
  const { done, value } = await reader.read()
  if (done) break
  const chunk = decoder.decode(value, { stream: true })
  // Append chunk to in-progress assistant message
  setMessages(prev => {
    const msgs = [...prev]
    msgs[msgs.length - 1] = {
      ...msgs[msgs.length - 1],
      content: msgs[msgs.length - 1].content + chunk,
    }
    return msgs
  })
}
setIsStreaming(false)
```

Store `abortControllerRef.current` as a `useRef<AbortController>` and call `abortControllerRef.current.abort()` in `handleStop()`.

### Dependency: `react-markdown` Not Yet Installed

`package.json` does not include `react-markdown` or `remark-gfm`. These must be installed before Task 1. Minimum versions:
- `react-markdown`: `^9.0.0` (compatible with React 18)
- `remark-gfm`: `^4.0.0`

Run: `npm install react-markdown remark-gfm`

For syntax highlighting in code blocks, `react-syntax-highlighter` is the standard choice, but it adds bundle weight. An acceptable lighter alternative is `highlight.js` with selective language imports. If syntax highlighting adds excessive complexity, ship the code block styling (monospace font, dark background, border) without syntax coloring in v1 — the design system does not mandate syntax coloring, only the font and background.

### File Structure to Create

```
app/
  api/
    chat/
      route.ts              ← POST streaming handler
  page.tsx                  ← Update to render AppShell → ChatPanel (replace placeholder)
  layout.tsx                ← Update to add font imports and base styles
lib/
  ai/
    streamChat.ts           ← NEW: server-only streaming wrapper (uses client.messages.stream())
components/
  layout/
    AppShell.tsx            ← NEW: three-mode shell (sidebar + main panel + bottom tab bar)
  chat/
    ChatPanel.tsx           ← NEW: 'use client'; manages messages state + streaming
    MessageBubble.tsx       ← NEW: renders a single user or ARIA message
    InputBar.tsx            ← NEW: 'use client'; textarea + Send/Stop button
    MarkdownRenderer.tsx    ← NEW: react-markdown wrapper with DESIGN.md tokens
```

### Design Token Quick Reference (from DESIGN.md)

| Token | Value |
|---|---|
| `bg` | `#0A0E27` |
| `surface` | `#141A2E` |
| `surfaceRaised` | `#1C2440` |
| `border` | `#2A3350` |
| `primary` | `#14B8A6` |
| `text` | `#E2E8F0` |
| `textMuted` | `#94A3B8` |
| `danger` | `#F87171` |
| ARIA bubble radius | `12px 12px 12px 4px` |
| User bubble radius | `12px 12px 4px 12px` |
| ARIA bubble left border | `2px solid #14B8A6` |
| Body font | Plus Jakarta Sans, 15px, 1.65 line-height |
| Mono font | JetBrains Mono, 13px, 1.6 line-height |
| Chat column max-width | 760px (centered) |
| Main panel max-width | 1040px |

### Previous Story Learnings Applied

From **Story 0.6** (auth/service-role boundary):
1. The ESLint rule disallowing `createServiceClient` in `app/api/` is active. The chat route handler must use `createServerClient()` exclusively. Run `npm run lint` before committing to catch any accidental import.
2. Do not import the Anthropic SDK directly in `app/api/chat/route.ts` — route it through `lib/ai/streamChat.ts`. This keeps the AI SDK contained in `lib/ai/` where the architecture expects it (AD-1).

From **Story 0.7** (AI call wrapper):
3. The `streamChat.ts` module must begin with `import 'server-only'` to prevent it from being accidentally bundled into the client. This is the established pattern for all `lib/ai/` and `lib/` modules.
4. Token logging is mandatory (AD-5 observability): log `{ model, specialist, input_tokens, output_tokens, cache_read_input_tokens, cache_creation_input_tokens }` after the stream closes using `stream.finalMessage()`.

From **Story 0.8** (privacy notice):
5. `isPrivacyNoticeAcknowledged(ownerId)` is already implemented in `lib/privacy/checkPrivacyNotice.ts`. Import it directly — do not re-implement the check.
6. `PrivacyNoticeModal` is already implemented in `components/PrivacyNoticeModal.tsx`. Import and use it — do not create a new modal component.
7. The modal must not be dismissible without explicit acknowledgement. The POST to `/api/privacy/acknowledge` is the only valid acknowledgement path.

From **Story 0.4** (auth):
8. Session validation via `supabase.auth.getUser()` before any logic — return 401 immediately if no valid session. Do not skip this step.

### CI Triad

Run in sequence before committing:
```
npm run lint
npx tsc --noEmit
npm run format:check
npm run build
```

The build check (`npm run build`) is newly added for this story because streaming route handlers and `'use client'` / `'use server'` boundaries are a common source of Next.js build errors that are not caught by `tsc` alone.

### What This Story Does NOT Implement

The following are in scope for later stories and must **not** be pre-implemented here:
- **Story 1.2:** Intent classification and routing (all messages go to a single system prompt in this story)
- **Story 1.3:** Bilingual detection (the system prompt mentions bilingual behavior as a placeholder; the actual detection logic is Story 1.3)
- **Story 1.4:** Business Context injection (the `businessContext` parameter in `streamChat` is wired up but passes an empty string for now)
- **Story 1.6:** Degraded AI banner (the graceful degradation in AC-10 covers the inline error case; the full degraded banner with DESIGN.md styling is Story 1.6)
- **Story 1.9:** Vision / image upload (the paperclip icon in the input bar is Story 1.9; do NOT add it in this story)
- **Story 1.13:** "Start new topic" (the overflow menu and `Ctrl+Shift+N` shortcut are Story 1.13)
- **Story 1.14:** First-run welcome card (the empty state is just an empty transcript in this story)
- **Conversation persistence:** Messages are in-memory only in this story. No `conversations` table exists yet. The server reconstructs context from the messages array sent with each request.

---

## Dev Agent Record

### Agent Model Used

### Debug Log References

None

### Completion Notes List

(none yet)

### File List

**New files:**
- `app/globals.css`
- `app/api/chat/route.ts`
- `lib/ai/streamChat.ts`
- `components/layout/AppShell.tsx`
- `components/chat/ChatPanel.tsx`
- `components/chat/MessageBubble.tsx`
- `components/chat/InputBar.tsx`
- `components/chat/MarkdownRenderer.tsx`

**Modified files:**
- `app/layout.tsx` — added globals.css import
- `app/page.tsx` — replaced placeholder with AppShell render
- `lib/ai/index.ts` — added streamChat exports
- `package.json` — added react-markdown, remark-gfm, lucide-react
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
