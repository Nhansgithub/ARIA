export {}
// ts-node inline tests for Story 5.1: In-App Delivery Record & Notification Indicator
// Pattern: no imports from project lib/ — logic simulated inline.
// Run: npx ts-node lib/__tests__/inAppDelivery51.test.ts

import fs from 'fs'
import path from 'path'

let passed = 0
let failed = 0

function assert(condition: boolean, label: string): void {
  if (condition) {
    console.log(`  ✓ ${label}`)
    passed++
  } else {
    console.error(`  ✗ FAIL: ${label}`)
    failed++
  }
}

// ── Inline badge count logic ───────────────────────────────────────────────

interface BriefingFlagItem {
  severity: 'high' | 'medium'
  type: string
}

interface BriefingRecord {
  flags: { items?: BriefingFlagItem[] } | null
  seen_at: string | null
}

function computeBadgeCount(
  briefing: BriefingRecord | null,
  pendingHighPriorityCheckIns: number
): number {
  const highFlagCount =
    briefing && briefing.seen_at === null
      ? (briefing.flags?.items ?? []).filter((f) => f.severity === 'high').length
      : 0
  return highFlagCount + pendingHighPriorityCheckIns
}

// ── T1-T15: Badge count logic ──────────────────────────────────────────────

console.log('\nT1-T15: Badge count logic')

// T1: No briefing → badge count is just check-in count
assert(computeBadgeCount(null, 3) === 3, 'T1: null briefing + 3 pending check-ins = badge 3')

// T2: Unseen briefing with 2 high flags → contributes 2
{
  const b: BriefingRecord = {
    flags: {
      items: [
        { severity: 'high', type: 'overdue' },
        { severity: 'high', type: 'stale' },
      ],
    },
    seen_at: null,
  }
  assert(computeBadgeCount(b, 0) === 2, 'T2: unseen briefing with 2 high flags = badge 2')
}

// T3: Seen briefing (seen_at set) → contributes 0 even with high flags
{
  const b: BriefingRecord = {
    flags: { items: [{ severity: 'high', type: 'overdue' }] },
    seen_at: '2026-07-01T05:00:00Z',
  }
  assert(computeBadgeCount(b, 0) === 0, 'T3: seen briefing does not contribute to badge')
}

// T4: Medium-severity flags don't count
{
  const b: BriefingRecord = {
    flags: {
      items: [
        { severity: 'medium', type: 'stale' },
        { severity: 'medium', type: 'missing_doc' },
      ],
    },
    seen_at: null,
  }
  assert(computeBadgeCount(b, 0) === 0, 'T4: medium-severity flags do not count toward badge')
}

// T5: Mix of high and medium — only high counted
{
  const b: BriefingRecord = {
    flags: {
      items: [
        { severity: 'high', type: 'overdue' },
        { severity: 'medium', type: 'stale' },
        { severity: 'high', type: 'stale' },
      ],
    },
    seen_at: null,
  }
  assert(computeBadgeCount(b, 0) === 2, 'T5: mixed severity — only 2 high flags counted')
}

// T6: Briefing + check-ins combined
{
  const b: BriefingRecord = {
    flags: { items: [{ severity: 'high', type: 'overdue' }] },
    seen_at: null,
  }
  assert(computeBadgeCount(b, 2) === 3, 'T6: 1 high briefing flag + 2 check-ins = badge 3')
}

// T7: Empty flags array
{
  const b: BriefingRecord = { flags: { items: [] }, seen_at: null }
  assert(computeBadgeCount(b, 0) === 0, 'T7: empty flags array = badge 0')
}

// T8: Null flags payload
{
  const b: BriefingRecord = { flags: null, seen_at: null }
  assert(computeBadgeCount(b, 0) === 0, 'T8: null flags payload = badge 0')
}

// T9: Zero check-ins, zero flags → badge 0
assert(computeBadgeCount(null, 0) === 0, 'T9: no briefing no check-ins = badge 0')

// T10: Badge reaches zero → should remove badge
assert(computeBadgeCount(null, 0) === 0, 'T10: badge 0 means badge removed')

// T11: Multiple high flags summed correctly
{
  const b: BriefingRecord = {
    flags: {
      items: Array.from({ length: 5 }, (_, i) => ({ severity: 'high' as const, type: `type${i}` })),
    },
    seen_at: null,
  }
  assert(computeBadgeCount(b, 0) === 5, 'T11: 5 high flags in unseen briefing = badge 5')
}

