---
story_id: "3.3"
epic: 3
title: "Document Viewer — Read, Edit, and Version History"
status: done
baseline_commit: "c2855fabe226c0b0484168c305babb7378c450dd"
---

# Story 3.3 — Document Viewer — Read, Edit, and Version History

## Story

As an Owner, I want a dedicated document viewer where I can read, edit, change status, and browse version history, so that I have full visibility and control over my document vault without leaving the app.

---

## What Already Exists (Do NOT Re-Implement)

Everything below was delivered in Epics 0–3.2 and must be treated as immutable foundation:

**From Story 3.1 (`lib/crm/documentService.ts`):**
- `createDocument(ownerId, input)` → inserts first version row, status=draft, version=1
- `saveDocumentVersion(ownerId, input)` → inserts new version row (N+1), preserves source row (AD-14)
- `updateDocumentStatus(ownerId, input)` → UPDATE with no-op guard, logs status_changed
- `getDocument(ownerId, {id})` → `.maybeSingle()`, owner-scoped
- `listDocuments(ownerId, params)` → filtered list, limit capped at 100
- `listDocumentVersions(ownerId, documentId)` → all rows in this document family, asc version
- Types: `DocumentRow`, `DocumentType`, `DocumentStatus`, `DocumentCreatedBy`

**From Story 3.2:**
- `lib/ai/orchestrator.ts`: `document_creation` intent bucket and specialist prompt
- `lib/ai/documentCreationTools.ts`: `DOCUMENT_CREATION_TOOLS` (4 tools)
- `app/api/chat/route.ts`: `document_creation` routing branch

**In `components/layout/AppShell.tsx`:**
- `mode === 'documents'` currently renders `<Placeholder title="Documents" />` — replace this with `<DocumentsPanel />`
- `Mode` type already includes `'documents'`

---

## Acceptance Criteria

**AC1 — Document List:**
Given the Owner taps "Documents" in the nav,
When the panel opens,
Then it shows a filterable list of all documents belonging to the Owner ordered by `created_at` descending,
With columns: title, type label, status pill (color-coded), linked client/deal name, last-modified date.
And it is filterable by status (all | draft | review | sent | signed | archived) via pill tabs above the list.
And tapping any row opens the Document Viewer for that document.
And if there are no documents, an empty state is shown: "Chưa có tài liệu nào. / No documents yet." with a hint to ask ARIA to draft one.

**AC2 — Document Viewer Header:**
Given the Owner opens a document,
When the viewer renders,
Then the header displays:
  - Document `title` (static text; not inline-editable in this story)
  - Status pill: colored chip — draft=#475569, review=#d97706, sent=#2563eb, signed=#16a34a, archived=#94a3b8 — with label in Vietnamese (Nháp / Đang xét / Đã gửi / Đã ký / Lưu trữ)
  - Version indicator: "v{N}" showing the currently displayed version
  - A "← Back" button that returns to the list view

**AC3 — Edit Mode:**
Given the Owner clicks "Edit" in the viewer toolbar,
When edit mode is active,
Then the document body switches from rendered Markdown to a plain textarea containing `content_md`.
And on 2-second user-typing idle OR explicit "Save" button press, the system calls `POST /api/documents/[id]/save` with `{content_md, created_by: "human"}`.
And the API creates a new version row via `saveDocumentVersion` and returns the new `DocumentRow`.
And the viewer silently updates the version indicator to the new version number.
And an `activity_log` entry is written with `action="document_edited"`, `actor=user` (done inside `saveDocumentVersion`).
And "Save" is disabled / shows a spinner while the request is in flight.

**AC4 — Version Selector:**
Given the viewer is open and the document has more than one version,
When the Owner clicks the version indicator ("v3"),
Then a dropdown appears listing all versions (e.g. "v1 — ARIA — 2026-06-01", "v2 — You — 2026-06-15").
And selecting a version renders that version's `content_md` in read-only Markdown mode (not edit mode).
And the version indicator updates to show the selected version.
And a "Viewing v2 (read-only)" banner is shown when viewing a non-latest version.

