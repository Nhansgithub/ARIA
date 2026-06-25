## Epic 4: Briefing & Proactivity

**Goal:** ARIA runs the proactive intelligence pipeline so nothing slips — generating a cached daily Briefing, detecting stale deals and missing actions, surfacing ranked priorities to the Owner, and prompting for deal updates on a configurable schedule with answer capture.

---

### Story 4.1: Pipeline Status Synthesis & Stage-Aware Next-Action

As an Owner, I want ARIA to return a synthesized deal/client status with a stage-appropriate next-action recommendation when I ask about my pipeline, so that I get a consultant's read instead of a raw data dump.

**Acceptance Criteria:**

**FR-14 — Synthesized status reply**

Given the Owner asks "What's the status of my pipeline?" or "How is [deal name] going?",
When ARIA fetches the relevant deals via `list_deals` or `get_deal` (Haiku-routed, AD-4),
Then the reply is prose synthesis — not a field listing — and includes for each deal: client name, current stage, value estimate, days since last activity, and a concrete next action.
And the response never returns a raw JSON or field dump to the chat interface.

Given a deal has had no logged activity for more than 7 days,
Then the reply explicitly states the number of days idle and surfaces the deal as requiring attention (FR-16 precursor, covered fully in Story 4.2).

**FR-15 — Stage-aware next-action**

Given the Owner asks "What should I do next with the Phở 24 deal?",
When ARIA determines the deal's current stage (e.g. "Proposal sent") and service type,
Then the recommended action is specific to that stage — e.g. for "Proposal sent" it recommends a follow-up, not "schedule a discovery call."
And the recommendation differs appropriately between a deal at "Discovery" vs "Proposal sent" vs "Contract review."

Given a deal's stage field contains free-text that does not match a canonical label (e.g. "Đang chờ anh xem lại"),
When ARIA interprets the stage,
Then it reasons contextually from the text and service type rather than rejecting or flagging an error — the stage is never rejected as invalid (AD-1, FR-15 free-text requirement).

Given the Owner asks for status in Vietnamese ("Tình hình deal nào đang tốt nhất?"),
When ARIA responds,
Then the entire response is in Vietnamese, including stage labels and recommended actions (FR-2 bilingual mirroring).

**Guidance stance (FR-3)**

Given the Owner asks what to do next on a deal at "Proposal sent" for 6 days,
Then ARIA includes the reasoning behind the recommendation (e.g. "Với dịch vụ web design, proposal thường cần follow-up sau 3–5 ngày để giữ momentum") and ends with a single concrete next step.

**Graceful degradation (AD-6, FR-5)**

Given the Claude API is unavailable when the Owner requests pipeline status,
When ARIA cannot perform synthesis,
Then it returns structured CRM data (stage, value, last activity date) with the degraded notice: "AI synthesis is temporarily unavailable — showing raw data" / "AI tạm thời không khả dụng — đang hiển thị dữ liệu thô."
And the response envelope carries `status: degraded` per AD-6.

**Model routing (AD-4)**

Given any pipeline status or next-action query,
When the request does not involve Deal Intelligence (FR-6 four-layer synthesis),
Then the AI call is routed to Haiku (economical tier) — not Sonnet — and this is verifiable via token-usage observability logs.

---

### Story 4.2: Stale-Deal Detection & Follow-Up Cadence Engine

As an Owner, I want ARIA to automatically detect deals with no activity for more than 7 days and apply the proposal follow-up cadence (3-day and 7-day reminders), so that no deal goes cold silently.

**Acceptance Criteria:**

**Depends on:** Story 4.1 (deal status synthesis tooling established).

**FR-16 — Stale-deal detection (>7 days)**

Given a deal has had no `activity_log` entry for more than 7 calendar days,
When ARIA evaluates the deal (during briefing generation or on conversational request),
Then the deal is classified as stale and its `stale_since` field is populated with the date of the last activity.
And a stale deal is surfaced in the Briefing "Slow-Moving Deals" section (Story 4.4 will render it; this story ensures the detection and field population).
And a stale deal is raised in conversation when the Owner asks about that deal or the pipeline.