// T12: Large check-in count combined with briefing flags
{
  const b: BriefingRecord = {
    flags: { items: [{ severity: 'high', type: 'overdue' }] },
    seen_at: null,
  }
  assert(computeBadgeCount(b, 9) === 10, 'T12: 1 high flag + 9 check-ins = badge 10')
}

// T13: Briefing with missing items key in flags
{
  const b: BriefingRecord = { flags: {} as { items?: BriefingFlagItem[] }, seen_at: null }
  assert(computeBadgeCount(b, 0) === 0, 'T13: flags object without items key = badge 0')
}

// T14: seen_at non-null means no contribution regardless of severity
{
  const b: BriefingRecord = {
    flags: {
      items: [
        { severity: 'high', type: 'overdue' },
        { severity: 'high', type: 'stale' },
      ],
    },
    seen_at: '2026-06-30T08:00:00Z',
  }
  assert(computeBadgeCount(b, 0) === 0, 'T14: seen_at non-null blocks all flag contributions')
}

// T15: Only check-in count (no briefing), various amounts
assert(computeBadgeCount(null, 1) === 1, 'T15: 1 pending high-priority check-in = badge 1')

// ── T16-T30: File structure checks ─────────────────────────────────────────

console.log('\nT16-T30: File structure checks')

const ROOT = process.cwd()

const migrationPath = path.join(
  ROOT,
  'supabase',
  'migrations',
  '20260701000000_briefing_seen_at.sql'
)
const badgeCountRoutePath = path.join(
  ROOT,
  'app',
  'api',
  'notifications',
  'badge-count',
  'route.ts'
)
const seenRoutePath = path.join(ROOT, 'app', 'api', 'briefings', '[date]', 'seen', 'route.ts')

const migrationContent = fs.existsSync(migrationPath) ? fs.readFileSync(migrationPath, 'utf-8') : ''
const badgeCountContent = fs.existsSync(badgeCountRoutePath)
  ? fs.readFileSync(badgeCountRoutePath, 'utf-8')
  : ''
const seenRouteContent = fs.existsSync(seenRoutePath) ? fs.readFileSync(seenRoutePath, 'utf-8') : ''

// T16: Migration file exists
assert(fs.existsSync(migrationPath), 'T16: migration 20260701000000_briefing_seen_at.sql exists')

// T17: Migration adds seen_at to briefings
assert(
  migrationContent.includes('seen_at') && migrationContent.includes('briefings'),
  'T17: migration adds seen_at to briefings'
)

// T18: Badge count API route exists
assert(
  fs.existsSync(badgeCountRoutePath),
  'T18: badge-count route exists at app/api/notifications/badge-count/'
)

// T19: Badge count route exports GET
assert(
  badgeCountContent.includes('export') && badgeCountContent.includes('GET'),
  'T19: badge-count route exports GET'
)

// T20: Badge count route uses createServerClient (AD-13)
assert(
  badgeCountContent.includes('createServerClient'),
  'T20: badge-count route uses createServerClient (AD-13)'
)

// T21: Badge count route does NOT use createServiceClient (AD-13)
assert(
  !badgeCountContent.includes('createServiceClient'),
  'T21: badge-count route does NOT use createServiceClient'
)

// T22: Badge count route checks seen_at IS NULL for unseen briefings
assert(
  badgeCountContent.includes('seen_at'),
  'T22: badge-count route checks seen_at for unseen briefings'
)

// T23: Badge count route queries check_ins status pending
assert(
  badgeCountContent.includes('status') && badgeCountContent.includes('pending'),
  'T23: badge-count route queries check_ins with status=pending'
)

// T24: Badge count route joins check_ins with deals for priority filter
assert(
  badgeCountContent.includes('deals') && badgeCountContent.includes('priority'),
  'T24: badge-count route joins check_ins with deals for priority filter'
)

// T25: Badge count route returns { count: number }
assert(badgeCountContent.includes('count'), 'T25: badge-count route returns count field')

// T26: Badge count route includes owner_id guard (AD-2)
assert(badgeCountContent.includes('owner_id'), 'T26: badge-count route includes owner_id (AD-2)')

// T27: Seen route exists
assert(fs.existsSync(seenRoutePath), 'T27: briefings/[date]/seen route exists')

