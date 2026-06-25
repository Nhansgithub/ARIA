## Epic 5: Delivery Channels

Goal: Proactive content (Briefings, Check-ins, urgency alerts) reaches the Owner reliably — written to in-app first (authoritative), pushed to Zalo OA chat (best-effort), and guaranteed by email — so no item is ever silently dropped.

---

### Story 5.1: In-App Delivery Record & Notification Indicator

As an Owner, I want every proactive item (Briefing, Check-in, urgency alert) to be immediately visible in the app with an unread count badge, So that I never miss a time-sensitive update even if no external channel is configured.

**Acceptance Criteria:**

**Given** the scheduler generates a daily Briefing or fires a check-in (Epic 4),
**When** the delivery service runs,
**Then** the proactive item is written as an in-app record to the `briefings` or `check_ins` table (with `channel = in_app`, `status = pending`) before any external channel is attempted — this write is the authoritative record per AD-8.

**Given** an in-app proactive record exists with `status = pending`,
**When** the Owner opens the app,
**Then** the Briefing panel (for a Briefing) or an ARIA-initiated message card in Chat (for a Check-in) is visible on next open, independent of whether Zalo or email delivery succeeded or failed (FR-38).

**Given** one or more high-urgency items are unaddressed (a deal with an overdue action in "Today," or a check-in for a high-priority deal),
**When** the Owner is on any panel,
**Then** the Briefing nav item shows an `{colors.accent}`-filled badge pill with the integer count of unaddressed high-urgency items; the count does not include low-urgency updates (FR-38, EXPERIENCE.md §IA Shell).

**Given** the Owner opens the Briefing panel and scrolls past all flagged high-urgency items, or taps a Check-in quick-reply chip resolving it,
**When** the item transitions to `status = answered` or the Briefing is marked seen,
**Then** the badge count decrements accordingly; reaching zero removes the badge entirely.

**Given** a high-urgency item arrives while the Owner is actively in the Chat panel,
**When** the in-app record is written,
**Then** a dismissible in-app banner also appears at the top of the Chat panel listing the urgency reason (EXPERIENCE.md Proactive Notifications §In-app).

**Given** Zalo OA is not yet set up and email delivery is also unavailable,
**When** the scheduler fires,
**Then** the in-app record is still written and the badge increments — the Owner is never left with no indicator (FR-38).

**Given** there are zero eligible deals (empty CRM or all deals paused),
**When** the scheduler fires,
**Then** no in-app record is created and the badge remains absent (FR-36, AD-7 idempotency).

**Implementation notes:**
- The in-app write must complete and commit before any Zalo or email call is made; external-channel failure must never roll back the in-app record (AD-8).
- The `briefings` table carries a unique constraint on `(owner_id, date)`; `check_ins` carry a per-`(deal_id, cadence_window)` dedupe key to ensure idempotency on job re-fire (AD-7).
- Badge count is derived from a query on unaddressed high-urgency in-app records; it is not a denormalized counter that can drift (FR-38).

---

### Story 5.2: Email Delivery — Briefing and Check-in Formats

As an Owner, I want the daily Briefing and proactive Check-ins delivered to my email inbox in a clear, actionable format, So that I have a reliable, always-available copy of every proactive item even before Zalo is configured.

**Acceptance Criteria:**

**Given** the delivery service has written an in-app record for a Briefing (Story 5.1 complete),
**When** Zalo OA is not yet set up OR Zalo delivery is unconfirmed (Story 5.4 not yet built or Zalo channel skipped),
**Then** an email is sent to the Owner's registered address carrying the full Briefing content — same sections as the in-app Briefing panel: Today (max 3 items with rationale and recommended action), Pipeline Snapshot, Documents Pending, This Week's Focus, Slow-Moving Deals (FR-29, AD-8).

**Given** a Briefing email is composed,
**When** the email is sent,
**Then** the subject line is "ARIA Tóm tắt — [DD/MM/YYYY]" (Vietnamese) / "ARIA Briefing — [YYYY-MM-DD]" (English) matching the Owner's UI language preference; the body is plain-text with structured section headings (no HTML required in v1); a footer contains an unsubscribe link for email compliance (EXPERIENCE.md §Email).

