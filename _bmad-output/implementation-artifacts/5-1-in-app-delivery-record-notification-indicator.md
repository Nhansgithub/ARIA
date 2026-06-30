---
story: 5-1
title: In-App Delivery Record & Notification Indicator
status: done
epic: 5
sprint: 1
baseline_commit: ""
---

# Story 5.1: In-App Delivery Record & Notification Indicator

Status: done

## Story

As an Owner, I want every proactive item (Briefing, Check-in, urgency alert) to be immediately visible in the app with an unread count badge, So that I never miss a time-sensitive update even if no external channel is configured.

## Acceptance Criteria

**Given** the scheduler generates a daily Briefing or fires a check-in (Epic 4),
**When** the delivery service runs,
**Then** the proactive item is written as an in-app record to the `briefings` or `check_ins` table (with `channel = in_app`, `status = pending`) before any external channel is attempted — this write is the authoritative record per AD-8.

**Given** an in-app proactive record exists with `status = pending`,
**When** the Owner opens the app,
**Then** the Briefing panel (for a Briefing) or an ARIA-initiated message card in Chat (for a Check-in) is visible on next open, independent of whether Zalo or email delivery succeeded or failed (FR-38).

**Given** one or more high-urgency items are unaddressed (a deal with an overdue action in "Today," or a check-in for a high-priority deal),
**When** the Owner is on any panel,
**Then** the Briefing nav item shows an amber-filled badge pill with the integer count of unaddressed high-urgency items; the count does not include low-urgency updates (FR-38).

**Given** the Owner opens the Briefing panel and scrolls past all flagged high-urgency items, or taps a Check-in quick-reply chip resolving it,
**When** the item transitions to `status = answered` or the Briefing is marked seen,
**Then** the badge count decrements accordingly; reaching zero removes the badge entirely.

**Given** a high-urgency item arrives while the Owner is actively in the Chat panel,
**When** the in-app record is written,
**Then** a dismissible in-app banner also appears at the top of the Chat panel listing the urgency reason.

**Given** there are zero eligible deals (empty CRM or all deals paused),
**When** the scheduler fires,
**Then** no in-app record is created and the badge remains absent (FR-36, AD-7 idempotency).

## Tasks / Subtasks

- [ ] **Task 1: Migration — add `seen_at` to briefings**
  - [ ] Create `supabase/migrations/20260701000000_briefing_seen_at.sql`
  - [ ] `ALTER TABLE briefings ADD COLUMN IF NOT EXISTS seen_at timestamptz` — nullable, set when owner sees all high-urgency items

- [ ] **Task 2: Badge count API**
  - [ ] Create `app/api/notifications/badge-count/route.ts`
  - [ ] `GET` handler: uses `createServerClient()`, verifies auth
  - [ ] Counts unseen high-urgency briefing flags: today's briefing WHERE `seen_at IS NULL` → count flags.items with `severity = 'high'`
  - [ ] Counts pending high-priority check-ins: `check_ins` WHERE `status = 'pending'` joined with `deals` WHERE `priority = 'high'`
  - [ ] Returns `{ count: number }` (sum of both)

- [ ] **Task 3: Mark briefing seen API**
  - [ ] Create `app/api/briefings/[date]/seen/route.ts`
  - [ ] `POST` handler: sets `seen_at = now()` for `briefings WHERE owner_id = user.id AND date = params.date`
  - [ ] Returns 204 on success, 404 if no briefing for that date

- [ ] **Task 4: AppShell badge count on mount**
  - [ ] Modify `components/layout/AppShell.tsx`
  - [ ] Fetch `GET /api/notifications/badge-count` on mount with `.catch(() => {})` (AD-6)
  - [ ] Use the API count as the initial `briefingBadgeCount`
  - [ ] When mode changes FROM 'briefing' → re-fetch badge count to pick up seen state

- [ ] **Task 5: BriefingPanel marks briefing seen**
  - [ ] Modify `components/briefing/BriefingPanel.tsx`
  - [ ] After owner has scrolled/loaded the briefing: call `POST /api/briefings/[date]/seen` fire-and-forget
  - [ ] `onHighFlagCount` still called from the panel as before (optimistic badge update)

