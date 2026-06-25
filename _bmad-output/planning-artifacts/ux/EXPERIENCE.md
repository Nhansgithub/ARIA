---
title: ARIA — Experience Contract
status: final
updated: 2026-06-25
sources:
  - _bmad-output/planning-artifacts/PRD.md (v2.0, source of truth)
  - DESIGN.md (visual identity — final; tokens referenced by {path} below)
---

# ARIA — Experience Contract

> DESIGN.md owns how it looks. This file owns how it works. Wherever a {token} is cited, DESIGN.md supplies the value. Any conflict between this file and PRD.md: PRD.md wins. Any conflict between this file and DESIGN.md on visual matters: DESIGN.md wins.

---

## Foundation

**Form factor:** Responsive web, PWA-friendly. Chat is primary; all other surfaces are secondary panels reachable from chat. Single-column on mobile (`< md`); two-column sidebar + main panel on `≥ md`. No native shell is shipped in v1; PWA installability is a low-cost add (manifest + service worker) that gives icon and standalone display on iOS/Android without a separate build.

**UI system:** Custom components built on Next.js + Tailwind CSS. No component library mandated (shadcn may be used selectively for primitives: Dialog, Toast, Skeleton, Sheet); all deviations from library defaults are resolved by the DESIGN.md token layer. This file describes behavior; DESIGN.md describes appearance.

**Visual identity:** DESIGN.md is the single source of visual truth. This file references its tokens by path — {colors.bg}, {colors.surface}, {colors.surfaceRaised}, {colors.border}, {colors.primary}, {colors.accent}, {colors.text}, {colors.textMuted}, {colors.success}, {colors.warning}, {colors.danger} for color; {typography.heading}, {typography.body}, {typography.mono} for type; {rounded.sm} through {rounded.full} for radii; {spacing.N} for the 4px-scale spacing system. Direction: Focused Dark.

**Language environment:** The app is bilingual Vietnamese/English. The `lang` attribute on `<html>` follows the *current UI display language* (default `vi`). Screen-reader-bound spans of the opposite language are wrapped with `lang="en"` or `lang="vi"` as appropriate. All date/number formatting follows the active locale.

---

## Information Architecture

ARIA presents three mutually exclusive **panel modes** inside one persistent shell. The shell never disappears; only the main panel contents change.

### Shell

```
┌────────────────────────────────────────────────────────┐
│  [≥ md] Left nav (64px collapsed / 220px expanded)     │
│          + Main panel (flex-1)                         │
│  [< md]  Bottom tab bar (4 items) + full-screen panel  │
└────────────────────────────────────────────────────────┘
```

**Left nav items (desktop, top-to-bottom):**

| Icon + Label | Route hint | Panel mode activated |
|---|---|---|
| Chat (default active) | `/` | Chat |
| Briefing | `/briefing` | Briefing |
| Docs | `/docs` | Document list → Document viewer |
| Settings | `/settings` | Settings panel |

- Notification indicator: a {colors.accent}-filled pill with integer count sits on the Briefing nav item when there are unread high-urgency items (FR-38). Count clears when the user opens Briefing and scrolls past flagged items or explicitly dismisses them.
- Nav items use {colors.text} at rest; {colors.primary} when active; {colors.textMuted} for icon-only collapsed state.
- On mobile, nav becomes a bottom tab bar with the same four items. Active tab: {colors.primary} icon + label. Inactive: {colors.textMuted}.

### Panel Modes

#### 1. Chat (default)

The default surface. Always restored when the user navigates back from another mode. Conversation transcript + input bar occupy the full panel. No secondary column in v1.

Trigger conditions:
- App open (if no unseen Briefing exists).
- User taps "Chat" in nav.
- A Briefing item is tapped → Chat opens with that item **pre-queued** (item text injected as pending message, visible in input bar, not yet sent — user can edit or press Send).
- After Document viewer "Ask ARIA about this doc" action.

#### 2. Document Viewer

Replaces the main panel when a Document is created, retrieved, or selected from the Docs list.

Anatomy (top-to-bottom):
1. **Header bar:** document name (editable inline, {typography.heading}), status pill, linked deal/client chip (tappable → opens deal context in Chat), version selector (e.g. "v3").
2. **Toolbar:** Edit | Export PDF | Change Status | History | (overflow: Delete).
3. **Body:** rendered markdown, full-width, {typography.body}, scrollable.
4. **Footer:** last modified timestamp ({colors.textMuted}), word count.

The viewer is read-only by default; "Edit" switches to a markdown textarea. Save on blur or explicit "Save" button; creates new version silently. "History" opens a slide-over listing versions with diff-on-click.