**Given** the delivery service has written an in-app check-in record for a specific deal,
**When** Zalo is not set up or delivery is unconfirmed,
**Then** a check-in email is sent to the Owner's address with: the deal name, the check-in question text (bilingual where configured), and numbered reply options "Trả lời 1, 2, hoặc 3 trong app ARIA" / "Reply 1, 2, or 3 in the ARIA app" — making clear that v1 email is outbound-only and answers are captured in-app (FR-29, addendum §F).

**Given** either the Briefing or a check-in has already been sent by email for a given `(owner_id, date/window)`,
**When** the scheduler re-fires or retries,
**Then** a duplicate email is NOT sent — the email send is guarded by the same idempotency key as the in-app record (AD-7).

**Given** the email provider returns a delivery error (e.g., invalid address, provider outage),
**When** the send attempt fails,
**Then** the failure is logged to the `activity_log` with `actor = ai`, `action = email_delivery_failed`; the in-app record remains intact (the Owner can still see the item in-app); no silent drop occurs (AD-8).

**Given** a high-urgency Briefing item exists (overdue action, high-priority deal),
**When** the Briefing email is sent,
**Then** the subject line is prefixed with "[Cần xử lý]" / "[Action needed]" to signal urgency (FR-29).

**Implementation notes:**
- Email delivery uses the configured transactional provider (Resend/SendGrid via Vercel environment, AD-11 — credentials server-side only).
- Email content is generated from the same structured data used to render the in-app Briefing; no separate AI call is made for email formatting.
- The `check_ins` record `channel` field logs `email` when the email path fires; if both in-app and email records exist for the same check-in, they share the same `check_ins.id` with multiple channel log entries.

---

### Story 5.3: Zalo OA Setup — Owner Follow & Token Refresh Job

As an Owner, I want a guided one-time setup to connect my Zalo Official Account and have the system automatically keep its access token fresh, So that ARIA can send proactive messages to my Zalo without interruption from token expiry.

**Acceptance Criteria:**

**Given** the Owner is in Settings → Notification Channels and Zalo OA is not yet connected,
**When** they view the panel,
**Then** a non-blocking info card reads "Zalo OA chưa kết nối — thông báo chủ động chỉ qua email và in-app." with a "Kết nối Zalo OA" CTA; proactive delivery still works via in-app and email (FR-38, EXPERIENCE.md §Zalo Not Set Up).

**Given** the Owner taps "Kết nối Zalo OA",
**When** the setup flow begins,
**Then** ARIA presents step-by-step instructions: (1) confirm the OA `app_id` and `secret_key` are entered or pre-configured (server-side, AD-11); (2) provide the Owner's Zalo `user_id` (the numeric ID linked to their personal Zalo account that will follow the OA); (3) confirm the Owner has followed the OA in their Zalo app (one-time action, required for OA chat to reach them as a follower) (FR-28, addendum §F).

**Given** the Owner completes the follow-setup steps and submits,
**When** ARIA validates the connection by calling the Zalo OA token endpoint (`POST https://oauth.zaloapp.com/v4/oa/access_token`) with the provided credentials,
**Then** on success: the access token and refresh token are stored encrypted, server-side only (AD-11); the Zalo setup status is marked `connected`; the UI confirms "Zalo OA đã kết nối — ARIA sẽ gửi thông báo qua Zalo."; on failure: a clear error is shown ("Không thể kết nối — kiểm tra App ID / Secret Key") and no partial state is saved.

**Given** the Zalo OA is connected and the `pg_cron` token-refresh job is running (AD-7),
**When** approximately 55 minutes have elapsed since the last token issue (5 minutes before the 1-hour expiry),
**Then** the refresh job calls the Zalo token endpoint with the stored refresh token; on success, the new access token and (if rotated) refresh token replace the stored values, encrypted, server-side (AD-11); the `activity_log` records `action = zalo_token_refreshed`.