Given a deal transitions from having activity to crossing the 7-day threshold,
When its staleness is detected,
Then the `stale_since` date is set once and not overwritten on subsequent detections — staleness onset is idempotent (AD-14 idempotent AI writes).

**FR-16 — Proposal follow-up cadence**

Given a deal is at stage "Proposal sent" (or any stage ARIA interprets as equivalent) and has no logged Owner response from the client,
When 3 calendar days have elapsed since the proposal stage was entered,
Then the deal is flagged for a first follow-up reminder.
And this flag is represented as a `next_action` update on the deal record with `next_action_due` set to the cadence-calculated date.

Given the first follow-up reminder has been generated and 7 days total have elapsed since the proposal stage with no response,
Then the deal is flagged for a second follow-up reminder ("Nhắc lần 2 — cân nhắc đóng hoặc lưu trữ deal này").

Given the Owner explicitly logs a client response (any activity on the deal from actor: user),
Then the follow-up cadence resets and no further cadence reminders fire for that window.

**Configurable cadence**

Given the Owner has configured custom follow-up intervals in Settings (e.g. 5 days first / 10 days second),
When cadence dates are calculated,
Then the custom intervals are used instead of the defaults (3/7 days).
And if no custom value is set, defaults of 3 and 7 days apply (FR-16).

**Empty CRM guard (FR-36, AD-7)**

Given the CRM contains zero active deals,
When any stale-detection or cadence logic runs,
Then no reminders, flags, or activity entries are written — the function exits cleanly.

**Activity log (FR-30, AD-14)**

Given staleness is detected or a cadence flag is set,
When the deal record is updated,
Then an activity log entry is written with `actor: ai`, `action: stale_detected` or `action: follow_up_cadence_flagged`, and the relevant payload (days idle, cadence step).
And if the re-run produces no change (deal was already stale with the same date), no duplicate log entry is written.

---

### Story 4.3: Briefing Generation Job — pg_cron Scheduler & Caching

As an Owner, I want ARIA to generate my daily Briefing automatically each morning and cache it so it is ready instantly when I open the app, so that I never wait for generation on app-open.

**Acceptance Criteria:**

**Depends on:** Story 4.2 (stale-deal detection fields available for briefing inputs).

**FR-25, AD-7 — Scheduled generation**

Given a `pg_cron` job is configured to run at approximately 07:00 Asia/Ho_Chi_Minh (OQ-8/OQ-12 tuning dial, default value),
When the job fires,
Then it invokes the Briefing Edge Function for the Owner.
And the job runs in `Asia/Ho_Chi_Minh` timezone per AD-7.

Given the job fires and a briefing record already exists for `(owner_id, date)` in the `briefings` table,
When the Edge Function checks for an existing record,
Then it exits without re-generating — the uniqueness constraint on `(owner_id, date)` is the idempotency guard (AD-7 no-double-generate).
And no duplicate `briefings` row is created regardless of how many times the job fires on the same day.

Given the job fires and no briefing record exists for today,
When the Edge Function runs,
Then it queries: active deals (status not archived/lost), pending documents (status draft|review), and the last 24-hour activity log — and nothing more (FR-25 scoped query).

**FR-36, AD-7 — Empty CRM guard**

Given the Owner has zero active deals in the CRM,
When the scheduled briefing job fires,
Then no briefing record is written and no AI call is made.
And the in-app surface shows the guided empty state rather than an empty briefing panel (FR-36, UJ-6).

**FR-25 — Caching behavior**

Given a briefing for today has been generated and cached (exists in `briefings` table with `generated_at` timestamp),
When the Owner opens the app or requests the briefing via `get_briefing(date)`,
Then the cached record is returned immediately without triggering a new AI generation call.
And the briefing panel footer shows "Generated [HH:mm] · Refresh" reflecting `generated_at`.

