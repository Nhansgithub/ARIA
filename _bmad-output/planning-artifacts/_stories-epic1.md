## Epic 1: Consultant Core

**Goal:** The Owner holds a real consultant conversation — asks, gets reasoned advice, and gets a Deal-Intelligence read (including pasting a Zalo screenshot) — in a working chat UI that teaches, mirrors language, degrades gracefully, and onboards from an empty state.

---

### Story 1.1: Chat UI Shell — Markdown Rendering, Streaming, Stop, and Copy

As an Owner, I want a fully functional chat interface that renders ARIA's responses as formatted text, streams replies in real time, lets me stop generation, and lets me copy any message, So that every subsequent epic can deliver readable, interactive responses from day one.

**Acceptance Criteria:**

**Given** the Owner is authenticated and on the Chat panel,
**When** ARIA sends a response containing Markdown (headers, bullets, bold, tables, inline code, fenced code blocks),
**Then** the rendered output displays formatted content — not raw Markdown symbols — using Plus Jakarta Sans for prose and JetBrains Mono for code blocks, consistent with DESIGN.md tokens. (FR-32, FR-33)

**Given** ARIA is generating a response,
**When** the first token arrives,
**Then** a blinking streaming cursor appears at the end of the in-progress text and the Send button is replaced by a "Stop" button (square-stop icon, label "Dừng lại" / "Stop", `#F87171` color, 44px min touch target). The input field is disabled during streaming. (FR-33; EXPERIENCE.md Stop Generation)

**Given** the Owner taps/clicks "Stop" while ARIA is streaming,
**When** the action completes,
**Then** the partial response is committed to the transcript with a "(stopped)" suffix in `textMuted` color, the Stop button reverts to Send, and the input field re-enables immediately. (FR-33)

**Given** an ARIA message is longer than 400 rendered characters,
**When** the message is displayed,
**Then** only the first ~400 chars are shown with a "Read more" affordance; tapping "Read more" expands the full message; the expanded state persists for that message within the session. (FR-33; §8 NFRs)

**Given** the Owner hovers over (desktop) or long-presses (mobile) any ARIA message,
**When** the copy affordance appears,
**Then** clicking/tapping it copies the message as plain text (no Markdown syntax); the icon briefly shows a checkmark for 1.5s; no toast is shown. (FR-33; EXPERIENCE.md Copy)

**Given** the Owner is on a mobile viewport (< 768px),
**When** the Chat panel renders,
**Then** the layout is single-column with the input bar pinned to the bottom; the sidebar is hidden and replaced by a bottom tab bar. (FR-32; DESIGN.md §4)

**Given** any ARIA message,
**When** a timestamp is rendered,
**Then** it shows "HH:mm" for same-day messages and "ddd HH:mm" for older ones, in `textMuted` style, below the bubble and always visible (not only on hover). (EXPERIENCE.md Chat Message)

**Given** the user bubble,
**When** rendered,
**Then** it is right-aligned with background `#1C2440`, radius `12px 12px 4px 12px`; the ARIA bubble is left-aligned with background `#141A2E`, a `2px solid #14B8A6` left-border accent, and radius `12px 12px 12px 4px`. (DESIGN.md §7.1)

---

### Story 1.2: Orchestrator — Intent Classification and Routing

As an Owner, I want every message I send to be classified into the right Interaction Mode and routed to the appropriate reasoning path, So that deal questions get deep analysis, document requests trigger elicitation, and ambiguous messages get a clarifying question rather than a wrong answer.

**Acceptance Criteria:**

**Given** the Owner sends a message describing a new or ongoing deal opportunity (e.g., "Vừa gặp một chủ F&B, họ muốn làm website"),
**When** the orchestrator classifies intent,
**Then** the message is routed to the Deal Intelligence reasoning path, not the plain Query path. (FR-1; AD-1)

**Given** the Owner sends a document request (e.g., "Draft a proposal for the Hanoi restaurant"),
**When** the orchestrator classifies intent,
**Then** the message is routed to the Document elicitation flow; no document is generated without elicitation. (FR-1; §4.5)

**Given** the Owner asks a pipeline or status question (e.g., "What deals are active?"),
**When** the orchestrator classifies intent,
**Then** the message is routed to the Sales/Pipeline reasoning path using the economical model (Haiku), not the high-judgment model. (FR-1; AD-4)

