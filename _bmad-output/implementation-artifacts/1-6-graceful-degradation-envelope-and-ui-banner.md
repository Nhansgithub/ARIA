---
story: 1.6
epic: 1
status: review
baseline_commit: 91cf3f9003d24a6f18a53efbfcc59c8aa1d742f8
---

# Story 1.6: Graceful Degradation Envelope and UI Banner

## Story

As an Owner, I want ARIA to always return something useful — even when the Claude API is unavailable — and to tell me clearly when AI synthesis is offline, so that I am never left with an unhandled error or an infinite spinner.

---

## Acceptance Criteria

**AC-1: Degraded-AI banner appears on API error/timeout/rate-limit**

**Given** the Claude API returns an error, times out (> ~10s to first token), or is rate-limited,
**When** the degradation condition is detected (sentinel `[ARIA error: ...]` found in streamed content),
**Then** a full-width degraded-AI banner appears at the top of the main panel with exact copy:
- EN: `"AI synthesis is temporarily unavailable — showing raw data. Analysis will resume when the connection recovers."`
- VI: `"AI tạm thời không khả dụng — đang hiển thị dữ liệu thô. Phân tích sẽ trở lại khi kết nối phục hồi."`

The banner uses `rgba(245,158,11,0.12)` background, `1px solid rgba(245,158,11,0.40)` border, `#FBBF24` text, and a Lucide `AlertTriangle` icon in `#F59E0B` (color is **not** the sole indicator — icon is required). (FR-5; AD-6; DESIGN.md §7.8)

**AC-2: Degraded response shows friendly message + Retry link**

**Given** the Owner sends a message while the AI is degraded,
**When** the stream contains the error sentinel `[ARIA error: ...]`,
**Then** the degraded assistant bubble replaces the raw sentinel with the message: `"AI synthesis is temporarily unavailable. [Retry]"` (VI: `"AI tạm thời không khả dụng. [Thử lại]"`) — no AI synthesis, no recommendations; the `[Retry]` is a clickable control that re-sends the last user message. (FR-5; AD-6)

**AC-3: No unhandled exception or infinite spinner**

**Given** any AI-backed operation,
**When** an error occurs,
**Then** no interaction results in an unhandled exception or an indefinite spinner; the UI always resolves to a readable state. (AD-6)

**AC-4: Banner auto-dismisses on API recovery**

**Given** the API recovers after a degraded period,
**When** the next ARIA response streams successfully (no sentinel detected),
**Then** the banner auto-dismisses without user action; the Owner does not need to manually clear the degraded state. (FR-5; EXPERIENCE.md Degraded State)

**AC-5: Network-loss toast with Retry + preserved input**

**Given** a network-lost error mid-message (fetch throws — distinct from user clicking Stop or API returning an error response),
**When** the error occurs,
**Then** a toast appears (VI: `"Mất kết nối. Thử lại không, Anh?"` / EN: `"Lost connection. Retry?"`) with a [Retry] CTA; the message text is restored to the input bar so the Owner can re-send; the blank assistant bubble is removed. (EXPERIENCE.md Error)

**AC-6: Briefing fallback sub-banner** *(deferred — Briefing not yet implemented)*

**Given** the daily Briefing generation fails due to API unavailability,
**When** the Briefing panel loads,
**Then** the last successfully cached Briefing is displayed with a sub-banner: `"Dữ liệu từ [time]"` / `"Data from [time]."` — **DEFERRED to Epic 4** because Briefing is a Placeholder in AppShell. No implementation needed here.

---

## Tasks / Subtasks

- [x] **Task 1: Create `DegradedBanner` component** (AC-1)
  - [x] Create `components/chat/DegradedBanner.tsx` — new component
  - [x] Banner is full-width with `margin: 8px 16px`, `padding: 10px 16px`, `borderRadius: 8px`
  - [x] Background: `rgba(245,158,11,0.12)`; border: `1px solid rgba(245,158,11,0.40)`
  - [x] Left icon: `AlertTriangle` from `lucide-react`, size 16, color `#F59E0B` — **required** (not optional)
  - [x] Text: `#FBBF24`, 13px, weight 500
  - [x] EN copy: `"AI synthesis is temporarily unavailable — showing raw data. Analysis will resume when the connection recovers."`
  - [x] VI copy: `"AI tạm thời không khả dụng — đang hiển thị dữ liệu thô. Phân tích sẽ trở lại khi kết nối phục hồi."`
  - [x] Props: `{ lang: 'vi' | 'en', onDismiss: () => void }` — dismissible via X button on right
  - [x] `role="alert"` for screen readers; X button: `aria-label="Dismiss degraded banner / Đóng thông báo"`
  - [x] X dismiss button: ghost, right-aligned, `#94a3b8`, hover `#e2e8f0`