Given the Owner taps "Refresh" in the briefing panel footer,
When the refresh request is received,
Then a new AI generation call is made, the `briefings` row for today is updated (not duplicated), and `generated_at` is updated to the refresh time.

**AD-4 — Model routing**

Given a briefing generation call is made,
When the AI synthesis runs,
Then it is routed to Haiku (economical tier) — briefing generation is structured and predictable (AD-4 routing table).
And this is verifiable via per-call token-usage logs (§8 Observability).

**AD-5 — Prompt caching**

Given the system prompt + tool definitions + Business Context (stable prefix) are byte-stable across briefing calls,
When the Edge Function assembles the prompt,
Then the stable prefix carries a `cache_control` breakpoint; volatile data (deal list, activity log, current date) is appended after it.
And cache hit is verified via `usage.cache_read_input_tokens > 0` in the observability log for non-first calls on the same day.

**AD-6 — Degraded fallback**

Given the Claude API is unavailable when the scheduled job fires,
When generation fails (timeout > ~10s, rate-limit, or API error),
Then the job does not write a failed/empty briefing row; instead the previous day's cached briefing (if any) is served with the sub-banner "Dữ liệu từ [time]" / "Data from [time]."
And the response envelope carries `status: degraded` (AD-6).

**RLS & owner-scoping (AD-2, AD-13)**

Given the Edge Function runs as a scheduled system task for a known owner,
When it reads and writes briefing data,
Then all Supabase queries are scoped to the correct `owner_id`.
And the service-role key is used only for this audited scheduled path — never for owner-initiated client requests (AD-13).

---

### Story 4.4: Briefing Structure, Detection Logic & Ranking

As an Owner, I want the daily Briefing to follow a fixed structure with intelligently ranked "Today" items and correctly categorized pipeline, document, and slow-deal sections, so that the most important actions are always surfaced first.

**Acceptance Criteria:**

**Depends on:** Story 4.3 (briefing generation job exists and caches a `content_md` + `flags` payload).

**FR-26 — Fixed briefing structure**

Given a briefing is generated,
When the AI compiles the sections,
Then the output follows this fixed section order: (1) Today — max 3 ranked items, (2) Pipeline Snapshot, (3) Documents Pending, (4) This Week's Focus, (5) Slow-Moving Deals.
And no section is omitted even if empty — empty sections render a concise "Không có gì mới" / "Nothing to note" placeholder.

**FR-26 — "Today" max 3, ranked**

Given more than 3 items qualify for the "Today" section,
When ranking is applied,
Then items are ranked in this priority order: (1) overdue actions (`next_action_due` < today), (2) due-today actions (`next_action_due` = today), (3) proposal-cadence reminders (3-day/7-day follow-up flags), (4) high-priority stale deals (priority = high AND stale_since is set).
And within the same tier, deals with higher `priority` (high > medium > low) rank first; `value_estimate` is the tie-breaker within the same priority level.
And exactly 3 items (or fewer if fewer qualify) appear in "Today"; remaining qualifying items appear only in their relevant section (Pipeline or Slow-Moving Deals).

**FR-26 — Slow-moving deals detection**

Given a deal has `stale_since` set (no activity > 7 days, established in Story 4.2),
When the briefing compiles the "Slow-Moving Deals" section,
Then the deal appears with its days-stale count (computed as today minus `stale_since`).
And the section is absent from "Today" unless it also qualifies by the ranking criteria above.

**FR-22 — Missing-document detection**

Given a deal's stage implies a document should exist (e.g. stage = "Proposal sent" with no linked document of type `proposal`),
When the briefing's "Documents Pending" section is compiled,
Then that deal is listed with a one-line rationale (e.g. "Đề xuất chưa được tạo cho deal này — cần trước khi follow-up").
And the detection covers: proposal expected at/after "Proposal sent" stage; contract expected at/after "Contract review" stage.