**Given** the Owner sends a business-level strategic question (e.g., "Should I lower my rates?"),
**When** the orchestrator classifies intent,
**Then** the message is routed to the Strategy Advisor path using the high-judgment model (Sonnet). (FR-1; AD-4)

**Given** the Owner sends an ambiguous message that fits multiple Interaction Modes,
**When** the orchestrator cannot confidently classify intent,
**Then** ARIA responds with a single clarifying question rather than guessing or defaulting to the wrong path. (FR-1)

**Given** any AI call from the orchestrator,
**When** the call is assembled,
**Then** the stable prefix (system prompt → tool definitions → Business Context) carries a `cache_control` breakpoint; volatile content (per-deal data, conversation turns) comes after the stable prefix. (AD-5)

**Given** any orchestrator or specialist AI call,
**When** the call is made,
**Then** it runs server-side only; the client never calls the Claude API directly. (AD-1; AD-3)

---

### Story 1.3: Bilingual Detection and Language Mirroring

As an Owner, I want ARIA to detect whether I write in Vietnamese or English and respond in the same language within the same conversation, So that I can switch languages naturally without configuring anything.

**Acceptance Criteria:**

**Given** the Owner sends a message in Vietnamese (e.g., "Khách hàng này có vẻ phức tạp lắm"),
**When** ARIA responds,
**Then** the response is in Vietnamese, using B2B-appropriate register (addressing the Owner as "Anh", acknowledging problems obliquely, no urgency language). (FR-2; §10)

**Given** the Owner sends a message in English (e.g., "What should I do with this stalled deal?"),
**When** ARIA responds,
**Then** the response is in English, direct and analytical, recommendation first, evidence second; no filler phrases ("Great question!", "Certainly!"). (FR-2; §10)

**Given** the Owner switches language mid-conversation (one message Vietnamese, the next English),
**When** ARIA responds to each message,
**Then** each response mirrors the language of that specific message, not the earlier ones. (FR-2)

**Given** ARIA is generating a client-facing document draft,
**When** the draft is produced,
**Then** it defaults to the Client's `language_pref` field (default Vietnamese), regardless of the Owner's current message language. (FR-2; addendum §B.1)

**Given** the app shell `<html>` element,
**When** rendered,
**Then** the `lang` attribute reflects the current UI display language (default `vi`); inline spans of the opposite language carry the appropriate `lang` attribute for screen-reader support. (EXPERIENCE.md Foundation)

---

### Story 1.4: Business Context Injection

As an Owner, I want ARIA to load my Business Context (agency info, pricing, rules) at the start of every session so its advice is grounded in my specific agency, So that every response is relevant without me re-explaining my situation in every conversation.

**Acceptance Criteria:**

**Given** the Owner begins a new session or sends their first message,
**When** the orchestrator assembles the context for its first AI call,
**Then** the Business Context document (≤ ~2,000 tokens) is injected as part of the stable prompt prefix; no bulk CRM data is pre-loaded — CRM data is fetched on demand via tools. (FR-4; AD-3; AD-5)

**Given** the Business Context contains pricing benchmarks (e.g., web design 20–80M VND, app 60–150M VND, automation 20–60M/workflow VND),
**When** ARIA gives advice that touches pricing,
**Then** the response reflects these benchmarks without the Owner needing to state them. (FR-4; FR-13; addendum §G)

**Given** the Owner navigates to Settings → Business Context,
**When** the Settings panel loads,
**Then** the current Business Context is displayed in an editable form; saving changes persists the update and logs an activity entry with `actor=user`. (FR-4)