- [x] **Task 2: Add sentinel detection + degraded state to `ChatPanel.tsx`** (AC-1, AC-2, AC-3, AC-4)
  - [x] Add state: `const [isDegraded, setIsDegraded] = useState(false)`
  - [x] Add state: `const [degradedLang, setDegradedLang] = useState<'vi' | 'en'>('en')` — tracks language for banner copy
  - [x] After stream ends in `handleSend`, check if the final assistant message content contains `'[ARIA error:'`
    - If sentinel detected: call `setIsDegraded(true)`; strip sentinel from content; mark message as `degraded: true`
    - If no sentinel: call `setIsDegraded(false)` (auto-dismiss on recovery — AC-4)
  - [x] Pass detected language to banner: derive `degradedLang` from `detectLanguage(lastUserMsg.content)` at send time, store via `setDegradedLang`
  - [x] Render `<DegradedBanner>` ABOVE the transcript `<div>` (inside the outer flex column, between the top of ChatPanel and the transcript scroll area)
  - [x] Banner onDismiss: `setIsDegraded(false)` — allows manual dismiss too
  - [x] Extracted `_streamAssistant(apiMessages, assistantId, restoreInputValue?)` shared helper used by both `handleSend` and `handleRetry`

- [x] **Task 3: Add Retry button to degraded assistant messages** (AC-2)
  - [x] Add `degraded?: boolean` field to the `Message` type in `MessageBubble.tsx`
  - [x] Add `onRetry?: () => void` prop to `MessageBubbleProps`
  - [x] In `MessageBubble`, when `message.degraded && !isStreaming && onRetry`: render Retry button below message content with amber ghost style (`RotateCcw` icon + "Retry" label)
  - [x] In `ChatPanel`, implement `handleRetry(failedAssistantId: string)` — filters failed msg, builds payload, streams inline via `_streamAssistant`
  - [x] In the `messages.map(...)` render, pass `onRetry={msg.degraded ? () => handleRetry(msg.id) : undefined}` to all MessageBubble instances

- [x] **Task 4: Network-loss toast** (AC-5)
  - [x] Add state: `const [networkToast, setNetworkToast] = useState(false)` — boolean; copy derived from `degradedLang`
  - [x] In `_streamAssistant` catch block: when NOT AbortError AND `!gotResponse` (fetch itself threw): restore inputValue, remove blank assistant slot, show `networkToast`, auto-dismiss after 4s via `toastTimerRef`
  - [x] Render toast inline above input bar: `role="alert"`, `AlertCircle` icon, red color (`#f87171`), bilingual copy from `NETWORK_TOAST_COPY` const
  - [x] `toastTimerRef` cleaned up via `useEffect` on unmount

- [x] **Task 5: CI triad** (all ACs)
  - [x] `npm run test` — all 49 tests pass (no regressions)
  - [x] `npm run lint` — no warnings
  - [x] `npm run format:check` — no formatting issues
  - [x] `npm run build` — Next.js build succeeds

---

## Dev Notes

### Scope: What This Story IS and IS NOT

**IS:**
- Client-side detection of the existing `[ARIA error: ...]` sentinel from `streamChat.ts`
- New `DegradedBanner` component (amber, §7.8 spec)
- New `networkToast` UI for mid-stream network loss
- Retry mechanism that re-sends without the degraded assistant message in the API context

**IS NOT:**
- Changes to `streamChat.ts` — the sentinel already exists
- Changes to `callAI.ts` — degradation envelope already exists
- Changes to `app/api/chat/route.ts` — no server changes needed
- Returning actual CRM data when degraded (Epic 2 dependency, deferred)
- Briefing cached fallback (Epic 4 dependency, deferred — AC-6)