**FR-26 — "Pipeline Snapshot"**

Given the briefing is generated,
When the Pipeline Snapshot section is compiled,
Then it contains: active deal count, total estimated value (sum of `value_estimate` on non-archived/lost deals), and a brief stage distribution (e.g. "3 deals — 1 discovery, 1 proposal, 1 contract review").
And it is written as a prose sentence, not a table or bullet list.

**Flags payload**

Given the briefing is stored in the `briefings` table,
When the `flags` JSONB column is written,
Then it contains a structured list of flagged items suitable for the notification badge count (FR-38): each flag carries `type` (overdue|stale|missing_doc|cadence_reminder), `deal_id`, `severity` (high|medium), and a short `label` string.
And the count of `severity: high` flags is what drives the unread badge count on the Briefing nav item (UJ-1, FR-38).

---

### Story 4.5: Briefing Panel UI — App-Open, On-Demand & Item-to-Chat Pre-Queue

As an Owner, I want to see the daily Briefing as the landing screen when I open the app, access it on demand, and tap any item to open Chat with that deal pre-queued, so that I can act on my priorities in one flow.

**Acceptance Criteria:**

**Depends on:** Story 4.4 (briefing `content_md` and `flags` data available); Story 4.3 (cache layer); Epic 0 shell and Epic 1 Chat panel.

**FR-27, UJ-1 — App-open behavior**

Given the Owner opens the app and a briefing for today exists and has not been seen (no session has navigated to `/briefing` today),
When the app shell loads,
Then the Briefing panel is the landing surface — not Chat.
And the panel renders within 1.5 seconds using skeleton rows matching section structure while data loads (EXPERIENCE.md loading state).

Given the Owner opens the app and the CRM has zero deals (first-run / empty state, FR-36),
When the app shell loads,
Then the Briefing panel is suppressed; Chat loads with the guided welcome instead.
And no empty briefing skeleton or error state is shown.

**FR-27 — Dismissal and return**

Given the Briefing panel is showing,
When the Owner taps "Chat" in the left nav (desktop) or bottom tab bar (mobile),
Then the panel switches to Chat and the Briefing is marked as seen.
And the Briefing nav item notification badge count decrements by the number of high-urgency flags that were addressed or scrolled past (EXPERIENCE.md nav switching behavior).

**FR-27 — On-demand access**

Given the Owner is in Chat and says "Show me today's briefing" or navigates to `/briefing`,
When the request is handled,
Then the Briefing panel opens and displays the cached briefing for today.
And if no briefing exists for today (scheduler not yet run), a "Generating…" skeleton is shown and generation is triggered on demand.

**FR-27, UJ-1 — Briefing item → Chat pre-queue**

Given the Owner taps a "Today" item in the Briefing panel,
When the tap is registered,
Then the app switches to Chat mode.
And the input bar is pre-populated with a composed message referencing the deal (e.g. "Phở 24 — đề xuất của em gửi 4 ngày rồi mà chưa thấy họ phản hồi. ARIA nghĩ sao?"), editable by the Owner.
And the message is NOT auto-sent — the Owner must press Send (EXPERIENCE.md pre-queue behavior, owner agency).

Given the Owner taps the "Ask ARIA about this" footer of any Deal card in the Briefing,
When the tap is registered,
Then the same pre-queue behavior fires: Chat opens, input bar populated, not auto-sent.

**Briefing panel sections rendering (FR-26, EXPERIENCE.md)**

Given the briefing `content_md` is loaded,
When the Briefing panel renders,
Then Section 1 "Today" shows at most 3 ranked items — each with: title, one-line rationale, recommended action, and a tappable area.
And the first "Today" item carries an amber (`{colors.accent}`) left border accent (urgency-ranked first); others carry teal (`{colors.primary}`) left border (DESIGN.md §7.2 briefing card).
And Section 5 "Slow-Moving Deals" shows each stale deal with its days-stale count in a `{colors.warning}` badge.

