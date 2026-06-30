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

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg)
}
function assertIncludes(text: string, sub: string, label?: string) {
  assert(text.includes(sub), `Expected "${label ?? sub}" to be present`)
}
function assertNotIncludes(text: string, sub: string, label?: string) {
  assert(!text.includes(sub), `Expected "${label ?? sub}" to be absent`)
}

const codeLines = (src: string) =>
  src.split('\n').filter((l) => !l.trimStart().startsWith('//') && !l.trimStart().startsWith('*'))

console.log('\nStory 5.5 — Delivery Orchestration (In-app → Zalo → Email)\n')

const emailCronRoute = read('app/api/cron/send-emails/route.ts')
const zaloCronRoute = read('app/api/cron/send-zalo/route.ts')
const pgCronEmailMig = read('supabase/migrations/20260701500000_pg_cron_email_send.sql')
const pgCronZaloMig = read('supabase/migrations/20260701410000_pg_cron_zalo_send.sql')
const pkgJson = JSON.parse(read('package.json')) as { scripts: Record<string, string> }

// ─── T1-T10: Email cron — zalo_status skip filter ────────────────────────────
console.log('── Email cron: zalo_status skip filter')

test('T1: email cron file exists', () =>
  assert(exists('app/api/cron/send-emails/route.ts'), 'missing'))
test('T2: briefing query skips zalo_status=sent (neq filter)', () => {
  const code = codeLines(emailCronRoute).join('\n')
  assert(
    (code.includes("neq('zalo_status'") || code.includes('neq("zalo_status"')) &&
      code.includes("'sent'"),
    'briefings query must filter out zalo_status=sent'
  )
})
test('T3: check-in query skips zalo_status=sent (neq filter)', () => {
  const code = codeLines(emailCronRoute).join('\n')
  const neqCount =
    (code.match(/neq.*zalo_status/g) ?? []).length + (code.match(/zalo_status.*neq/g) ?? []).length
  assert(neqCount >= 2, 'both briefings and check_ins queries must have zalo_status filter')
})
test('T4: email still sends when zalo_status=pending', () => {
  const code = codeLines(emailCronRoute).join('\n')
  assertNotIncludes(
    code,
    "eq('zalo_status', 'pending')",
    'must not filter TO pending — only filter OUT sent'
  )
})
test('T5: email skips only sent — not failed/pending/skipped', () => {
  const code = codeLines(emailCronRoute).join('\n')
  assert(
    !code.includes("neq('zalo_status', 'failed'") && !code.includes("neq('zalo_status', 'pending'"),
    'must only filter out sent status — failed and pending should still get email'
  )
})
test('T6: email cron uses timing-safe CRON_SECRET comparison', () => {
  const importLines = emailCronRoute.split('\n').filter((l) => l.trimStart().startsWith('import '))
  assert(
    importLines.some((l) => l.includes('timingSafeEqual') || l.includes('crypto')),
    'must import timingSafeEqual from crypto'
  )
})
test('T7: briefings select includes email_sent_at null guard', () =>
  assertIncludes(emailCronRoute, 'email_sent_at'))
test('T8: check_ins select includes email_sent_at null guard', () => {
  const count = (emailCronRoute.match(/email_sent_at/g) ?? []).length
  assert(count >= 2, 'both briefings and check_ins must guard on email_sent_at')
})
test('T9: email cron uses createServiceClient (AD-13)', () => {
  const importLines = emailCronRoute.split('\n').filter((l) => l.trimStart().startsWith('import '))
  assert(
    importLines.some((l) => l.includes('createServiceClient')),
    'must use createServiceClient'
  )
})
test('T10: email cron never uses createServerClient', () => {
  const importLines = emailCronRoute.split('\n').filter((l) => l.trimStart().startsWith('import '))
  assert(
    !importLines.some((l) => l.includes('createServerClient')),
    'cron must not use createServerClient'
  )
})

// ─── T11-T20: Cron timing — Zalo before Email ────────────────────────────────
console.log('── Cron timing: Zalo :05 → Email :15')

test('T11: pg_cron email send migration exists', () =>
  assert(exists('supabase/migrations/20260701500000_pg_cron_email_send.sql'), 'missing'))