**Given** the token-refresh job fires but the refresh token has expired (valid for 3 months from Zalo) or the request fails,
**When** the refresh attempt returns an error,
**Then** the Zalo setup status is set to `token_expired`; the delivery service falls back to email for subsequent sends (AD-8); the Owner is shown a non-blocking in-app notification "Kết nối Zalo OA cần được kết nối lại" with a link to Settings → Notification Channels.

**Given** the Owner is in the first-run flow (FR-36) after their first Deal Intelligence read,
**When** ARIA offers Zalo setup ("Anh muốn nhận thông báo qua Zalo không? Em có thể nhắc anh mỗi sáng."),
**Then** tapping "Để sau" skips setup without error; the in-app+email channels remain active; the setup offer does not reappear in conversation (only in Settings) (EXPERIENCE.md §UJ-6).

**Given** OQ-13 (Zalo OA app registration) has not been completed (OA not yet approved by Zalo),
**When** a developer or operator attempts to run this story,
**Then** the story is blocked — OA registration with Zalo is a prerequisite; the story's definition of done explicitly requires a working OA `app_id` and API approval.

**Implementation notes:**
- The `pg_cron` refresh job runs every 55 minutes in `Asia/Ho_Chi_Minh` time (AD-7); it is idempotent — if the current token is still valid with > 10 minutes remaining, it skips the refresh call and logs a no-op.
- Zalo `app_id`, `secret_key`, encrypted access token, and refresh token are stored in the server environment/secrets store; they are never sent to the client or logged in plaintext (AD-11).
- The `check_ins` and `briefings` tables gain a `zalo_status` field (`not_configured | sent | failed | token_expired`) to support delivery-orchestration logic in Story 5.5.

---

### Story 5.4: Zalo OA Chat Send with Quick-Reply-as-Numbered-Text

As an Owner, I want Briefings and Check-ins pushed to my Zalo as conversational messages, with check-in options presented as numbered choices since Zalo doesn't support button UI, So that I can respond directly in Zalo with a simple number without switching to the ARIA app.

**Acceptance Criteria:**

**Given** the Zalo OA is connected and the access token is valid (Story 5.3 complete),
**When** the delivery service processes a Briefing for the day,
**Then** ARIA calls `POST /v2.0/oa/message` with the Owner's Zalo `user_id` and the Briefing content formatted as plain text (no markdown — Zalo OA chat is text-only) with section headers as plain labels; content exceeding Zalo's OA message character limit is truncated and appended with "Xem đầy đủ trong app ARIA" / "See full briefing in ARIA app" (FR-28, EXPERIENCE.md §Zalo OA).

**Given** a check-in message is being sent via Zalo OA chat,
**When** the message is composed,
**Then** quick-reply chip options are converted to numbered text below the question body:
- Vietnamese example: "Deal Phở 24 — có gì mới từ thứ Ba không?\n1. Họ phản hồi rồi\n2. Vẫn đang chờ\n3. Cần nhắc thêm\nTrả lời bằng số 1, 2, hoặc 3."
- English example: "Phở 24 proposal — any movement since Tuesday?\n1. They responded\n2. Still waiting\n3. Needs a nudge\nReply with 1, 2, or 3."
No Zalo button or template component is used (FR-28, addendum §F — Zalo OA chat does not support button UI).

**Given** the Zalo API call to send the message returns a successful HTTP response (2xx with a message ID),
**When** the delivery service receives the response,
**Then** the `check_ins` or `briefings` record's `zalo_status` is set to `sent`; the `activity_log` records `action = zalo_message_sent` with the Zalo message ID; no email fallback fires for this item.

**Given** the Zalo API call fails (non-2xx response, network error, or messaging-window rejection),
**When** the delivery service receives the error,
**Then** the `zalo_status` is set to `failed`; the email fallback fires automatically carrying the same content (FR-28 design-for-failure, AD-8); the in-app record remains unaffected; the failure is logged to `activity_log`.