- [ ] **Task 6: Chat panel dismissible banner**
  - [ ] Modify `components/chat/ChatPanel.tsx`
  - [ ] On mount: fetch `GET /api/notifications/badge-count` (separate from the check-in pending fetch)
  - [ ] If count > 0: show a dismissible banner above InputBar: "Có [N] mục cần xử lý — xem Briefing" in amber
  - [ ] Banner has a dismiss (×) button; on dismiss, banner disappears (local state only, not persisted)
  - [ ] Banner does NOT appear if the owner is already on the Briefing panel (the prop/mode context is not available in ChatPanel — just show it always in Chat mode)

- [ ] **Task 7: Test file**
  - [ ] Create `lib/__tests__/inAppDelivery51.test.ts`
  - [ ] ≥60 ts-node tests following the standard pattern
  - [ ] T1-T15: Inline badge count logic (briefing high-flag counting, check-in pending counting)
  - [ ] T16-T30: File structure checks (migration, badge API, seen API)
  - [ ] T31-T45: AppShell and BriefingPanel modifications
  - [ ] T46-T60: ChatPanel banner, package.json scripts

- [ ] **Task 8: Update package.json**
  - [ ] Add `test:in-app-delivery51` script
  - [ ] Add to CI chain in `test` script

## Dev Notes

### Schema (current state after all prior migrations)

```
briefings:
  id, owner_id, date, content_md, flags (jsonb), generated_at
  UNIQUE(owner_id, date)
  → flags shape: { items: Array<{ type, deal_id, deal_title, severity: 'high'|'medium', reason, recommended_action }> }

check_ins:
  id, owner_id, deal_id, prompt_template, sent_at,
  channel (checkin_channel ENUM: 'in_app'|'zalo'|'email', default 'in_app'),
  answered_at, answer (jsonb), status (checkin_status ENUM: 'pending'|'answered'|'skipped'),
  created_at
  UNIQUE INDEX check_ins_pending_per_deal ON (owner_id, deal_id) WHERE status = 'pending'
```

Migration adds: `seen_at timestamptz` to `briefings` (nullable).

### Badge count logic

The badge represents: how many high-urgency proactive items does the owner have that need attention RIGHT NOW?

**Briefing contribution:**
- Today's briefing (`date = current UTC date`), if `seen_at IS NULL`, contributes the count of `flags.items` where `severity = 'high'`
- If no briefing today, contributes 0
- Once `seen_at` is set (briefing viewed), contributes 0

**Check-in contribution:**
- Count of `check_ins WHERE status = 'pending'` joined with deals WHERE `deals.priority = 'high'`
- These are high-priority deals that haven't been answered yet
- When check-in is answered/skipped → status changes → count decreases automatically

**Supabase join pattern for check-ins:**
```typescript
const { count } = await supabase
  .from('check_ins')
  .select('*, deals!inner(priority)', { count: 'exact', head: true })
  .eq('owner_id', user.id)
  .eq('status', 'pending')
  .eq('deals.priority', 'high')
```

**Briefing high-flag count:**
```typescript
const { data: briefing } = await supabase
  .from('briefings')
  .select('flags, seen_at')
  .eq('owner_id', user.id)
  .eq('date', todayUtc)  // 'YYYY-MM-DD'
  .is('seen_at', null)   // only unseen briefings count
  .single()

const highFlags = briefing
  ? (briefing.flags?.items ?? []).filter((f: { severity: string }) => f.severity === 'high').length
  : 0
```

### Mark seen API

`POST /api/briefings/[date]/seen` — URL param is a date string like `2026-06-30`.

```typescript
await supabase
  .from('briefings')
  .update({ seen_at: new Date().toISOString() })
  .eq('owner_id', user.id)
  .eq('date', params.date)
```

Returns `NextResponse.json({}, { status: 204 })` on success.

### AppShell badge fetch on mount