**AC5 — Version History Slide-over:**
Given the Owner clicks "History" in the viewer toolbar,
When the slide-over opens (from right side),
Then it lists all versions in reverse chronological order (newest first), each row showing: "v{N}", created_by display ("ARIA" if ai, "You" if human), and `created_at` formatted as "DD MMM YYYY HH:mm".
And clicking any version row shows a simple line-by-line diff of that version vs the previous version, with added lines prefixed "+" and highlighted in success tint (#dcfce7 background), removed lines prefixed "−" and highlighted in danger tint (#fee2e2 background), unchanged lines shown normally.
And there is a close / "×" button to dismiss the slide-over.

**AC6 — Change Status:**
Given the Owner clicks "Status" in the viewer toolbar,
When the inline dropdown opens (not a modal),
Then it shows only legally forward-moving transitions from current status:
  - draft → review, archived
  - review → sent, archived
  - sent → signed, archived
  - signed → archived
  - archived → (no options shown; button disabled)
And selecting "Sent" shows a confirmation prompt inline: "Ghi vào lịch sử hoạt động?" / "Log to activity feed?" with [Yes] [No] buttons.
And on confirmation (Yes or any other status), `PATCH /api/documents/[id]/status` is called with `{status}`.
And the status pill in the header updates immediately on success.
And an `activity_log` entry is written (done inside `updateDocumentStatus`).

**AC7 — Ask ARIA about this doc:**
Given the Owner clicks "Ask ARIA" in the viewer toolbar,
When the action fires,
Then the app switches to `mode = 'chat'` (using the AppShell setMode callback) and pre-populates the Chat input bar with "Tell me about [document title]" (editable, NOT auto-sent — Owner agency preserved).

**AC8 — New document auto-open:**
This story does NOT need to implement auto-switch-to-viewer when ARIA creates a document via chat. That cross-panel communication is deferred to Story 3.6. The `documents` panel simply reloads its list when switched to.

---

## Tasks / Subtasks

- [x] Task 1 — API routes for documents
  - [x] `app/api/documents/route.ts` — GET handler: authenticate user, call `listDocuments(user.id, {status?, limit: 50})`, return JSON array. Accept optional `?status=` query param.
  - [x] `app/api/documents/[id]/route.ts` — GET handler: authenticate, call `getDocument(user.id, {id})`, return 404 if null, else return DocumentRow JSON.
  - [x] `app/api/documents/[id]/save/route.ts` — POST handler: authenticate, parse body `{content_md, created_by}`, call `saveDocumentVersion(user.id, {source_id: id, content_md, created_by})`, return new DocumentRow.
  - [x] `app/api/documents/[id]/status/route.ts` — PATCH handler: authenticate, parse body `{status}`, call `updateDocumentStatus(user.id, {id, status, actor: 'user'})`, return `{updated}`.
  - [x] `app/api/documents/[id]/versions/route.ts` — GET handler: authenticate, call `listDocumentVersions(user.id, id)`, return JSON array.

- [x] Task 2 — DocumentsPanel shell component
  - [x] Create `components/documents/DocumentsPanel.tsx` — client component (`'use client'`)
  - [x] Internal state: `view: 'list' | 'viewer'`, `selectedDocId: string | null`
  - [x] In `list` view: renders `<DocumentList onSelect={(id) => { setSelectedDocId(id); setView('viewer') }} />`
  - [x] In `viewer` view: renders `<DocumentViewer id={selectedDocId} onBack={() => setView('list')} onOpenChat={onOpenChat} />`
  - [x] Export prop: `onOpenChat: (prefill: string) => void` — passed in from AppShell to switch mode to 'chat' and prefill input

- [x] Task 3 — DocumentList component
  - [x] Create `components/documents/DocumentList.tsx` — client component
  - [x] On mount fetch `GET /api/documents` to load list; store in local state
  - [x] Status filter tabs: All | Nháp | Đang xét | Đã gửi | Đã ký | Lưu trữ — clicking filters by status (re-fetches or client-side filter)
  - [x] List renders rows with: title (truncated at 60 chars), type chip, status pill (color per AC2), client/deal column ("—" if null), relative date
  - [x] Empty state message per AC1
  - [x] Loading skeleton: 3 grey placeholder rows while fetching
  - [x] Clicking a row calls `onSelect(doc.id)`

- [x] Task 4 — DocumentViewer component
  - [x] Create `components/documents/DocumentViewer.tsx` — client component
  - [x] Props: `id: string`, `onBack: () => void`, `onOpenChat: (prefill: string) => void`
  - [x] On mount: fetch `GET /api/documents/[id]` for current doc, then fetch `GET /api/documents/[id]/versions` for version list
  - [x] State: `doc: DocumentRow | null`, `versions: DocumentRow[]`, `editMode: boolean`, `editContent: string`, `displayVersion: DocumentRow | null`, `saving: boolean`, `showHistory: boolean`, `showStatusMenu: boolean`
  - [x] Header: back button, title, status pill, version indicator (clickable to open version dropdown)
  - [x] Toolbar buttons: Edit | Save (in edit mode) | History | Status | Ask ARIA
  - [x] Body: when `!editMode` → `<MarkdownRenderer content={displayVersion?.content_md ?? ''} />` (reuse existing `components/chat/MarkdownRenderer.tsx`)
  - [x] Body: when `editMode` → `<textarea value={editContent} onChange=... />` styled with monospace font, full height
  - [x] Autosave: `useRef` debounce timer, 2000ms; triggers `POST /api/documents/[id]/save`; clears timer on every keystroke; also fires on "Save" button click
  - [x] Version dropdown: shown below version indicator, lists all versions from `versions` state
  - [x] When `displayVersion !== doc` (viewing old version): show read-only banner
  - [x] "Ask ARIA" button: calls `onOpenChat('Tell me about ' + doc.title)`

- [x] Task 5 — VersionHistoryPanel slide-over
  - [x] Create `components/documents/VersionHistoryPanel.tsx` — client component
  - [x] Props: `versions: DocumentRow[]`, `onClose: () => void`
  - [x] Renders as a right-side overlay (fixed position, z-index above main content, `w-80` or 320px)
  - [x] Lists versions in reverse order (versions[...].reverse())
  - [x] Each row shows: "v{N}", created_by ("ARIA" | "You"), formatted date
  - [x] On row click: show diff of clicked version vs previous version (inline below the row)
  - [x] Diff implementation: split `content_md` of both versions by `\n`, compute line-level diff (added/removed/unchanged using a simple two-pointer or LCS approach — no external library), render with +/− prefixes and color backgrounds
  - [x] Close button top-right

- [x] Task 6 — Wire AppShell
  - [x] In `components/layout/AppShell.tsx`: import `DocumentsPanel`
  - [x] Add `chatPrefill: string` state and `setChatPrefill` setter; pass to `ChatPanel` as a new `initialPrefill` prop
  - [x] Replace `{mode === 'documents' && <Placeholder title="Documents" />}` with `{mode === 'documents' && <DocumentsPanel onOpenChat={(text) => { setChatPrefill(text); setMode('chat') }} />}`
  - [x] In `ChatPanel.tsx` or `InputBar.tsx`: accept optional `initialPrefill?: string` prop and pre-populate the input when it changes (using `useEffect` on the prop); clear prefill after it is consumed

- [x] Task 7 — Story-specific tests (`lib/__tests__/documentViewer33.test.ts`)
  - [x] `export {}` first line, NO project lib/ imports
  - [x] T1: STATUS_TRANSITIONS map: draft→[review, archived], review→[sent, archived], sent→[signed, archived], signed→[archived], archived→[]
  - [x] T2: computeDiff(['a','b','c'], ['a','x','c']) → [{type:'unchanged',line:'a'}, {type:'removed',line:'b'}, {type:'added',line:'x'}, {type:'unchanged',line:'c'}]
  - [x] T3: computeDiff([], ['x']) → [{type:'added',line:'x'}]
  - [x] T4: computeDiff(['x'], []) → [{type:'removed',line:'x'}]
  - [x] T5: computeDiff(['a','b'], ['a','b']) → all unchanged
  - [x] T6: formatVersionLabel('ai', '2026-06-01T10:00:00Z') → contains 'ARIA', 'Jun 2026', separator
  - [x] T7: formatVersionLabel('human', '2026-06-15T09:30:00Z') → contains 'You', 'Jun 2026', separator
  - [x] T8: STATUS_LABEL map: draft=Nháp, review=Đang xét, sent=Đã gửi, signed=Đã ký, archived=Lưu trữ
  - [x] T9: STATUS_COLOR map: each status has a defined hex color
  - [x] T10: truncateTitle('VeryLongClientName_Proposal_2026-06-01_v1_extra', 60) truncates at 60 chars with ellipsis
  - [x] T11: truncateTitle('Short', 60) returns unchanged
  - [x] T12: API routes exist — use `fs.existsSync` to assert `app/api/documents/route.ts` exists
  - [x] T13: `app/api/documents/[id]/save/route.ts` exists
  - [x] T14: `app/api/documents/[id]/status/route.ts` exists
  - [x] T15: `app/api/documents/[id]/versions/route.ts` exists
  - [x] T16: `components/documents/DocumentsPanel.tsx` exists
  - [x] T17: `components/documents/DocumentViewer.tsx` exists
  - [x] T18: `components/documents/DocumentList.tsx` exists
  - [x] T19: `components/documents/VersionHistoryPanel.tsx` exists
  - [x] T20: AppShell source contains 'DocumentsPanel' import

- [x] Task 8 — Add npm test script and run CI triad
  - [x] Add `"test:document-viewer33": "npx ts-node lib/__tests__/documentViewer33.test.ts"` to `package.json`
  - [x] Run `npx tsc --noEmit` — clean (no output)
  - [x] Run `npx next lint` — no ESLint warnings or errors
  - [x] Run `npm run test:document-viewer33` — 24 passed, 0 failed

- [x] Task 9 — Update story status
  - [x] Set story frontmatter `status: done`
  - [x] Update `sprint-status.yaml`: `3-3-document-viewer-read-edit-and-version-history: done`

---

## Dev Notes

### Architecture Constraints (Non-Negotiable)

- **AD-2**: Every API route must call `supabase.auth.getUser()` first and pass `user.id` as `ownerId` to every service call. Never query without owner scope.
- **AD-11**: `lib/crm/documentService.ts` already has `import 'server-only'`. API routes in `app/api/` do NOT need `import 'server-only'` — they are Route Handler modules (Next.js marks them server-only automatically). Components in `components/` are client components and must NOT import from `lib/crm/`.
- **AD-13**: API routes must call `createServerClient()` from `@/lib/supabase/server`, NEVER `createServiceClient()`.
- **AD-1**: `@anthropic-ai/sdk` is never needed in this story — no AI calls.
- **AD-14**: Document editing always creates a NEW row via `saveDocumentVersion` — never UPDATE the content of an existing row.

### API Route Pattern (follow exactly)

Follow the existing pattern in `app/api/deals/[id]/route.ts`:

```typescript
import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { someServiceFunction } from '@/lib/crm/documentService'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })

  const result = await someServiceFunction(user.id, params.id)
  if (!result) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 })
  return new Response(JSON.stringify(result), {
    headers: { 'Content-Type': 'application/json' },
  })
}
```

### Component Pattern

Client components (`'use client'`) fetch data via the API routes — they never import from `lib/crm/` or `lib/ai/`. They call `fetch('/api/documents/...')` directly.

### Existing Component to Reuse

- `components/chat/MarkdownRenderer.tsx` — reuse for rendering `content_md` in read mode. Import it in `DocumentViewer.tsx`.

### Status Transitions (AC6 legal moves only)

```typescript
const STATUS_TRANSITIONS: Record<DocumentStatus, DocumentStatus[]> = {
  draft: ['review', 'archived'],
  review: ['sent', 'archived'],
  sent: ['signed', 'archived'],
  signed: ['archived'],
  archived: [],
}
```

### Autosave Implementation

```typescript
const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

function handleContentChange(value: string) {
  setEditContent(value)
  if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
  saveTimerRef.current = setTimeout(() => triggerSave(value), 2000)
}

async function triggerSave(content: string) {
  if (saving) return
  setSaving(true)
  const res = await fetch(`/api/documents/${id}/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content_md: content, created_by: 'human' }),
  })
  if (res.ok) {
    const newDoc: DocumentRow = await res.json()
    setDoc(newDoc)
    setVersions(prev => [...prev, newDoc])
    setDisplayVersion(newDoc)
  }
  setSaving(false)
}
```

### Diff Algorithm

Keep it simple — no external library needed. Line-level diff using a greedy approach:

```typescript
type DiffLine = { type: 'added' | 'removed' | 'unchanged'; line: string }