**FR-27 — Refresh**

Given the Owner taps "Refresh" in the Briefing panel footer,
When the refresh completes,
Then the panel re-renders with updated content and the footer shows the new `generated_at` time.
And the "Refresh" link is disabled (spinner) during generation and re-enabled on completion or failure.

**Notification badge (FR-38)**

Given the briefing has been generated and contains at least one `severity: high` flag,
When the Owner has not yet opened the Briefing panel in this session,
Then the Briefing nav item shows an amber badge with the count of unaddressed high-urgency items.
And the badge count clears when the Owner opens Briefing and scrolls past the flagged items (EXPERIENCE.md nav switching).

**Degraded state (AD-6, FR-5)**

Given the API is unavailable and no briefing was generated for today,
When the Owner opens the app,
Then the last available cached briefing is shown with a sub-banner "Dữ liệu từ [time]" / "Data from [time]."
And if no cached briefing exists at all (first day, no prior generation), the Chat empty state is shown instead.

---

### Story 4.6: Proactive Check-in Scheduler — Trigger Criteria & Job

As an Owner, I want ARIA to automatically schedule and send proactive check-in prompts for deals that have gone quiet or have an imminent action due, so that my pipeline stays current without me having to remember to update it.

**Acceptance Criteria:**

**Depends on:** Story 4.3 (pg_cron + Edge Function pattern established); Story 4.2 (stale-deal fields populated).

**FR-17, AD-7 — Scheduled job**

Given a `pg_cron` job is configured to evaluate check-in eligibility on a regular cadence (default: once daily, configurable via OQ-12),
When the job fires,
Then it evaluates all active deals for the Owner against the trigger criteria.
And the job is idempotent: a re-fire within the same cadence window does not create a duplicate `check_ins` row for the same `(deal_id, cadence_window)` — the dedupe key on the `check_ins` table enforces this (AD-7, addendum §B.6).

**FR-17 — Trigger criteria (defaults)**

Given a deal is active (not archived or lost),
When the trigger evaluation runs,
Then a check-in is eligible if ALL of the following are true:
- (a) No activity has been logged for ≥ 3 days AND deal priority = high, OR no activity for ≥ 5 days AND priority = medium or low; AND
- (b) There is no pending (unanswered) `check_ins` record already in the `check_ins` table for this deal; AND
- (c) The daily global check-in cap has not been reached (default: 3 check-ins/day per owner, configurable in Settings, SM-C1).

Given a deal has a `next_action_due` date that is today or in the past (overdue),
Then it is also eligible regardless of the inactivity-day threshold (FR-17 "approaching a due action" criterion).
And the due/overdue path is evaluated independently of the inactivity path — a deal can qualify via either.

**FR-36 — Empty CRM guard**

Given the Owner has zero active deals,
When the check-in evaluation job fires,
Then no `check_ins` rows are created and no AI calls are made.

**Check-in record creation**

Given a deal is eligible for a check-in,
When the job selects the check-in prompt template (see Story 4.7 for answer capture),
Then a `check_ins` row is inserted with: `owner_id`, `deal_id`, `prompt_template` (populated with deal name and last activity reference), `sent_at` (current timestamp), `channel: in_app`, `status: pending`.
And the row for Zalo/email delivery is also created with the appropriate channel if set up (actual external push is Epic 5; this story creates the authoritative in-app record per AD-8).

**Global cap enforcement (SM-C1)**

Given 3 check-in records have already been created today for the owner (or the configured cap value),
When the evaluation job processes additional eligible deals,
Then no further check-in rows are created for that day.
And the highest-priority eligible deals are selected first (priority: high > medium > low, then `value_estimate` as tie-breaker).

**RLS & owner-scoping (AD-2)**

Given the check-in job runs,
When it reads from `deals` and writes to `check_ins`,
Then all operations are scoped to the correct `owner_id`.
And RLS policies are enforced; no cross-owner data is readable or writable (AD-13 — service-role used only for this audited scheduled path).

