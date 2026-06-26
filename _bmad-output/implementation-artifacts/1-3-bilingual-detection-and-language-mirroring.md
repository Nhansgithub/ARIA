---
story: 1.3
epic: 1
status: done
baseline_commit: fd4bd00aac3307b4603463798f33a613bec29496
---

# Story 1.3: Bilingual Detection and Language Mirroring

## Story

As an Owner, I want ARIA to detect whether I write in Vietnamese or English and respond in the same language within the same conversation, so that I can switch languages naturally without configuring anything.

---

## Acceptance Criteria

**AC-1: Vietnamese messages produce Vietnamese responses with B2B register**

**Given** the Owner sends a message in Vietnamese (e.g., "Khách hàng này có vẻ phức tạp lắm"),
**When** ARIA responds,
**Then** the response is in Vietnamese, using B2B-appropriate register: address the Owner as "Anh", acknowledge problems obliquely, avoid urgency/pressure language. (FR-2; §10)

**AC-2: English messages produce English responses with direct analytical style**

**Given** the Owner sends a message in English (e.g., "What should I do with this stalled deal?"),
**When** ARIA responds,
**Then** the response is in English — direct and analytical, recommendation first, evidence second — with no filler phrases ("Great question!", "Certainly!", etc.). (FR-2; §10)

**AC-3: Mid-conversation language switch is mirrored per message**

**Given** the Owner switches language mid-conversation (one message Vietnamese, the next English),
**When** ARIA responds to each message,
**Then** each response mirrors the language of **that specific message**, not the language of prior turns. (FR-2)

**AC-4: Document language defaults to client's `language_pref`**

**Given** ARIA is generating a client-facing document draft,
**When** the draft is produced,
**Then** it uses the client's `language_pref` field (default Vietnamese), regardless of the Owner's current message language. (FR-2; addendum §B.1)
Note: Document generation is implemented in Epic 3. This story must ensure that `detectLanguage()` is positioned so that the document path can read `client.language_pref` instead — no document generation code is needed here.

**AC-5: HTML `lang` attribute reflects language of each message bubble**

**Given** the chat renders ARIA's response message bubble,
**When** the message bubble is displayed,
**Then** the bubble element carries `lang="vi"` for Vietnamese responses and `lang="en"` for English responses, enabling screen-reader pronunciation. (EXPERIENCE.md Foundation; ARIA §10)
The `<html>` root `lang="vi"` set in `app/layout.tsx` is already correct for the default UI language and must not be changed by this story.

---

## Tasks / Subtasks

- [ ] **Task 1: Create `lib/language/detectLanguage.ts`** (AC-1, AC-2, AC-3)
  - [ ] Implement `detectLanguage(text: string): 'vi' | 'en'` using Vietnamese-specific Unicode detection
  - [ ] Vietnamese detection pattern: match on characters in `ĂăĐđƠơƯư` (ăĂđĐơƠưƯ) or the Vietnamese Extended Latin block `Ạ-ỹ`
  - [ ] Default to `'en'` when no Vietnamese characters detected
  - [ ] Function is pure (no imports, no side effects) — usable on both server and client without `server-only`
  - [ ] Export as named export `detectLanguage`

- [ ] **Task 2: Update `lib/ai/streamChat.ts` to accept and inject language directive** (AC-1, AC-2, AC-3)
  - [ ] Add `detectedLang?: 'vi' | 'en'` to `StreamChatOptions` interface
  - [ ] After the cached system prompt block, append a SECOND (non-cached) system block containing the language directive when `detectedLang` is set
  - [ ] Vietnamese directive: `'LANGUAGE: Vietnamese (vi). Address the Owner as "Anh". Acknowledge difficulties obliquely. Avoid urgency or pressure language. Respond entirely in Vietnamese.'`
  - [ ] English directive: `'LANGUAGE: English (en). Be direct and analytical. Lead with the recommendation, then evidence. No filler phrases ("Great question!", "Certainly!").'`
  - [ ] The second system block must NOT have `cache_control` (it is volatile — varies per message, must not pollute the cache of block 1)

- [ ] **Task 3: Update `app/api/chat/route.ts` to detect and pass language** (AC-1, AC-2, AC-3)
  - [ ] Import `detectLanguage` from `@/lib/language/detectLanguage`
  - [ ] After extracting `messages`, find the last `user` turn: `const lastUserMsg = [...messages].reverse().find(m => m.role === 'user')`
  - [ ] Call `detectLanguage(lastUserMsg?.content ?? '')` to get `detectedLang: 'vi' | 'en'`
  - [ ] Pass `detectedLang` to `streamChat()`