### Sentinel Format (existing in streamChat.ts)

From `lib/ai/streamChat.ts` catch block:
```typescript
const errMsg = err instanceof Error ? err.message : 'Unknown error'
controller.enqueue(encoder.encode(`\n\n[ARIA error: ${errMsg}]`))
controller.close()
```

Detection string: `'[ARIA error:'` (always at the end of the stream content, possibly after partial AI response).

**Detection logic** (after stream ends):
```typescript
const hasError = finalContent.includes('[ARIA error:')
if (hasError) {
  setIsDegraded(true)
  // Strip sentinel from displayed content
  const cleanContent = finalContent.substring(0, finalContent.lastIndexOf('\n\n[ARIA error:'))
  // Mark message as degraded
}
```

### Exact DegradedBanner Design Spec (DESIGN.md §7.8)

```
bg:      rgba(245, 158, 11, 0.12)
border:  1px solid rgba(245, 158, 11, 0.40)
text:    #FBBF24, 13px, weight 500
icon:    AlertTriangle (lucide-react) @ 16px, color #F59E0B — REQUIRED
radius:  8px
margin:  8px 16px
padding: 10px 16px
dismiss: X button (ghost), right-aligned
rule:    Color NEVER sole indicator — icon required always
WCAG:    #FBBF24 on panel bg → 8.3:1 contrast (AAA)
```

### Banner Copy (exact strings)

```
EN: "AI synthesis is temporarily unavailable — showing raw data. Analysis will resume when the connection recovers."
VI: "AI tạm thời không khả dụng — đang hiển thị dữ liệu thô. Phân tích sẽ trở lại khi kết nối phục hồi."
```

Language selection: `detectLanguage(lastUserMsg.content)` — same function used by `streamChat.ts` for language mirroring. Already importable from `@/lib/language/detectLanguage` (pure module, no `server-only`).

### ChatPanel Current State Shape

Existing state (do NOT break these):
```typescript
const [messages, setMessages] = useState<Message[]>([])
const [inputValue, setInputValue] = useState('')
const [isStreaming, setIsStreaming] = useState(false)
const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set())
const [showPrivacyModal, setShowPrivacyModal] = useState(false)
const [pendingMessage, setPendingMessage] = useState<string | null>(null)
```

New state to add:
```typescript
const [isDegraded, setIsDegraded] = useState(false)
const [degradedLang, setDegradedLang] = useState<'vi' | 'en'>('en')
const [networkToast, setNetworkToast] = useState<{ message: string; onRetry: () => void } | null>(null)
```

New ref to add:
```typescript
const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
```

Add to cleanup useEffect (already exists for savedTimerRef pattern in BusinessContextPanel):
```typescript
useEffect(() => {
  return () => { if (toastTimerRef.current) clearTimeout(toastTimerRef.current) }
}, [])
```

### Message Type Extension (MessageBubble.tsx)

Current `Message` type:
```typescript
export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  stopped?: boolean
}
```

Add:
```typescript
  degraded?: boolean  // true when message is a degraded AI response (sentinel detected)
```

### handleRetry Architecture

The retry function must NOT include the failed assistant message in the API payload (it would confuse the AI into thinking it already responded). Implementation pattern:

```typescript
async function handleRetry(failedAssistantId: string) {
  if (isStreaming) return
  
  // Compute clean state synchronously (before any setMessages call)
  const cleanedMsgs = messages.filter(m => m.id !== failedAssistantId)
  const apiPayload = cleanedMsgs.map(m => ({ role: m.role, content: m.content }))
  
  // Create new assistant slot
  const newAssistantId = String(++idCounterRef.current)
  const newAssistantSlot: Message = {
    id: newAssistantId,
    role: 'assistant',
    content: '',
    timestamp: new Date(),
  }
  
  // Update state: remove failed message, add new blank slot
  setMessages([...cleanedMsgs, newAssistantSlot])
  setIsStreaming(true)
  setIsDegraded(false)  // optimistically clear — will re-set if still failing
  
  const controller = new AbortController()
  abortControllerRef.current = controller
  
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: apiPayload }),
      signal: controller.signal,
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    
    const reader = response.body!.getReader()
    const decoder = new TextDecoder()
    let accumulatedContent = ''
    
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const chunk = decoder.decode(value, { stream: true })
      accumulatedContent += chunk
      setMessages(prev => {
        const msgs = [...prev]
        const lastIdx = msgs.length - 1
        const last = msgs[lastIdx]
        if (lastIdx >= 0 && last && last.id === newAssistantId) {
          msgs[lastIdx] = { ...last, content: last.content + chunk }
        }
        return msgs
      })
    }
    
    // Check for sentinel in final content
    const hasError = accumulatedContent.includes('[ARIA error:')
    if (hasError) {
      setIsDegraded(true)
      // strip and mark degraded
    } else {
      setIsDegraded(false)  // auto-dismiss
    }
    setIsStreaming(false)
    abortControllerRef.current = null
  } catch (err) {
    // same error handling as handleSend
    setIsStreaming(false)
  }
}
```

