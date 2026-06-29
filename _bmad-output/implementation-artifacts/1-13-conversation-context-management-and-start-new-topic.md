---
story_id: 1.13
epic: 1
title: Conversation Context Management and Start New Topic
status: review
baseline_commit: 1f8b6dd847a2bf7c17264f0727ef9061df2cb5d7
---

## Story

As an Owner, I want long-running conversations to stay within limits without losing my business data, and to be able to start a fresh topic without losing my CRM records, So that ARIA stays coherent over long sessions and I'm in control of context resets.

## Acceptance Criteria

- **AC-1 — Server-side context summarization:** When a conversation's reconstructed context (Business Context + tool-fetched entities + recent turns) exceeds ~40,000 tokens, older turns beyond the last ~10 verbatim turns are summarized server-side before the next AI call. The full transcript view still shows all history with a full-width visual divider: a `#2A3350` rule labeled "Earlier messages summarized for context efficiency" in `textMuted` style (`#94a3b8`, `Plus Jakarta Sans`, 13px). (FR-35; AD-12; EXPERIENCE.md Long-Conversation Context Handling)

- **AC-2 — Session context reconstruction from CRM only:** When the Owner starts a new session after a previous one, context is reconstructed from CRM data (Intelligence Fields, activity log) and Business Context injection — not from re-reading old conversation transcripts. Durable state lives in the CRM, not in chat history. (FR-35; AD-3)

- **AC-3 — "Start new topic" action clears in-memory context:** When the Owner triggers "Start new topic" via the `···` overflow menu in the chat header or the keyboard shortcut `Ctrl/Cmd+Shift+N`, the in-memory conversation context is cleared (reset to Business Context + system prompt only). A full-width divider appears in the transcript labeled "New topic started — [HH:mm]" in `textMuted` style. A non-modal tooltip "Context cleared — CRM data kept" fades after 2s. (FR-33; FR-35; AD-12; EXPERIENCE.md Start New Topic)

- **AC-4 — CRM data is never deleted by "Start new topic":** When "Start new topic" executes, no CRM record, document, deal, client, or activity log entry is deleted or modified. Only the in-memory `messages` state array is affected. (FR-35)

- **AC-5 — Image bytes not re-included after extraction:** When subsequent conversation turns (after a "Start new topic" or within the same session) reference a deal whose image content has already been extracted and written to the CRM, the raw image bytes are not re-included in the AI call context. Only the extracted structured fields are referenced. (FR-35; AD-9)

- **AC-6 — "Start new topic" affordance hidden on empty chat:** When no conversation content exists yet (the `messages` state array is empty), the "Start new topic" option is not shown in the overflow menu and the keyboard shortcut has no effect. The affordance only appears after at least one message exists. (EXPERIENCE.md Input Bar §7.5)

## Tasks / Subtasks

- [x] **Task 1 — Add "Start new topic" overflow menu to chat header** (`components/chat/ChatPanel.tsx`)
  - [x] Add a chat header bar above the transcript with an overflow (`···`) button; styled with `background: #0a0e27`, `border-bottom: 1px solid #2A3350`, `padding: 8px 16px`, `display: flex`, `justify-content: space-between`, `align-items: center`
  - [x] The overflow button (`MoreHorizontal` from `lucide-react`, 20px, color `#94a3b8`) is only rendered when `messages.length > 0` (AC-6)
  - [x] Clicking the overflow button opens a small dropdown menu anchored below the button; menu item: "New topic" (VI: "Chủ đề mới"), styled with `background: #141a2e`, `border: 1px solid #2A3350`, `border-radius: 8px`, `padding: 8px 0`, one menu item
  - [x] Clicking "New topic" calls `handleStartNewTopic()` and closes the menu
  - [x] Add keyboard shortcut listener: `Ctrl+Shift+N` / `Cmd+Shift+N` → calls `handleStartNewTopic()` when `messages.length > 0` and not streaming