```typescript
useEffect(() => {
  fetch('/api/notifications/badge-count')
    .then((r) => r.ok ? r.json() : Promise.reject())
    .then((d: { count: number }) => setBriefingBadgeCount(d.count))
    .catch(() => { /* AD-6 */ })
}, [])
```

Also re-fetch when mode changes FROM 'briefing':
```typescript
// Inside NavButton onClick, after setMode:
if (prevMode === 'briefing') {
  fetch('/api/notifications/badge-count')
    .then((r) => r.ok ? r.json() : Promise.reject())
    .then((d: { count: number }) => setBriefingBadgeCount(d.count))
    .catch(() => {})
}
```

Actually, simpler: use a `useEffect([mode])` to re-fetch when mode changes, but only when it changes AWAY from briefing.

```typescript
const prevModeRef = useRef<Mode>(mode)
useEffect(() => {
  const prev = prevModeRef.current
  prevModeRef.current = mode
  if (prev === 'briefing' && mode !== 'briefing') {
    fetch('/api/notifications/badge-count')
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then((d: { count: number }) => setBriefingBadgeCount(d.count))
      .catch(() => {})
  }
}, [mode])
```

The `onHighFlagCount` callback from BriefingPanel remains as the optimistic update when inside the Briefing panel (live count from the current briefing). The API fetch covers the mount case and the transition-out case.

### BriefingPanel seen call

When the briefing is loaded, call the seen API immediately (the owner opened Briefing panel = they saw it):

```typescript
// Inside the existing fetch effect, after setting briefing state:
const dateStr = data.briefing.date  // from API response
fetch(`/api/briefings/${dateStr}/seen`, { method: 'POST' }).catch(() => {})
```

The `onHighFlagCount` call remains for optimistic badge update while in the briefing panel.

### Chat panel banner

```tsx
const [urgentCount, setUrgentCount] = useState(0)
const [bannerDismissed, setBannerDismissed] = useState(false)

useEffect(() => {
  fetch('/api/notifications/badge-count')
    .then((r) => r.ok ? r.json() : Promise.reject())
    .then((d: { count: number }) => setUrgentCount(d.count))
    .catch(() => {})
}, [])
```

Render above check-in cards:
```tsx
{urgentCount > 0 && !bannerDismissed && (
  <div style={{ /* amber banner styles */ }}>
    <span>Có {urgentCount} mục cần xử lý — xem Briefing</span>
    <button onClick={() => setBannerDismissed(true)}>×</button>
  </div>
)}
```

### AD constraints

- **AD-2**: Every Supabase query includes `.eq('owner_id', user.id)` — critical for badge count
- **AD-13**: `createServerClient()` in all API routes — NOT `createServiceClient()`
- **AD-6**: All client-side fetches have `.catch(() => {})` — badge failing must never break UI
- **AD-7**: `briefings` UNIQUE on `(owner_id, date)` ensures idempotency — seen_at can be set multiple times safely
- **AD-8**: In-app records are the authoritative write — Epic 4's scheduler already handles this; Story 5.1 adds the seen-tracking layer

### Existing code to preserve

- `BriefingPanel.onHighFlagCount(count)` callback → AppShell `setBriefingBadgeCount` — keep as the live badge while briefing is open
- `AppShell.briefingBadgeCount` → badge pill on Briefing nav item — keep, just also set it from API on mount
- `ChatPanel.pendingCheckIns` state from `GET /api/check-ins/pending` — keep; the banner is a SEPARATE fetch from badge-count
- The `onEmpty` callback in BriefingPanel → navigates to Chat — keep unchanged
- `briefingBadgeCount` reset to 0 when user clicks a non-briefing nav item (`setBriefingBadgeCount(0)` in existing onClick) — keep but supplement with API re-fetch

### Test pattern (ts-node)

Same as all previous stories:
```typescript
export {}
import fs from 'fs'
import path from 'path'
const ROOT = process.cwd()
// ... assert() function ...
// T1-T15: inline badge logic
// T16-T30: file structure checks
// T31-T60: component and API checks
console.log(`\nResults: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
```

Never import from project `lib/`. Read files with `fs.readFileSync`. Use `process.cwd()` not `__dirname`.

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