Trigger: `FR-32` — creating or retrieving any Document auto-switches to this mode.

#### 3. Briefing Panel

Full-panel take-over. Fixed structure per `FR-26`:

1. **Section: Today** — max 3 ranked action items. Each item: title, one-line rationale, recommended action, tappable → Chat pre-queue.
2. **Section: Pipeline Snapshot** — active deal count, total estimated value, stage distribution. Prose, not a table.
3. **Section: Documents Pending** — documents in draft/review status, linked deal.
4. **Section: This Week's Focus** — ARIA's single strategic recommendation for the week.
5. **Section: Slow-Moving Deals** — deals > 7 days without activity; each with days-stale count.

Footer: "Generated [time] · Refresh" link. Cached; refresh triggers a new generation call. On first-run/empty (FR-36), the Briefing panel is suppressed and the guided welcome runs instead (see Key Flows §UJ-6).

#### 4. Settings Panel

Accessible from nav. Sub-sections: Business Context (view + edit), Notification Channels (Zalo OA setup, email, in-app toggles), Check-in Cadence (global and per-deal), Account (email/password, data export). Settings panel is a standard form surface; no panel-mode switch; back returns to Chat.

### Surface Coverage Map (PRD → IA)

| PRD Surface / Need | ARIA Surface |
|---|---|
| Chat + markdown rendering (FR-33) | Chat panel |
| Document creation/viewing/versioning (FR-19–FR-22, FR-32) | Document viewer |
| Daily Briefing, landing on open (FR-27, FR-26) | Briefing panel |
| Proactive check-ins (FR-17, FR-18) | In-app: Chat panel (check-in card injected as ARIA message); external: Zalo/email |
| Business Context view/edit (FR-4) | Settings → Business Context |
| Zalo OA one-time setup (FR-28, FR-36) | Settings → Notification Channels (also offered in first-run flow) |
| Check-in cadence config (FR-18) | Settings → Check-in Cadence |
| Notification badge (FR-38) | Briefing nav item pill |
| Document list / vault access | Docs nav item → panel listing all docs, filterable by status/client |
| First-run / empty state (FR-36) | Chat panel with guided welcome overlay |
| Authentication (FR-34) | Dedicated auth route `/login` outside the shell |

---

## Voice and Tone

### Governing rules

1. **Language mirroring (FR-2):** Every advisory reply matches the language of the Owner's last message. Client-facing document drafts follow the Client's `language_pref` (default Vietnamese).
2. **Guidance stance (FR-3):** Every advisory or Deal Intelligence reply ends with a concrete next step and its rationale, unless the Owner signaled "information only." ARIA reasons out loud; it does not state conclusions without evidence.
3. **Vietnamese advisory register:** Warm, professional, not formal-cold. Use "Anh" when addressing Nhan. Acknowledge problems obliquely ("Có vẻ phần này cần xem lại" not "Anh chưa làm"). No urgency language ("gấp lắm," "cuối cùng rồi"). Numbers and data stated directly; softened framing around judgment.
4. **English advisory register (SM-C3 calibration):** Direct, analytical, concise. Give the recommendation first, evidence second. Do not over-explain to the expert; trust that Nhan can follow a short logical chain. No filler phrases ("Great question!", "Certainly!").
5. **Client-facing Vietnamese drafts:** Relationship-preserving, appropriately hierarchical (Anh/Chị for the client contact), indirect about problems. Emojis acceptable in Zalo register. Match or slightly exceed the formality of the client's last message.

### Microcopy examples

**Empty state (first run, Chat, Vietnamese):**
> "Chào Anh Nhan! Em là ARIA — trợ lý kinh doanh của anh. Anh chưa có deal nào cả, mình bắt đầu bằng cách anh kể cho em nghe một khách đang thương lượng được không? Không cần điền form — cứ kể tự nhiên."

**Empty state (first run, English fallback):**
> "Hey Nhan. I'm ARIA — your business consultant. No deals on record yet. Tell me about one you're currently working — no form, just talk."

**Streaming indicator (below input bar, Vietnamese):**
> "ARIA đang phân tích…"

**Streaming indicator (English):**
> "ARIA is thinking…"

**Degraded-AI banner (FR-5, Vietnamese):**
> "AI tạm thời không khả dụng — đang hiển thị dữ liệu thô. Phân tích sẽ trở lại khi kết nối phục hồi."

**Degraded-AI banner (English):**
> "AI synthesis unavailable — showing raw data. Analysis will resume when the connection recovers."

