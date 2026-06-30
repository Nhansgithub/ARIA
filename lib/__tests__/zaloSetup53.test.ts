export {}
import fs from 'fs'
import path from 'path'

// ─── helpers ────────────────────────────────────────────────────────────────

const root = process.cwd()
const read = (rel: string) => fs.readFileSync(path.join(root, rel), 'utf8')
const exists = (rel: string) => fs.existsSync(path.join(root, rel))

let passed = 0
let failed = 0
const failures: string[] = []

function test(name: string, fn: () => void) {
  try {
    fn()
    console.log(`  ✓ ${name}`)
    passed++
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`  ✗ ${name}: ${msg}`)
    failures.push(`${name}: ${msg}`)
    failed++
  }
}

function assert(cond: boolean, msg: string) { if (!cond) throw new Error(msg) }
function assertIncludes(text: string, sub: string, label?: string) {
  assert(text.includes(sub), `Expected "${label ?? sub}" to be present`)
}
function assertNotIncludes(text: string, sub: string, label?: string) {
  assert(!text.includes(sub), `Expected "${label ?? sub}" to be absent`)
}

// ─── Load files ─────────────────────────────────────────────────────────────

const migrationSetup   = read('supabase/migrations/20260701300000_zalo_setup.sql')
const migrationRefresh = read('supabase/migrations/20260701310000_pg_cron_zalo_refresh.sql')
const tokenService     = read('lib/zalo/zaloTokenService.ts')
const connectRoute     = read('app/api/settings/zalo/connect/route.ts')
const disconnectRoute  = read('app/api/settings/zalo/disconnect/route.ts')
const cronRoute        = read('app/api/cron/refresh-zalo-token/route.ts')
const channelsRoute    = read('app/api/settings/notification-channels/route.ts')
const panel            = read('components/settings/NotificationChannelsPanel.tsx')
const pkgJson          = JSON.parse(read('package.json')) as { scripts: Record<string, string> }

const codeLines = (src: string) => src.split('\n').filter(l => !l.trimStart().startsWith('//') && !l.trimStart().startsWith('*') && !l.trimStart().startsWith('/*'))

// ─────────────────────────────────────────────────────────────────────────────
console.log('\nStory 5.3 — Zalo OA Setup & Credential Gating\n')

// ─── T1-T10: Migration — zalo_setup ─────────────────────────────────────────
console.log('── Migration: 20260701300000_zalo_setup.sql')

test('T1: migration file exists', () => assert(exists('supabase/migrations/20260701300000_zalo_setup.sql'), 'file missing'))
test('T2: adds zalo_user_id column', () => assertIncludes(migrationSetup, 'zalo_user_id'))
test('T3: adds zalo_access_token column', () => assertIncludes(migrationSetup, 'zalo_access_token'))
test('T4: adds zalo_token_issued_at column', () => assertIncludes(migrationSetup, 'zalo_token_issued_at'))
test('T5: uses IF NOT EXISTS guard', () => assertIncludes(migrationSetup, 'IF NOT EXISTS'))
test('T6: targets settings table', () => assertIncludes(migrationSetup, 'ALTER TABLE settings'))
test('T7: zalo_user_id is text type', () => {
  const line = migrationSetup.split('\n').find(l => l.includes('zalo_user_id'))
  assert(!!line && line.includes('text'), 'zalo_user_id must be text')
})
test('T8: zalo_token_issued_at is timestamptz', () => {
  const line = migrationSetup.split('\n').find(l => l.includes('zalo_token_issued_at'))
  assert(!!line && line.includes('timestamptz'), 'must be timestamptz')
})
test('T9: does NOT add encrypted_zalo_refresh_token (already exists)', () => {
  const addLines = migrationSetup.split('\n').filter(l => !l.trimStart().startsWith('--') && l.includes('encrypted_zalo_refresh_token'))
  assert(addLines.length === 0, 'encrypted_zalo_refresh_token already exists from story 0.5')
})
test('T10: no DROP or DELETE statements', () => {
  assertNotIncludes(migrationSetup.toUpperCase(), 'DROP ', 'DROP')
  assertNotIncludes(migrationSetup.toUpperCase(), 'DELETE ', 'DELETE')
})

// ─── T11-T15: Migration — pg_cron refresh job ────────────────────────────────
console.log('── Migration: 20260701310000_pg_cron_zalo_refresh.sql')

test('T11: pg_cron migration file exists', () => assert(exists('supabase/migrations/20260701310000_pg_cron_zalo_refresh.sql'), 'file missing'))
test('T12: schedules refresh-zalo-token cron job', () => assertIncludes(migrationRefresh, 'refresh-zalo-token'))
test('T13: fires every hour at :05', () => assertIncludes(migrationRefresh, '5 * * * *'))
test('T14: calls /api/cron/refresh-zalo-token endpoint', () => assertIncludes(migrationRefresh, '/api/cron/refresh-zalo-token'))
test('T15: uses cron_secret for authorization', () => assertIncludes(migrationRefresh, 'cron_secret'))

// ─── T16-T25: zaloTokenService.ts ────────────────────────────────────────────
console.log('── lib/zalo/zaloTokenService.ts')