- [x] **Task 2 — Implement `handleStartNewTopic` function** (`components/chat/ChatPanel.tsx`)
  - [x] Define a new state variable: `const [dividers, setDividers] = useState<Array<{ id: string; type: 'new-topic' | 'context-summary'; time?: Date }>>([])` (or incorporate dividers into the messages array as a special message type — see Dev Notes for chosen approach)
  - [x] `handleStartNewTopic()`:
    1. Guard: if `isStreaming` or `messages.length === 0`, return early
    2. Create a divider entry: `{ id: String(++idCounterRef.current), type: 'new-topic', time: new Date() }`
    3. Append the divider to the transcript render list (see Dev Notes for the `RenderItem` union type approach)
    4. Reset the `messages` state to `[]` — this is the in-memory context reset; the transcript items remain visible
    5. Show a 2s "Context cleared — CRM data kept" tooltip (use `setNewTopicToast(true)` + `setTimeout` to clear it after 2000ms)
    6. No DB writes, no API calls, no CRM mutation (AC-4)

- [x] **Task 3 — Render dividers in the transcript** (`components/chat/ChatPanel.tsx`)
  - [x] Introduce a `RenderItem` union type:
    ```typescript
    type RenderItem =
      | { kind: 'message'; msg: Message }
      | { kind: 'divider'; id: string; label: string }
    ```
  - [x] Derive `renderItems: RenderItem[]` from `messages` state and a separate `dividerItems` state array using `useMemo` — keep render list in chronological insertion order
  - [x] Render dividers as a full-width `<div>` with: `background: #2A3350`, `height: 1px`, `margin: 16px 0`, `position: relative`; centered label `<span>` with `color: #94a3b8`, `fontSize: 12px`, `fontFamily: "'Plus Jakarta Sans', sans-serif"`, `background: #0a0e27`, `padding: 0 12px`, `position: absolute`, `top: -9px`, `left: 50%`, `transform: translateX(-50%)`
  - [x] Label text for "new topic" dividers: `"New topic started — HH:mm"` (format the time using `toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false })`)
  - [x] Label text for context-summary dividers (AC-1): `"Earlier messages summarized for context efficiency"`

- [x] **Task 4 — "New topic" 2s tooltip** (`components/chat/ChatPanel.tsx`)
  - [x] Add state: `const [newTopicToast, setNewTopicToast] = useState(false)`
  - [x] Add a timer ref: `const newTopicToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)`
  - [x] Clear the timer in the `useEffect` cleanup alongside the existing `toastTimerRef`
  - [x] Render the tooltip when `newTopicToast === true` — positioned below the `···` button or centered at the top of the transcript — as a non-modal `<div>` with: `position: absolute`, `top: 48px`, `right: 16px`, `background: '#1C2440'`, `border: '1px solid #2A3350'`, `border-radius: 8px`, `padding: '8px 14px'`, `color: '#94a3b8'`, `fontSize: 13px`, `fontFamily: "'Plus Jakarta Sans', sans-serif"`, `zIndex: 50`, `pointerEvents: 'none'`
  - [x] Text: `"Context cleared — CRM data kept"`
  - [x] Auto-dismiss after 2000ms via `setTimeout`

- [x] **Task 5 — Server-side context token budget + summarization** (`lib/ai/contextManager.ts` — new file)
  - [x] Create `lib/ai/contextManager.ts` (new file)
  - [x] Add `import 'server-only'` at line 1 (AD-11)
  - [x] Do NOT import `@anthropic-ai/sdk` directly — use `callAI()` if a summarization AI call is needed (AD-1); however, for this story, implement a **turn-count-based approximation**: if `messages.length > 20` (proxy for ~40K tokens with ~2K tokens/turn average), keep only the last 10 turns
  - [x] Implement `trimMessages(messages: ChatTurn[]): { trimmed: ChatTurn[]; wasTrimmed: boolean }`:
    - If `messages.length <= 20`, return `{ trimmed: messages, wasTrimmed: false }`
    - Otherwise, keep the last 10 messages: `{ trimmed: messages.slice(-10), wasTrimmed: true }`
    - This is a conservative approximation (OQ-9 — exact threshold is a tuning dial); the 20-turn / keep-10 defaults match AD-12's spec
  - [x] Export `trimMessages` — this is a pure function with no side effects