**Check-in quick-reply chip prompt (Vietnamese, UJ-3):**
> "Deal Phở 24 — có gì mới từ thứ Ba không?"
> Chips: [Họ phản hồi rồi] [Vẫn đang chờ] [Cần nhắc thêm]

**Check-in quick-reply chip prompt (English):**
> "Phở 24 proposal — any movement since Tuesday?"
> Chips: [They responded] [Still waiting] [Needs a nudge]

**Error (network, Vietnamese):**
> "Mất kết nối. Thử lại không, Anh?"
> [Thử lại]

**Error (network, English):**
> "Lost connection. Retry?"
> [Retry]

**Stub creation confirmation (Vietnamese):**
> "Em đã tạo hồ sơ cho khách Phở 24 và deal website của họ. Anh có biết người quyết định là ai không?"

**Pricing floor flag (Vietnamese):**
> "Giá anh đề xuất thấp hơn mức thường thấy cho loại dự án này (~30–50M VND). Trước khi giảm giá, mình xem lại giá trị anh mang lại cho họ nhé?"

---

## Component Patterns

Behavioral. Appearance deferred to DESIGN.md.

### Chat Message

**User message:**
- Right-aligned bubble. {colors.surface} background, {colors.text} text, {rounded.lg}. Timestamp shown on hover/long-press ({colors.textMuted}, {typography.body} small). No copy action on user messages.
- Image attachment: thumbnail inline above text; tap to expand lightbox.