test('T16: file exists', () => assert(exists('lib/zalo/zaloTokenService.ts'), 'file missing'))
test('T17: starts with import server-only (AD-11)', () => {
  const firstMeaningfulLine = tokenService.split('\n').find(l => l.trim().length > 0)
  assert(firstMeaningfulLine?.includes("import 'server-only'") ?? false, 'must import server-only as first line')
})
test('T18: exports isZaloConfigured function', () => assertIncludes(tokenService, 'export function isZaloConfigured'))
test('T19: isZaloConfigured checks ZALO_APP_ID', () => assertIncludes(tokenService, 'ZALO_APP_ID'))
test('T20: isZaloConfigured checks ZALO_SECRET_KEY', () => assertIncludes(tokenService, 'ZALO_SECRET_KEY'))
test('T21: exports exchangeCredentialsForTokens', () => assertIncludes(tokenService, 'export async function exchangeCredentialsForTokens'))
test('T22: exports refreshAccessToken', () => assertIncludes(tokenService, 'export async function refreshAccessToken'))
test('T23: uses AbortSignal.timeout for fetch (AD-6)', () => assertIncludes(tokenService, 'AbortSignal.timeout'))
test('T24: never throws — wraps in try/catch returning ok:false', () => {
  const code = codeLines(tokenService).join('\n')
  assertIncludes(code, 'ok: false, error')
  assertIncludes(code, 'catch (err)')
})
test('T25: uses Zalo token URL v4/oa', () => assertIncludes(tokenService, 'oauth.zaloapp.com/v4/oa/access_token'))

// ─── T26-T35: connect route ───────────────────────────────────────────────────
console.log('── app/api/settings/zalo/connect/route.ts')

test('T26: file exists', () => assert(exists('app/api/settings/zalo/connect/route.ts'), 'file missing'))
test('T27: returns 503 when !isZaloConfigured()', () => {
  const code = codeLines(connectRoute).join('\n')
  assertIncludes(code, '503')
  assertIncludes(code, 'isZaloConfigured')
})
test('T28: validates auth — returns 401 on missing user', () => assertIncludes(connectRoute, '401'))
test('T29: validates zalo_user_id is present', () => assertIncludes(connectRoute, 'zalo_user_id'))
test('T30: rejects non-numeric zalo_user_id', () => assertIncludes(connectRoute, '/^\\d+$/'))
test('T31: calls exchangeCredentialsForTokens', () => assertIncludes(connectRoute, 'exchangeCredentialsForTokens'))
test('T32: returns 502 if token exchange fails', () => assertIncludes(connectRoute, '502'))
test('T33: upserts zalo_status as connected', () => assertIncludes(connectRoute, "'connected'"))
test('T34: uses createServerClient (AD-13 owner path)', () => {
  const importLines = connectRoute.split('\n').filter(l => l.trimStart().startsWith('import '))
  assert(importLines.some(l => l.includes('createServerClient')), 'must import createServerClient')
})
test('T35: stores zalo_token_issued_at timestamp', () => assertIncludes(connectRoute, 'zalo_token_issued_at'))

// ─── T36-T40: disconnect route ────────────────────────────────────────────────
console.log('── app/api/settings/zalo/disconnect/route.ts')

test('T36: file exists', () => assert(exists('app/api/settings/zalo/disconnect/route.ts'), 'file missing'))
test('T37: nulls out zalo_user_id', () => assertIncludes(disconnectRoute, 'zalo_user_id: null'))
test('T38: nulls out zalo_access_token', () => assertIncludes(disconnectRoute, 'zalo_access_token: null'))
test('T39: nulls out encrypted_zalo_refresh_token', () => assertIncludes(disconnectRoute, 'encrypted_zalo_refresh_token: null'))
test('T40: sets zalo_status to not_configured', () => assertIncludes(disconnectRoute, "'not_configured'"))

// ─── T41-T50: refresh-zalo-token cron route ───────────────────────────────────
console.log('── app/api/cron/refresh-zalo-token/route.ts')

test('T41: file exists', () => assert(exists('app/api/cron/refresh-zalo-token/route.ts'), 'file missing'))
test('T42: validates CRON_SECRET header', () => assertIncludes(cronRoute, 'CRON_SECRET'))
test('T43: early skips if !isZaloConfigured()', () => {
  const code = codeLines(cronRoute).join('\n')
  assertIncludes(code, 'isZaloConfigured')
  assertIncludes(code, 'skipped')
})
test('T44: uses createServiceClient (AD-13 cron path)', () => {
  const importLines = cronRoute.split('\n').filter(l => l.trimStart().startsWith('import '))
  assert(importLines.some(l => l.includes('createServiceClient')), 'must import createServiceClient')
})
test('T45: never uses createServerClient in cron', () => {
  const importLines = cronRoute.split('\n').filter(l => l.trimStart().startsWith('import '))
  assert(!importLines.some(l => l.includes('createServerClient')), 'cron must not use createServerClient')
})
test('T46: queries settings by zalo_status=connected', () => assertIncludes(cronRoute, "'connected'"))
test('T47: uses 50-minute refresh cutoff for 1-hour TTL', () => {
  const code = codeLines(cronRoute).join('\n')
  assert(code.includes('50') && (code.includes('* 60') || code.includes('* 60_000') || code.includes('50 * 60') || code.includes('50_')), '50-minute buffer expected')
})
test('T48: calls refreshAccessToken on each owner', () => assertIncludes(cronRoute, 'refreshAccessToken'))
test('T49: sets zalo_status=token_expired on refresh failure', () => assertIncludes(cronRoute, "'token_expired'"))
test('T50: writes to activity_log on success (AD-14)', () => {
  const code = codeLines(cronRoute).join('\n')
  assertIncludes(code, 'activity_log')
  assertIncludes(code, 'zalo_token_refreshed')
})

