---
status: done
baseline_commit: ""
---

# Story 1.9: Vision Input — Screenshot Extraction and CRM Integration

## Story

**As a** Vietnamese service agency founder (the Owner),
**I want to** paste or attach a screenshot of a client conversation or document into ARIA's chat,
**So that** ARIA reads the image, extracts deal context, creates CRM records automatically, and I don't have to retype anything from the screenshot.

## Acceptance Criteria

- **AC-1:** The InputBar shows a Paperclip button; clicking it opens a native file picker (accept: `image/*`, max one image at a time in v1). Pasting an image via Ctrl+V / Cmd+V anywhere in the chat panel also attaches an image.
- **AC-2:** After selection, a 40×40px thumbnail chip appears above the textarea (1px solid `#2A3350` border, 8px radius, Lucide `X` to remove). If the file exceeds 10 MB, an inline error message appears instead of the chip, and no image is attached. Only one image per message in v1 (second paste/attach replaces the first).
- **AC-3:** When the Owner sends a message with an image, the image is compressed to long edge ≤ 1568px client-side (AD-9), uploaded to owner-scoped Supabase Storage (`screenshots/{ownerId}/{timestamp}.{ext}`, AD-2), then sent to the vision extraction path using the high-judgment model (Sonnet 4.6, AD-4). Token usage is logged.
- **AC-4:** ARIA's response states explicitly what was legible and what was not (omission boundary). No fabrication of names, numbers, or dates.
- **AC-5:** If the image contains sufficient context (at minimum a client name), ARIA calls `find_similar_clients` then `create_client_stub` + `create_deal_stub` with extracted fields. Activity log entries are appended (AD-14: append-only).
- **AC-6:** After send, the user message bubble shows a 40×40px thumbnail of the uploaded image above the text content. The raw image bytes are NOT re-sent on subsequent conversational turns (FR-35).
- **AC-7:** If the vision API call fails, the AD-6 degraded sentinel `[ARIA error: ...]` is emitted and the Story 1.6 degraded banner appears.

## Tasks / Subtasks

- [x] **Task 1 — Client-side image utility** (`lib/imageUtils.ts`)
  - [x] Export `MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024` and `MAX_LONG_EDGE_PX = 1568`
  - [x] Export `validateImageFile(file: File): { ok: boolean; error?: string }` — checks size and MIME type
  - [x] Export `SupportedMediaType = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'`
  - [x] Export `compressImage(file, maxLongEdge?)` — canvas-based resize, returns `{ base64, mediaType, width, height }`
  - [x] No `'use client'` directive and no server-only imports (may be used in browser only)

- [x] **Task 2 — Supabase Storage migration** (`supabase/migrations/20260628000000_screenshots_bucket.sql`)
  - [x] Create private `screenshots` bucket (`public: false`)
  - [x] RLS INSERT policy: authenticated user can upload to their own prefix (`(storage.foldername(name))[1] = auth.uid()::text`)
  - [x] RLS SELECT policy: authenticated user can read from their own prefix

- [x] **Task 3 — Extend Message type** (`components/chat/MessageBubble.tsx`)
  - [x] Add `thumbnailUrl?: string` to the `Message` interface
  - [x] In user bubble, render thumbnail `<img>` (40×40px, radius 8px, objectFit cover, border `1px solid #2A3350`) above the text content when `message.thumbnailUrl` is set
  - [x] Alt text: `"Uploaded screenshot"`

- [x] **Task 4 — Update InputBar** (`components/chat/InputBar.tsx`)
  - [x] Add props: `pendingImage?: File | null`, `onImageAttach?: (file: File) => void`, `onImageRemove?: () => void`, `imageError?: string | null`
  - [x] Internally derive `previewUrl` via `useEffect` + `URL.createObjectURL` / `revokeObjectURL` from `pendingImage`
  - [x] Add hidden `<input type="file" accept="image/*">` triggered by Paperclip button
  - [x] Add `Paperclip` button (Lucide, 16px) before the textarea; disabled during streaming
  - [x] Above-textarea image chip: 40×40px thumbnail + Lucide `X` button (remove) — shown only when `pendingImage` is set
  - [x] Inline error: `imageError && <span style={{ color: '#f87171', fontSize: 13 }}>{imageError}</span>`
  - [x] Update send-enabled logic: `canSend = !isStreaming && (value.trim().length > 0 || pendingImage != null)`
  - [x] File input `onChange` → calls `onImageAttach(e.target.files[0])` and resets input value