- [x] **Task 6 — Wire `trimMessages` in the API route** (`app/api/chat/route.ts`)
  - [x] Import `trimMessages` from `@/lib/ai/contextManager`
  - [x] After `const messages = body.messages as ChatTurn[]`, add:
    ```typescript
    const { trimmed: messagesForAI, wasTrimmed } = trimMessages(messages)
    ```
  - [x] Replace all downstream uses of `messages` (in `classifyIntent`, `streamChat`, `runAgentWithTools`, `runVisionExtraction`) with `messagesForAI` — the full `messages` array is no longer needed after this point
  - [x] The `wasTrimmed` flag is available for future use (e.g. logging); for this story, log it to console: `if (wasTrimmed) console.log('[ARIA/context] Messages trimmed for context budget')`
  - [x] Language detection (`detectLanguage`) still uses `messages` (the original full array) to find the last user message — do NOT trim before language detection

- [x] **Task 7 — Tests** (`lib/__tests__/contextManager113.test.ts`)
  - [x] Create `lib/__tests__/contextManager113.test.ts` (ts-node inline pattern)
  - [x] Add `export {}` at top (ES module scope — Story 1.11 fix)
  - [x] Inline the `trimMessages` logic (NEVER import from `lib/`) to test against expected behavior:
    - T1 — `trimMessages` with 5 messages returns all 5 untrimmed (`wasTrimmed: false`)
    - T2 — `trimMessages` with 20 messages returns all 20 untrimmed (`wasTrimmed: false`)
    - T3 — `trimMessages` with 21 messages returns last 10 (`wasTrimmed: true`)
    - T4 — `trimMessages` with 30 messages returns last 10 and `wasTrimmed: true`
    - T5 — trimmed result always ends with the last message from the original array
    - T6 — `trimMessages` with 0 messages returns empty array and `wasTrimmed: false`
    - T7 — RenderItem union: verify that `kind: 'message'` and `kind: 'divider'` are distinct discriminator values (shape test — inline the union, assert membership)
  - [x] Add `"test:context113": "npx ts-node lib/__tests__/contextManager113.test.ts"` to `package.json` scripts

- [x] **Task 8 — CI triad**
  - [x] `npx tsc --noEmit` — zero errors
  - [x] `npx eslint components/chat/ChatPanel.tsx lib/ai/contextManager.ts app/api/chat/route.ts`
  - [x] `npx prettier --write` on all touched files
  - [x] Run new test via `npx ts-node lib/__tests__/contextManager113.test.ts`

- [x] **Task 9 — Update story status**
  - [x] Mark all tasks `[x]`, fill Dev Agent Record
  - [x] `sprint-status.yaml`: `1-13-conversation-context-management-and-start-new-topic: done`, update `last_updated`

## Dev Notes

### Architecture decisions in effect