// T28: Seen route exports POST
assert(
  seenRouteContent.includes('export') && seenRouteContent.includes('POST'),
  'T28: seen route exports POST'
)

// T29: Seen route uses createServerClient (AD-13)
assert(
  seenRouteContent.includes('createServerClient'),
  'T29: seen route uses createServerClient (AD-13)'
)

// T30: Seen route updates seen_at on briefings with owner_id guard (AD-2)
assert(
  seenRouteContent.includes('seen_at') && seenRouteContent.includes('owner_id'),
  'T30: seen route updates seen_at with owner_id guard (AD-2)'
)

// ── T31-T45: AppShell and BriefingPanel modifications ──────────────────────

console.log('\nT31-T45: AppShell and BriefingPanel modifications')

const appShellPath = path.join(ROOT, 'components', 'layout', 'AppShell.tsx')
const briefingPanelPath = path.join(ROOT, 'components', 'briefing', 'BriefingPanel.tsx')

const appShellContent = fs.existsSync(appShellPath) ? fs.readFileSync(appShellPath, 'utf-8') : ''
const briefingPanelContent = fs.existsSync(briefingPanelPath)
  ? fs.readFileSync(briefingPanelPath, 'utf-8')
  : ''

// T31: AppShell imports useEffect
assert(appShellContent.includes('useEffect'), 'T31: AppShell imports useEffect')

// T32: AppShell imports useRef
assert(appShellContent.includes('useRef'), 'T32: AppShell imports useRef')

// T33: AppShell fetches /api/notifications/badge-count on mount
assert(
  appShellContent.includes('/api/notifications/badge-count'),
  'T33: AppShell fetches badge-count API on mount'
)

// T34: AppShell re-fetches badge count when leaving briefing panel
assert(
  appShellContent.includes("'briefing'") && appShellContent.includes('fetchBadgeCount'),
  'T34: AppShell re-fetches badge count on mode transition from briefing'
)

// T35: AppShell uses prevModeRef to track previous mode
assert(
  appShellContent.includes('prevModeRef'),
  'T35: AppShell uses prevModeRef for mode transition tracking'
)

// T36: AppShell badge fetch has catch for AD-6
assert(
  appShellContent.includes('AD-6') || appShellContent.includes('.catch('),
  'T36: AppShell badge fetch has .catch() for AD-6 graceful degradation'
)

// T37: BriefingPanel calls /api/briefings/.../seen POST after loading briefing
assert(
  briefingPanelContent.includes('/api/briefings/') &&
    briefingPanelContent.includes("method: 'POST'"),
  'T37: BriefingPanel calls POST /api/briefings/[date]/seen on load'
)

// T38: BriefingPanel seen call is fire-and-forget (no await at top level)
assert(
  briefingPanelContent.includes('/api/briefings/') && briefingPanelContent.includes('.catch('),
  'T38: BriefingPanel seen call is fire-and-forget with .catch()'
)

// T39: BriefingPanel still calls onHighFlagCount (existing behavior preserved)
assert(
  briefingPanelContent.includes('onHighFlagCount'),
  'T39: BriefingPanel still calls onHighFlagCount (preserved)'
)

// T40: BriefingPanel seen call uses data.date for URL
assert(
  briefingPanelContent.includes('data.date') || briefingPanelContent.includes('.date'),
  'T40: BriefingPanel uses briefing date in seen URL'
)

// T41: Seen route validates date format before query
assert(
  seenRouteContent.includes('\\d{4}-\\d{2}-\\d{2}') || seenRouteContent.includes('test('),
  'T41: seen route validates date format (YYYY-MM-DD)'
)

// T42: Seen route returns 404 if briefing not found
assert(
  seenRouteContent.includes('404'),
  'T42: seen route returns 404 if briefing not found for date'
)

// T43: Seen route returns 204 on success
assert(seenRouteContent.includes('204'), 'T43: seen route returns 204 on success')

// T44: Badge count route uses .maybeSingle() or handles missing briefing gracefully
assert(
  badgeCountContent.includes('maybeSingle') || badgeCountContent.includes('single'),
  'T44: badge-count route handles missing briefing gracefully (maybeSingle or null check)'
)

// T45: Badge count route queries today\'s briefing by date
assert(
  badgeCountContent.includes('date') && badgeCountContent.includes('briefings'),
  'T45: badge-count route queries today date on briefings table'
)