- [x] **Task 5 — Update ChatPanel** (`components/chat/ChatPanel.tsx`)
  - [x] Add state: `pendingImage: File | null`, `imageError: string | null`
  - [x] Add `handleImageAttach(file: File)` — validates via `validateImageFile`, sets `pendingImage` or `imageError`
  - [x] Add `handleImageRemove()` — clears both states
  - [x] Add paste handler: `useEffect` attaches `paste` listener to `window`; extracts first image/* item from `clipboardData`; calls `handleImageAttach`
  - [x] Modify `handleSend`: if `pendingImage` present, call `compressImage`; create `thumbnailUrl = URL.createObjectURL(pendingImage)` for user bubble display; include `imageBase64` + `imageMediaType` in `_streamAssistant` call; clear `pendingImage` and `imageError` after capture
  - [x] Allow send when only image is attached (no text required): guard becomes `(!trimmedText && !pendingImage) || isStreaming`
  - [x] User message in state: add `thumbnailUrl` field; `content` = trimmedText (may be empty string for image-only messages)
  - [x] Pass `imageBase64` + `imageMediaType` to `_streamAssistant`; include them in `fetch` body
  - [x] Pass `pendingImage`, `onImageAttach`, `onImageRemove`, `imageError` to `InputBar`
  - [x] Do NOT include `imageBase64` in the `messages` array sent to the API for subsequent turns (FR-35: image not re-sent)

- [x] **Task 6 — Vision extraction function** (`lib/ai/visionExtraction.ts`)
  - [x] `import 'server-only'` at top
  - [x] `import Anthropic from '@anthropic-ai/sdk'` (AD-1: allowed inside `lib/ai/`)
  - [x] Define `VISION_SPECIALIST_PROMPT` (see Dev Notes)
  - [x] Export `runVisionExtraction(options: VisionExtractionOptions): ReadableStream<Uint8Array>`
  - [x] Build system blocks: stable specialist prompt with `cache_control: ephemeral` + optional business context + language directive (same AD-5 pattern as `agentWithTools.ts`)
  - [x] Build conversation history: all `messages` EXCEPT the last user message (last user is the image turn)
  - [x] Build vision content block: `[{ type: 'image', source: { type: 'base64', media_type, data } }, { type: 'text', text: userText }]` (omit text block if `userText` is empty)
  - [x] Agentic loop `MAX_TOOL_ITERATIONS = 2`: call Sonnet (AD-4: `ARIA_MODELS.highJudgment`), dispatch `runTools(toolUseBlocks, ownerId)`, accumulate messages
  - [x] Use `AbortSignal.timeout(30_000)` on each API call
  - [x] Use `{ headers: { 'anthropic-beta': 'prompt-caching-2024-07-31' } }` (prompt-caching header, same as `agentWithTools.ts`)
  - [x] Log tokens via `console.log` after the final response: `[vision] tokens: input=X output=Y`
  - [x] VISION tools = `CRM_STUB_TOOLS` (imported from `./crmTools`) — tool calls dispatched via `runTools` from `./toolRunner`
  - [x] AD-5: sort tools alphabetically before passing to API
  - [x] AD-6: catch block emits `\n\n[ARIA error: ${errMsg}]` sentinel and calls `controller.close()`

- [x] **Task 7 — Update API route** (`app/api/chat/route.ts`)
  - [x] Parse `imageBase64: string | undefined` and `imageMediaType: string | undefined` from `body`
  - [x] If `imageBase64` present: skip intent classification; route directly to `runVisionExtraction`
  - [x] Before calling `runVisionExtraction`: upload image to Supabase Storage (`screenshots/${user.id}/${Date.now()}.${ext}`); log warning on upload failure (non-fatal — vision extraction proceeds regardless)
  - [x] `detectedLang` detection must use `lastUserMsg.content` (text only — image is separate)
  - [x] Vision path does NOT call `classifyIntent` (image routing overrides classification)
  - [x] Non-image path: unchanged (classifyIntent → crm_action | deal_intelligence | others)

- [x] **Task 8 — Tests** (`lib/__tests__/imageUtils.test.ts`)
  - [x] Follow ts-node inline pattern: inline all validation logic, no imports from project `lib/`
  - [x] T1 — `validateImageFile`: rejects files over 10 MB
  - [x] T2 — `validateImageFile`: rejects unsupported MIME types (e.g. `application/pdf`)
  - [x] T3 — `validateImageFile`: accepts `image/jpeg`, `image/png`, `image/webp`, `image/heic`
  - [x] T4 — `MAX_LONG_EDGE_PX = 1568` constant (inline the constant value)
  - [x] T5 — `MAX_IMAGE_SIZE_BYTES = 10485760` (10 × 1024 × 1024)

- [x] **Task 9 — CI triad**
  - [x] `npx tsc --noEmit` — zero errors
  - [x] `npx eslint lib/imageUtils.ts lib/ai/visionExtraction.ts components/chat/InputBar.tsx components/chat/ChatPanel.tsx components/chat/MessageBubble.tsx app/api/chat/route.ts`
  - [x] `npx prettier --write` all touched files
  - [x] Run `lib/__tests__/imageUtils.test.ts` via ts-node

- [x] **Task 10 — Update story status**
  - [x] `sprint-status.yaml`: set `1-9-vision-input-screenshot-extraction-and-crm-integration: done`
  - [x] Update `last_updated` field

## Dev Notes

### Architecture decisions in effect

- **AD-1**: `@anthropic-ai/sdk` import allowed only inside `lib/ai/`. `visionExtraction.ts` is inside `lib/ai/` — OK. `imageUtils.ts` is a pure browser utility — no SDK import.
- **AD-2**: All storage paths prefixed with `${ownerId}/`. Route handler uses `createServerClient()` (AD-13: never service role on owner data paths).
- **AD-4**: Vision calls must use `ARIA_MODELS.highJudgment` (Sonnet 4.6). Never downgraded.
- **AD-5**: Stable specialist prompt with `cache_control: ephemeral` + volatile language directive appended. Tools sorted alphabetically. Prompt-caching header required.
- **AD-6**: Vision catch block must emit `\n\n[ARIA error: ${errMsg}]` — triggers Story 1.6 degraded banner.
- **AD-9**: Images compressed client-side to long edge ≤ 1568px before upload. Raw image NOT re-sent after first turn (FR-35).
- **AD-11**: `imageBase64` lives in request body server-to-server; never goes to `NEXT_PUBLIC_*`; route handler is server-only.
- **AD-13**: Route handler uses `createServerClient()` for auth + storage — never `createServiceClient()`.
- **AD-14**: Activity log appended in `stubService.ts` (via existing `log_activity` tool) — append-only; no UPDATE on activity_log.

### File: `lib/imageUtils.ts` (NEW)

```typescript
// Client-only browser utility. No server-only imports. No 'use client' directive.

export const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024 // 10 MB (AC-2)
export const MAX_LONG_EDGE_PX = 1568 // AD-9

export type SupportedMediaType = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'

const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
])

export function validateImageFile(file: File): { ok: boolean; error?: string } {
  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return { ok: false, error: 'Image must be under 10 MB' }
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return { ok: false, error: 'Unsupported format. Use JPEG, PNG, WebP, GIF, or HEIC.' }
  }
  return { ok: true }
}

export async function compressImage(
  file: File,
  maxLongEdge = MAX_LONG_EDGE_PX
): Promise<{ base64: string; mediaType: SupportedMediaType; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      const { naturalWidth: w, naturalHeight: h } = img
      const scale = Math.min(1, maxLongEdge / Math.max(w, h))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(w * scale)
      canvas.height = Math.round(h * scale)
      const ctx = canvas.getContext('2d')
      if (!ctx) return reject(new Error('Canvas 2D context unavailable'))
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      const outputType: SupportedMediaType =
        file.type === 'image/png' ? 'image/png' : 'image/jpeg'
      const dataUrl = canvas.toDataURL(outputType, 0.85)
      const base64 = dataUrl.split(',')[1] ?? ''
      resolve({ base64, mediaType: outputType, width: canvas.width, height: canvas.height })
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load image for compression'))
    }
    img.src = url
  })
}
```

### File: `supabase/migrations/20260628000000_screenshots_bucket.sql` (NEW)

```sql
-- Create private screenshots bucket for owner-scoped image storage (AD-9, AD-2)
INSERT INTO storage.buckets (id, name, public)
VALUES ('screenshots', 'screenshots', false)
ON CONFLICT (id) DO NOTHING;

-- RLS: owner can upload to their own prefix only
CREATE POLICY "owner_screenshots_insert"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'screenshots'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- RLS: owner can read their own screenshots
CREATE POLICY "owner_screenshots_select"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'screenshots'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
```

### File: `components/chat/MessageBubble.tsx` — Message type change

Add `thumbnailUrl?: string` to `Message` interface:
```typescript
export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  stopped?: boolean
  degraded?: boolean
  thumbnailUrl?: string  // local blob URL for display only; not persisted or sent to API
}
```

In the user bubble render (inside the existing user `<div>`), add thumbnail above text:
```tsx
{/* User bubble body */}
<div ...>
  {message.thumbnailUrl && (
    <img
      src={message.thumbnailUrl}
      alt="Uploaded screenshot"
      style={{
        width: 40,
        height: 40,
        borderRadius: 8,
        objectFit: 'cover',
        border: '1px solid #2A3350',
        marginBottom: message.content ? 8 : 0,
        display: 'block',
      }}
    />
  )}
  {message.content}
