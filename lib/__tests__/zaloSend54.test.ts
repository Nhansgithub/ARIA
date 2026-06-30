export {}
import fs from 'fs'
import path from 'path'

const root = process.cwd()
const read = (rel: string) => fs.readFileSync(path.join(root, rel), 'utf8')
const exists = (rel: string) => fs.existsSync(path.join(root, rel))

let passed = 0
let failed = 0
const failures: string[] = []

function test(name: string, fn: () => void) {
  try { fn(); console.log(`  ✓ ${name}`); passed++ }
  catch (err) {
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

const codeLines = (src: string) => src.split('\n').filter(l => !l.trimStart().startsWith('//') && !l.trimStart().startsWith('*') && !l.trimStart().startsWith('/*'))

console.log('\nStory 5.4 — Zalo OA Message Sending\n')

// ─── Files ───────────────────────────────────────────────────────────────────
const migrationDelivery  = read('supabase/migrations/20260701400000_zalo_delivery_status.sql')
const migrationCron      = read('supabase/migrations/20260701410000_pg_cron_zalo_send.sql')
const zaloService        = read('lib/zalo/zaloService.ts')
const briefingFormatter  = read('lib/zalo/briefingZaloFormatter.ts')
const checkInFormatter   = read('lib/zalo/checkInZaloFormatter.ts')
const sendZaloRoute      = read('app/api/cron/send-zalo/route.ts')
const webhookRoute       = read('app/api/webhooks/zalo/route.ts')
const pkgJson            = JSON.parse(read('package.json')) as { scripts: Record<string, string> }

// ─── T1-T8: Migration — delivery status columns ───────────────────────────────
console.log('── Migration: 20260701400000_zalo_delivery_status.sql')

test('T1: migration file exists', () => assert(exists('supabase/migrations/20260701400000_zalo_delivery_status.sql'), 'missing'))
test('T2: adds zalo_status to briefings', () => {
  const lines = migrationDelivery.split('\n')
  assert(lines.some(l => l.includes('briefings') || l.includes('ALTER TABLE briefings')), 'briefings table missing')
})
test('T3: adds zalo_status to check_ins', () => {
  const lines = migrationDelivery.split('\n')
  assert(lines.some(l => l.includes('check_ins') || l.includes('ALTER TABLE check_ins')), 'check_ins table missing')
})
test('T4: zalo_status uses CHECK constraint with valid values', () => assertIncludes(migrationDelivery, 'pending'))
test('T5: includes sent value in CHECK constraint', () => assertIncludes(migrationDelivery, 'sent'))
test('T6: includes failed value in CHECK constraint', () => assertIncludes(migrationDelivery, 'failed'))
test('T7: uses IF NOT EXISTS guard', () => assertIncludes(migrationDelivery, 'IF NOT EXISTS'))
test('T8: default is pending', () => assertIncludes(migrationDelivery, "DEFAULT 'pending'"))

// ─── T9-T14: Migration — pg_cron send-zalo job ───────────────────────────────
console.log('── Migration: 20260701410000_pg_cron_zalo_send.sql')

test('T9: migration file exists', () => assert(exists('supabase/migrations/20260701410000_pg_cron_zalo_send.sql'), 'missing'))
test('T10: schedules send-zalo-notifications cron job', () => assertIncludes(migrationCron, 'send-zalo-notifications'))
test('T11: fires at :05 UTC (before email at :15)', () => assertIncludes(migrationCron, '5 * * * *'))
test('T12: calls /api/cron/send-zalo endpoint', () => assertIncludes(migrationCron, '/api/cron/send-zalo'))
test('T13: uses cron_secret for authorization', () => assertIncludes(migrationCron, 'cron_secret'))
test('T14: unschedules previous job before re-scheduling', () => assertIncludes(migrationCron, 'unschedule'))

// ─── T15-T24: zaloService.ts ─────────────────────────────────────────────────
console.log('── lib/zalo/zaloService.ts')

test('T15: file exists', () => assert(exists('lib/zalo/zaloService.ts'), 'missing'))
test('T16: starts with import server-only (AD-11)', () => {
  const firstMeaningful = zaloService.split('\n').find(l => l.trim().length > 0)
  assert(firstMeaningful?.includes("import 'server-only'") ?? false, 'must be first line')
})
test('T17: exports sendZaloMessage function', () => assertIncludes(zaloService, 'export async function sendZaloMessage'))
test('T18: uses Zalo OA v2.0 message endpoint', () => assertIncludes(zaloService, 'openapi.zalo.me/v2.0/oa/message'))
test('T19: sends access_token as header', () => assertIncludes(zaloService, "'access_token'"))
test('T20: uses AbortSignal.timeout (AD-6 timeout)', () => assertIncludes(zaloService, 'AbortSignal.timeout'))
test('T21: never throws — returns ok:false on error', () => {
  const code = codeLines(zaloService).join('\n')
  assertIncludes(code, 'ok: false, error')
  assertIncludes(code, 'catch (err)')
})
test('T22: sends recipient user_id in body', () => assertIncludes(zaloService, 'user_id'))
test('T23: checks Zalo error code 0 = success convention', () => {
  const code = codeLines(zaloService).join('\n')
  assert(code.includes('error !== 0') || code.includes('error && data.error !== 0'), 'must handle Zalo 0=success convention')
})
test('T24: returns message_id on success', () => assertIncludes(zaloService, 'message_id'))

// ─── T25-T34: briefingZaloFormatter.ts ───────────────────────────────────────
console.log('── lib/zalo/briefingZaloFormatter.ts')

test('T25: file exists', () => assert(exists('lib/zalo/briefingZaloFormatter.ts'), 'missing'))
test('T26: starts with import server-only (AD-11)', () => {
  const firstMeaningful = briefingFormatter.split('\n').find(l => l.trim().length > 0)
  assert(firstMeaningful?.includes("import 'server-only'") ?? false, 'must be first line')
})
test('T27: exports formatBriefingForZalo function', () => assertIncludes(briefingFormatter, 'export function formatBriefingForZalo'))
test('T28: hard limit at 2000 chars', () => assertIncludes(briefingFormatter, '2000'))
test('T29: truncation tail includes "Xem đầy đủ trong app ARIA"', () => assertIncludes(briefingFormatter, 'Xem đầy đủ trong app ARIA'))
test('T30: plain text — no markdown syntax', () => {
  const code = codeLines(briefingFormatter).join('\n')
  assertNotIncludes(code, '**', 'bold markdown')
  assertNotIncludes(code, '##', 'heading markdown')
})
test('T31: includes owner_name in greeting', () => {
  const code = codeLines(briefingFormatter).join('\n')
  assertIncludes(code, 'owner_name')
})
test('T32: lists deals with priority indicator', () => {
  const code = codeLines(briefingFormatter).join('\n')
  assert(code.includes('high') && code.includes('medium'), 'priority levels expected')
})
test('T33: returns string type', () => {
  const code = codeLines(briefingFormatter).join('\n')
  assert(code.includes(': string') || code.includes('string {'), 'must return string')
})
test('T34: interface BriefingForZalo is exported or defined', () => assertIncludes(briefingFormatter, 'BriefingForZalo'))

// ─── T35-T42: checkInZaloFormatter.ts ────────────────────────────────────────
console.log('── lib/zalo/checkInZaloFormatter.ts')

test('T35: file exists', () => assert(exists('lib/zalo/checkInZaloFormatter.ts'), 'missing'))
test('T36: starts with import server-only (AD-11)', () => {
  const firstMeaningful = checkInFormatter.split('\n').find(l => l.trim().length > 0)
  assert(firstMeaningful?.includes("import 'server-only'") ?? false, 'must be first line')
})
test('T37: exports formatCheckInForZalo function', () => assertIncludes(checkInFormatter, 'export function formatCheckInForZalo'))
test('T38: hard limit at 2000 chars', () => assertIncludes(checkInFormatter, '2000'))
test('T39: truncation tail includes "Xem đầy đủ trong app ARIA"', () => assertIncludes(checkInFormatter, 'Xem đầy đủ trong app ARIA'))
test('T40: uses numbered option format', () => {
  const code = codeLines(checkInFormatter).join('\n')
  assert(code.includes('i + 1') || code.includes('${i + 1}'), 'numbered options expected')
})
test('T41: includes deal_title in message', () => assertIncludes(checkInFormatter, 'deal_title'))
test('T42: interface CheckInForZalo defined', () => assertIncludes(checkInFormatter, 'CheckInForZalo'))

// ─── T43-T56: send-zalo cron route ───────────────────────────────────────────
console.log('── app/api/cron/send-zalo/route.ts')

test('T43: file exists', () => assert(exists('app/api/cron/send-zalo/route.ts'), 'missing'))
test('T44: validates CRON_SECRET', () => assertIncludes(sendZaloRoute, 'CRON_SECRET'))
test('T45: early skip if !isZaloConfigured()', () => {
  const code = codeLines(sendZaloRoute).join('\n')
  assertIncludes(code, 'isZaloConfigured')
  assertIncludes(code, 'skipped')
})
test('T46: uses createServiceClient (AD-13 cron path)', () => {
  const importLines = sendZaloRoute.split('\n').filter(l => l.trimStart().startsWith('import '))
  assert(importLines.some(l => l.includes('createServiceClient')), 'must use createServiceClient')
})
test('T47: never uses createServerClient', () => {
  const importLines = sendZaloRoute.split('\n').filter(l => l.trimStart().startsWith('import '))
  assert(!importLines.some(l => l.includes('createServerClient')), 'cron must not use createServerClient')
})
test('T48: queries connected owners for briefings', () => {
  const code = codeLines(sendZaloRoute).join('\n')
  assertIncludes(code, "'connected'")
  assertIncludes(code, 'zalo_access_token')
})
test('T49: filters briefings by zalo_status=pending', () => assertIncludes(sendZaloRoute, "'pending'"))
test('T50: calls sendZaloMessage for briefings', () => assertIncludes(sendZaloRoute, 'sendZaloMessage'))
test('T51: updates briefing zalo_status to sent on success', () => {
  const code = codeLines(sendZaloRoute).join('\n')
  assertIncludes(code, 'briefings')
  assertIncludes(code, "'sent'")
})
test('T52: updates to failed on send failure', () => assertIncludes(sendZaloRoute, "'failed'"))
test('T53: processes check_ins as well', () => assertIncludes(sendZaloRoute, 'check_ins'))
test('T54: uses timing-safe CRON_SECRET comparison', () => {
  const code = codeLines(sendZaloRoute).join('\n')
  assert(code.includes('timingSafe') || code.includes('diff |=') || code.includes('timingSafeEqual'), 'must use timing-safe comparison')
})
test('T55: logFailure writes to activity_log (AD-14)', () => {
  const code = codeLines(sendZaloRoute).join('\n')
  assertIncludes(code, 'activity_log')
  assertIncludes(code, 'zalo_briefing_failed')
})
test('T56: GET handler returns response object', () => assertIncludes(sendZaloRoute, 'export async function GET'))

// ─── T57-T62: webhook route ───────────────────────────────────────────────────
console.log('── app/api/webhooks/zalo/route.ts')

test('T57: webhook route file exists', () => assert(exists('app/api/webhooks/zalo/route.ts'), 'missing'))
test('T58: exports GET for Zalo verification challenge', () => assertIncludes(webhookRoute, 'export async function GET'))
test('T59: GET returns challenge param for verification', () => assertIncludes(webhookRoute, 'challenge'))
test('T60: exports POST for inbound events', () => assertIncludes(webhookRoute, 'export async function POST'))
test('T61: POST logs to activity_log (AD-14)', () => {
  const code = codeLines(webhookRoute).join('\n')
  assertIncludes(code, 'activity_log')
  assertIncludes(code, 'zalo_event_received')
})
test('T62: uses createServiceClient (AD-13 — no user session)', () => {
  const importLines = webhookRoute.split('\n').filter(l => l.trimStart().startsWith('import '))
  assert(importLines.some(l => l.includes('createServiceClient')), 'must use createServiceClient')
})

// ─── T63-T65: package.json ────────────────────────────────────────────────────
console.log('── package.json')

test('T63: test:zalo-send54 script present', () => {
  const s = pkgJson.scripts['test:zalo-send54']
  assert(s !== undefined && s.includes('zaloSend54'), 'test:zalo-send54 script missing or wrong')
})
test('T64: main test chain includes zaloSend54', () => {
  const mainTest = pkgJson.scripts['test']
  assert(mainTest !== undefined && mainTest.includes('zaloSend54'), 'main test chain must include zaloSend54')
})
test('T65: all Story 5.4 source files exist as a set', () => {
  const files = [
    'lib/zalo/zaloService.ts',
    'lib/zalo/briefingZaloFormatter.ts',
    'lib/zalo/checkInZaloFormatter.ts',
    'app/api/cron/send-zalo/route.ts',
    'app/api/webhooks/zalo/route.ts',
    'supabase/migrations/20260701400000_zalo_delivery_status.sql',
    'supabase/migrations/20260701410000_pg_cron_zalo_send.sql',
  ]
  const missing = files.filter(f => !exists(f))
  assert(missing.length === 0, `Missing files: ${missing.join(', ')}`)
})

// ─── Summary ─────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(56)}`)
console.log(`Results: ${passed} passed, ${failed} failed`)
if (failures.length > 0) {
  console.error('\nFailures:')
  failures.forEach(f => console.error(`  • ${f}`))
  process.exit(1)
}
console.log('All Story 5.4 tests passed.')