### Banner Render Position in ChatPanel

Current ChatPanel JSX structure:
```
<div> {/* outer flex column, height 100% */}
  <div> {/* transcript scroll area, flex 1 */} ... </div>
  <div> {/* input bar wrapper */} ... </div>
  {showPrivacyModal && <PrivacyNoticeModal />}
</div>
```

Add banner ABOVE the transcript div (between outer div and transcript div):
```
<div> {/* outer flex column */}
  {isDegraded && <DegradedBanner lang={degradedLang} onDismiss={() => setIsDegraded(false)} />}
  <div> {/* transcript scroll area */ </div>
  ...
```

This makes the banner sticky at the top of the chat area (above messages, below app chrome).

### Network Error vs Sentinel Error

Two distinct failure modes — handle them differently:

| Mode | Trigger | UI Response |
|---|---|---|
| **Sentinel error** | `fetch` returns HTTP 200, stream contains `[ARIA error: ...]` | DegradedBanner + degraded message + Retry inline |
| **Network error** | `fetch` itself throws (network loss, DNS failure) | Toast with Retry CTA + restore input bar |
| **HTTP error** | `fetch` returns non-200 (e.g. 500) | Current behavior: "Something went wrong" in message — **no change needed for this story** |

The catch block discriminator:
```typescript
} catch (err) {
  if (err instanceof Error && err.name === 'AbortError') {
    // User clicked Stop — existing handling (no change)
    setIsStreaming(false)
    return
  }
  // All other errors = network/HTTP failure
  setIsStreaming(false)
  setInputValue(trimmedText)  // RESTORE input bar (AC-5)
  setMessages(prev => prev.filter(m => m.id !== assistantId))  // REMOVE blank slot
  const lang = detectLanguage(trimmedText)
  const toastMsg = lang === 'vi' ? 'Mất kết nối. Thử lại không, Anh?' : 'Lost connection. Retry?'
  setNetworkToast({ message: toastMsg, onRetry: () => handleSend(trimmedText) })
  toastTimerRef.current = setTimeout(() => setNetworkToast(null), 8000)
}
```

Note: the user message (`trimmedText`) was already added to `messages` state before the fetch attempt (in `!isRetry` path). When we remove the blank assistant slot and restore `inputValue`, the user message STAYS in the transcript — the user can see what they sent AND the input bar is restored with the same text for easy re-send.

### Lucide Icons

Already in use: `MessageSquare`, `FileText`, `LayoutDashboard`, `Settings`, `Send`, `Square`, `Copy`, `Check`.

**New for this story:** `AlertTriangle` — import from `lucide-react` in `DegradedBanner.tsx`. No new npm package needed.

### Toast Component Design

The networkToast is a small inline component rendered inside ChatPanel (NOT a portal). Position it at the bottom of the main panel, above the InputBar:

```
<div> {/* outer flex column */}
  {isDegraded && <DegradedBanner ... />}
  <div> {/* transcript */ </div>
  {networkToast && (
    <div role="status" ...>
      <span>{networkToast.message}</span>
      <button onClick={() => { networkToast.onRetry(); setNetworkToast(null) }}>Retry / Thử lại</button>
      <button onClick={() => setNetworkToast(null)} aria-label="Dismiss">×</button>
    </div>
  )}
  <div> {/* input bar */ </div>
```