</div>
```

### File: `components/chat/InputBar.tsx` — full rewrite of props + layout

```typescript
interface InputBarProps {
  value: string
  onChange: (value: string) => void
  onSend: () => void
  onStop: () => void
  isStreaming: boolean
  pendingImage?: File | null       // NEW
  onImageAttach?: (file: File) => void  // NEW
  onImageRemove?: () => void       // NEW
  imageError?: string | null       // NEW
}
```

Inside the component, add:
```typescript
const fileInputRef = useRef<HTMLInputElement>(null)
const [previewUrl, setPreviewUrl] = useState<string | null>(null)

// Derive blob URL from pendingImage for the chip thumbnail
useEffect(() => {
  if (!pendingImage) {
    setPreviewUrl(null)
    return
  }
  const url = URL.createObjectURL(pendingImage)
  setPreviewUrl(url)
  return () => URL.revokeObjectURL(url)
}, [pendingImage])

const canSend = !isStreaming && (value.trim().length > 0 || Boolean(pendingImage))
```

Layout structure (replaces the existing flat flex layout):
```tsx
<div
  style={{
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    padding: '12px 16px',
    borderTop: '1px solid #2a3350',
    background: '#0a0e27',
  }}
>
  {/* Image preview chip */}
  {pendingImage && previewUrl && (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <img
        src={previewUrl}
        alt="Image to send"
        style={{
          width: 40,
          height: 40,
          borderRadius: 8,
          objectFit: 'cover',
          border: '1px solid #2A3350',
          flexShrink: 0,
        }}
      />
      <button
        onClick={onImageRemove}
        aria-label="Remove image"
        style={{
          background: 'transparent',
          border: 'none',
          color: '#94a3b8',
          cursor: 'pointer',
          padding: 4,
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <X size={14} />
      </button>
    </div>
  )}

  {/* Inline image error */}
  {imageError && (
    <span style={{ color: '#f87171', fontSize: 13, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      {imageError}
    </span>
  )}

  {/* Input row */}
  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
    {/* Paperclip attach button */}
    <button
      onClick={() => fileInputRef.current?.click()}
      disabled={isStreaming}
      aria-label="Attach image"
      style={{
        minWidth: 36,
        minHeight: 36,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'transparent',
        border: '1px solid #2a3350',
        borderRadius: 8,
        color: isStreaming ? '#4a5568' : '#94a3b8',
        cursor: isStreaming ? 'not-allowed' : 'pointer',
        flexShrink: 0,
      }}
    >
      <Paperclip size={16} />
    </button>

    {/* Textarea (unchanged style) */}
    <textarea ... />

    {/* Stop / Send (update disabled/logic to use canSend) */}
    {isStreaming ? <StopButton /> : <SendButton disabled={!canSend} />}
  </div>

  {/* Hidden file input */}
  <input
    ref={fileInputRef}
    type="file"
    accept="image/*"
    style={{ display: 'none' }}
    onChange={(e) => {
      const file = e.target.files?.[0]
      if (file) onImageAttach?.(file)
      e.target.value = '' // reset so same file can be re-attached
    }}
  />
</div>
```

Imports to add: `import { Paperclip, X } from 'lucide-react'`, `import { useState } from 'react'` (already imported `useRef`, `useEffect`).

### File: `components/chat/ChatPanel.tsx` — key additions

New state + imports:
```typescript
import { validateImageFile, compressImage } from '@/lib/imageUtils'
// ... existing imports ...

const [pendingImage, setPendingImage] = useState<File | null>(null)
const [imageError, setImageError] = useState<string | null>(null)
```

Paste handler (add after existing `useEffect` hooks):
```typescript
useEffect(() => {
  function handlePaste(e: ClipboardEvent) {
    if (isStreaming) return
    const items = Array.from(e.clipboardData?.items ?? [])
    const imageItem = items.find((item) => item.type.startsWith('image/'))
    if (!imageItem) return
    const file = imageItem.getAsFile()
    if (!file) return
    handleImageAttach(file)
  }
  window.addEventListener('paste', handlePaste)
  return () => window.removeEventListener('paste', handlePaste)
}, [isStreaming])
```

New handlers:
```typescript
function handleImageAttach(file: File) {
  const validation = validateImageFile(file)
  if (!validation.ok) {
    setImageError(validation.error ?? 'Invalid image')
    setPendingImage(null)
    return
  }
  setImageError(null)
  setPendingImage(file)
}

function handleImageRemove() {
  setPendingImage(null)
  setImageError(null)
}
```

Modified `_streamAssistant` signature:
```typescript
async function _streamAssistant(
  apiMessages: { role: string; content: string }[],
  assistantId: string,
  restoreInputValue?: string,
  imageBase64?: string,      // NEW
  imageMediaType?: string    // NEW
) {
  // ...
  body: JSON.stringify({ messages: apiMessages, imageBase64, imageMediaType }),
  // ...
}
```

Modified `handleSend` — key changes:
```typescript
async function handleSend(text: string, isRetry = false) {
  const trimmedText = text.trim()
  // Guard: need either text OR image (not neither)
  if ((!trimmedText && !pendingImage) || isStreaming) return

  // Capture and clear image state before any async work
  const imageFile = pendingImage
  let imageBase64: string | undefined
  let imageMediaType: string | undefined
  let thumbnailUrl: string | undefined

  if (imageFile) {
    try {
      const compressed = await compressImage(imageFile)
      imageBase64 = compressed.base64
      imageMediaType = compressed.mediaType
      // Blob URL for display in user bubble (local only — not sent to API)
      thumbnailUrl = URL.createObjectURL(imageFile)
    } catch {
      setImageError('Failed to process image. Please try again.')
      return
    }
    setPendingImage(null)
    setImageError(null)
  }

  // Build API messages (text only — imageBase64 is separate body field, FR-35)
  const currentMessages = messages.map((m) => ({ role: m.role, content: m.content }))
  const apiMessages = isRetry
    ? currentMessages
    : [...currentMessages, { role: 'user' as const, content: trimmedText }]

  const assistantId = String(++idCounterRef.current)
  const assistantMsg: Message = { id: assistantId, role: 'assistant', content: '', timestamp: new Date() }

  const userContent = isRetry
    ? ([...messages].reverse().find((m) => m.role === 'user')?.content ?? trimmedText)
    : trimmedText
  setDegradedLang(detectLanguage(userContent))

  if (!isRetry) {
    const userMsgId = String(++idCounterRef.current)
    const userMsg: Message = {
      id: userMsgId,
      role: 'user',
      content: trimmedText,
      timestamp: new Date(),
      thumbnailUrl,  // local blob URL for display; never sent to API
    }
    setMessages((prev) => [...prev, userMsg, assistantMsg])
    setInputValue('')
  } else {
    setMessages((prev) => [...prev, assistantMsg])
  }

  await _streamAssistant(apiMessages, assistantId, isRetry ? undefined : trimmedText, imageBase64, imageMediaType)
}
```

Updated InputBar usage in JSX:
```tsx
<InputBar
  value={inputValue}
  onChange={setInputValue}
  onSend={() => handleSend(inputValue)}
  onStop={handleStop}
  isStreaming={isStreaming}
  pendingImage={pendingImage}
  onImageAttach={handleImageAttach}
  onImageRemove={handleImageRemove}
  imageError={imageError}
/>
```

### File: `lib/ai/visionExtraction.ts` (NEW)

```typescript
import 'server-only'
import Anthropic from '@anthropic-ai/sdk'
import { getAnthropicApiKey } from '@/lib/secrets'
import { ARIA_MODELS } from './models'
import { CRM_STUB_TOOLS } from './crmTools'
import { runTools } from './toolRunner'
import type { ChatTurn } from './streamChat'

const VISION_SPECIALIST_PROMPT = `You are ARIA, an AI business consultant for a Vietnamese service agency founder.
You have received an image (screenshot, photo, or document) from the Owner.

EXTRACTION PROTOCOL — follow this sequence exactly:

Step 1 — READ & EXTRACT:
Read the image carefully. Extract every deal-relevant detail:
  - Client name, company name, contact person
  - Service requested or stated need
  - Budget or price mentions (in VND or USD)
  - Timeline expectations or urgency signals
  - Any objections, concerns, or hesitations

Step 2 — STATE WHAT YOU FOUND:
  Legible: [list each extracted field explicitly]
  Unreadable: [state exactly what you could not read — do NOT guess or fabricate]

Step 3 — CREATE CRM RECORDS (if enough context):
  If you extracted at minimum a client name:
  a. Call find_similar_clients(name, company) FIRST to check for duplicates.
  b. If no match found: call create_client_stub then create_deal_stub with the extracted data.
  c. Confirm: "Em đã tạo hồ sơ cho [name]..." (VI) or "I've created a stub for [name]..." (EN).
  d. Ask EXACTLY 2 targeted follow-up questions to fill the most important gaps.
  If the image lacks a client name: ask the Owner to clarify before creating any records.

OMISSION RULE: Never guess unreadable content. Never fabricate a name, number, or date.
State explicitly what was and was not legible.`

const MAX_TOOL_ITERATIONS = 2
const VISION_TIMEOUT_MS = 30_000

const LANG_DIRECTIVE: Record<'vi' | 'en', string> = {
  vi: 'LANGUAGE: Vietnamese (vi). Address the Owner as "Anh". Respond entirely in Vietnamese.',
  en: 'LANGUAGE: English (en). Be direct. Lead with findings, then questions.',
}

export interface VisionExtractionOptions {
  imageBase64: string
  imageMediaType: string
  userText: string
  messages: ChatTurn[]
  businessContext?: string
  detectedLang?: 'vi' | 'en'
  ownerId: string
}

export function runVisionExtraction(options: VisionExtractionOptions): ReadableStream<Uint8Array> {
  const { imageBase64, imageMediaType, userText, messages, businessContext, detectedLang, ownerId } =
    options
  const client = new Anthropic({ apiKey: getAnthropicApiKey() })
  const encoder = new TextEncoder()

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        // AD-5: stable prefix with cache_control + volatile language directive
        const system: Anthropic.TextBlockParam[] = [
          {
            type: 'text',
            text: VISION_SPECIALIST_PROMPT,
            // @ts-expect-error — cache_control is valid but not yet typed in SDK
            cache_control: { type: 'ephemeral' },
          },
        ]
        if (businessContext) {
          system.push({ type: 'text', text: `\n\nOwner Business Context:\n${businessContext}` })
        }
        if (detectedLang) {
          system.push({ type: 'text', text: `\n\n${LANG_DIRECTIVE[detectedLang]}` })
        }

        // AD-5: sort tools alphabetically for cache stability
        const tools = [...CRM_STUB_TOOLS].sort((a, b) =>
          a.name.localeCompare(b.name)
        ) as Anthropic.Tool[]

        // History = all turns except the last user message (image is in current turn, FR-35)
        const history: Anthropic.MessageParam[] = messages
          .slice(0, -1)
          .map((m) => ({ role: m.role, content: m.content }))

        // Build the image + text content block for this turn
        const visionContent: Anthropic.ContentBlockParam[] = [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: imageMediaType as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif',
              data: imageBase64,
            },
          },
        ]
        if (userText.trim()) {
          visionContent.push({ type: 'text', text: userText.trim() })
        }

        const allMessages: Anthropic.MessageParam[] = [
          ...history,
          { role: 'user', content: visionContent },
        ]

        let iteration = 0

        while (iteration < MAX_TOOL_ITERATIONS) {
          const response = await client.messages.create(
            {
              model: ARIA_MODELS.highJudgment, // AD-4: vision always high-judgment
              max_tokens: 4096,
              system,
              tools,
              messages: allMessages,
            },
            {
              headers: { 'anthropic-beta': 'prompt-caching-2024-07-31' },
              signal: AbortSignal.timeout(VISION_TIMEOUT_MS),
            }
          )

          const toolUseBlocks = response.content.filter(
            (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
          )

          if (response.stop_reason !== 'tool_use' || toolUseBlocks.length === 0) {
            const text = response.content
              .filter((b): b is Anthropic.TextBlock => b.type === 'text')
              .map((b) => b.text)
              .join('')
            // AD-9: log token usage
            console.log(
              `[vision] tokens: input=${response.usage?.input_tokens ?? 0} output=${response.usage?.output_tokens ?? 0} specialist=vision_input`
            )
            controller.enqueue(encoder.encode(text || '\n\n[ARIA error: Empty response from AI]'))
            controller.close()
            return
          }

          const toolResults = await runTools(toolUseBlocks, ownerId)
          allMessages.push({ role: 'assistant', content: response.content })
          allMessages.push({ role: 'user', content: toolResults })
          iteration++
        }

        // Max iterations reached — final call without tools to force text synthesis
        const finalResponse = await client.messages.create(
          {
            model: ARIA_MODELS.highJudgment,
            max_tokens: 4096,
            system,
            messages: allMessages,
          },
          {
            headers: { 'anthropic-beta': 'prompt-caching-2024-07-31' },
            signal: AbortSignal.timeout(VISION_TIMEOUT_MS),
          }
        )
        const finalText = finalResponse.content
          .filter((b): b is Anthropic.TextBlock => b.type === 'text')
          .map((b) => b.text)
          .join('')
        console.log(
          `[vision] tokens: input=${finalResponse.usage?.input_tokens ?? 0} output=${finalResponse.usage?.output_tokens ?? 0} specialist=vision_input`
        )
        controller.enqueue(encoder.encode(finalText || '\n\n[ARIA error: Empty response from AI]'))
        controller.close()
      } catch (err) {
        // AD-6: sentinel triggers degraded banner in ChatPanel
        const errMsg = err instanceof Error ? err.message : 'Unknown error'
        controller.enqueue(encoder.encode(`\n\n[ARIA error: ${errMsg}]`))
        controller.close()
      }
    },
  })
}
```

### File: `app/api/chat/route.ts` — additions

Parse image from body and add vision routing:
```typescript
import { runVisionExtraction } from '@/lib/ai/visionExtraction'
// ... (add after existing imports)