function computeDiff(oldLines: string[], newLines: string[]): DiffLine[] {
  const result: DiffLine[] = []
  let i = 0, j = 0
  while (i < oldLines.length || j < newLines.length) {
    if (i >= oldLines.length) { result.push({ type: 'added', line: newLines[j++]! }); continue }
    if (j >= newLines.length) { result.push({ type: 'removed', line: oldLines[i++]! }); continue }
    if (oldLines[i] === newLines[j]) { result.push({ type: 'unchanged', line: oldLines[i]! }); i++; j++ }
    else { result.push({ type: 'removed', line: oldLines[i++]! }); result.push({ type: 'added', line: newLines[j++]! }) }
  }
  return result
}
```

Note: This is a greedy (not LCS) diff — it won't produce perfect diffs for complex moves, but is sufficient for MVP document versioning.

### Status Color Mapping

```typescript
const STATUS_COLOR: Record<DocumentStatus, string> = {
  draft: '#475569',
  review: '#d97706',
  sent: '#2563eb',
  signed: '#16a34a',
  archived: '#94a3b8',
}

const STATUS_LABEL: Record<DocumentStatus, string> = {
  draft: 'Nháp',
  review: 'Đang xét',
  sent: 'Đã gửi',
  signed: 'Đã ký',
  archived: 'Lưu trữ',
}
```

### Date Formatting

No external library. Use `Intl.DateTimeFormat`:

```typescript
function formatVersionLabel(createdBy: 'ai' | 'human', createdAt: string): string {
  const who = createdBy === 'ai' ? 'ARIA' : 'You'
  const d = new Date(createdAt)
  const fmt = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    hour12: false,
  })
  return `${who} · ${fmt.format(d)}`
}
```

### ChatPanel prefill integration

In `AppShell.tsx`, add state:
```typescript
const [chatPrefill, setChatPrefill] = useState('')
```

Pass to ChatPanel: `<ChatPanel initialPrefill={chatPrefill} onPrefillConsumed={() => setChatPrefill('')} />`

In `InputBar.tsx` (or `ChatPanel.tsx`), `useEffect(() => { if (initialPrefill) setInput(initialPrefill) }, [initialPrefill])`.

Do NOT auto-submit — just set the input value so the Owner can review and edit before sending.

### Test File Pattern

Tests must:
1. Start with `export {}`
2. Use `import fs from 'fs'` and `import path from 'path'` for file existence checks (this is the pattern established in Story 3.2 — ES module imports work fine with ts-node)
3. Inline all logic — no imports from project `lib/`
4. Inline the pure helper functions (`computeDiff`, `formatVersionLabel`, `STATUS_TRANSITIONS`, etc.) to test them in isolation

---

## Dev Agent Record

### Implementation Plan
1. Created 5 API routes under `app/api/documents/` following AD-2/AD-13 pattern (server client, owner-scoped).
2. Created `components/documents/DocumentsPanel.tsx` as the shell orchestrating list↔viewer navigation.
3. Created `components/documents/DocumentList.tsx` with status filter tabs, loading skeleton, empty state, and row rendering.
4. Created `components/documents/DocumentViewer.tsx` with all spec-exact helpers (`computeDiff`, `formatVersionLabel`, `STATUS_TRANSITIONS`, `STATUS_COLOR`, `STATUS_LABEL`, `truncateTitle`) exported for test reuse; autosave via `useRef` debounce; version dropdown; old-version read-only banner; status transitions with inline confirmation for "sent"; "Ask ARIA" prefill wiring.
5. Created `components/documents/VersionHistoryPanel.tsx` as a right-side slide-over with greedy line-level diff rendered inline per version row.
6. Wired `AppShell.tsx`: imported `DocumentsPanel`, added `chatPrefill` state, replaced Documents placeholder, passed `initialPrefill`/`onPrefillConsumed` to `ChatPanel`.
7. Updated `ChatPanel.tsx` to accept `initialPrefill`/`onPrefillConsumed` props and added `useEffect` to populate the input bar without auto-sending.
8. Created `lib/__tests__/documentViewer33.test.ts` with 24 passing tests (covering T1–T20 story spec plus T1b–T1e sub-cases for all STATUS_TRANSITIONS entries).

### Debug Log
- T6/T7 timezone issue: `Intl.DateTimeFormat` renders in local timezone (UTC+7 on dev machine), so exact time assertions like `10:00` failed. Fixed by asserting on timezone-invariant parts: prefix (`ARIA`/`You`), month/year (`Jun 2026`), and separator (` · `).

### Completion Notes
- All 9 tasks complete, all ACs satisfied.
- CI triad: `npx tsc --noEmit` clean, `npx next lint` no warnings, `npm run test:document-viewer33` 24/24 passed.
- AD-11 enforced: all components use `fetch('/api/documents/...')` — no direct `lib/crm/` imports.
- AD-14 enforced: editing creates new version row via `saveDocumentVersion`, never mutates existing rows.
- AD-2/AD-13 enforced: all API routes call `createServerClient()` and gate on `supabase.auth.getUser()`.
- Prefill is NOT auto-sent — Owner must press Send (AC7 Owner agency preserved).

---

## File List

New files to create:
- `app/api/documents/route.ts`
- `app/api/documents/[id]/route.ts`
- `app/api/documents/[id]/save/route.ts`
- `app/api/documents/[id]/status/route.ts`
- `app/api/documents/[id]/versions/route.ts`
- `components/documents/DocumentsPanel.tsx`
- `components/documents/DocumentList.tsx`
- `components/documents/DocumentViewer.tsx`
- `components/documents/VersionHistoryPanel.tsx`
- `lib/__tests__/documentViewer33.test.ts`

Files to modify:
- `components/layout/AppShell.tsx` (wire DocumentsPanel, add chatPrefill state)
- `components/chat/ChatPanel.tsx` and/or `components/chat/InputBar.tsx` (accept initialPrefill prop)
- `package.json` (add test:document-viewer33 script)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (3-3 → done)

---

## Change Log
- 2026-06-29: Story 3.3 implemented — Document Viewer with read/edit/version history UI, 5 API routes, AppShell + ChatPanel wiring, 24 tests passing.