**Given** ARIA updates the Business Context as part of a conversation (e.g., after learning the Owner's typical deposit rate),
**When** the update is written,
**Then** it is logged in the activity log with `actor=ai` and the change payload; the Owner is notified of the update in ARIA's reply. (FR-4; AD-14)

**Given** any AI call,
**When** the token budget for Business Context is assembled,
**Then** the injected context stays within ~2,000 tokens; if the stored Business Context exceeds this, it is summarized/trimmed before injection, and the trim is logged. (FR-4; §8 NFRs)

---

### Story 1.5: Guidance Stance Enforcement

As an Owner, I want every piece of advice or Deal Intelligence response from ARIA to explain the reasoning behind it and end with a concrete recommended next step, So that I learn business principles and always know what to do next, even when I have no prior business background.

**Acceptance Criteria:**

**Given** the Owner asks an Advice-mode question (e.g., "Should I lower my rates?"),
**When** ARIA responds,
**Then** the response names a specific recommendation (not just options), states the principle or evidence behind it, and ends with a concrete next step. (FR-3; §4.6)

**Given** the Owner asks a Deal Intelligence question about a specific deal,
**When** ARIA responds,
**Then** the response explains its reasoning out loud ("Based on your last 3 F&B deals…" / "From the domain pattern…") and ends with a single recommended next action. (FR-3; FR-6)

**Given** the Owner states a plan that ARIA detects is likely counterproductive (e.g., discounting a deal where the real objection is a trust gap),
**When** ARIA responds,
**Then** ARIA challenges the plan directly, names the actual issue, and explains the principle at stake — it does not silently accept the flawed premise. (FR-3; addendum §G)

**Given** the Owner explicitly signals they only want information (e.g., "Just tell me the deal status, no advice"),
**When** ARIA responds,
**Then** the response provides the information concisely without appending a next-step recommendation. (FR-3; SM-C3)

**Given** any advisory response in Query mode (pipeline status, field lookup),
**When** rendered,
**Then** the response is terse — it does not pad with guidance that was not needed; over-explanation is a failure mode. (FR-3; SM-C3; §8)

---

### Story 1.6: Graceful Degradation Envelope and UI Banner

As an Owner, I want ARIA to always return something useful — even when the Claude API is unavailable — and to tell me clearly when AI synthesis is offline, So that I am never left with an unhandled error or an infinite spinner.

**Acceptance Criteria:**

**Given** the Claude API returns an error, times out (> ~10s to first token), or is rate-limited,
**When** the degradation condition is detected,
**Then** a full-width degraded-AI banner appears at the top of the main panel with the exact copy: "AI synthesis is temporarily unavailable — showing raw data. Analysis will resume when the connection recovers." (VI: "AI tạm thời không khả dụng — đang hiển thị dữ liệu thô."); the banner uses `rgba(245,158,11,0.12)` background, `1px solid rgba(245,158,11,0.40)` border, `#FBBF24` text, and a Lucide `AlertTriangle` icon (color is not the sole indicator). (FR-5; AD-6; DESIGN.md §7.8)

**Given** the Owner sends a message while the AI is degraded,
**When** ARIA processes the request,
**Then** the response returns available structured CRM data (deal status, fields, last activity) formatted as plain text — no AI synthesis, no recommendations — with a "Retry" link inline. (FR-5; AD-6)

**Given** the daily Briefing generation fails due to API unavailability,
**When** the Briefing panel loads,
**Then** the last successfully cached Briefing is displayed with a sub-banner: "Dữ liệu từ [time]" / "Data from [time]." (FR-5; AD-6)

**Given** any AI-backed operation,
**When** an error occurs,
**Then** no interaction results in an unhandled exception or an indefinite spinner; the degradation envelope (`{ status: ok | degraded | error, data, degraded_reason? }`) is returned and the UI renders accordingly. (AD-6)

**Given** the API recovers after a degraded period,
**When** recovery is detected,
**Then** the banner auto-dismisses without user action; the Owner does not need to manually clear the degraded state. (FR-5; EXPERIENCE.md Degraded State)

**Given** a network-lost error (mid-message),
**When** the error occurs,
**Then** a toast appears (VI: "Mất kết nối. Thử lại không, Anh?" / EN: "Lost connection. Retry?") with a [Retry] CTA; the message text is preserved in the input bar. (EXPERIENCE.md Error)

---

### Story 1.7: Conversational Stub Creation

As an Owner, I want ARIA to automatically create a Client and Deal record in the CRM the moment I mention a new client in conversation, confirm it did so, and ask no more than 2 targeted follow-up questions, So that I never need to manually open a form and my CRM stays current as I talk.

**Acceptance Criteria:**

**Given** the Owner describes a client or deal not in the CRM (e.g., "Tôi vừa gặp một chủ chuỗi F&B — muốn làm website và automation"),
**When** ARIA detects no existing Client matching the described entity,
**Then** ARIA calls `create_client_stub` and `create_deal_stub` (addendum §C) in the background, creates correctly linked records (deal → client), and confirms creation in the reply. (FR-7; AD-1)

**Given** a Stub is being created,
**When** ARIA confirms creation,
**Then** the confirmation message is clear (VI: "Em đã tạo hồ sơ cho [client name] và deal [deal description]") and ARIA asks no more than 2 targeted gap-filling questions in the same turn. (FR-7; EXPERIENCE.md Stub creation microcopy)

**Given** the Owner mentions a client name that closely matches an existing CRM Client,
**When** ARIA processes the mention,
**Then** ARIA offers to link the new deal to the existing Client rather than creating a duplicate — it asks for confirmation before creating any new entity. (FR-37)

**Given** a Stub is created,
**When** it is persisted,
**Then** the record is marked with `stub` status in the status pill (`#F59E0B` accent color, label "Chưa đủ thông tin / Incomplete"), it is excluded from similar-deal pattern matching until minimally enriched, and the activity log records the creation with `actor=ai`. (FR-37; AD-14; EXPERIENCE.md Status Pill)

**Given** an un-enriched Stub that has been idle beyond a configurable period,
**When** the Stub is surfaced in a Deal Intelligence read or Briefing,
**Then** it is flagged for completion or archival; the Owner can merge or discard it via conversation. (FR-37)

---

### Story 1.8: Deal Intelligence — Four-Layer Synthesis with Omission Boundary

As an Owner, I want ARIA to deliver a full consultant's read — across four layers of reasoning — whenever I mention a deal, omitting only sections that genuinely cannot be populated yet, So that I always get actionable judgment, not just data retrieval.

**Acceptance Criteria:**

**Given** the Owner mentions an existing deal with client history and at least one similar past deal,
**When** ARIA produces the Deal Intelligence read,
**Then** the read is structured as: understanding / real need / risk flags / opportunity signals / prediction / recommended approach / documents needed / next action — and ARIA explicitly states when it is drawing on pattern matching ("Based on your last 3 F&B website deals…"). (FR-6; AD-4)

**Given** a new lead with only two sentences of context and no similar deals,
**When** ARIA produces the Deal Intelligence read,
**Then** the read is shorter — only sections with actual data or inferable content are included — but two elements are always present: a one-line *understanding* and a *next action*. ARIA states it is reasoning from domain knowledge, not pattern history. (FR-6 omission boundary)

**Given** any Deal Intelligence read,
**When** risk flags are present,
**Then** each flag carries a severity (HIGH / MEDIUM / LOW) and a reason; severity HIGH is rendered with `#F87171` color and a Lucide `AlertTriangle` icon (color is not the sole indicator). (FR-6; DESIGN.md §7.2)

**Given** Deal Intelligence is triggered,
**When** the AI call is routed,
**Then** it always uses the high-judgment model (Sonnet 4.6); Deal Intelligence is never downgraded to the economical tier regardless of session state or cost pressure. (AD-4; §8)

**Given** an existing deal with Intelligence Fields already populated (`inferred_real_need`, `risk_flags`, `opportunity_signals`, `predicted_outcome`, `prediction_reason`),
**When** ARIA produces a new Deal Intelligence read with updated signals,
**Then** only fields with genuinely changed values are updated in the CRM; a no-op write logs nothing; changed fields are logged in the activity log with `actor=ai` and the change payload. (FR-6; AD-14)

**Given** a Deal Intelligence read that references similar deals,
**When** those links are presented,
**Then** each linked deal includes a `similarity_reason` stated explicitly in the response. (FR-6; FR-10)

**Given** the Owner asks for a Deal Intelligence read and the CRM has Client context available,
**When** ARIA assembles the context for the AI call,
**Then** only the specific client, deal, and similar-deal records are fetched via tools — not the entire CRM; the per-DI-call context budget defined in AD-5/OQ-11 is respected. (FR-6; AD-3; AD-5)

---

### Story 1.9: Vision Input — Screenshot Extraction and CRM Integration

As an Owner, I want to paste or upload a Zalo conversation screenshot and have ARIA extract the deal context from it, fold that into its read, and update the CRM record, So that I never have to manually transcribe Zalo threads.

**Acceptance Criteria:**

**Given** the Owner pastes an image (`Ctrl+V` / `Cmd+V`) or attaches one via the paperclip icon on the Chat panel,
**When** the image is staged,
**Then** a thumbnail preview appears in the input bar above the text field with an "×" remove button; the Owner can send it together with a text message. (FR-9; FR-33; EXPERIENCE.md Image Upload/Paste)

**Given** the Owner sends a message with an attached image,
**When** the message is submitted,
**Then** the image is uploaded to owner-scoped Supabase Storage (AD-9; AD-2), then sent to the vision extraction path using `extract_from_image` (addendum §C) on the high-judgment, vision-capable model (Sonnet 4.6). (FR-9; AD-4; AD-9)

**Given** a legible screenshot of a Zalo conversation,
**When** ARIA processes it,
**Then** extracted text and deal context (client name, stated need, budget mentions, contact name) are reflected in ARIA's response and written to the relevant CRM fields; the activity log records the extraction with `actor=ai`. (FR-9; AD-14)

**Given** a partially unreadable image (blurry, clipped, low contrast),
**When** ARIA processes it,
**Then** ARIA explicitly states what it could and could not extract (e.g., "Em không đọc được phần tên công ty trong ảnh") and asks the Owner to confirm the missing fields — it does not silently guess. (FR-9; UJ-2 edge case)

**Given** an image whose content has already been extracted and written to the CRM,
**When** subsequent turns of the same conversation are processed,
**Then** the raw image bytes are not re-sent to the API; only the extracted structured context is referenced in the conversation context. (FR-9; FR-35; AD-9)

**Given** an uploaded image that exceeds 10 MB,
**When** the Owner attempts to attach it,
**Then** an inline error appears under the attachment preview: "Ảnh quá lớn (max 10 MB)" / "Image too large (max 10 MB)" and the attachment is removed; no upload attempt is made. (EXPERIENCE.md Error)

**Given** an image to be extracted,
**When** it is sent to the API,
**Then** it is compressed to a long edge of ≤ ~1568px before the API call; per-extraction token counts are logged for cost observability. (AD-9; §8 Observability)

---

### Story 1.10: Decision-Maker Tracking and Stall Diagnosis

As an Owner, I want ARIA to surface the decision-maker question early in any deal and, when a deal goes quiet, give me a diagnosis of why — not just a "stale" flag — with a culturally appropriate re-engagement message ready to use, So that I do not waste time chasing the wrong contact and I know how to re-engage effectively.

**Acceptance Criteria:**

**Given** a new deal has been created (via Stub or explicit description) and the `decision_maker` field on the Client is unknown,
**When** ARIA delivers the Deal Intelligence read for that deal,
**Then** the read includes a DECISION-MAKER: UNKNOWN risk flag and ARIA asks the Owner to identify the actual approver. (FR-11; addendum §B.1; addendum §G)

**Given** the Owner's contact on a deal is identified as non-final-approver (e.g., a project manager, not the business owner),
**When** ARIA includes this in the read,
**Then** it is flagged as a risk with a reason ("The decision will be made above your current contact"). (FR-11)

**Given** a deal with no logged activity for ≥ 7 days and active status,
**When** ARIA surfaces the deal in conversation or Deal Intelligence,
**Then** ARIA produces a stall diagnosis naming a probable cause — one of: trust gap / budget not yet allocated / internal approval pending / seasonal — and incorporates the Client's industry and relevant seasonal context (e.g., "With F&B clients, silence after 4 days often means internal approval, not lost interest"). (FR-12; addendum §G)

**Given** a stall diagnosis is produced,
**When** ARIA presents it,
**Then** ARIA offers to draft a warm, non-pressuring Zalo follow-up in Vietnamese register — indirect, relationship-preserving, no Western urgency language ("ASAP", "cuối cùng rồi"); the draft is offered, not auto-sent. (FR-12; §9.1; §10)

**Given** ARIA has domain knowledge that a stalled F&B deal in Q1 may be affected by post-Tết cash flow,
**When** the deal matches this pattern,
**Then** the stall diagnosis incorporates this seasonal context explicitly with a reason. (FR-12; addendum §G)

---

### Story 1.11: Pricing-Floor Awareness

As an Owner, I want ARIA to flag when a price I'm considering falls below the sustainable floor for that service type and offer value-framing guidance before I discount, So that I stop underpricing my work.

**Acceptance Criteria:**

**Given** the Owner proposes or discusses a price for a deal of a known Service Type,
**When** the proposed price is below the benchmark floor for that service type stored in Business Context,
**Then** ARIA flags it with a clear message (VI: "Giá anh đề xuất thấp hơn mức thường thấy cho loại dự án này (~30–50M VND). Trước khi giảm giá, mình xem lại giá trị anh mang lại cho họ nhé?") before any discount advice is offered. (FR-13; EXPERIENCE.md Pricing floor microcopy)

**Given** ARIA flags a below-floor price,
**When** the guidance is provided,
**Then** the response frames pricing around value delivered to the client, not cost incurred by the Owner; it does not immediately accept the premise that discounting is the right move. (FR-13; FR-23; addendum §G)

**Given** the initial seed pricing benchmarks (web 20–80M VND, app 60–150M VND, automation 20–60M/workflow VND) are stored in Business Context,
**When** the Owner edits them in Settings → Business Context,
**Then** the updated benchmarks are saved and used in all subsequent pricing checks; changes are logged to the activity log with `actor=user`. (FR-13; §14 assumptions)

**Given** a service type that does not have a benchmark set in Business Context,
**When** the Owner proposes a price for that service type,
**Then** ARIA does not flag it as below-floor but may note the absence of a benchmark and offer to set one. (FR-13)

---

### Story 1.12: Strategy Advisor and Cross-Deal Pattern Detection

As an Owner, I want ARIA to give me specific, reasoned strategic advice when I ask business questions — and to proactively surface structural patterns it detects across multiple deals even when I haven't asked — So that I learn from my own data, not just general advice.

**Acceptance Criteria:**

**Given** the Owner asks a business-level strategic question (e.g., "I keep losing deals on price — should I lower my rates?"),
**When** ARIA responds via the Strategy path,
**Then** it names a specific recommendation (not just options), backs it with a reason anchored in the Owner's own deal data or Vietnamese SME domain knowledge, and challenges the premise if the underlying cause is likely not what the Owner stated (e.g., price objection after enthusiasm = trust gap, not budget). (FR-23; §4.6; addendum §G)

**Given** the Owner asks a positioning or niche question (e.g., "Should I specialize in F&B or keep it general?"),
**When** ARIA responds,
**Then** the response is grounded in the Owner's own pipeline data (service type distribution, win/loss patterns) as well as domain knowledge about Vietnamese SME verticals; uncertainty is acknowledged honestly when data is insufficient. (FR-23)

**Given** ARIA detects a cross-deal pattern across multiple deals (e.g., three consecutive proposal-stage losses, repeated scope creep on a specific service type),
**When** the pattern crosses a detectable threshold,
**Then** ARIA surfaces it proactively with a specific structural recommendation — even if the Owner did not ask — framed as "I've noticed across your recent deals…" (FR-24)

**Given** a strategy response is generated,
**When** routed,
**Then** it always uses the high-judgment model (Sonnet 4.6). (AD-4)

**Given** the Owner's stated plan is likely counterproductive (e.g., sending a proposal before discovering the decision-maker),
**When** ARIA detects the error,
**Then** ARIA says so directly and explains why, rather than complying silently. (FR-3; FR-23)

---

### Story 1.13: Conversation Context Management and Start New Topic

As an Owner, I want long-running conversations to stay within limits without losing my business data, and to be able to start a fresh topic without losing my CRM records, So that ARIA stays coherent over long sessions and I'm in control of context resets.

**Acceptance Criteria:**

**Given** a conversation where the reconstructed context (Business Context + tool-fetched entities + recent turns) exceeds ~40,000 tokens,
**When** the next AI call is assembled,
**Then** older turns beyond the last ~10 verbatim turns are summarized server-side; the transcript view still shows full history with a visual divider: a full-width `#2A3350` rule labeled "Earlier messages summarized for context efficiency" in `textMuted`. (FR-35; AD-12; EXPERIENCE.md Long-Conversation Context Handling)

**Given** the Owner starts a new session after a previous one,
**When** the new session begins,
**Then** context is reconstructed from the CRM (Intelligence Fields, activity log) and Business Context injection — not from re-reading old transcripts; durable state lives in the CRM, not in chat history. (FR-35; AD-3)

**Given** the Owner triggers "Start new topic" (via the ··· overflow menu or `Ctrl/Cmd+Shift+N`),
**When** the action executes,
**Then** the in-memory conversation context is cleared (reset to Business Context + system prompt only); CRM data, activity log, and all past transcript messages are retained; a full-width divider appears in the transcript labeled "New topic started — [time]" in `textMuted`; a non-modal tooltip "Context cleared — CRM data kept" fades after 2s. (FR-33; FR-35; AD-12; EXPERIENCE.md Start New Topic)

**Given** "Start new topic" is triggered,
**When** the action executes,
**Then** no CRM record, document, deal, or client data is deleted or modified. (FR-35)

**Given** an extracted image whose content has already been written to the CRM,
**When** subsequent conversation turns reference the same deal,
**Then** the raw image bytes are not re-included in the AI call context; only the extracted structured fields are referenced. (FR-35; AD-9)

**Given** the "Start new topic" affordance,
**When** no conversation content exists yet (empty chat),
**Then** the affordance is not shown (it only appears after a conversation has content). (EXPERIENCE.md Input Bar §7.5)

---

### Story 1.14: First-Run and Empty-State Onboarding

As an Owner on my very first session, I want ARIA to guide me through a lightweight setup, get me value from my first deal description before any data entry, and explain what ARIA does in one breath, So that I understand what I'm working with and trust ARIA is useful before I've invested any effort.

**Acceptance Criteria:**

**Given** the Owner authenticates for the first time with zero clients and zero deals in the CRM,
**When** the app loads,
**Then** the Chat panel is the landing surface (not the Briefing panel); a centered welcome card (not a message bubble) displays ARIA's introduction in ~40 words, in the language detected from the browser locale (default Vietnamese). The exact microcopy: "Chào Anh Nhan! Em là ARIA — trợ lý kinh doanh của anh. Anh chưa có deal nào cả, mình bắt đầu bằng cách anh kể cho em nghe một khách đang thương lượng được không? Không cần điền form — cứ kể tự nhiên." (FR-36; UJ-6; EXPERIENCE.md Empty/First-Run)

**Given** the welcome card is displayed,
**When** the Owner sees it,
**Then** a single soft prompt appears below the card: "Anh đang thương lượng deal nào không? Kể cho em nghe đi." / "Tell me about a deal you're working on." The Business Context setup is offered as a skippable aside on one line; if skipped, defaults are applied silently. (FR-36; UJ-6)

**Given** the Owner describes their first deal in natural language during first-run,
**When** ARIA responds,
**Then** it delivers a Deal Intelligence read (shorter than a full read per the omission boundary — FR-6 — since no similar deals exist yet), creates a Stub for the deal, and confirms creation in the reply. Value is delivered before any form is filled. (FR-36; FR-6; FR-7; UJ-6)

**Given** the first Deal Intelligence read has completed during first-run,
**When** ARIA responds,
**Then** ARIA offers the Zalo OA setup in one non-intrusive line: "Anh muốn nhận thông báo qua Zalo không? Em có thể nhắc anh mỗi sáng." with a skippable "Để sau" option; setup is accessible later in Settings → Notification Channels. (FR-36; FR-28; UJ-6)

**Given** the CRM is empty (first-run or reset),
**When** the scheduled Briefing job runs,
**Then** no Briefing is generated, no check-ins fire, and no empty Briefing panel or notification badge is shown. (FR-36; §4.12)

**Given** the Owner skips the welcome flow entirely and types a random question immediately,
**When** ARIA processes it,
**Then** ARIA answers the question without forcing onboarding; Business Context is collected opportunistically from the answer if relevant context is available. No onboarding gate blocks interaction. (FR-36; §14 assumptions)

**Given** the app is fully set up with at least one deal in the CRM,
**When** the Owner opens the app on a subsequent session,
**Then** the welcome card and onboarding flow are no longer shown; the Briefing panel (if unseen) or Chat panel is the landing surface. (FR-36)