// In POST handler, after parsing body:
const body = await req.json()
const messages = body.messages as ChatTurn[]
const imageBase64 = body.imageBase64 as string | undefined
const imageMediaType = body.imageMediaType as string | undefined

// Language detection (unchanged — uses text content of last user message)
const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user')
const detectedLang = lastUserMsg ? detectLanguage(lastUserMsg.content) : undefined

// Vision path: if image present, bypass intent classification
if (imageBase64 && imageMediaType) {
  // Upload to owner-scoped Supabase Storage (AD-9, AD-2, AD-13)
  const ext = imageMediaType === 'image/png' ? 'png' : imageMediaType === 'image/webp' ? 'webp' : 'jpg'
  const storagePath = `${user.id}/${Date.now()}.${ext}`
  const imageBuffer = Buffer.from(imageBase64, 'base64')
  const { error: uploadError } = await supabase.storage
    .from('screenshots')
    .upload(storagePath, imageBuffer, { contentType: imageMediaType, upsert: false })
  if (uploadError) {
    // Non-fatal: log warning, proceed with vision extraction
    console.warn('[vision] Storage upload failed:', uploadError.message)
  }

  const businessContext = await getBusinessContext(user.id)
  const userText = lastUserMsg?.content ?? ''

  const stream = runVisionExtraction({
    imageBase64,
    imageMediaType,
    userText,
    messages,
    detectedLang,
    businessContext: businessContext ?? undefined,
    ownerId: user.id,
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}

// Non-image path: classify intent and route as before
const [businessContext, classification] = await Promise.all([
  getBusinessContext(user.id),
  classifyIntent(messages),
])
// ... rest unchanged
```

**Note on import order change:** `businessContext` was previously fetched in the parallel `Promise.all`. For the image path, we fetch it separately (after the early return for vision). For the non-image path, the existing `Promise.all` stays intact. Extract `businessContext` fetch to only happen once per code path — see the implementation note in the task.

### File: `lib/__tests__/imageUtils.test.ts` (NEW — ts-node inline pattern)

```typescript
// ts-node inline pattern: logic inlined, no imports from project lib/ files

// Inlined constants (must match lib/imageUtils.ts)
const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024
const MAX_LONG_EDGE_PX = 1568
const ALLOWED_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif',
])