**Activity log (FR-30, AD-14)**

Given a check-in row is created,
When the insert succeeds,
Then an `activity_log` entry is written with `actor: ai`, `action: checkin_scheduled`, `entity_type: deal`, `entity_id: deal_id`.
And if a re-run finds an existing pending check-in for the same deal in the same window, no duplicate log entry is written.

---

### Story 4.7: Check-in Delivery, Quick-Reply UI & Answer Capture

As an Owner, I want to receive proactive check-in prompts in-app with quick-reply chips, tap one answer to update the deal, and have ARIA capture free-text answers too, so that keeping my pipeline current takes one tap.

**Acceptance Criteria:**

**Depends on:** Story 4.6 (check-in records created in `check_ins` table with `status: pending`).

**FR-17, UJ-3, EXPERIENCE.md — In-app check-in delivery**

Given a `check_ins` row with `status: pending` and `channel: in_app` exists for a deal,
When the Owner opens or returns to the Chat panel,
Then an ARIA-initiated message appears in the Chat transcript referencing the specific deal and the last known state.
And the message includes 2–3 quick-reply chips appropriate to the deal's stage (e.g. "Họ phản hồi rồi" / "They responded", "Vẫn đang chờ" / "Still waiting", "Cần nhắc thêm" / "Needs a nudge") per the UJ-3 example.
And the Briefing nav item notification badge increments by 1 for the new pending check-in (FR-38, EXPERIENCE.md notification dot vs badge).

**FR-18, EXPERIENCE.md — Quick-reply chip interaction**

Given the check-in message is displayed with chips,
When the Owner taps a chip,
Then the chip becomes selected (teal fill, DESIGN.md §7.7 selected state) and the chip value is sent as a user message immediately without a secondary Send tap.
And the other chips are disabled (opacity 0.5, cursor not-allowed).
And the `check_ins` row is updated: `answered_at` = now, `answer` = `{ type: quick_reply, value: <chip_label> }`, `status: answered`.

Given the Owner types a free-text reply instead of tapping a chip,
When the first keystroke is registered,
Then the chips disappear and the Owner's typed reply is processed as the answer.
And the `check_ins` row is updated with `answer: { type: free_text, value: <text> }`, `status: answered`.

**FR-18 — Answer capture → field updates**

Given the Owner has answered a check-in (quick-reply or free-text),
When ARIA processes the answer (Haiku-routed, AD-4 — structured extraction, not Deal Intelligence),
Then the relevant deal fields are updated based on the answer content:
- A "responded" answer: `next_action` updated to reflect the follow-up needed; stage may advance if the answer implies it.
- A "still waiting" answer: `next_action_due` extended by the cadence interval; no stage change.
- A "needs nudge" answer: a follow-up draft is offered (ARIA asks one clarifying question or offers a Zalo message template).
And all field changes are written to `activity_log` with `actor: ai`, `action: checkin_answered`, and the answer payload.

Given the answer implies a stage change (e.g. "Cần xem lại hợp đồng" → "Contract review"),
When ARIA updates the deal,
Then `stage` is updated, `stage_history` receives a new entry with timestamp and actor, and the activity log records the change (FR-30, AD-14).
And ARIA's follow-on response confirms the update and offers a next step (FR-3 guidance stance).

**FR-18 — Answer capture → Intelligence Fields (AI-maintained)**

Given the Owner's check-in answer contains new signals (e.g. "Họ muốn giảm giá"),
When ARIA processes the answer,
Then relevant Intelligence Fields are updated: `risk_flags`, `opportunity_signals`, or `inferred_real_need` as appropriate.
And each Intelligence Field update is logged with `actor: ai` (AD-14 idempotent AI writes — no duplicate entry if the field value is unchanged).

**Bilingual check-in messages (FR-2)**

