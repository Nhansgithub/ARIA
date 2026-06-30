export {}
import fs from 'fs'
import path from 'path'

let passed = 0
let failed = 0

function test(name: string, fn: () => void) {
  try {
    fn()
    console.log(`  ✓ ${name}`)
    passed++
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error(`  ✗ ${name}\n    ${msg}`)
    failed++
  }
}

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg)
}

const root = process.cwd()

// ─── Inline formatter logic (mirrors production, no lib/ import) ───────────────

function stripMarkdown(md: string): string {
  return md
    .replace(/#{1,6}\s*/g, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/^\s*[-*]\s+/gm, '• ')
    .trim()
}

function formatDateVi(isoDate: string): string {
  const [year, month, day] = isoDate.split('-')
  return `${day}/${month}/${year}`
}

interface BriefingFlagItem { severity: 'high' | 'medium'; type: string }
interface BriefingInput { date: string; content_md: string | null; flags: { items?: BriefingFlagItem[] } | null }

function formatBriefingEmail(briefing: BriefingInput, lang: 'vi' | 'en' = 'vi') {
  const hasHighUrgency = (briefing.flags?.items ?? []).some((f) => f.severity === 'high')
  let subject: string
  if (lang === 'vi') {
    const dateLabel = formatDateVi(briefing.date)
    subject = hasHighUrgency
      ? `[Cần xử lý] ARIA Tóm tắt — ${dateLabel}`
      : `ARIA Tóm tắt — ${dateLabel}`
  } else {
    subject = hasHighUrgency
      ? `[Action needed] ARIA Briefing — ${briefing.date}`
      : `ARIA Briefing — ${briefing.date}`
  }
  const UNSUBSCRIBE_VI = 'Để huỷ nhận email, đăng nhập ARIA > Cài đặt > Kênh thông báo.'
  const UNSUBSCRIBE_EN = 'To unsubscribe, sign in to ARIA > Settings > Notification Channels.'
  const bodyContent = briefing.content_md
    ? stripMarkdown(briefing.content_md).slice(0, 2000)
    : lang === 'vi' ? 'Không có nội dung briefing hôm nay.' : 'No briefing content available today.'
  const footer = lang === 'vi' ? UNSUBSCRIBE_VI : UNSUBSCRIBE_EN
  const text = `${bodyContent}\n\n---\n${footer}`
  return { subject, text }
}

interface CheckInInput { deal_title: string; prompt_template: string | null }

function formatCheckInEmail(checkIn: CheckInInput, lang: 'vi' | 'en' = 'vi') {
  const subject = lang === 'vi'
    ? `ARIA Nhắc nhở — ${checkIn.deal_title}`
    : `ARIA Check-in — ${checkIn.deal_title}`
  const greeting = lang === 'vi' ? 'Xin chào,' : 'Hello,'
  const dealLine = lang === 'vi'
    ? `ARIA có một nhắc nhở check-in cho deal: ${checkIn.deal_title}`
    : `ARIA has a check-in reminder for deal: ${checkIn.deal_title}`
  const prompt = checkIn.prompt_template ?? (lang === 'vi' ? 'Bạn có cập nhật nào cho deal này không?' : 'Do you have any updates for this deal?')
  const REPLY_VI = `Trả lời 1, 2, hoặc 3 trong app ARIA:\n1. Có\n2. Không\n3. Để sau`
  const REPLY_EN = `Reply 1, 2, or 3 in the ARIA app:\n1. Yes\n2. No\n3. Later`
  const UNSUBSCRIBE_VI = 'Để huỷ nhận email, đăng nhập ARIA > Cài đặt > Kênh thông báo.'
  const UNSUBSCRIBE_EN = 'To unsubscribe, sign in to ARIA > Settings > Notification Channels.'
  const replyInstructions = lang === 'vi' ? REPLY_VI : REPLY_EN
  const footer = lang === 'vi' ? UNSUBSCRIBE_VI : UNSUBSCRIBE_EN
  const text = `${greeting}\n\n${dealLine}\n\n${prompt}\n\n${replyInstructions}\n\n---\n${footer}`
  return { subject, text }
}

// ─── T1–T15: Inline formatter logic ───────────────────────────────────────────
console.log('\nT1–T15: Formatter logic')

test('T1: vi briefing subject — no high flag', () => {
  const { subject } = formatBriefingEmail({ date: '2026-07-01', content_md: 'Hello', flags: null })
  assert(subject === 'ARIA Tóm tắt — 01/07/2026', `Got: ${subject}`)
})

test('T2: vi briefing subject — high severity flag → [Cần xử lý] prefix', () => {
  const { subject } = formatBriefingEmail(
    { date: '2026-07-01', content_md: 'Hi', flags: { items: [{ severity: 'high', type: 'risk' }] } },
  )
  assert(subject.startsWith('[Cần xử lý]'), `Got: ${subject}`)
})

test('T3: en briefing subject — no high flag', () => {
  const { subject } = formatBriefingEmail({ date: '2026-07-01', content_md: 'Hi', flags: null }, 'en')
  assert(subject === 'ARIA Briefing — 2026-07-01', `Got: ${subject}`)
})

test('T4: en briefing subject — high flag → [Action needed] prefix', () => {
  const { subject } = formatBriefingEmail(
    { date: '2026-07-01', content_md: 'Hi', flags: { items: [{ severity: 'high', type: 'overdue' }] } },
    'en',
  )
  assert(subject.startsWith('[Action needed]'), `Got: ${subject}`)
})

test('T5: stripMarkdown removes ## headers', () => {
  const result = stripMarkdown('## Section Title')
  assert(!result.includes('#'), `Still has #: ${result}`)
  assert(result.includes('Section Title'), `Lost title: ${result}`)
})

test('T6: stripMarkdown removes **bold** markers', () => {
  const result = stripMarkdown('**important**')
  assert(result === 'important', `Got: ${result}`)
})

test('T7: stripMarkdown removes *italic* markers', () => {
  const result = stripMarkdown('*note*')
  assert(result === 'note', `Got: ${result}`)
})

test('T8: stripMarkdown removes backtick inline code', () => {
  const result = stripMarkdown('use `myFunc()` here')
  assert(!result.includes('`'), `Still has backtick: ${result}`)
})

test('T9: stripMarkdown converts bullet list → • prefix', () => {
  const result = stripMarkdown('- item one')
  assert(result.startsWith('•'), `Got: ${result}`)
})

test('T10: vi date formatting converts YYYY-MM-DD to DD/MM/YYYY', () => {
  const result = formatDateVi('2026-07-15')
  assert(result === '15/07/2026', `Got: ${result}`)
})

test('T11: briefing email uses fallback text when content_md is null', () => {
  const { text } = formatBriefingEmail({ date: '2026-07-01', content_md: null, flags: null })
  assert(text.includes('Không có nội dung'), `Got: ${text.slice(0, 60)}`)
})

test('T12: briefing email footer contains unsubscribe instruction', () => {
  const { text } = formatBriefingEmail({ date: '2026-07-01', content_md: 'Hi', flags: null })
  assert(text.includes('Để huỷ nhận email'), `Footer missing: ${text.slice(-100)}`)
})

test('T13: vi check-in subject contains deal title', () => {
  const { subject } = formatCheckInEmail({ deal_title: 'Acme Corp', prompt_template: null })
  assert(subject.includes('Acme Corp'), `Got: ${subject}`)
  assert(subject.includes('Nhắc nhở'), `Got: ${subject}`)
})

test('T14: vi check-in text body contains numbered reply options', () => {
  const { text } = formatCheckInEmail({ deal_title: 'Deal X', prompt_template: null })
  assert(text.includes('1.'), `Missing option 1: ${text.slice(0, 100)}`)
  assert(text.includes('2.'), `Missing option 2: ${text.slice(0, 100)}`)
  assert(text.includes('3.'), `Missing option 3: ${text.slice(0, 100)}`)
})

test('T15: check-in email footer contains unsubscribe instruction', () => {
  const { text } = formatCheckInEmail({ deal_title: 'Deal Y', prompt_template: null })
  assert(text.includes('Để huỷ nhận email'), `Footer missing: ${text.slice(-100)}`)
})

// ─── T16–T30: File structure ────────────────────────────────────────────────
console.log('\nT16–T30: File structure')

const migrationFile = path.join(root, 'supabase/migrations/20260701100000_email_sent_at.sql')
const emailServiceFile = path.join(root, 'lib/email/emailService.ts')
const briefingFormatterFile = path.join(root, 'lib/email/briefingEmailFormatter.ts')
const checkInFormatterFile = path.join(root, 'lib/email/checkInEmailFormatter.ts')
const cronRouteFile = path.join(root, 'app/api/cron/send-emails/route.ts')

const migrationContent = fs.existsSync(migrationFile) ? fs.readFileSync(migrationFile, 'utf-8') : ''
const emailServiceContent = fs.existsSync(emailServiceFile) ? fs.readFileSync(emailServiceFile, 'utf-8') : ''
const briefingFormatterContent = fs.existsSync(briefingFormatterFile) ? fs.readFileSync(briefingFormatterFile, 'utf-8') : ''
const checkInFormatterContent = fs.existsSync(checkInFormatterFile) ? fs.readFileSync(checkInFormatterFile, 'utf-8') : ''
const cronRouteContent = fs.existsSync(cronRouteFile) ? fs.readFileSync(cronRouteFile, 'utf-8') : ''

test('T16: migration file exists', () => {
  assert(fs.existsSync(migrationFile), `Not found: ${migrationFile}`)
})

test('T17: migration adds email_sent_at to briefings', () => {
  assert(migrationContent.includes('briefings'), 'No briefings table reference')
  assert(migrationContent.includes('email_sent_at'), 'No email_sent_at column')
})

test('T18: migration adds email_sent_at to check_ins', () => {
  assert(migrationContent.includes('check_ins'), 'No check_ins table reference')
  assert(migrationContent.toLowerCase().includes('email_sent_at'), 'No email_sent_at for check_ins')
})

test('T19: emailService.ts exists', () => {
  assert(fs.existsSync(emailServiceFile), `Not found: ${emailServiceFile}`)
})

test('T20: emailService.ts starts with import server-only (AD-11)', () => {
  assert(emailServiceContent.trimStart().startsWith("import 'server-only'"), 'Must start with server-only import')
})

test('T21: emailService.ts exports sendEmail function', () => {
  assert(emailServiceContent.includes('export async function sendEmail'), 'Missing sendEmail export')
})

test('T22: emailService.ts uses RESEND_API_KEY env var', () => {
  assert(emailServiceContent.includes('RESEND_API_KEY'), 'Missing RESEND_API_KEY reference')
})

test('T23: briefingEmailFormatter.ts exists', () => {
  assert(fs.existsSync(briefingFormatterFile), `Not found: ${briefingFormatterFile}`)
})

test('T24: briefingEmailFormatter.ts starts with import server-only (AD-11)', () => {
  assert(briefingFormatterContent.trimStart().startsWith("import 'server-only'"), 'Must start with server-only import')
})

test('T25: briefingEmailFormatter.ts exports formatBriefingEmail', () => {
  assert(briefingFormatterContent.includes('export function formatBriefingEmail'), 'Missing formatBriefingEmail export')
})

test('T26: checkInEmailFormatter.ts exists', () => {
  assert(fs.existsSync(checkInFormatterFile), `Not found: ${checkInFormatterFile}`)
})

test('T27: checkInEmailFormatter.ts starts with import server-only (AD-11)', () => {
  assert(checkInFormatterContent.trimStart().startsWith("import 'server-only'"), 'Must start with server-only import')
})

test('T28: checkInEmailFormatter.ts exports formatCheckInEmail', () => {
  assert(checkInFormatterContent.includes('export function formatCheckInEmail'), 'Missing formatCheckInEmail export')
})

test('T29: cron send-emails route.ts exists', () => {
  assert(fs.existsSync(cronRouteFile), `Not found: ${cronRouteFile}`)
})

test('T30: cron route has substantive content (> 500 chars)', () => {
  assert(cronRouteContent.length > 500, `File too short: ${cronRouteContent.length} chars`)
})

// ─── T31–T45: Cron route structure ─────────────────────────────────────────
console.log('\nT31–T45: Cron route structure')

test('T31: cron route imports createServiceClient (AD-13 — cron uses service client)', () => {
  assert(cronRouteContent.includes('createServiceClient'), 'Missing createServiceClient import')
})

test('T32: cron route does NOT import createServerClient (AD-13 — no owner request context)', () => {
  const importLines = cronRouteContent.split('\n').filter(l => l.trimStart().startsWith('import '))
  const hasImport = importLines.some(l => l.includes('createServerClient'))
  assert(!hasImport, 'Must not import createServerClient in cron route')
})

test('T33: cron route validates CRON_SECRET (returns 401 on failure)', () => {
  assert(cronRouteContent.includes('401'), 'Missing 401 Unauthorized response')
  assert(cronRouteContent.includes('Unauthorized'), 'Missing Unauthorized text')
})

test('T34: cron route reads CRON_SECRET from process.env', () => {
  assert(cronRouteContent.includes('process.env.CRON_SECRET'), 'Missing CRON_SECRET env var reference')
})

test('T35: cron route queries briefings with is(email_sent_at, null)', () => {
  assert(cronRouteContent.includes("'briefings'"), 'Missing briefings query')
  assert(cronRouteContent.includes("'email_sent_at'") || cronRouteContent.includes('email_sent_at'), 'Missing email_sent_at filter')
  assert(cronRouteContent.includes('.is('), 'Missing .is() null check')
})

test('T36: cron route queries check_ins with email_sent_at IS NULL', () => {
  assert(cronRouteContent.includes("'check_ins'"), 'Missing check_ins query')
})

test('T37: cron route has LIMIT 100 on briefing query', () => {
  assert(cronRouteContent.includes('.limit(100)'), 'Missing .limit(100)')
})

test('T38: cron route has LIMIT 100 on check-in query (at least two limit calls)', () => {
  const limitCount = (cronRouteContent.match(/\.limit\(100\)/g) ?? []).length
  assert(limitCount >= 2, `Expected at least 2 .limit(100) calls, got ${limitCount}`)
})

test('T39: cron route updates email_sent_at on successful send', () => {
  assert(cronRouteContent.includes('email_sent_at'), 'Missing email_sent_at update')
  assert(cronRouteContent.includes('.update('), 'Missing .update() call')
})

test('T40: cron route has logFailure helper', () => {
  assert(cronRouteContent.includes('logFailure'), 'Missing logFailure function')
  assert(cronRouteContent.includes('function logFailure'), 'logFailure must be declared as a function')
})

test('T41: logFailure inserts into activity_log directly (not via logActivity)', () => {
  assert(cronRouteContent.includes("'activity_log'"), 'logFailure must write to activity_log table')
  assert(cronRouteContent.includes('.insert('), 'logFailure must use .insert()')
})

test('T42: cron route does NOT call logActivity in non-comment code (fails in cron — use direct insert)', () => {
  const codeLines = cronRouteContent.split('\n').filter(l => !l.trimStart().startsWith('//'))
  const calls = codeLines.some(l => l.includes('logActivity('))
  assert(!calls, 'Must not call logActivity() in cron — use direct insert via service client')
})

test('T43: cron route uses auth.admin.getUserById to retrieve owner email', () => {
  assert(cronRouteContent.includes('auth.admin.getUserById'), 'Missing auth.admin.getUserById call')
})

test('T44: cron route returns sent.briefings, sent.checkIns, failed shape', () => {
  assert(cronRouteContent.includes('briefingsSent') || cronRouteContent.includes('briefings:'), 'Missing briefings count')
  assert(cronRouteContent.includes('checkInsSent') || cronRouteContent.includes('checkIns:'), 'Missing checkIns count')
  assert(cronRouteContent.includes('failed'), 'Missing failed count')
})

test('T45: emailService has try/catch — never throws (AD-6 graceful degradation)', () => {
  assert(emailServiceContent.includes('try {'), 'Missing try block')
  assert(emailServiceContent.includes('} catch'), 'Missing catch block')
  assert(!emailServiceContent.includes('throw '), 'Must not throw — return { ok: false } instead')
})

// ─── T46–T60: package.json and misc correctness ─────────────────────────────
console.log('\nT46–T60: package.json and misc correctness')

const pkgFile = path.join(root, 'package.json')
const pkgContent = fs.existsSync(pkgFile) ? fs.readFileSync(pkgFile, 'utf-8') : '{}'
const pkg = JSON.parse(pkgContent)
const scripts: Record<string, string> = pkg.scripts ?? {}

test('T46: package.json has test:email-delivery52 script', () => {
  const s = scripts['test:email-delivery52']
  assert(s !== undefined, 'Missing test:email-delivery52 script')
  assert(s!.includes('emailDelivery52.test.ts'), 'Script must reference emailDelivery52.test.ts')
})

test('T47: main test script includes emailDelivery52.test.ts', () => {
  const s = scripts['test']
  assert(s !== undefined && s.includes('emailDelivery52.test.ts'), 'emailDelivery52.test.ts not in main test chain')
})

test('T48: emailService uses EMAIL_FROM env var with fallback', () => {
  assert(emailServiceContent.includes('EMAIL_FROM'), 'Missing EMAIL_FROM env var')
  assert(emailServiceContent.includes('??'), 'Missing fallback for EMAIL_FROM')
})

test('T49: emailService sends to array format [payload.to] for Resend API', () => {
  assert(emailServiceContent.includes('to: ['), 'Must send to as array for Resend API')
})

test('T50: briefing email text includes body content (not just subject)', () => {
  const { text } = formatBriefingEmail({ date: '2026-07-01', content_md: '## Summary\n\n**Key** point here.', flags: null })
  assert(text.includes('Summary'), `Missing body content: ${text.slice(0, 100)}`)
  assert(text.includes('Key'), `Markdown stripping removed content: ${text.slice(0, 100)}`)
})

test('T51: vi check-in reply instruction starts with Trả lời 1, 2, hoặc 3', () => {
  const { text } = formatCheckInEmail({ deal_title: 'Deal Z', prompt_template: null })
  assert(text.includes('Trả lời 1, 2, hoặc 3'), `Missing reply instruction: ${text.slice(0, 200)}`)
})

test('T52: vi check-in greeting is Xin chào,', () => {
  const { text } = formatCheckInEmail({ deal_title: 'Deal Z', prompt_template: null })
  assert(text.startsWith('Xin chào,'), `Got: ${text.slice(0, 30)}`)
})

test('T53: formatBriefingEmail strips markdown from content_md', () => {
  const { text } = formatBriefingEmail({ date: '2026-07-01', content_md: '## Header\n\n**Bold text**', flags: null })
  assert(!text.includes('##'), `## not stripped: ${text.slice(0, 60)}`)
  assert(!text.includes('**'), `** not stripped: ${text.slice(0, 60)}`)
})

test('T54: cron route exports GET function', () => {
  assert(cronRouteContent.includes('export async function GET'), 'Missing GET export')
})

test('T55: cron route imports from @/lib/supabase/server (not separate serviceClient file)', () => {
  assert(cronRouteContent.includes('@/lib/supabase/server'), 'Must import from @/lib/supabase/server')
  assert(!cronRouteContent.includes('@/lib/supabase/serviceClient'), 'Must not import from separate serviceClient file')
})

test('T56: emailService Authorization header uses Bearer token format', () => {
  assert(emailServiceContent.includes('Bearer'), 'Missing Bearer in Authorization header')
  assert(emailServiceContent.includes('Authorization'), 'Missing Authorization header')
})

test('T57: emailService Content-Type is application/json', () => {
  assert(emailServiceContent.includes('application/json'), 'Missing Content-Type: application/json')
})

test('T58: formatBriefingEmail truncates content_md at 2000 chars', () => {
  const longMd = 'a'.repeat(3000)
  const { text } = formatBriefingEmail({ date: '2026-07-01', content_md: longMd, flags: null })
  const bodyPart = text.split('\n\n---\n')[0] ?? ''
  assert(bodyPart.length <= 2000, `Body exceeds 2000 chars: ${bodyPart.length}`)
})

test('T59: formatCheckInEmail handles null prompt_template with vi fallback', () => {
  const { text } = formatCheckInEmail({ deal_title: 'Deal A', prompt_template: null })
  assert(text.includes('cập nhật'), `Missing vi fallback prompt: ${text.slice(0, 100)}`)
})

test('T60: migration uses IF NOT EXISTS guard', () => {
  assert(migrationContent.toUpperCase().includes('IF NOT EXISTS'), 'Migration must use IF NOT EXISTS guard')
})

// ─── Summary ─────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`)
console.log(`Results: ${passed} passed, ${failed} failed out of ${passed + failed} tests`)
if (failed > 0) process.exit(1)
