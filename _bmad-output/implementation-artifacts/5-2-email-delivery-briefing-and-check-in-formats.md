---
story: 5-2
title: Email Delivery — Briefing and Check-in Formats
status: done
epic: 5
sprint: 1
baseline_commit: ""
---

# Story 5.2: Email Delivery — Briefing and Check-in Formats

Status: ready-for-dev

## Story

As an Owner, I want the daily Briefing and proactive Check-ins delivered to my email inbox in a clear, actionable format, So that I have a reliable, always-available copy of every proactive item even before Zalo is configured.

## Acceptance Criteria

**Given** the delivery service has written an in-app record for a Briefing (Story 5.1 complete),
**When** Zalo OA is not yet set up OR Zalo delivery is unconfirmed,
**Then** an email is sent to the Owner's registered address carrying the full Briefing content: Today (max 3 items with rationale and recommended action), Pipeline Snapshot, Documents Pending, This Week's Focus, Slow-Moving Deals (FR-29, AD-8).

**Given** a Briefing email is composed,
**When** the email is sent,
**Then** the subject line is "ARIA Tóm tắt — [DD/MM/YYYY]" (Vietnamese) / "ARIA Briefing — [YYYY-MM-DD]" (English); plain-text body with structured section headings; footer with unsubscribe line for compliance.

**Given** a high-urgency Briefing item exists (overdue action, high-priority deal),
**When** the Briefing email is sent,
**Then** subject is prefixed "[Cần xử lý] " (Vietnamese) / "[Action needed] " (English).

**Given** the delivery service has written a check-in record,
**When** Zalo is not set up or unconfirmed,
**Then** a check-in email is sent with: deal name, check-in question text, numbered reply options "Trả lời 1, 2, hoặc 3 trong app ARIA" — answers are captured in-app only (FR-29).

**Given** a Briefing or check-in email has already been sent for a given `(owner_id, date/window)`,
**When** the scheduler re-fires or retries,
**Then** a duplicate email is NOT sent — guarded by `email_sent_at` on the record (AD-7).

**Given** the email provider returns a delivery error,
**When** the send attempt fails,
**Then** failure logged to `activity_log` with `actor = ai`, `action = email_delivery_failed`; in-app record stays intact (AD-8).

## Tasks / Subtasks

- [ ] **Task 1: Migration — email_sent_at on briefings and check_ins**
  - [ ] Create `supabase/migrations/20260701100000_email_sent_at.sql`
  - [ ] `ALTER TABLE briefings ADD COLUMN IF NOT EXISTS email_sent_at timestamptz`
  - [ ] `ALTER TABLE check_ins ADD COLUMN IF NOT EXISTS email_sent_at timestamptz`

- [ ] **Task 2: Email service (raw Resend API)**
  - [ ] Create `lib/email/emailService.ts`
  - [ ] `import 'server-only'` at line 1 (AD-11 — env var with secret key)
  - [ ] `sendEmail({ to, subject, text }): Promise<{ ok: boolean; error?: string }>`
  - [ ] Uses `RESEND_API_KEY` env var (server-only, no `NEXT_PUBLIC_` prefix)
  - [ ] Raw `fetch('https://api.resend.com/emails', ...)` — no npm dependency needed
  - [ ] Never throws; returns `{ ok: false, error }` on failure (AD-6)
  - [ ] `FROM_EMAIL` constant: `'ARIA <no-reply@aria.vn>'` (configurable via env)

- [ ] **Task 3: Briefing email formatter**
  - [ ] Create `lib/email/briefingEmailFormatter.ts`
  - [ ] `import 'server-only'` at line 1 (AD-11)
  - [ ] `formatBriefingEmail(briefing: BriefingEmailInput, lang: 'vi' | 'en'): BriefingEmailOutput`
  - [ ] Interface `BriefingEmailInput`: `{ date: string; content_md: string | null; flags: { items?: BriefingFlagItem[] } | null }`
  - [ ] Interface `BriefingEmailOutput`: `{ subject: string; text: string }`
  - [ ] `hasHighUrgency`: flags.items has any severity='high' → prepend "[Cần xử lý] " or "[Action needed] "
  - [ ] Subject: `"ARIA Tóm tắt — {DD/MM/YYYY}"` (vi) / `"ARIA Briefing — {YYYY-MM-DD}"` (en)
  - [ ] Body: plain text, sections derived from `content_md` (strip markdown, add headings)
  - [ ] Footer line: `"Để huỷ nhận email, đăng nhập ARIA > Cài đặt > Kênh thông báo."` (vi) / equivalent (en)
  - [ ] Never throws

- [ ] **Task 4: Check-in email formatter**
  - [ ] Create `lib/email/checkInEmailFormatter.ts`
  - [ ] `import 'server-only'` at line 1 (AD-11)
  - [ ] `formatCheckInEmail(checkIn: CheckInEmailInput, lang: 'vi' | 'en'): CheckInEmailOutput`
  - [ ] Interface `CheckInEmailInput`: `{ deal_title: string; prompt_template: string | null }`
  - [ ] Interface `CheckInEmailOutput`: `{ subject: string; text: string }`
  - [ ] Subject: `"ARIA Nhắc nhở — {deal_title}"` (vi) / `"ARIA Check-in — {deal_title}"` (en)
  - [ ] Body: deal name, prompt text, then "Trả lời 1, 2, hoặc 3 trong app ARIA:" + numbered options
  - [ ] Options: `1. Có  2. Không  3. Để sau`
  - [ ] Footer: unsubscribe line (same as briefing)
  - [ ] Never throws