function validateImageFile(file: { size: number; type: string }): { ok: boolean; error?: string } {
  if (file.size > MAX_IMAGE_SIZE_BYTES) return { ok: false, error: 'Image must be under 10 MB' }
  if (!ALLOWED_TYPES.has(file.type)) return { ok: false, error: 'Unsupported format. Use JPEG, PNG, WebP, GIF, or HEIC.' }
  return { ok: true }
}

let passed = 0, failed = 0
function t(label: string, fn: () => void) {
  try { fn(); console.log(`  ✓ ${label}`); passed++ }
  catch (e) { console.error(`  ✗ ${label}:`, e instanceof Error ? e.message : e); failed++ }
}
function assert(cond: boolean, msg: string) { if (!cond) throw new Error(msg) }

console.log('=== imageUtils.test.ts ===\n')

t('T1 — rejects file over 10 MB', () => {
  const r = validateImageFile({ size: MAX_IMAGE_SIZE_BYTES + 1, type: 'image/jpeg' })
  assert(!r.ok, 'expected ok=false')
  assert(r.error?.includes('10 MB') ?? false, 'expected 10 MB error')
})

t('T2 — rejects unsupported MIME type', () => {
  const r = validateImageFile({ size: 1024, type: 'application/pdf' })
  assert(!r.ok, 'expected ok=false for pdf')
})