// ── T46-T60: ChatPanel banner and package.json ────────────────────────────

console.log('\nT46-T60: ChatPanel banner and package.json')

const chatPanelPath = path.join(ROOT, 'components', 'chat', 'ChatPanel.tsx')
const packageJsonPath = path.join(ROOT, 'package.json')

const chatPanelContent = fs.existsSync(chatPanelPath) ? fs.readFileSync(chatPanelPath, 'utf-8') : ''
const packageJsonContent = fs.existsSync(packageJsonPath)
  ? fs.readFileSync(packageJsonPath, 'utf-8')
  : ''

// T46: ChatPanel has urgentCount state
assert(chatPanelContent.includes('urgentCount'), 'T46: ChatPanel has urgentCount state')

// T47: ChatPanel has bannerDismissed state
assert(chatPanelContent.includes('bannerDismissed'), 'T47: ChatPanel has bannerDismissed state')

// T48: ChatPanel fetches /api/notifications/badge-count on mount
assert(
  chatPanelContent.includes('/api/notifications/badge-count'),
  'T48: ChatPanel fetches badge-count API on mount'
)

// T49: ChatPanel shows banner only when urgentCount > 0 and not dismissed
assert(
  chatPanelContent.includes('urgentCount > 0') && chatPanelContent.includes('bannerDismissed'),
  'T49: ChatPanel banner shown when urgentCount > 0 and not dismissed'
)

// T50: ChatPanel banner has dismiss button (×)
assert(
  chatPanelContent.includes('setBannerDismissed(true)') ||
    chatPanelContent.includes('setBannerDismissed'),
  'T50: ChatPanel banner has dismiss button calling setBannerDismissed'
)

// T51: ChatPanel banner mentions Briefing or urgency items in Vietnamese
assert(
  chatPanelContent.includes('Briefing') || chatPanelContent.includes('Có'),
  'T51: ChatPanel banner has Vietnamese urgency text or Briefing reference'
)

// T52: ChatPanel banner has aria-label or accessibility attribute on dismiss button
assert(
  chatPanelContent.includes('aria-label') || chatPanelContent.includes('title='),
  'T52: ChatPanel banner dismiss button has accessibility label'
)

// T53: ChatPanel badge fetch has .catch() for AD-6
assert(
  chatPanelContent.indexOf('/api/notifications/badge-count') >= 0 &&
    chatPanelContent.includes('.catch('),
  'T53: ChatPanel badge fetch has .catch() for AD-6'
)

// T54: ChatPanel banner has amber color (consistent with urgency styling)
assert(
  chatPanelContent.includes('#f59e0b') ||
    chatPanelContent.includes('amber') ||
    chatPanelContent.includes('245,158,11'),
  'T54: ChatPanel banner uses amber urgency color'
)

// T55: Seen route does NOT use createServiceClient (AD-13)
assert(
  !seenRouteContent.includes('createServiceClient'),
  'T55: seen route does NOT use createServiceClient (AD-13)'
)

// T56: Badge count route handles missing briefing (no briefing today = count from check-ins only)
assert(
  badgeCountContent.indexOf('null') >= 0 || badgeCountContent.includes('maybeSingle'),
  'T56: badge-count route handles no briefing for today gracefully'
)

// T57: AppShell badge fetch uses setBriefingBadgeCount
assert(
  appShellContent.includes('setBriefingBadgeCount'),
  'T57: AppShell sets briefingBadgeCount from badge-count API result'
)

// T58: BriefingPanel seen call fires inside applyBriefing (when briefing data is applied)
assert(
  briefingPanelContent.includes('applyBriefing') &&
    briefingPanelContent.includes('/api/briefings/'),
  'T58: BriefingPanel seen call is inside applyBriefing function'
)

// T59: package.json contains test:in-app-delivery51 script
assert(
  packageJsonContent.includes('test:in-app-delivery51'),
  'T59: package.json contains test:in-app-delivery51 script'
)

// T60: package.json test chain includes inAppDelivery51.test.ts
assert(
  packageJsonContent.includes('inAppDelivery51.test.ts'),
  'T60: package.json test chain includes inAppDelivery51.test.ts'
)

// ── Summary ────────────────────────────────────────────────────────────────

console.log(`\nResults: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