- [ ] **Task 5: Send-emails cron endpoint**
  - [ ] Create `app/api/cron/send-emails/route.ts`
  - [ ] `GET` handler protected by `CRON_SECRET` (same pattern as `app/api/cron/briefing/route.ts`)
  - [ ] Uses `createServiceClient()` (AD-13 — cron/system task, not owner-data path)
  - [ ] **Briefing email loop**: query `briefings WHERE email_sent_at IS NULL AND date = today` (paginate up to 100)
    - For each: fetch owner email from `auth.users` (service client)
    - `formatBriefingEmail` → `sendEmail`
    - On success: `UPDATE briefings SET email_sent_at = now()`
    - On failure: `logActivity` with `action = 'email_delivery_failed'`
  - [ ] **Check-in email loop**: query `check_ins WHERE email_sent_at IS NULL AND status = 'pending'` (up to 100)
    - JOIN deals to get `title` and `owner_id`
    - For each: fetch owner email; `formatCheckInEmail` → `sendEmail`
    - On success: `UPDATE check_ins SET email_sent_at = now()`
    - On failure: `logActivity` with `action = 'email_delivery_failed'`
  - [ ] Returns `{ sent: { briefings: N, checkIns: N }, failed: N }`

- [ ] **Task 6: Test file**
  - [ ] Create `lib/__tests__/emailDelivery52.test.ts`
  - [ ] ≥60 ts-node tests, standard pattern
  - [ ] T1-T15: Inline email formatter logic (subject, body, urgency prefix, footer)
  - [ ] T16-T30: File structure checks (migration, emailService, formatters)
  - [ ] T31-T45: Send-emails cron route structure
  - [ ] T46-T60: package.json scripts and misc correctness checks

- [ ] **Task 7: Update package.json**
  - [ ] Add `test:email-delivery52` script
  - [ ] Add to CI chain

## Dev Notes

### Email provider: Resend via raw fetch (no new npm package)

```typescript
// lib/email/emailService.ts
const RESEND_URL = 'https://api.resend.com/emails'

export async function sendEmail({ to, subject, text }: EmailPayload): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return { ok: false, error: 'RESEND_API_KEY not configured' }

  try {
    const res = await fetch(RESEND_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM ?? 'ARIA <no-reply@aria.vn>',
        to: [to],
        subject,
        text,
      }),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      return { ok: false, error: `Resend ${res.status}: ${body}` }
    }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
}
```

### Briefing email formatter

The `content_md` field holds the full AI-generated markdown briefing. For v1 plain-text email, strip markdown syntax:
- Remove `##` / `**` / `*` / `_` / `` ` `` markers
- Keep paragraph breaks as `\n\n`
- Limit body to first 2000 chars if very long (prevent oversized emails)

```typescript
function stripMarkdown(md: string): string {
  return md
    .replace(/#{1,6}\s*/g, '')   // headings
    .replace(/\*\*(.+?)\*\*/g, '$1')  // bold
    .replace(/\*(.+?)\*/g, '$1')  // italic
    .replace(/`(.+?)`/g, '$1')    // inline code
    .replace(/^\s*[-*]\s+/gm, '• ')  // bullet points
    .trim()
}
```

Subject (Vietnamese):
- No urgency: `"ARIA Tóm tắt — 01/07/2026"` (DD/MM/YYYY from `date`)
- Urgency: `"[Cần xử lý] ARIA Tóm tắt — 01/07/2026"`

Subject (English):
- No urgency: `"ARIA Briefing — 2026-07-01"` (YYYY-MM-DD)
- Urgency: `"[Action needed] ARIA Briefing — 2026-07-01"`

### Check-in email body

```
Xin chào,

ARIA có một nhắc nhở check-in cho deal: {deal_title}

{prompt_template}

Trả lời 1, 2, hoặc 3 trong app ARIA:
1. Có
2. Không
3. Để sau

---
Để huỷ nhận email, đăng nhập ARIA > Cài đặt > Kênh thông báo.
```

### Cron endpoint pattern (copy from existing briefing cron)

```typescript
function validateCronSecret(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return false
  const authHeader = request.headers.get('authorization')
  if (!authHeader || !/^Bearer\s+/i.test(authHeader)) return false
  const token = authHeader.replace(/^Bearer\s+/i, '')
  return token === cronSecret
}
```

### Owner email lookup

From `auth.users` via service client:
```typescript
const { data: { users } } = await supabase.auth.admin.listUsers()
// OR per-owner:
const { data: { user } } = await supabase.auth.admin.getUserById(ownerId)
const email = user?.email
```

### AD-13 compliance in cron

The send-emails cron uses `createServiceClient()` — it's a system task with no HTTP request context. It accesses user emails via `auth.admin.getUserById()`, which requires the service role key. This is the ONLY path where service client + user data access is permitted (admin operations for system tasks).

### Idempotency (AD-7)

- Briefing: `email_sent_at IS NULL` — set to `now()` on success
- Check-in: `email_sent_at IS NULL` — set to `now()` on success  
- Duplicate-safe: if cron fires twice for the same day, the `WHERE email_sent_at IS NULL` filter ensures no double-send

### AD-8: In-app record survives email failure

The cron does NOT roll back the briefing/check_in record on email failure. The `email_sent_at` simply stays NULL (will be retried on next cron run). The failure is logged to `activity_log`. The owner still sees the item in-app.

### Language preference

The `settings.business_context` field may contain language info, but for simplicity use `vi` as default for all email subjects in v1. The email formatter should accept `lang` param but v1 always passes `'vi'`.

### Test pattern

Same ts-node pattern as all prior story tests. Inline formatter logic (no lib imports), file structure checks via `fs.readFileSync`.

## Dev Agent Record

### Completion Notes
_(to be filled by dev agent)_

### Debug Log
_(to be filled by dev agent)_

## File List
_(to be filled during implementation)_

## Change Log

| Date | Change |
|------|--------|
| 2026-06-30 | Story created |