t('T3 — accepts image/jpeg', () => {
  const r = validateImageFile({ size: 1024, type: 'image/jpeg' })
  assert(r.ok, 'expected ok=true for jpeg')
})

t('T3b — accepts image/png', () => {
  const r = validateImageFile({ size: 1024, type: 'image/png' })
  assert(r.ok, 'expected ok=true for png')
})

t('T3c — accepts image/webp', () => {
  const r = validateImageFile({ size: 1024, type: 'image/webp' })
  assert(r.ok, 'expected ok=true for webp')
})

t('T3d — accepts image/heic', () => {
  const r = validateImageFile({ size: 1024, type: 'image/heic' })
  assert(r.ok, 'expected ok=true for heic')
})

t('T4 — MAX_LONG_EDGE_PX = 1568 (AD-9)', () => {
  assert(MAX_LONG_EDGE_PX === 1568, `expected 1568, got ${MAX_LONG_EDGE_PX}`)
})

t('T5 — MAX_IMAGE_SIZE_BYTES = 10485760', () => {
  assert(MAX_IMAGE_SIZE_BYTES === 10485760, `expected 10485760, got ${MAX_IMAGE_SIZE_BYTES}`)
})

t('T6 — file at exactly 10 MB boundary is accepted', () => {
  const r = validateImageFile({ size: MAX_IMAGE_SIZE_BYTES, type: 'image/jpeg' })
  assert(r.ok, 'expected ok=true at exact boundary')
})