**Given** an inbound Zalo reply arrives (Owner sends "1", "2", or "3" back to the OA),
**When** the Zalo webhook receives the message (v1: inbound webhook is plumbing-only),
**Then** v1 logs the raw payload to `activity_log`; full inbound capture and check-in answer processing via Zalo replies is deferred post-v1 (addendum §F — "Replies/inbound from Zalo: webhook for later"); the Owner is instructed in the Zalo message to reply in the ARIA app for full processing in v1.

**Given** the access token has expired and the refresh job has not yet run (edge case between refresh cycles),
**When** the send call returns a 401/auth error,
**Then** the delivery service marks `zalo_status = token_expired`, triggers an immediate token refresh attempt (one retry), and if that fails, fires the email fallback; no proactive item is dropped (AD-8).

**Given** the OA quality grade drops to "Low" (hypothetical — near-zero risk for a private single-user OA),
**When** the Zalo API returns a quota-exceeded or grade-blocked error,
**Then** the same design-for-failure path applies: `zalo_status = failed`, email fallback fires, Owner is notified in-app.

**Implementation notes:**
- Zalo send calls use the server-side access token only; the token is never passed to the Next.js client (AD-11).
- Message text generation for Zalo reuses the content already generated for the in-app record — no additional AI call; formatting is a pure string transformation (strip markdown, number chips, truncate).
- OQ-5 operational validation (confirm unsolicited push behavior under the 48h messaging window) is a prerequisite for this story's sign-off; the story's definition of done requires at least one end-to-end test send to a real OA follower.

---

### Story 5.5: Delivery Orchestration — In-App → Zalo → Email Priority/Fallback

As an Owner, I want every proactive item delivered through a consistent priority sequence — in-app always, then Zalo if set up, then email as the guaranteed backstop — with no item ever dropped and no duplicate sends, So that I can rely on receiving every Briefing and Check-in regardless of which channels are configured or available.

**Acceptance Criteria:**

**Given** the Briefing scheduler or check-in job fires for an eligible owner (AD-7 idempotency guardrails active),
**When** the delivery orchestrator runs,
**Then** it executes exactly this sequence per AD-8:
1. Write in-app record (authoritative) — Story 5.1; this write must succeed before proceeding.
2. If Zalo OA status is `connected` AND access token is valid: attempt Zalo send (Story 5.4).
3. If Zalo send is unconfirmed (status `failed`, `token_expired`, or `not_configured`) OR Zalo OA status is not `connected`: send email (Story 5.2).
4. If Zalo send succeeded: email is NOT sent (no duplicate content delivery).

**Given** the orchestrator completes for a given `(owner_id, item_id)`,
**When** the result is recorded,
**Then** the item's delivery record shows exactly which channels were attempted and their outcomes (`in_app: written`, `zalo: sent|failed|skipped`, `email: sent|skipped|failed`); no combination results in zero delivery — in-app is always written (FR-38, AD-8).

**Given** a Briefing was already sent today (idempotency check: `briefings` unique on `(owner_id, date)`),
**When** the scheduler re-fires (restart, duplicate trigger),
**Then** the orchestrator detects the existing record and skips all channel sends; no duplicate in-app record, no duplicate Zalo message, no duplicate email (AD-7).

**Given** a check-in was already sent for a `(deal_id, cadence_window)` pair,
**When** the job re-fires,
**Then** the orchestrator detects the deduplication key and skips; the existing in-app record and any external sends are left intact (AD-7).

**Given** a transient failure occurs during email send (SMTP timeout) after Zalo already failed,
**When** both external channels have failed,
**Then** the in-app record persists as the Owner's guaranteed access point; the failure is logged; no silent drop occurs; a retry of the email send may be attempted on the next job tick using the existing in-app record as source of truth (AD-8).

**Given** the global daily check-in cap is reached (default: 3 check-in messages per day, SM-C1),
**When** additional check-ins would otherwise fire,
**Then** the orchestrator suppresses them until the next calendar day; the cap applies across all channels combined, not per-channel (EXPERIENCE.md §Cadence Guardrails).