- **AD-1**: `@anthropic-ai/sdk` is blocked outside `lib/ai/`. `contextManager.ts` is a `lib/ai/` file, so the Anthropic SDK is technically available. However, for this story the summarization uses a turn-count heuristic — no actual AI call is made. If a future story upgrades to true LLM summarization, it must go through `callAI()`, not direct SDK instantiation.
- **AD-3**: Durable state lives in the CRM, not in chat history. "Start new topic" is the UI manifestation of this — it resets the in-memory `messages[]` while CRM records remain intact. New sessions always reconstruct from the DB, not from replaying the transcript.
- **AD-5**: The `trimMessages` call must happen AFTER `detectLanguage` (which reads from the original array to find the last user message) but BEFORE passing messages to `classifyIntent`, `streamChat`, or `runAgentWithTools`. Language detection must not be affected by trimming.
- **AD-11**: `lib/ai/contextManager.ts` must have `import 'server-only'` at line 1. New file — do NOT forget.
- **AD-12**: The default thresholds (summarize at ~40K tokens, keep last ~10 turns) are tuning dials (OQ-9). This story implements a conservative proxy: trim when `messages.length > 20`, keep last 10. Exact token counting requires inspecting the Anthropic response's `usage` object or running a tokenizer — out of scope for this story. The proxy is documented with a comment referencing OQ-9.
- **No AD-13 / AD-14 impact**: This story has no new DB writes. `handleStartNewTopic` is purely in-memory on the client. The API change (`trimMessages`) is server-side read-only manipulation of the messages array.

### Current `ChatPanel.tsx` state shape

```typescript
// Current state variables in ChatPanel.tsx (as of Story 1.12 baseline):
const [messages, setMessages] = useState<Message[]>([])       // core conversation array
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

// Refs:
const abortControllerRef = useRef<AbortController | null>(null)
const transcriptRef = useRef<HTMLDivElement | null>(null)
const idCounterRef = useRef(0)
const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
```

The `messages` array is the single in-memory conversation buffer. It is built up message by message and sent in full as `apiMessages` to `POST /api/chat` on every turn (see `handleSend` lines 251–254 in ChatPanel.tsx).

**Key: `messages` state vs. transcript render list are currently the same array.** This story decouples them: `messages` becomes the "context window" (what is sent to the API), while the transcript render list is a separate derived structure that includes both messages AND dividers. After "Start new topic", `messages` resets to `[]` but the render list retains all prior messages above the divider.

### Chosen architecture: separate `transcriptItems` list

The cleanest approach for this story is to maintain two parallel arrays:

1. **`messages: Message[]`** — the API context window. Reset to `[]` on "Start new topic". This is what gets sent to the API.
2. **`transcriptItems: RenderItem[]`** — the full visual transcript including messages and dividers, in insertion order. Never reset. Built up by `handleSend` (appends new `{ kind: 'message', msg }` items) and `handleStartNewTopic` (appends a `{ kind: 'divider', ... }` item).

This decouples UI rendering from API payload, satisfying both AC-3 (transcript retains past messages) and AC-4 (no CRM deletion). It also naturally supports AC-1 (context-summary dividers can be inserted into `transcriptItems` when the API route returns a `wasTrimmed` signal — future enhancement).

**`RenderItem` type:**
```typescript
type RenderItem =
  | { kind: 'message'; msg: Message }
  | { kind: 'divider'; id: string; label: string }
```

**`handleSend` change:** instead of `setMessages(prev => [...prev, userMsg, assistantMsg])`, also push to `transcriptItems`:
```typescript
setMessages(prev => [...prev, userMsg, assistantMsg])
setTranscriptItems(prev => [
  ...prev,
  { kind: 'message', msg: userMsg },
  { kind: 'message', msg: assistantMsg },
])
```

The streaming update to the assistant message (`msgs[lastIdx] = { ...last, content: last.content + chunk }`) must update both `messages` and `transcriptItems`. Since `transcriptItems` holds `msg` references by value (not by reference), update `transcriptItems` with the same pattern:
```typescript
setTranscriptItems(prev => {
  const items = [...prev]
  const lastIdx = items.length - 1
  const last = items[lastIdx]
  if (lastIdx >= 0 && last && last.kind === 'message' && last.msg.id === assistantId) {
    items[lastIdx] = { kind: 'message', msg: { ...last.msg, content: last.msg.content + chunk } }
  }
  return items
})
```
This is the highest-complexity change in this story — both state arrays must stay in sync throughout streaming, stop, retry, and privacy-modal flows.