Toast style:
- `background: #1c2440`, `border: 1px solid #2a3350`, `borderRadius: 8px`
- `padding: 10px 16px`, `margin: 0 16px 8px`
- `color: #e2e8f0`, `fontSize: 13`
- Retry button: teal ghost (`color: #14b8a6`, no border)
- Dismiss X: `color: #94a3b8`

### Previous Story Learnings (Stories 1.1–1.5)

1. **ts-node test pattern**: This story has UI changes (no ts-node tests needed for new components). Only regression tests (existing test suite) must pass.
2. **ESLint**: Run `npm run lint` before commit. Check for unused imports — `detectLanguage` must be imported at the top of ChatPanel.tsx.
3. **Prettier**: Run `npm run format:check`; auto-fix with `npm run format`.
4. **server-only boundary**: `detectLanguage` is safe to import in client components — it has no `server-only` guard. `ChatPanel.tsx` is `'use client'`.
5. **useRef for timers**: Follow the `savedTimerRef` pattern from `BusinessContextPanel.tsx` (ref + cleanup useEffect) for `toastTimerRef`.
6. **React state functional updater**: When removing messages by ID, always use `setMessages(prev => prev.filter(...))` to avoid stale closure issues.
7. **No new npm packages**: All needed UI elements use `lucide-react` (already installed) and inline styles (existing pattern).

### Files Changed

**New files:**
- `components/chat/DegradedBanner.tsx` — degraded AI banner component

**Modified files:**
- `components/chat/ChatPanel.tsx` — add isDegraded state, sentinel detection, handleRetry, networkToast
- `components/chat/MessageBubble.tsx` — add `degraded?` to Message type, `onRetry?` prop, Retry button render

**No changes:**
- `lib/ai/streamChat.ts` — sentinel already written
- `lib/ai/callAI.ts` — envelope already correct
- `app/api/chat/route.ts` — no server changes
- `lib/__tests__/*.test.ts` — no new unit tests (UI story)
- `package.json` — no new dependencies

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- TypeScript error on sentinel setMessages: `msgs[idx]` array access returns `T | undefined` in strict mode; fixed by introducing local `existing` variable before spreading.

### Completion Notes List

- Created `DegradedBanner.tsx` — amber banner matching DESIGN.md §7.8 exactly (bg, border, icon, text, dismiss button with hover)
- Extracted streaming logic to `_streamAssistant(apiMessages, assistantId, restoreInputValue?)` shared by `handleSend` and `handleRetry`; avoids async closure issues and deduplication
- Sentinel detection uses local `accumulated` variable (not state) to avoid async read-after-write issues; regex strips `\n\n[ARIA error:...]` from displayed content
- `handleRetry` computes `cleanedMsgs` synchronously from closure `messages` before any `setMessages` call; builds `apiPayload` from cleaned list then calls `_streamAssistant`
- Network error distinguished via `gotResponse` flag: set to `true` only after `await fetch()` resolves; catch block with `!gotResponse` → toast + restore inputValue + remove slot
- `networkToast` is a simple boolean (not an object); bilingual copy derived from `degradedLang` state already set at send time
- All 49 existing tests pass; lint clean; format clean; build succeeds

### File List

**New files:**
- `components/chat/DegradedBanner.tsx`

**Modified files:**
- `components/chat/ChatPanel.tsx` — `_streamAssistant` helper, `isDegraded`/`degradedLang`/`networkToast` state, `toastTimerRef`, `handleRetry`, DegradedBanner + networkToast render, `detectLanguage` import
- `components/chat/MessageBubble.tsx` — `degraded?` on `Message`, `onRetry?` prop, `RotateCcw` import, Retry button in ARIA bubble

### Change Log

- `components/chat/DegradedBanner.tsx`: new amber banner component (AC-1)
- `components/chat/ChatPanel.tsx`: extracted `_streamAssistant`; added sentinel detection → `isDegraded` + strip + `degraded: true` on message; added `handleRetry`; added network toast via `gotResponse` flag; added `DegradedBanner` render above transcript; added network toast render above input bar; `detectLanguage` sets `degradedLang` at send time
- `components/chat/MessageBubble.tsx`: `degraded?` added to `Message`; `onRetry?` added to props; Retry button (amber, `RotateCcw` icon) renders when `message.degraded && !isStreaming && onRetry`