t('T7 — image/gif is accepted', () => {
  const r = validateImageFile({ size: 1024, type: 'image/gif' })
  assert(r.ok, 'expected ok=true for gif')
})

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
```

### package.json — add imageUtils test script

Add to the `test:*` scripts:
```json
"test:imageUtils": "node --loader ts-node/esm lib/__tests__/imageUtils.test.ts"
```

### Supabase Storage: local dev note

In local dev, run `supabase migration up` to apply the new migration. The `screenshots` bucket will be created. Test upload via the route handler after auth.

### Previous story learnings (1.1–1.8)

1. **ts-node test pattern**: ALL `lib/__tests__/*.test.ts` files must inline their logic — no imports from project `lib/`. The `tsconfig` uses `"moduleResolution": "bundler"` which is incompatible with ts-node ESM for local `.ts` imports.
2. **Prettier formatting**: Run `npx prettier --write` on every new/edited `.ts`/`.tsx` file before the CI triad — Prettier flags long lines as a format error.
3. **Supabase join returns array**: When using `!inner` join in PostgREST, the related table returns as an array. Use a normalizer function (see Story 1.8's `clientOf()`).
4. **Activity log is append-only**: Never UPDATE or DELETE `activity_log` rows. Always INSERT new rows. (AD-14)
5. **`@ts-expect-error` for `cache_control`**: The Anthropic SDK's TypeScript types don't include `cache_control` on `TextBlockParam`. Use `@ts-expect-error` with a comment explaining why. Pattern established in `agentWithTools.ts`.
6. **`createServerClient()` only**: Route handlers MUST use `createServerClient()`. `createServiceClient()` is never used on owner-data paths (AD-13).
7. **ESLint `import 'server-only'`**: All `lib/ai/*.ts` and `lib/crm/*.ts` files must have `import 'server-only'` at the top (AD-1/AD-11). `lib/imageUtils.ts` is a browser utility — no server-only, but also no `@anthropic-ai/sdk`.
8. **CRM tools already sorted**: `CRM_STUB_TOOLS` in `crmTools.ts` is already alphabetically sorted. `runVisionExtraction` still sorts defensively (safe to re-sort).
9. **TypeScript `as` cast for tool input**: Use `block.input as SomeInputType` when passing tool inputs to service functions — the Anthropic SDK types `block.input` as `Record<string, unknown>`.
10. **Blob URLs and cleanup**: `URL.createObjectURL` in client components should be revoked via cleanup function in `useEffect` return. In `handleSend`, the `thumbnailUrl` created for display in the user bubble will live until the page navigates away — acceptable for v1 (no explicit revoke needed in the message bubble; we don't hold a ref to it after the state update).

### Critical: `route.ts` import after refactor

After adding the vision path, the `businessContext` fetch needs to happen in both paths but only once per path. Current code uses `Promise.all([getBusinessContext, classifyIntent])`. The refactored code should:
1. Check for `imageBase64` first (before `Promise.all`)
2. If vision path: call `getBusinessContext(user.id)` directly, then call `runVisionExtraction`
3. If text path: `Promise.all([getBusinessContext, classifyIntent])` as before

Do NOT call `getBusinessContext` twice in the same request.

## Dev Agent Record

### Implementation Plan

Implemented in the sequence specified by the story: (1) `lib/imageUtils.ts` browser
utility; (2) `screenshots` storage bucket migration with owner-scoped RLS; (3) `Message.thumbnailUrl`
+ user-bubble render; (4) `InputBar` Paperclip/chip/error props; (5) `ChatPanel` pendingImage state,
window paste handler, attach/remove handlers, image-aware `handleSend`/`_streamAssistant`;
(6) `lib/ai/visionExtraction.ts` following the `agentWithTools.ts` pattern (Sonnet 4.6, prompt-caching
header, alphabetical tools, AD-6 sentinel); (7) `route.ts` vision routing that bypasses
`classifyIntent`, uploads to owner-scoped storage non-fatally, and fetches business context exactly
once per path; (8) inline ts-node test; (9) CI triad.

### Completion Notes

- CI triad green: `npx tsc --noEmit` 0 errors; ESLint 0 errors (2 expected `@next/next/no-img-element`
  warnings on blob-URL thumbnails where `next/image` is unsuitable); Prettier formatted all touched
  files; `imageUtils.test.ts` 10/10 passing.
- `getBusinessContext` is called exactly once per request path — vision path calls it directly before
  the early `return`; non-image path keeps the existing `Promise.all`.
- FR-35 honored: `imageBase64` travels only as a top-level request body field, never inside the
  `messages` array, so the raw image is not re-sent on subsequent turns.
- Vision history slices off the last user turn (`messages.slice(0, -1)`) and rebuilds it as the
  image+text content block for the current turn.

### Debug Log

| Issue | Fix | File |
|-------|-----|------|
| `@ts-expect-error` over `cache_control` was flagged as an unused directive (TS2578) — the installed `@anthropic-ai/sdk` ^0.106.0 types `cache_control` on `TextBlockParam`. | Removed the directive to match the SDK and the existing `agentWithTools.ts` pattern (which uses a bare `cache_control`). | `lib/ai/visionExtraction.ts` |

## File List

**New files:**
- `lib/imageUtils.ts`
- `lib/ai/visionExtraction.ts`
- `supabase/migrations/20260628000000_screenshots_bucket.sql`
- `lib/__tests__/imageUtils.test.ts`

**Modified files:**
- `components/chat/MessageBubble.tsx` — Message.thumbnailUrl, user bubble thumbnail render
- `components/chat/InputBar.tsx` — Paperclip button, image chip, new props
- `components/chat/ChatPanel.tsx` — pendingImage state, paste handler, image send
- `app/api/chat/route.ts` — vision routing, Storage upload
- `package.json` — add `test:imageUtils` script

## Change Log

| Date | Change |
|------|--------|
| 2026-06-26 | Story file created |
| 2026-06-29 | Implemented all 10 tasks; CI triad green; status set to done |

## Review Findings

_To be populated by code review agent_