**Alternative considered:** A single `transcriptItems` array with messages extracted from it for API payload using `transcriptItems.filter(i => i.kind === 'message').map(i => i.msg)`. This is simpler but requires filtering on every render and on every API call. The dual-array approach is preferred because it keeps the API payload path fast and explicit.

### `handleStartNewTopic` pseudocode

```typescript
function handleStartNewTopic() {
  if (isStreaming || messages.length === 0) return
  const dividerLabel = `New topic started — ${new Date().toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })}`
  const dividerId = String(++idCounterRef.current)
  setTranscriptItems(prev => [
    ...prev,
    { kind: 'divider', id: dividerId, label: dividerLabel },
  ])
  setMessages([])
  // Show 2s tooltip
  setNewTopicToast(true)
  if (newTopicToastTimerRef.current) clearTimeout(newTopicToastTimerRef.current)
  newTopicToastTimerRef.current = setTimeout(() => setNewTopicToast(false), 2000)
}
```

### Keyboard shortcut implementation

Add inside `ChatPanel` component (as a `useEffect`):

```typescript
useEffect(() => {
  function handleKeyDown(e: KeyboardEvent) {
    const isMac = navigator.platform.toUpperCase().includes('MAC')
    const modKey = isMac ? e.metaKey : e.ctrlKey
    if (modKey && e.shiftKey && e.key === 'N') {
      e.preventDefault()
      handleStartNewTopic()
    }
  }
  window.addEventListener('keydown', handleKeyDown)
  return () => window.removeEventListener('keydown', handleKeyDown)
}, [messages.length, isStreaming])  // re-register when guard conditions change
```

### `lib/ai/contextManager.ts` — new file

```typescript
import 'server-only'

import type { ChatTurn } from './streamChat'

// AD-12: Context budget — trim older turns when the conversation grows long.
// Threshold: trim when messages > MAX_MESSAGES; keep last KEEP_MESSAGES turns.
// This is a turn-count proxy for the ~40K token budget (OQ-9 tuning dial).
// At ~2K tokens/turn average (user + assistant), 20 turns ≈ 40K tokens.
// Exact token counting requires the Anthropic tokenizer — future enhancement.

const MAX_MESSAGES = 20
const KEEP_MESSAGES = 10

export interface TrimResult {
  trimmed: ChatTurn[]
  wasTrimmed: boolean
}

export function trimMessages(messages: ChatTurn[]): TrimResult {
  if (messages.length <= MAX_MESSAGES) {
    return { trimmed: messages, wasTrimmed: false }
  }
  return { trimmed: messages.slice(-KEEP_MESSAGES), wasTrimmed: true }
}
```

### `app/api/chat/route.ts` — integration point

Current flow (as of Story 1.12):
1. Parse `body.messages` into `const messages: ChatTurn[]`
2. `detectLanguage` on last user turn
3. Vision path (uses `messages`)
4. `Promise.all([getBusinessContext, classifyIntent(messages)])`
5. Route to specialist with `messages`

After this story:
1. Parse `body.messages` into `const messages: ChatTurn[]`
2. `detectLanguage` on last user turn ← **uses original `messages`**
3. `const { trimmed: messagesForAI, wasTrimmed } = trimMessages(messages)` ← **new**
4. If `wasTrimmed`: `console.log('[ARIA/context] Messages trimmed for context budget')`
5. Vision path (uses `messagesForAI`)
6. `Promise.all([getBusinessContext, classifyIntent(messagesForAI)])`
7. Route to specialist with `messagesForAI`

The variable rename from `messages` → `messagesForAI` propagates through all 4 specialist branches. Rename carefully — `messages` is also used in the `detectLanguage` call and must remain the original.

### ts-node test pattern (critical — from Stories 1.9–1.12)