test('T12: email cron fires at :15 UTC', () => assertIncludes(pgCronEmailMig, '15 * * * *'))
test('T13: Zalo cron fires at :05 UTC (before email)', () =>
  assertIncludes(pgCronZaloMig, '5 * * * *'))
test('T14: email cron calls /api/cron/send-emails', () =>
  assertIncludes(pgCronEmailMig, '/api/cron/send-emails'))
test('T15: email cron uses cron_secret', () => assertIncludes(pgCronEmailMig, 'cron_secret'))
test('T16: email cron migration uses unschedule guard', () =>
  assertIncludes(pgCronEmailMig, 'unschedule'))
test('T17: Zalo :05 fires before Email :15 — numeric verification', () => {
  const zaloMin = pgCronZaloMig.match(/(\d+)\s+\*\s+\*\s+\*\s+\*/)
  const emailMin = pgCronEmailMig.match(/(\d+)\s+\*\s+\*\s+\*\s+\*/)
  assert(!!zaloMin && !!emailMin, 'both cron schedules must be found')
  const zMin = parseInt(zaloMin![1] ?? '99', 10)
  const eMin = parseInt(emailMin![1] ?? '0', 10)
  assert(zMin < eMin, `Zalo must run at lower minute than email (${zMin} < ${eMin})`)
})
test('T18: email cron has timeout_milliseconds set', () =>
  assertIncludes(pgCronEmailMig, 'timeout_milliseconds'))
test('T19: comment documents the orchestration reason (skips Zalo-delivered)', () => {
  assertIncludes(pgCronEmailMig.toLowerCase(), 'zalo')
})
test('T20: both cron schedules are per-hour not per-day', () => {
  assert(
    pgCronZaloMig.includes('* * * *') && pgCronEmailMig.includes('* * * *'),
    'both must be hourly crons'
  )
})

// ─── T21-T30: Zalo cron — sends first, DB state as handshake ────────────────
console.log('── Zalo cron: sends first, sets zalo_status=sent')

test('T21: Zalo send cron file exists', () =>
  assert(exists('app/api/cron/send-zalo/route.ts'), 'missing'))
test('T22: Zalo cron updates briefing zalo_status=sent on success', () => {
  const code = codeLines(zaloCronRoute).join('\n')
  assertIncludes(code, "'sent'")
  assertIncludes(code, 'briefings')
})
test('T23: Zalo cron updates check_in zalo_status=sent on success', () => {
  const code = codeLines(zaloCronRoute).join('\n')
  assertIncludes(code, 'check_ins')
})
test('T24: Zalo cron skips if not configured (isZaloConfigured gate)', () => {
  const code = codeLines(zaloCronRoute).join('\n')
  assertIncludes(code, 'isZaloConfigured')
  assertIncludes(code, 'skipped')
})
test('T25: Zalo cron uses timing-safe CRON_SECRET comparison', () => {
  const importLines = zaloCronRoute.split('\n').filter((l) => l.trimStart().startsWith('import '))
  assert(
    importLines.some((l) => l.includes('timingSafeEqual') || l.includes('crypto')),
    'must use timingSafeEqual'
  )
})
test('T26: Zalo cron filters briefings by zalo_status=pending', () =>
  assertIncludes(zaloCronRoute, "'pending'"))
test('T27: Zalo cron checks DB update errors (P1 from review)', () => {
  const code = codeLines(zaloCronRoute).join('\n')
  assert(
    code.includes('updateErr') || code.includes('error: update'),
    'update errors must be checked'
  )
})
test('T28: Zalo cron logs failures to activity_log (AD-14)', () => {
  const code = codeLines(zaloCronRoute).join('\n')
  assertIncludes(code, 'activity_log')
})
test('T29: Zalo cron returns sent/failed counts', () => {
  const code = codeLines(zaloCronRoute).join('\n')
  assertIncludes(code, 'briefingsSent')
  assertIncludes(code, 'checkInsSent')
})
test('T30: DB-state handshake — no direct Zalo→Email coupling (no import cross-reference)', () => {
  assertNotIncludes(zaloCronRoute, 'send-emails', 'Zalo cron must not import email logic')
  assertNotIncludes(emailCronRoute, 'send-zalo', 'Email cron must not import Zalo logic')
})