- [ ] **Task 4: Update `MessageBubble.tsx` to apply `lang` attribute** (AC-5)
  - [ ] Import `detectLanguage` from `@/lib/language/detectLanguage` (client-safe import — no `server-only`)
  - [ ] For ARIA (non-user) messages, call `detectLanguage(message.content)` to get `bubbleLang`
  - [ ] Apply `lang={bubbleLang}` to the outer message bubble `<div>` for non-user messages
  - [ ] For user messages, apply `lang="vi"` (default — user's language is already handled by response mirroring)
  - [ ] Do NOT change the `<html lang="vi">` in `app/layout.tsx`

- [ ] **Task 5: Update specialist system prompts in `lib/ai/orchestrator.ts`** (AC-1, AC-2)
  - [ ] Replace the placeholder "Answer in the same language as the user's message (Vietnamese or English)" line in each specialist prompt with a bilingual register block
  - [ ] The register block should describe BOTH Vietnamese and English register in the prompt, so the model falls back gracefully if the language directive (Task 2) is absent
  - [ ] Vietnamese register rules: address as "Anh"; acknowledge problems obliquely ("vấn đề này khá phức tạp" not "đây là vấn đề lớn"); no urgency language ("cần ngay lập tức"); direct and structured
  - [ ] English register rules: direct, analytical, recommendation first; no filler phrases

- [ ] **Task 6: Write unit tests in `lib/__tests__/detectLanguage.test.ts`** (AC-1, AC-2, AC-3)
  - [ ] Test: Vietnamese text with ắ/ề/ổ → 'vi'
  - [ ] Test: Vietnamese text with đ/ơ/ư (the "backbone" chars) → 'vi'
  - [ ] Test: Pure ASCII English text → 'en'
  - [ ] Test: Mixed Vietnamese/English (e.g., "This is a vấn đề") → 'vi' (Vietnamese chars detected)
  - [ ] Test: Empty string → 'en' (default)
  - [ ] Test: Whitespace/numbers only → 'en'

- [ ] **Task 7: Update test script in `package.json`** (all ACs)
  - [ ] Add `npx ts-node lib/__tests__/detectLanguage.test.ts` to the test chain

- [ ] **Task 8: CI triad** (all ACs)
  - [ ] `npm run test` — all tests pass
  - [ ] `npm run lint` — no warnings
  - [ ] `npx tsc --noEmit` — no type errors
  - [ ] `npm run format:check` — no formatting issues
  - [ ] `npm run build` — Next.js build succeeds

---

## Dev Notes

### Why Heuristic Detection, Not `franc`

The `franc` language-detection library supports 176 languages via trigram analysis. For the Vietnamese/English binary, it is significant overkill (~100KB) and its accuracy on short messages (1–5 words) is unreliable because trigrams are sparse. Vietnamese has a distinctive Unicode character set that makes a simple regex check near-perfect:

- `ăĂ` (U+0103/U+0102) and all toned variants
- `đĐ` (U+0111/U+0110) — the most diagnostic single character
- `ơƠ` (U+01A1/U+01A0) and all toned variants
- `ưƯ` (U+01B0/U+01AF) and all toned variants
- The entire Vietnamese Extended Latin block `Ạ–ỹ` (all toned a/e/i/o/u variants)

English text never contains any of these characters. A single character match is sufficient to classify as Vietnamese. Short greetings like "hi", "ok", "thanks" default to English — which is correct behaviour (they can be either language but produce an acceptable English response).

**Exact detection regex:**
```typescript
const VIETNAMESE_RE = /[ĂăĐđƠơƯưẠ-ỹ]/u
```

### AD-5 Cache Discipline — Language Directive Placement

The specialist system prompt (block 1) is stable and cached across requests:
```
system: [
  { type: 'text', text: SPECIALIST_SYSTEM_PROMPTS[intent], cache_control: { type: 'ephemeral' } },  // ← cached
  { type: 'text', text: langDirective },  // ← volatile, NO cache_control
]
```

Block 2 (language directive) varies per request but does NOT break the cache hit rate of block 1, because caching applies to everything UP TO AND INCLUDING the last `cache_control` breakpoint. Block 2 has no `cache_control` so it is always re-sent as volatile content. This is intentional and correct per AD-5.

Do NOT move the language directive into block 1 or add `cache_control` to block 2.

### `lib/language/detectLanguage.ts` — Exact Implementation

```typescript
// Pure function — no server-only, no imports — usable on both server and client.

const VIETNAMESE_RE = /[ĂăĐđƠơƯưẠ-ỹ]/u

export function detectLanguage(text: string): 'vi' | 'en' {
  return VIETNAMESE_RE.test(text) ? 'vi' : 'en'
}
```

No dependencies, no module graph complications, works in both `use client` and server contexts.

### `lib/ai/streamChat.ts` — Required Changes

Current `StreamChatOptions`:
```typescript
export interface StreamChatOptions {
  model: AriaModel
  specialist: string
  systemPrompt: string
  businessContext?: string
  messages: ChatTurn[]
}
```

Add `detectedLang`:
```typescript
export interface StreamChatOptions {
  model: AriaModel
  specialist: string
  systemPrompt: string
  businessContext?: string
  messages: ChatTurn[]
  detectedLang?: 'vi' | 'en'   // NEW — Story 1.3
}
```

Language directive strings (must match these exactly — they are tested):
```typescript
const LANG_DIRECTIVE: Record<'vi' | 'en', string> = {
  vi: 'LANGUAGE: Vietnamese (vi). Address the Owner as "Anh". Acknowledge difficulties obliquely. Avoid urgency or pressure language. Respond entirely in Vietnamese.',
  en: 'LANGUAGE: English (en). Be direct and analytical. Lead with the recommendation, then evidence. No filler phrases ("Great question!", "Certainly!").',
}
```

Updated system construction in `streamChat()`:
```typescript
const system: Anthropic.TextBlockParam[] = [
  {
    type: 'text',
    text: options.systemPrompt,
    cache_control: { type: 'ephemeral' },  // cached — stable across requests
  },
]

// Language directive: volatile, injected AFTER the cache breakpoint (AD-5)
if (options.detectedLang) {
  system.push({
    type: 'text',
    text: LANG_DIRECTIVE[options.detectedLang],
    // intentionally no cache_control — this block is volatile
  })
}
```

### `app/api/chat/route.ts` — Required Changes

After the `messages` extraction and before `classifyIntent`:

```typescript
const lastUserMsg = [...messages].reverse().find(m => m.role === 'user')
const detectedLang = detectLanguage(lastUserMsg?.content ?? '')
```

Then pass to `streamChat`:
```typescript
const stream = streamChat({
  model: INTENT_MODEL_MAP[classification.intent],
  specialist: classification.intent,
  systemPrompt: SPECIALIST_SYSTEM_PROMPTS[classification.intent],
  messages,
  detectedLang,    // NEW
})
```

### `components/chat/MessageBubble.tsx` — AC-5

The component already receives `message.content` and `isUser` props. For non-user messages, detect the language of the content and apply `lang` to the outer bubble wrapper.

```typescript
// At the top of the component function (client component):
import { detectLanguage } from '@/lib/language/detectLanguage'

// Inside the render:
const bubbleLang = isUser ? 'vi' : detectLanguage(message.content)

// On the outer message div:
<div lang={bubbleLang} ...>
```

This adds essentially zero cost — the regex check runs once per render. The component is already a client component (`'use client'`).

### Updated Specialist Prompts in `lib/ai/orchestrator.ts`

Replace the placeholder "Answer in the same language as the user's message (Vietnamese or English)" line in each prompt with explicit bilingual register guidance. This acts as a stable fallback if the language directive is absent.

Example for `deal_intelligence`:
```
If the Owner writes in Vietnamese: respond in Vietnamese. Address as "Anh". Acknowledge difficulties obliquely ("vấn đề này có thể phức tạp" not "đây là lỗi lớn"). Avoid urgency language. Use formal but warm B2B register.
If the Owner writes in English: respond in English. Be direct. Lead with recommendation, then evidence. No filler phrases.
```

The language directive injected by `streamChat.ts` (Task 2) takes explicit precedence, but including these instructions in the stable system prompt ensures graceful fallback even if `detectedLang` is undefined (e.g., a future caller omits it).

### Updating `lib/ai/index.ts`

Add the language utility export so it can be imported from a single place:

```typescript
export { detectLanguage } from '../language/detectLanguage'
export type { } // no new types
```

Wait — `lib/language/detectLanguage.ts` is outside `lib/ai/`, so index.ts in `lib/ai/` should not re-export it. Instead:
- Server: import directly `from '@/lib/language/detectLanguage'`
- Client: import directly `from '@/lib/language/detectLanguage'`

No barrel re-export needed for this utility.

### Test File — `lib/__tests__/detectLanguage.test.ts`

Standalone ts-node test, same pattern as `callAI.test.ts`:

```typescript
import assert from 'assert'

// Inline the pure function (avoids module resolution issues)
const VIETNAMESE_RE = /[ĂăĐđƠơƯưẠ-ỹ]/u
function detectLanguage(text: string): 'vi' | 'en' {
  return VIETNAMESE_RE.test(text) ? 'vi' : 'en'
}

// ... tests ...
```

### Files NOT Changed by This Story

- `lib/ai/orchestrator.ts` (INTENT_MODEL_MAP, classifyIntent) — no routing changes
- `lib/ai/callAI.ts` — unchanged
- `lib/ai/models.ts` — unchanged
- `app/layout.tsx` — `lang="vi"` is the correct default for the UI; do NOT change

### What This Story Does NOT Implement

- **Document language_pref**: AC-4 is a constraint note. Epic 3 stories will read `client.language_pref` when generating documents. No document code exists yet.
- **Database language_pref column**: Already defined in `clients` table schema (addendum §B.1). This story does not add or read it.
- **Client-side language preferences**: No settings UI. Detection is per-message, automatic.
- **French/other languages**: Out of scope. Binary Vi/En only.
- **ORCHESTRATOR_SYSTEM_PROMPT changes**: The classification prompt does not need language awareness — intent classification works in both languages.

### Previous Story Learnings (From Story 1.2)

1. **ts-node test pattern**: Test files at `lib/__tests__/*.test.ts`, run via `npx ts-node`. Tests must be fully self-contained — inline pure logic rather than importing from `server-only` modules. For `detectLanguage`, the function is pure and has no `server-only` dependency, so it COULD be imported directly — but inline it anyway for consistency.

2. **ESLint unused variable**: After removing hardcoded constants in Story 1.2, lint failed on unused imports. Ensure all imports in modified files are actually used.

3. **Prettier**: The project uses Prettier. After writing, run `npx prettier --write` on changed files. Run `npm run format:check` before commit.

4. **`StreamChatOptions` interface is a breaking change surface**: When adding `detectedLang?` to `StreamChatOptions`, the `?` makes it optional — all existing call sites in `route.ts` continue to work. After adding the field, check that `route.ts` passes it explicitly (not left undefined).

5. **TypeScript strict mode**: The project has strict TypeScript. `options.detectedLang` is `'vi' | 'en' | undefined`. Guard with `if (options.detectedLang)` before accessing `LANG_DIRECTIVE[options.detectedLang]`.

6. **Review pattern**: After all CI checks pass, commit with message format `fix(story-1.3): ...` for review fixes and `feat(story-1.3): ...` for the main implementation.

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
- `lib/language/detectLanguage.ts`
- `lib/__tests__/detectLanguage.test.ts`

**Modified files:**
- `lib/ai/streamChat.ts` — add `detectedLang?: 'vi' | 'en'` to `StreamChatOptions`; inject language directive system block
- `lib/ai/orchestrator.ts` — update specialist prompts with bilingual B2B register guidance
- `app/api/chat/route.ts` — detect language of latest user message, pass `detectedLang` to `streamChat()`
- `components/chat/MessageBubble.tsx` — apply `lang` attribute to ARIA message bubbles
- `package.json` — add detectLanguage test to test script

### Review Findings

- [x] [Review][Patch] P1 — Empty/no-user-turn silently injects English directive; pass `undefined` instead of `detectLanguage('')` [app/api/chat/route.ts:38]
- [x] [Review][Patch] P2 — User bubble `lang` hardcoded `'vi'` regardless of actual user message language; call `detectLanguage(message.content)` for user bubble too [components/chat/MessageBubble.tsx:71]
- [x] [Review][Patch] P3 — NFD-normalised Vietnamese text misdetected as English; add `text = text.normalize('NFC')` at start of function [lib/language/detectLanguage.ts:9]
- [x] [Review][Defer] D1 — Diacritics-free Vietnamese input (e.g. "ok anh oi") defaults to English — known limitation per spec dev notes [lib/language/detectLanguage.ts] — deferred, accepted per spec
- [x] [Review][Defer] D2 — `detectLanguage` called every render; streaming `lang` flips mid-stream before Vietnamese chars arrive — architecture limitation [components/chat/MessageBubble.tsx:71] — deferred, inherent to current streaming design
- [x] [Review][Defer] D3 — No runtime validation that `body.messages` is an array before `.reverse()` [app/api/chat/route.ts:35] — deferred, pre-existing
- [x] [Review][Defer] D4 — Test inlines `detectLanguage` rather than importing real module — project convention for ts-node tests [lib/__tests__/detectLanguage.test.ts:4] — deferred, project convention

### Change Log

(to be filled by dev agent)