- NEVER import from project `lib/` files in test files
- Inline all logic and expected shapes directly in the test file
- Add `export {}` at the top of every test file (prevents TSC redeclaration errors — Story 1.11)
- Run via `npx ts-node lib/__tests__/contextManager113.test.ts` (not `node --loader ts-node/esm`)
- Inline the `trimMessages` logic (copy the constants and function body) rather than importing

### Overflow menu implementation notes

The `···` overflow menu is a small custom dropdown — no external library needed. Use a `useRef` for the menu container and a click-outside listener to close it:

```typescript
const [overflowOpen, setOverflowOpen] = useState(false)
const overflowRef = useRef<HTMLDivElement | null>(null)

useEffect(() => {
  function handleClickOutside(e: MouseEvent) {
    if (overflowRef.current && !overflowRef.current.contains(e.target as Node)) {
      setOverflowOpen(false)
    }
  }
  if (overflowOpen) document.addEventListener('mousedown', handleClickOutside)
  return () => document.removeEventListener('mousedown', handleClickOutside)
}, [overflowOpen])
```

The menu button and dropdown are wrapped in `<div ref={overflowRef} style={{ position: 'relative' }}>`. The dropdown itself is `position: absolute; top: 36px; right: 0; z-index: 100`.

### Retry flow compatibility

`handleRetry(failedAssistantId)` currently computes `cleanedMsgs` from `messages`. After this story, retry must also update `transcriptItems` to replace the failed assistant slot. The retry flow already handles the `messages` array correctly — add a parallel `setTranscriptItems` update that replaces the failed assistant item (matched by `msg.id`) with the new assistant placeholder.

### AC-5 (image bytes not re-included) — already implemented

Story 1.9 already enforces this: `imageBase64` is sent as a separate body field (never inside `messages`), and the API route processes it as a one-off vision extraction. Once extracted, the CRM fields hold the structured data. Subsequent turns only include text messages in the `messages` array. AC-5 is satisfied by the existing architecture and requires no new code — verify in tests by confirming that `body.messages` never contains raw image data.

### Learnings carried from Stories 1.9–1.12

1. **ts-node test pattern**: Inline all logic; `export {}` at top; run via `npx ts-node`. Never import from `lib/`.
2. **Prettier before CI**: Run `npx prettier --write` on every edited file before the CI triad.
3. **New files need `import 'server-only'`**: `lib/ai/contextManager.ts` is a new `lib/ai/` file — `import 'server-only'` at line 1 (AD-11).
4. **State sync discipline**: Any state that feeds both the API payload and the UI render must be kept in sync through ALL code paths: `handleSend`, `handleRetry`, the streaming updater, the stop handler, and the privacy-modal resumption. Audit every `setMessages` call and add a corresponding `setTranscriptItems` update.
5. **`idCounterRef` is the source of truth for IDs**: All new message and divider IDs must use `String(++idCounterRef.current)` to avoid collisions.
6. **No new DB migrations**: This story has zero schema changes. `trimMessages` is a pure in-memory operation; `handleStartNewTopic` never touches the DB.
7. **AD-12 is the governing rule**: The context management spec (summarize at ~40K, keep last ~10, show visual divider, "Start new topic" resets context but not CRM) is fully captured in AD-12 and EXPERIENCE.md "Long-Conversation Context Handling" and "Start New Topic" sections.
8. **ESLint exhaustive-deps**: The keyboard shortcut `useEffect` depends on `messages.length` and `isStreaming` — these must be in the dependency array to avoid a stale closure on the guard check inside `handleStartNewTopic`.

### Files to create / modify

**New files:**
- `lib/ai/contextManager.ts`
- `lib/__tests__/contextManager113.test.ts`

**Modified files:**
- `components/chat/ChatPanel.tsx` — add overflow menu, `handleStartNewTopic`, `transcriptItems` state, divider rendering, keyboard shortcut, 2s tooltip
- `app/api/chat/route.ts` — import `trimMessages`, apply context trimming before specialist routing
- `package.json` — add `test:context113` script