**ARIA message:**
- Left-aligned with a {colors.surface} background and a 2px {colors.primary} left-border accent (per DESIGN.md §7.1 — DESIGN.md wins on visual conflict). Avatar: "A" monogram or ARIA icon, {colors.primary} background. {typography.body}.
- Markdown rendered: headings ({typography.heading}), bullets, bold, tables, inline code ({typography.mono}, {colors.surfaceRaised} background), code blocks (syntax-highlighted, copy button top-right).
- **Collapse rule (FR-33 / §8 NFR):** ARIA messages > 400 rendered characters show the first ~400 chars + "Read more" affordance. Expanded state is sticky per session (user's expand choice persists until page reload). Collapsed threshold counts rendered text, not markdown source.
- **Copy:** a copy-to-clipboard icon appears on hover/focus (top-right of message). Copies plain text (no markdown syntax). Confirmation: icon briefly becomes a checkmark; no toast.
- Timestamp: always shown below the message ({colors.textMuted}), format "HH:mm" same day, "ddd HH:mm" older.
- Streaming state: a blinking cursor appended to the in-progress text; "Stop generation" button visible in input area (see Interaction Primitives).

### Deal / Briefing Card

Used in Briefing "Today" section and as structured ARIA responses for Deal Intelligence reads.

Anatomy:
- Header: client name + deal name ({typography.heading} small), status pill, days-since-activity badge ({colors.warning} if > 7 days).
- Body: up to 5 fields visible — inferred real need, top risk flag (with severity: {colors.danger} / {colors.warning}), top opportunity signal ({colors.success}), predicted outcome, next action.
- Footer: "Ask ARIA about this" → opens Chat pre-queued with this deal context.
- Max height on Briefing: 3 lines visible; overflow faded + "expand" chevron.

### Status Pill

Used on Document viewer header and deal cards. States and colors:

| Status | Color token | Label (VI / EN) |
|---|---|---|
| draft | {colors.textMuted} | Nháp / Draft |
| review | {colors.warning} | Đang xét / In review |
| sent | {colors.primary} | Đã gửi / Sent |
| signed | {colors.success} | Đã ký / Signed |
| archived | {colors.border} | Lưu trữ / Archived |
| stub | {colors.accent} | Chưa đủ thông tin / Incomplete |

Pills are non-interactive in read-only contexts; in Document viewer, clicking the pill opens a "Change Status" dropdown (inline, not a modal).

### Document Viewer + Actions

See IA §2 for anatomy. Behavioral rules:
- Edit mode: textarea with monospace font ({typography.mono}). Autosave on 2s idle or on explicit "Save." Save = new version; version number increments silently (shown in header version selector).
- "Export PDF": triggers a server call (no AI); spinner on button; downloads file on completion. File name: `{ClientName}_{DocumentType}_{YYYY-MM-DD}_v{N}.pdf`.
- "Change Status": inline dropdown, no modal. Selecting "Sent" prompts "Log to activity feed?" (yes/no chips, default yes).
- "History": right-side slide-over, list of versions with author (ai | you) and timestamp. Click any version to preview diff inline (side-by-side, added lines {colors.success} tint, removed lines {colors.danger} tint).
- "Ask ARIA about this": closes viewer, opens Chat, pre-queues "Tell me about [document name]" — editable before send.

### Check-in Quick-Reply Chips

Check-in messages from ARIA render with 2–3 chip options below the message body (FR-17, FR-18). Chips:
- Horizontal scroll on mobile if > 2 chips.
- {colors.surface} background, {colors.border} border, {rounded.full}, {typography.body} small.
- Tap: chip becomes {colors.primary} filled (selected state), message sent immediately (no separate send tap required). Other chips disable.
- After tap: chips disappear, replaced by the sent reply text in a user bubble, and ARIA's follow-on response streams in.
- If the Owner types a free-text reply instead, chips disappear on first keystroke.

### Image Upload / Paste (Vision, FR-9)

- Paste from clipboard (`Ctrl+V` / `Cmd+V`): image detected → preview thumbnail appears in input bar above text field; "×" button removes it.
- Upload: paperclip icon in input toolbar → file picker, accepts jpg/png/webp/heic, max 10 MB per image (limit displayed on hover/tap of icon), one image per message in v1.
- On send: thumbnail shown in user message; ARIA streams a vision-extraction response (see streaming state).
- Partially unreadable image: ARIA explicitly states extracted vs unextracted fields and asks the Owner to confirm gaps (FR-9 consequence).

### Stop Generation

- Visible whenever ARIA is streaming a response.
- Location: replaces the Send button in the input bar during streaming.
- Label: "Stop" (VI: "Dừng lại"), square-stop icon.
- Behavior: immediately halts the stream; the partial response is committed to the transcript with a "(stopped)" suffix in {colors.textMuted}. The input field re-enables.

### Start New Topic (FR-33, FR-35)

- Location: overflow menu (···) in the chat header, or keyboard shortcut `Ctrl+Shift+N` / `Cmd+Shift+N`.
- Label: "New topic" (VI: "Chủ đề mới").
- Behavior: clears the in-memory conversation context (resets to Business Context injection + system prompt only); does NOT delete CRM data, activity log, or past messages from the transcript view. Past messages remain visible above a visual divider — a full-width rule with label "New topic started — [time]" ({colors.border}, {colors.textMuted} label).
- Confirmation: a single non-modal tooltip ("Context cleared — CRM data kept") fades after 2s. No destructive-action dialog needed (the action is reversible via the transcript).

---

## State Patterns

### Loading / Streaming

| Moment | Treatment |
|---|---|
| App shell initial load | {colors.surfaceRaised} skeleton shapes matching nav + main panel layout. No spinner. |
| Briefing generation in progress | Skeleton rows matching Briefing section structure (Today: 3 rows, Pipeline: 1, etc.). |
| ARIA streaming a response | Blinking cursor at end of in-progress text. Stop button replaces Send. Input disabled. |
| Document saving | Save button shows spinner inline; input remains editable (optimistic). On success: version increments. On failure: toast (error variant): "Couldn't save — try again." |
| PDF export in progress | Export PDF button shows spinner; other actions remain enabled. |

### Empty / First-Run (FR-36)

Triggered when: authenticated, CRM has zero clients and zero deals.

Behavior:
- Briefing panel is **suppressed** (not shown on app open); Chat is the landing surface.
- Chat shows a centered welcome card (not a message bubble) with ARIA's introduction in one breath (~40 words), language-detected from browser locale (default Vietnamese).
- Below the card: a single input prompt "Kể cho em nghe một khách hàng anh đang thương lượng" / "Tell me about a deal you're working on."
- Business Context setup: offered as a conversational aside ("Trước khi bắt đầu, anh cho em biết về công ty mình một chút được không? Hoặc mình bắt đầu với deal luôn cũng được."). Skippable; defaults applied silently if skipped.
- Zalo OA setup: offered after the first Deal Intelligence read completes ("Anh muốn nhận thông báo qua Zalo không? Em có thể nhắc anh mỗi sáng."). One link; skippable.
- Scheduler (FR-25) does **not** fire for empty CRM; no empty Briefing or check-ins are sent.
- Notification badge: suppressed until first Deal is created.

### Degraded / AI Unavailable (FR-5)

Triggered when: Claude API returns error, timeout (> ~10s first token), or rate-limit.

Behavior:
- A full-width banner appears at the top of the main panel (not a toast): see microcopy examples above.
- Banner background: {colors.warning} tint; {colors.text} label; dismissible (×).
- Chat input remains enabled; a sent message while degraded returns structured CRM data only (deal status, fields, last activity) formatted as a plain response — no AI synthesis, no recommendations.
- Briefing: falls back to the last cached version with a sub-banner "Dữ liệu từ [time]" / "Data from [time]."
- No infinite spinner anywhere; a "Retry" link appears in degraded ARIA messages.
- When API recovers: banner auto-dismisses; no action from user required.

### Error

| Error | Treatment |
|---|---|
| Network lost mid-message | Toast (error): see microcopy. Retry CTA. Message held in input bar (not lost). |
| API error (non-degraded) | Inline under the ARIA message: "Something went wrong. [Retry]" — not a modal. |
| Image too large | Inline under attachment preview: "Ảnh quá lớn (max 10 MB)" / "Image too large (max 10 MB)." Attachment removed. |
| Auth session expired | Full-screen intercept: "Phiên đã hết hạn — đăng nhập lại" / "Session expired — sign in again." [Sign in] button. No data loss; input content preserved in sessionStorage. |
| PDF export failure | Toast: "Xuất PDF thất bại — thử lại" / "PDF export failed — try again." |

### Offline

- ServiceWorker detects `offline` event → a non-dismissible banner at top: "Không có kết nối internet" / "No internet connection."
- Read-only use continues: previously loaded transcript, Briefing, and Documents remain visible.
- Input bar disabled with tooltip "Cần kết nối để gửi tin nhắn" / "Connection required to send messages."
- On reconnect: banner clears automatically; input re-enables; pending state syncs.

### Long-Conversation Context Handling (FR-35)

- Durable business state lives in CRM; the AI call context is bounded.
- When a conversation exceeds the context budget (thresholds set in architecture, OQ-9), ARIA summarizes older turns server-side before the next AI call; the transcript view still shows all history.
- A visual divider in the transcript: "Earlier messages summarized for context efficiency" ({colors.border} rule, {colors.textMuted} label). This is informational; no user action required.
- "Start new topic" (see Component Patterns) is the user-facing reset mechanism.
- Once an image's content is extracted to the record, the raw image bytes are not re-sent on subsequent turns (FR-35 consequence).

### Zalo Not Set Up

- Check-ins and Briefing still deliver in-app even without Zalo (FR-38).
- In Settings → Notification Channels: a non-blocking info card "Zalo OA chưa kết nối — proactive notifications chỉ qua email và in-app." with "Connect Zalo OA" CTA.
- In the first check-in delivered in-app: a one-time note appended to the message "Bật Zalo OA để nhận tin nhắn này trong Zalo." (not shown again after dismissal).

---

## Interaction Primitives

### Send / Stop

- **Send:** Enter key (desktop) or tap Send button. Shift+Enter inserts newline.
- **Stop generation:** visible only during streaming; square-stop icon; keyboard: `Escape` while input is focused.
- After stop: input re-enables immediately; partial response committed.

### Copy

- Hover/focus any ARIA message → copy icon appears top-right.
- Keyboard: `Tab` to message → `C` (no modifier; only when message is focused, not when typing in input).
- Copies plain text. Icon shows checkmark for 1.5s.

### Image Paste

- `Ctrl+V` / `Cmd+V` anywhere on the Chat panel (not just in input) attaches a clipboard image.
- Drag-and-drop onto the chat panel also attaches (if supported by browser).
- Only one image per message in v1.

### Quick-Reply Chip Tap

- Tap sends the chip value as a user message immediately.
- No secondary confirmation.
- Keyboard: chips are focusable via Tab; Space/Enter activates.

### Nav Switching

- Clicking a nav item switches panel mode; pending input text is preserved in the input bar (not cleared) when switching away from Chat and back.
- Navigating to Briefing marks it as "seen" (clears the notification badge count for that Briefing day).
- Deep-linking: `/briefing`, `/docs`, `/docs/:id`, `/settings` are valid routes (PWA/browser history).

### Briefing Item → Chat Pre-Queue

- Tapping any Briefing "Today" item or Deal card "Ask ARIA" footer:
  1. Switches panel to Chat.
  2. Populates input bar with a pre-composed message (deal name + implied question), editable.
  3. Does NOT auto-send — user reviews and presses Send. (Rationale: owner agency; avoids accidental sends.)

### Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Enter` | Send message |
| `Shift+Enter` | Newline in input |
| `Escape` | Stop generation (if streaming); close dialogs/slide-overs |
| `Ctrl/Cmd+Shift+N` | Start new topic |
| `Ctrl/Cmd+V` | Paste image (if clipboard has image) |
| `Ctrl/Cmd+K` | (Reserved for future command palette — do not use in v1) |
| `Tab` (in transcript) | Move focus through messages (accessibility) |

---

## Accessibility Floor

All requirements are behavioral; visual contrast ratios and focus-ring appearance are governed by DESIGN.md (target: WCAG AA, ≥ 4.5:1 for normal text).

- **Touch targets:** minimum 44×44 CSS px for all interactive elements (chips, nav items, send button, copy icon, viewer toolbar buttons).
- **Focus rings:** always visible when keyboard-navigating; DESIGN.md specifies the ring style using {colors.primary}. Focus order matches reading order on every surface.
- **Keyboard completeness:** every interaction primitive (send, stop, copy, nav switch, chip tap, doc actions, settings save) is reachable without a pointer device.
- **`prefers-reduced-motion`:** blinking streaming cursor replaced by a static ellipsis. Skeleton fade-ins and status-pill transitions skipped. No other animation is motion-critical.
- **Alternative text:** ARIA-generated images (none in v1). User-uploaded images: `alt="Uploaded screenshot"` by default; after extraction, alt text is updated to the extracted summary (first 120 chars). ARIA monogram/icon: `aria-label="ARIA"`.
- **Form labels:** every Settings form input has a visible label (not placeholder-only). Placeholder text is supplementary, never the sole label.
- **Color-not-sole-indicator:** status pills always carry a text label alongside color. Risk severity uses shape + label (triangle icon + "HIGH") in addition to {colors.danger}. Notification badge carries a count number, not just a dot.
- **Vietnamese screen-reader:** `<html lang="vi">` default. English spans inside Vietnamese text: `<span lang="en">`. ARIA landmark roles: `<nav>`, `<main>`, `<aside>` for slide-overs. Screen reader announces panel switches: "Chat — conversation", "Briefing — daily summary", "Documents — [name]".
- **Live regions:** streaming ARIA response uses `aria-live="polite"` on the message container so screen readers announce completion (not mid-stream tokens). Check-in chips use `role="group"` with `aria-label` matching the question text. Toast notifications use `role="status"` or `role="alert"` depending on severity.
- **Contrast (deferred):** exact ratios defined in DESIGN.md. All token choices must pass AA. {colors.textMuted} on {colors.bg} must not be used for critical information (timestamps and supplemental labels only).

---

## Key Flows

### UJ-1 — Morning Briefing (Nhan opens ARIA at 7:45am)

1. Nhan taps the ARIA icon on his phone. App launches (PWA standalone).
2. App detects an unseen Briefing for today (generated by the overnight scheduler). The Briefing panel loads, skeleton rows resolve in < 1.5s.
3. **Today section** shows 3 ranked items: (1) "Phở 24 proposal — no response for 4 days, follow-up due," (2) "Bếp Nhà brief — draft ready for review," (3) "Gia Bình automation — discovery call scheduled today."
4. Each item shows a one-line rationale and a recommended action chip.
5. Nhan taps item 1 ("Phở 24 proposal"). The panel switches to Chat; input bar is pre-populated with "Phở 24 — đề xuất của em gửi 4 ngày rồi mà chưa thấy họ phản hồi. ARIA nghĩ sao?", editable.
6. Nhan presses Send.
7. **Climax:** ARIA streams a stall-diagnosis read (FR-12): "Với F&B, im lặng sau 4 ngày thường là đang chờ phê duyệt nội bộ, không phải mất hứng. Em gợi ý nhắn họ một tin ngắn…" and offers a draft Zalo follow-up.
8. Nhan taps "Dùng tin nhắn này" — a draft appears in Document viewer (a Zalo message draft, not a formal document, but viewable and copyable).
9. **Resolution:** Nhan copies the message to Zalo manually (ARIA does not send autonomously, per §5 non-goal). The deal's `next_action` and activity log are updated.

**Edge case (FR-5):** If the Claude API is unavailable, step 3 shows cached Briefing data with degraded banner. Step 6 returns structured deal data ("Phở 24: Proposal sent, 4 days idle, last contact [date]") with no synthesis. Retry link present.

---

### UJ-2 — New Deal + Screenshot (Nhan pastes a Zalo screenshot mid-conversation)

1. Nhan is in Chat. He types "Em vừa gặp một chủ chuỗi F&B — muốn làm website và 'có thể cả automation.'" and pastes a Zalo screenshot of the initial thread.
2. Input bar shows: text message + image thumbnail. He taps Send.
3. ARIA streams: extraction progress implied by streaming cursor. Response arrives: "Em đọc được từ ảnh: [tên công ty, loại hình, ngân sách chưa rõ, người liên hệ: Chị Lan]. Một vài thứ em không đọc rõ — anh confirm giúp: (1) Tên công ty đầy đủ? (2) Số cửa hàng hiện tại?" (FR-9 partial-extraction behavior).
4. Nhan confirms: "Phúc Long, 12 cửa hàng."
5. **Climax:** ARIA delivers a full Deal Intelligence read: understanding ("Phúc Long muốn brand presence + efficiency gains, chưa chắc biết họ muốn gì chính xác"), real need ("Standardize ordering UX across locations, not just a brochure site"), risk flags (SCOPE: HIGH — 'website và automation' = vague; DECISION-MAKER: UNKNOWN), opportunity signals (chain scale = upsell potential), prediction ("60% chốt trong 45 ngày nếu discovery tốt"), recommended approach (pain-mapping session, not a pitch), next action ("Hỏi Chị Lan: ai là người duyệt ngân sách?").
6. ARIA: "Em đã tạo hồ sơ cho Phúc Long và deal này." — Stub confirmed (FR-7). Asks 1 follow-up: "Anh có biết ai quyết định ngân sách không?" (FR-11).
7. **Resolution:** Nhan has a CRM record and a consultant's read without any form-filling. Intelligence Fields updated (FR-8).

**Edge case:** Low-quality screenshot → ARIA states "Em không đọc được phần [X] trong ảnh" and asks Nhan to confirm those fields manually.

---

### UJ-3 — Proactive Check-in (ARIA prompts Nhan 3 days after silence on a deal)

1. Nhan has been heads-down on delivery for 3 days. A scheduled check-in fires (FR-17 trigger: active deal, 3 days no activity, high priority).
2. In-app: an ARIA message appears in Chat (injected as if ARIA initiated the session, with a notification badge increment on the nav item).
3. Message: "Deal Phở 24 — có gì mới từ thứ Ba không?" followed by quick-reply chips: [Họ phản hồi rồi] [Vẫn đang chờ] [Cần nhắc thêm].
4. Simultaneously (if Zalo is set up): same message delivered to Zalo OA chat.
5. **Climax:** Nhan taps [Họ phản hồi rồi] on the Zalo message. ARIA captures the response, asks one follow-up: "Họ nói gì — chốt hay cần thêm thông tin?". Nhan types "Cần xem lại hợp đồng."
6. ARIA updates the deal: stage → "Contract review," `next_action` → "Send contract," activity log entry written (actor: ai + user). Intelligence Fields updated.
7. **Resolution:** Pipeline current; Nhan didn't have to remember anything.

**Edge case:** If Zalo message window is closed (OQ-5), Zalo delivery fails silently → email fallback fires with same content (FR-28/FR-29). In-app notification always present (FR-38).

---

### UJ-4 — Document Elicitation (Nhan asks for a proposal)

1. Nhan: "Draft a proposal for the Hanoi restaurant client."
2. ARIA fetches deal + client, identifies missing fields: budget confirmed? decision-maker confirmed? timeline agreed?
3. ARIA: "Trước khi em viết, cho em hỏi 3 điều: (1) Ngân sách anh đã confirm chưa? (2) Ai ký duyệt đề xuất bên họ? (3) Timeline mong muốn — anh có nói với họ chưa?" (FR-19 — ≤ 3 questions per turn).
4. Nhan answers all three.
5. ARIA presents a draft outline for approval: title, 5 sections with one-line descriptions. "Outline này ổn không anh?" (FR-19 — outline before generation).
6. Nhan: "Thêm một phần về quy trình làm việc."
7. ARIA updates outline, reconfirms.
8. Nhan approves. ARIA generates full proposal in markdown.
9. **Climax:** Panel switches to Document viewer. Header: "Phúc Long — Website Proposal — 2026-06-25 v1," status pill "Nháp." Nhan reads through; the document is correctly scoped, outcome-led, in Vietnamese.
10. ARIA (in Chat, alongside): "Em đã lưu đề xuất này. Khi nào anh sẵn sàng gửi thì chuyển trạng thái sang 'Đã gửi' — em sẽ nhắc anh follow-up sau 3 ngày nếu chưa có phản hồi."
11. **Resolution:** Versioned document exists; ARIA explains the follow-up cadence (teaching stance, FR-3). PDF export available (FR-21).

---

### UJ-6 — First Run / Empty ARIA (Day one, Nhan just registered)

1. Nhan completes email/password registration. App loads Chat panel (no Briefing — CRM is empty, FR-36).
2. Welcome card (centered, non-bubble): "Chào Anh Nhan! Em là ARIA — trợ lý kinh doanh của anh. Em sẽ giúp anh theo dõi pipeline, phân tích deal, và soạn tài liệu — chỉ qua trò chuyện, không cần điền form."
3. Below card: a single soft prompt "Anh đang thương lượng deal nào không? Kể cho em nghe đi."
4. Business Context offer (one line, dismissible): "Anh muốn cho em biết về công ty mình trước không? Hoặc bắt đầu với deal luôn cũng được." — If dismissed, defaults applied silently.
5. Nhan describes his first deal in natural language.
6. **Climax:** ARIA delivers a Deal Intelligence read (shorter, since no history or similar deals — FR-6 omission boundary), creates a Stub, confirms creation in the reply. Nhan has gotten value before doing any data entry.
7. ARIA: "Em đã lưu deal này. Từ từ em sẽ hỏi thêm khi cần. Anh muốn bật thông báo Zalo không?" (Zalo OA setup offer, FR-28).
8. Nhan taps "Để sau." Setup skipped; Settings remains available.
9. **Resolution:** ARIA explains what to expect next ("Mỗi sáng em sẽ tóm tắt những việc cần làm. Nếu deal có gì mới em sẽ nhắc anh."). Nhan understands the product loop without a tutorial. 

**Edge case:** Nhan skips the welcome entirely and types a random question. ARIA answers it, and opportunistically collects Business Context from the answer. No forced onboarding gate.

---

## Proactive Notifications — Cross-Channel Behavior

This section governs how ARIA's proactive outputs (Briefing, Check-ins, urgency alerts) reach Nhan across all three Delivery Channels. It is product-specific and has no direct parallel in generic design systems.

### Channel Priority and Fallback (FR-28, FR-29, FR-38)

```
In-app (always) → Zalo OA chat (preferred external) → Email (guaranteed fallback)
```

Rule: **no proactive item is ever silently dropped.** If Zalo fails or is not set up, email carries the same content. In-app always reflects the item on next open, independent of external channel success.

### Channel-Specific Rules

**In-app:**
- Check-in appears as an ARIA-initiated message in the Chat transcript.
- Briefing notification: badge count on the Briefing nav item.
- High-urgency alert (e.g. deal with imminent deadline): badge on Briefing nav item + a dismissible banner in Chat if the user is currently in Chat.
- All items persist until addressed (addressed = chip tapped, message replied to, or manually dismissed).

**Zalo OA:**
- Requires one-time Owner-follows-their-own-OA setup (onboarding, FR-36).
- Delivery uses OA chat (free-text), not ZNS templates (§11 constraint).
- Zalo messaging window: if the window is closed (assumed ~48h since the Owner last messaged the OA — to be validated against Zalo OA docs, OQ-5), delivery may fail. Email fallback fires automatically. ARIA does not retry the Zalo delivery.
- Check-in quick-reply chips are replicated as numbered text options in Zalo ("Trả lời: 1, 2, hoặc 3") since Zalo OA chat does not support button UI components. Responses captured as text matches.
- Zalo message format: text-only (no markdown). Truncated to Zalo's OA message character limit (per Zalo API spec; overflow → "Xem đầy đủ trong app ARIA").

**Email:**
- Triggered automatically when Zalo delivery is unconfirmed or not set up.
- Briefing email: plain-text + structured sections (same content as the Briefing panel). Subject: "ARIA Briefing — [date]" (VI: "ARIA Tóm tắt — [ngày]").
- Check-in email: same question text + numbered reply instructions ("Reply with 1, 2, or 3" — email parsing of structured replies is a future enhancement; v1 email is outbound-only, Owner replies in-app).
- Sent from a transactional address; unsubscribe link in footer (email compliance).

### Cadence Guardrails (SM-C1, FR-17)

- Global daily cap: at most N check-in messages per day (default: 3; configurable in Settings). Prevents notification spam.
- At most one check-in per deal per cadence window.
- Briefing fires once per day; no duplicate sends.
- If no eligible deals exist: no check-ins fire (FR-36 consequence).
- Urgency escalation: a deal that has been check-in-eligible for > 2 consecutive windows without a response has its priority elevated in the next Briefing "Today" section (not a separate notification blast).

### Notification Dot vs Badge

- **Dot** (no count): a deal or item has been updated but is low-urgency.
- **Badge with count** ({colors.accent} filled pill): one or more high-urgency unaddressed items. Count = number of unaddressed high-urgency items across Briefing + check-ins. Clearing: user opens Briefing AND taps/replies to each flagged item, or globally dismisses via "Mark all seen" in Briefing footer.

---

*End of EXPERIENCE.md contract. DESIGN.md (visual identity, token values) is final — all {token} references resolve. Gaps flagged for downstream: (1) Zalo OA button-UI limitation — check-in chips must degrade to numbered text in Zalo; confirm against Zalo API docs before Epic 5 story writing. (2) OQ-5 Zalo messaging-window (48h) policy — email-fallback cadence to be validated against Zalo's current policy before Epic 4/5 implementation.*