Given the Owner's last message before the check-in was in Vietnamese,
When the check-in message is rendered,
Then the prompt text and chip labels are in Vietnamese.
And if the Owner's context is English, the prompt and chips are in English.
And both language variants are shown in the acceptance example: Vietnamese ("Deal Phở 24 — có gì mới từ thứ Ba không?") and English ("Phở 24 proposal — any movement since Tuesday?") per EXPERIENCE.md microcopy.

**Skip / dismiss**

Given the Owner ignores a check-in message (does not answer or dismiss),
When the next cadence window fires (Story 4.6 evaluation),
Then the existing pending check-in is detected (Story 4.6 AC: no duplicate if pending exists) and no second check-in is created for the same deal.
And after 2 consecutive missed windows, the deal's priority is elevated in the next Briefing "Today" ranking (EXPERIENCE.md cadence guardrails — urgency escalation path, not a separate notification blast).

**In-app record as authoritative (AD-8)**

Given any check-in is delivered,
When it is stored,
Then the `check_ins` table record is the authoritative copy regardless of Zalo/email delivery status (AD-8).
And the in-app message is always shown on app open even if external delivery failed (FR-38).

---

### Story 4.8: Check-in Cadence Configuration & Per-Deal Pause

As an Owner, I want to configure global check-in frequency, adjust the inactivity thresholds, and pause check-ins per deal or globally, so that proactive prompts are helpful rather than noise.

**Acceptance Criteria:**

**Depends on:** Story 4.7 (check-in system operational).

**FR-18 — Settings surface (EXPERIENCE.md §IA → Settings Panel)**

Given the Owner navigates to Settings → Check-in Cadence,
When the settings panel renders,
Then it displays the current values for:
- Global daily cap (default: 3; input: number, min 1, max 10).
- High-priority inactivity threshold (default: 3 days; input: number, min 1).
- Standard inactivity threshold (default: 5 days; input: number, min 1).
- Global check-ins enabled/disabled toggle.
And all inputs have visible `<label>` elements (EXPERIENCE.md accessibility floor).

Given the Owner saves a changed cadence value,
When the save is confirmed,
Then the new value is persisted to the `settings` / `business_context` record (addendum §B.7) scoped to `owner_id`.
And future check-in evaluation jobs (Story 4.6) read these values instead of the hardcoded defaults.
And an `activity_log` entry is written with `actor: user`, `action: cadence_setting_changed`, and the before/after values.

**FR-18 — Per-deal pause**

Given the Owner says "Pause check-ins for the Phở 24 deal" in Chat,
When ARIA handles the request,
Then the corresponding `deals` record (or a per-deal flag column in `deals` or `check_ins` config) is updated to `checkin_paused: true`.
And the Story 4.6 evaluation skips that deal when `checkin_paused = true`.
And ARIA confirms the pause in its reply and tells the Owner how to re-enable it ("Anh có thể bật lại bằng cách nói 'Bật lại check-in cho Phở 24'").

Given the Owner says "Resume check-ins for the Phở 24 deal" in Chat,
When ARIA handles the request,
Then `checkin_paused` is set to false for that deal and confirmation is given.

**FR-18 — Global pause**

Given the Owner toggles "Check-ins disabled" in Settings,
When the toggle is saved,
Then the Story 4.6 scheduled job creates no new check-in rows while the toggle is off.
And existing pending check-in messages in Chat remain visible but no new ones are injected.

**Cadence validation**

Given the Owner sets the high-priority threshold to a value greater than or equal to the standard threshold,
When the save is attempted,
Then ARIA or the UI surfaces an inline validation message: "High-priority threshold should be shorter than the standard threshold — e.g. 3 days vs 5 days" / "Ngưỡng ưu tiên cao nên ngắn hơn ngưỡng thông thường."
And the save is blocked until the values are corrected.

**RLS (AD-2)**

Given the Owner saves cadence settings,
When the write occurs,
Then the `settings` row is scoped to the authenticated `owner_id` and RLS enforcement prevents any cross-owner read or write.