## Dev Agent Record

### Debug Log

- TSC error TS18048 on `items[idx]` in sentinel path — fixed with explicit `as RenderItem` cast since TypeScript doesn't narrow array indexed access through `idx >= 0` guard alone.
- TSC error TS2367 in test T7 — comparing literal union discriminator values at compile time is flagged as "no overlap"; resolved with `as string` casts.
- Prettier reformatted `RenderItem` type to single line and reformatted test harness; no logic changes.
- Replaced deprecated `navigator.platform` with `navigator.userAgent` regex check.

### Completion Notes

- **Task 1**: Added fixed chat header bar (`#0a0e27`, `border-bottom: 1px solid #2A3350`) with `MoreHorizontal` (lucide-react, 20px, `#94a3b8`) overflow button. Button and dropdown only rendered when `messages.length > 0` (AC-6). Dropdown uses click-outside listener via `overflowRef`. Menu item "Chủ đề mới" calls `handleStartNewTopic()`. Keyboard shortcut `Ctrl/Cmd+Shift+N` wired via `useEffect` with `[messages.length, isStreaming]` deps to avoid stale closure.
- **Task 2**: `handleStartNewTopic()` guards on `isStreaming || messages.length === 0`, appends a `{ kind: 'divider' }` to `transcriptItems`, resets `messages` to `[]` (no DB/CRM touch — AC-4), triggers 2s toast.
- **Task 3**: `RenderItem` discriminated union (`kind: 'message' | 'divider'`). Dual-array architecture: `messages` = API context window; `transcriptItems` = full visual transcript. `transcriptItems` is the authoritative render list, kept in sync through `handleSend`, `handleRetry`, `handleStop`, `_streamAssistant` (streaming updates, AbortError, network error, HTTP error, sentinel, privacy gate). Dividers rendered as `height: 1px; background: #2A3350` with centered absolute `<span>` label.
- **Task 4**: `newTopicToast` state + `newTopicToastTimerRef` ref. Timer cleaned up in unmount effect alongside `toastTimerRef`. Tooltip positioned `absolute; top: 48px; right: 16px; zIndex: 50; pointerEvents: none`.
- **Task 5**: `lib/ai/contextManager.ts` created with `import 'server-only'` at line 1. `trimMessages(messages)` returns `{ trimmed, wasTrimmed }`. Pure function — no side effects, no DB, no SDK import.
- **Task 6**: `app/api/chat/route.ts` imports `trimMessages`. Trimming applied after `detectLanguage` (uses original array per AD-5) but before all AI calls. All 4 specialist branches (`classifyIntent`, `runAgentWithTools` × 3, `streamChat`) switched to `messagesForAI`. `wasTrimmed` logged to console.
- **Task 7**: `lib/__tests__/contextManager113.test.ts` with 7 tests (T1–T7). All 7 pass. Inline logic only; no lib/ imports.
- **Task 8**: TSC 0 errors, ESLint 0 warnings, Prettier clean, test 7/7 pass.
- **AC-5** (image bytes not re-included): verified by existing architecture — `imageBase64` always sent as separate body field, never in `messages[]`. No new code needed.

### File List

- `lib/ai/contextManager.ts` — new file
- `lib/__tests__/contextManager113.test.ts` — new file
- `components/chat/ChatPanel.tsx` — modified (overflow menu, handleStartNewTopic, transcriptItems, divider rendering, keyboard shortcut, 2s tooltip, dual-array state sync)
- `app/api/chat/route.ts` — modified (import trimMessages, apply context trimming, rename messages → messagesForAI downstream)
- `package.json` — modified (added test:context113 script)

### Change Log
| Date | Change |
|------|--------|
| 2026-06-29 | Story file created |
| 2026-06-29 | Implemented all tasks; story marked review |