// ─── T51-T58: notification-channels route (updated) ─────────────────────────
console.log('── app/api/settings/notification-channels/route.ts')

test('T51: returns zalo_server_configured boolean', () => assertIncludes(channelsRoute, 'zalo_server_configured'))
test('T52: zalo_server_configured checks both ZALO_APP_ID and ZALO_SECRET_KEY', () => {
  const code = codeLines(channelsRoute).join('\n')
  assertIncludes(code, 'ZALO_APP_ID')
  assertIncludes(code, 'ZALO_SECRET_KEY')
})
test('T53: OWNER_WRITABLE_FIELDS does not include zalo_status', () => {
  const match = channelsRoute.match(/OWNER_WRITABLE_FIELDS\s*=\s*\[([^\]]+)\]/)
  assert(!!match, 'OWNER_WRITABLE_FIELDS constant expected')
  assertNotIncludes(match![1] ?? '', 'zalo_status', 'zalo_status must not be owner-writable')
})
test('T54: GET returns Cache-Control: no-store', () => assertIncludes(channelsRoute, 'no-store'))
test('T55: GET uses maybeSingle()', () => assertIncludes(channelsRoute, 'maybeSingle'))
test('T56: PATCH rejects unknown fields with 400', () => {
  const code = codeLines(channelsRoute).join('\n')
  assert(code.includes('400') && (code.includes('Unknown') || code.includes('OWNER_WRITABLE') || code.includes('read-only')), '400 for unknown fields expected')
})

// ─── T57-T64: NotificationChannelsPanel component ────────────────────────────
console.log('── components/settings/NotificationChannelsPanel.tsx')

test('T57: component file exists', () => assert(exists('components/settings/NotificationChannelsPanel.tsx'), 'file missing'))
test('T58: exports NotificationChannelsPanel', () => assertIncludes(panel, 'export function NotificationChannelsPanel'))
test('T59: fetches /api/settings/notification-channels on mount', () => assertIncludes(panel, '/api/settings/notification-channels'))
test('T60: shows Zalo setup wizard (showZaloWizard state)', () => assertIncludes(panel, 'showZaloWizard'))
test('T61: wizard has zalo_user_id input', () => assertIncludes(panel, 'zaloUserId'))
test('T62: wizard has follow confirmation checkbox', () => assertIncludes(panel, 'zaloFollowConfirmed'))
test('T63: POST to /api/settings/zalo/connect', () => assertIncludes(panel, '/api/settings/zalo/connect'))
test('T64: disconnect button calls /api/settings/zalo/disconnect', () => assertIncludes(panel, '/api/settings/zalo/disconnect'))
test('T65: shows server-not-configured message when zaloServerConfigured=false', () => {
  const code = codeLines(panel).join('\n')
  assert(
    code.includes('zaloServerConfigured') && (code.includes('ZALO_APP_ID') || code.includes('zalo-docs') || code.includes('Chưa được cấu hình') || code.includes('không được cấu hình') || code.includes('Tính năng Zalo chưa')),
    'must display server not configured message'
  )
})
test('T66: dialog has role=dialog and aria-modal=true', () => {
  assertIncludes(panel, 'role="dialog"')
  assertIncludes(panel, 'aria-modal="true"')
})
test('T67: dialog handles Escape key (onKeyDown)', () => assertIncludes(panel, 'Escape'))
test('T68: email toggle uses role=switch aria-checked', () => {
  assertIncludes(panel, 'role="switch"')
  assertIncludes(panel, 'aria-checked')
})

// ─── T69-T70: package.json ────────────────────────────────────────────────────
console.log('── package.json')

test('T69: test:zalo-setup53 script present', () => {
  const s = pkgJson.scripts['test:zalo-setup53']
  assert(s !== undefined && s.includes('zaloSetup53'), 'test:zalo-setup53 script missing or wrong')
})
test('T70: main test chain includes zaloSetup53', () => {
  const mainTest = pkgJson.scripts['test']
  assert(mainTest !== undefined && mainTest.includes('zaloSetup53'), 'main test chain must include zaloSetup53')
})

// ─── Summary ─────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(56)}`)
console.log(`Results: ${passed} passed, ${failed} failed`)
if (failures.length > 0) {
  console.error('\nFailures:')
  failures.forEach(f => console.error(`  • ${f}`))
  process.exit(1)
}
console.log('All Story 5.3 tests passed.')