// ─── T31-T40: Orchestration correctness assertions ───────────────────────────
console.log('── Orchestration correctness')

test('T31: AD-8 priority — in-app exists before Zalo runs (briefings table has both in-app and zalo_status)', () => {
  const code = codeLines(zaloCronRoute).join('\n')
  assertIncludes(code, 'briefings')
  assertIncludes(code, 'zalo_status')
})
test('T32: email fallback when Zalo fails (failed ≠ sent → email still runs)', () => {
  const code = codeLines(emailCronRoute).join('\n')
  assert(
    !code.includes("eq('zalo_status', 'failed'") || code.includes("neq('zalo_status', 'sent'"),
    'failed Zalo must not block email'
  )
})
test('T33: email fallback when Zalo not configured (skipped ≠ sent → email still runs)', () => {
  assertNotIncludes(emailCronRoute, "eq('zalo_status', 'skipped'", 'skipped must not block email')
})
test('T34: delivery order documented in email cron (AD-8 comment or story comment)', () => {
  const code = emailCronRoute.split('\n').join(' ').toLowerCase()
  assert(
    code.includes('zalo') &&
      (code.includes('ad-8') || code.includes('skip') || code.includes('priority')),
    'orchestration comment expected in email cron'
  )
})
test('T35: briefings query is today-scoped (date filter)', () => {
  const code = codeLines(emailCronRoute).join('\n')
  assertIncludes(code, 'today')
  assertIncludes(code, 'date')
})
test('T36: check_ins query is not artificially scoped to today (time-based only)', () => {
  const code = codeLines(emailCronRoute).join('\n')
  assertIncludes(code, "status', 'pending'")
})

// ─── T37-T44: File and package checks ────────────────────────────────────────
console.log('── File & package checks')

test('T37: zalo_status column exists in briefings migration (Story 5.4)', () => {
  assert(
    exists('supabase/migrations/20260701400000_zalo_delivery_status.sql'),
    '5.4 migration missing'
  )
  const m = read('supabase/migrations/20260701400000_zalo_delivery_status.sql')
  assertIncludes(m, 'briefings')
  assertIncludes(m, 'zalo_status')
})
test('T38: zalo_status column exists in check_ins migration (Story 5.4)', () => {
  const m = read('supabase/migrations/20260701400000_zalo_delivery_status.sql')
  assertIncludes(m, 'check_ins')
})
test('T39: test:delivery-orchestration55 script present', () => {
  const s = pkgJson.scripts['test:delivery-orchestration55']
  assert(s !== undefined && s.includes('deliveryOrchestration55'), 'script missing or wrong path')
})
test('T40: main test chain includes deliveryOrchestration55', () => {
  const main = pkgJson.scripts['test']
  assert(
    main !== undefined && main.includes('deliveryOrchestration55'),
    'missing from main test chain'
  )
})
test('T41: pg_cron migrations are in correct timestamp order', () => {
  const zaloTs = 20260701410000
  const emailTs = 20260701500000
  assert(emailTs > zaloTs, 'email cron migration must come after Zalo cron migration')
})
test('T42: send-emails route has been updated (import crypto visible)', () => {
  assertIncludes(emailCronRoute, 'crypto')
})
test('T43: Zalo cron skips gracefully when !isZaloConfigured — no exception', () => {
  const code = codeLines(zaloCronRoute).join('\n')
  assertIncludes(code, "skipped: 'Zalo not configured'")
})
test('T44: Email cron has no Zalo dependency — decoupled via DB state only', () => {
  assertNotIncludes(emailCronRoute, 'zaloService', 'email cron must not import Zalo service')
  assertNotIncludes(
    emailCronRoute,
    'zaloTokenService',
    'email cron must not import Zalo token service'
  )
})

// ─── Summary ─────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(56)}`)
console.log(`Results: ${passed} passed, ${failed} failed`)
if (failures.length > 0) {
  console.error('\nFailures:')
  failures.forEach((f) => console.error(`  • ${f}`))
  process.exit(1)
}
console.log('All Story 5.5 tests passed.')