**Given** Zalo OA is set up AND the access token is valid AND the email-only path has been the default for several days (Zalo had been `not_configured`),
**When** Zalo setup is completed mid-day,
**Then** existing already-delivered items are NOT re-sent via Zalo; only new items from the next scheduler tick go through the full Zalo path.

**Given** the Owner has set Zalo to disabled in Settings → Notification Channels,
**When** the orchestrator runs,
**Then** the Zalo step is skipped entirely (no send attempt) and email fires as the external channel; the in-app record is always written regardless (FR-38).

**Implementation notes:**
- The orchestrator is implemented as a Supabase Edge Function invoked by `pg_cron` (AD-7); it is stateless and reconstructs delivery state solely from the database records.
- The orchestration logic is a single server-side function; it is NOT split across the Next.js API and the Edge Function to avoid partial execution on network partition.
- Secrets (Zalo token, SMTP credentials, Anthropic key) are accessed from the server environment only; the Edge Function never passes them to any client surface (AD-11).
- OQ-5 (Zalo OA push validation) and OQ-13 (OA registration) must be resolved before this story's Zalo path can be end-to-end tested; the email-only path is independently testable.

---

### Story 5.6: Delivery Channel Settings & Zalo-Not-Set-Up Graceful State

As an Owner, I want clear Settings controls for my notification channels and a graceful in-app experience when Zalo is not yet configured, So that I always understand which channels are active and can manage them without breaking the proactive delivery flow.

**Acceptance Criteria:**

**Given** the Owner navigates to Settings → Notification Channels,
**When** the panel loads,
**Then** they see the status of each channel:
- **In-app:** always active, shown as "Luôn bật" / "Always on" (non-toggleable — in-app is the authoritative channel, FR-38, AD-8).
- **Zalo OA:** connection status (`connected` / `not connected` / `token expired`); "Connect" or "Reconnect" CTA as appropriate (Story 5.3).
- **Email:** configured address shown; toggle to enable/disable email fallback (default: enabled); disabling shows a warning "Nếu Zalo thất bại sẽ không có kênh dự phòng" / "If Zalo fails there will be no fallback channel."

**Given** Zalo OA status is `not_configured` or `token_expired`,
**When** the first check-in is delivered in-app,
**Then** a one-time note is appended to that check-in message: "Bật Zalo OA trong Cài đặt để nhận tin nhắn này qua Zalo." — this note is shown only once per Owner lifetime (not on every check-in) and is dismissed after the Owner views it (EXPERIENCE.md §Zalo Not Set Up).

**Given** Zalo OA status is `not_configured`,
**When** the Owner is in Settings → Notification Channels,
**Then** the panel shows a non-blocking info card "Zalo OA chưa kết nối — thông báo chủ động chỉ qua email và in-app." with a "Kết nối Zalo OA" CTA, consistent with EXPERIENCE.md.

**Given** the Owner toggles email off AND Zalo is not configured or in `token_expired` state,
**When** the toggle is submitted,
**Then** the system displays a blocking confirmation dialog: "Nếu tắt email và Zalo chưa kết nối, anh sẽ chỉ thấy thông báo trong app. Tiếp tục không?" — if confirmed, email is disabled; in-app delivery continues as the sole channel (FR-38 ensures in-app is always authoritative regardless).

**Given** the Owner enables email after it was disabled,
**When** the next Briefing or check-in fires,
**Then** the email path is active again; no backfill of previously missed emails is sent.

**Given** check-in cadence is configurable per FR-18,
**When** the Owner adjusts the global cadence or pauses check-ins for a specific deal in Settings → Check-in Cadence,
**Then** the `pg_cron` job respects the updated flag on the next tick; paused deals produce no in-app record, no Zalo send, and no email send for check-ins (AD-7, FR-18).

**Implementation notes:**
- Settings state is persisted in the `settings / business_context` table (addendum §B.7), owner-scoped with RLS (AD-2).
- The in-app channel toggle is UI-only (always active) — there is no server-side flag to disable in-app delivery; this prevents any path that could result in zero delivery channels.
- This story has no new scheduler or send logic; it wires UI controls into flags that the orchestrator (Story 5.5) already reads.
