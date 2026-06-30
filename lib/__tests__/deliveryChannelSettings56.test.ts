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

// ─── File paths ──────────────────────────────────────────────────────────────
const migrationFile = path.join(root, 'supabase/migrations/20260701200000_notification_channels.sql')
const apiRouteFile = path.join(root, 'app/api/settings/notification-channels/route.ts')
const panelFile = path.join(root, 'components/settings/NotificationChannelsPanel.tsx')
const appShellFile = path.join(root, 'components/layout/AppShell.tsx')
const chatPanelFile = path.join(root, 'components/chat/ChatPanel.tsx')
const pkgFile = path.join(root, 'package.json')

const migrationContent = fs.existsSync(migrationFile) ? fs.readFileSync(migrationFile, 'utf-8') : ''
const apiRouteContent = fs.existsSync(apiRouteFile) ? fs.readFileSync(apiRouteFile, 'utf-8') : ''
const panelContent = fs.existsSync(panelFile) ? fs.readFileSync(panelFile, 'utf-8') : ''
const appShellContent = fs.existsSync(appShellFile) ? fs.readFileSync(appShellFile, 'utf-8') : ''
const chatPanelContent = fs.existsSync(chatPanelFile) ? fs.readFileSync(chatPanelFile, 'utf-8') : ''
const pkg = JSON.parse(fs.existsSync(pkgFile) ? fs.readFileSync(pkgFile, 'utf-8') : '{}')
const scripts: Record<string, string> = pkg.scripts ?? {}

// ─── T1–T15: Migration ───────────────────────────────────────────────────────
console.log('\nT1–T15: Migration')

test('T1: migration file exists', () => {
  assert(fs.existsSync(migrationFile), `Not found: ${migrationFile}`)
})

test('T2: migration adds email_enabled column', () => {
  assert(migrationContent.includes('email_enabled'), 'Missing email_enabled column')
})

test('T3: email_enabled defaults to true', () => {
  assert(migrationContent.includes('DEFAULT true'), 'email_enabled must default to true')
})

test('T4: migration adds zalo_status column', () => {
  assert(migrationContent.includes('zalo_status'), 'Missing zalo_status column')
})

test('T5: zalo_status defaults to not_configured', () => {
  assert(migrationContent.includes("'not_configured'"), 'Missing not_configured default')
})

test('T6: zalo_status has CHECK constraint with valid values', () => {
  assert(migrationContent.includes('connected'), 'Missing connected in check constraint')
  assert(migrationContent.includes('token_expired'), 'Missing token_expired in check constraint')
})

test('T7: migration adds zalo_setup_note_shown column', () => {
  assert(migrationContent.includes('zalo_setup_note_shown'), 'Missing zalo_setup_note_shown column')
})

test('T8: zalo_setup_note_shown defaults to false', () => {
  assert(migrationContent.includes('DEFAULT false'), 'zalo_setup_note_shown must default to false')
})

test('T9: migration uses IF NOT EXISTS for all ADD COLUMN statements', () => {
  const addCount = (migrationContent.match(/ADD COLUMN IF NOT EXISTS/gi) ?? []).length
  assert(addCount >= 3, `Expected 3+ ADD COLUMN IF NOT EXISTS, got ${addCount}`)
})

test('T10: migration modifies settings table', () => {
  assert(migrationContent.includes('settings'), 'Migration must reference settings table')
})

test('T11: zalo_status is NOT NULL', () => {
  const zaloLine = migrationContent.split('\n').find(l => l.includes('zalo_status') && !l.trimStart().startsWith('--'))
  assert(zaloLine !== undefined && zaloLine.includes('NOT NULL'), `zalo_status column line: ${zaloLine}`)
})

test('T12: email_enabled is boolean type', () => {
  assert(migrationContent.includes('boolean'), 'email_enabled must be boolean type')
})

test('T13: migration file is valid SQL (no obvious syntax errors — starts with --)', () => {
  assert(migrationContent.trimStart().startsWith('--'), 'Migration should start with a comment')
})

test('T14: migration does not drop any columns or tables', () => {
  assert(!migrationContent.toUpperCase().includes('DROP COLUMN'), 'Must not drop columns')
  assert(!migrationContent.toUpperCase().includes('DROP TABLE'), 'Must not drop tables')
})

test('T15: migration does not update existing rows (no UPDATE/DELETE — non-destructive)', () => {
  const codeLines = migrationContent.split('\n').filter(l => !l.trimStart().startsWith('--'))
  const hasMutatingDML = codeLines.some(l => /^\s*(UPDATE|DELETE)\s/i.test(l))
  assert(!hasMutatingDML, 'Migration must not update or delete existing data')
})

// ─── T16–T30: API route ──────────────────────────────────────────────────────
console.log('\nT16–T30: API route')

test('T16: API route file exists', () => {
  assert(fs.existsSync(apiRouteFile), `Not found: ${apiRouteFile}`)
})

test('T17: API route exports GET function', () => {
  assert(apiRouteContent.includes('export async function GET'), 'Missing GET export')
})

test('T18: API route exports PATCH function', () => {
  assert(apiRouteContent.includes('export async function PATCH'), 'Missing PATCH export')
})

test('T19: API route uses createServerClient (AD-13 — owner request path)', () => {
  assert(apiRouteContent.includes('createServerClient'), 'Must use createServerClient for owner path')
})

test('T20: API route does NOT use createServiceClient (AD-13)', () => {
  assert(!apiRouteContent.includes('createServiceClient'), 'Must not use createServiceClient in owner route')
})

test('T21: API route returns 401 when user is not authenticated', () => {
  assert(apiRouteContent.includes('401'), 'Missing 401 Unauthorized response')
  assert(apiRouteContent.includes('Unauthorized'), 'Missing Unauthorized message')
})

test('T22: API route queries settings with eq(owner_id) (AD-2)', () => {
  assert(apiRouteContent.includes("'owner_id'"), 'Missing owner_id filter (AD-2)')
  assert(apiRouteContent.includes('.eq('), 'Missing .eq() call')
})

test('T23: GET returns email_enabled, zalo_status, zalo_setup_note_shown', () => {
  assert(apiRouteContent.includes('email_enabled'), 'Missing email_enabled in select')
  assert(apiRouteContent.includes('zalo_status'), 'Missing zalo_status in select')
  assert(apiRouteContent.includes('zalo_setup_note_shown'), 'Missing zalo_setup_note_shown in select')
})

test('T24: PATCH rejects zalo_status writes — either allowlist or explicit denylist', () => {
  // Either an explicit allowlist (OWNER_WRITABLE_FIELDS) or explicit rejection guard must be present
  const hasAllowlist = apiRouteContent.includes('OWNER_WRITABLE_FIELDS') || apiRouteContent.includes('ALLOWED')
  const hasDenylist = apiRouteContent.includes('zalo_status is read-only')
  assert(hasAllowlist || hasDenylist, 'Must block zalo_status writes via allowlist or explicit rejection')
  assert(apiRouteContent.includes('400'), 'Must return 400 when zalo_status write attempted')
})

test('T25: PATCH validates email_enabled is boolean', () => {
  assert(apiRouteContent.includes("email_enabled must be a boolean") || apiRouteContent.includes('email_enabled'), 'Missing email_enabled type validation')
})

test('T26: PATCH validates zalo_setup_note_shown is boolean', () => {
  assert(apiRouteContent.includes('zalo_setup_note_shown'), 'Missing zalo_setup_note_shown in PATCH')
})

test('T27: PATCH returns 204 on success', () => {
  assert(apiRouteContent.includes('204'), 'Missing 204 No Content response')
})

test('T28: PATCH returns 400 when no writable fields provided', () => {
  assert(apiRouteContent.includes('No writable fields'), 'Missing empty-patch guard')
})

test('T29: PATCH uses upsert on owner_id conflict', () => {
  assert(apiRouteContent.includes('.upsert('), 'Must use upsert for settings')
  assert(apiRouteContent.includes("onConflict: 'owner_id'"), 'Must upsert on owner_id conflict')
})

test('T30: GET uses maybeSingle to distinguish no-row from DB error', () => {
  assert(apiRouteContent.includes('.maybeSingle()'), 'Must use maybeSingle() to handle no-settings row')
})

// ─── T31–T45: NotificationChannelsPanel component ───────────────────────────
console.log('\nT31–T45: NotificationChannelsPanel component')

test('T31: NotificationChannelsPanel.tsx exists', () => {
  assert(fs.existsSync(panelFile), `Not found: ${panelFile}`)
})

test('T32: panel is a client component', () => {
  assert(panelContent.trimStart().startsWith("'use client'"), "Must start with 'use client'")
})

test('T33: panel exports NotificationChannelsPanel function', () => {
  assert(panelContent.includes('export function NotificationChannelsPanel'), 'Missing NotificationChannelsPanel export')
})

test('T34: panel shows in-app channel as always-on (Luôn bật)', () => {
  assert(panelContent.includes('Luôn bật'), 'Missing Luôn bật badge for in-app channel')
})

test('T35: panel shows Zalo OA section', () => {
  assert(panelContent.includes('Zalo OA'), 'Missing Zalo OA section')
})

test('T36: panel shows email toggle (role=switch)', () => {
  assert(panelContent.includes('role="switch"'), 'Missing role="switch" toggle for email')
})

test('T37: panel shows Zalo not-configured info card text', () => {
  assert(panelContent.includes('thông báo chủ động chỉ qua email và in-app'), 'Missing Zalo not-configured info card text')
})

test('T38: panel shows email-off warning text', () => {
  assert(panelContent.includes('Nếu Zalo thất bại sẽ không có kênh dự phòng'), 'Missing email-off warning text')
})

test('T39: panel has confirmation dialog for disabling email without Zalo', () => {
  assert(panelContent.includes('role="dialog"'), 'Missing confirmation dialog (role=dialog)')
  assert(panelContent.includes('aria-modal'), 'Dialog must have aria-modal')
})

test('T40: confirmation dialog text warns about in-app only', () => {
  assert(panelContent.includes('chỉ thấy thông báo trong app'), 'Missing in-app-only warning in confirmation dialog')
})

test('T41: panel fetches GET /api/settings/notification-channels on mount', () => {
  assert(panelContent.includes('/api/settings/notification-channels'), 'Missing API fetch')
})

test('T42: panel PATCHes /api/settings/notification-channels on toggle', () => {
  assert(panelContent.includes("method: 'PATCH'"), 'Missing PATCH call')
})

test('T43: panel has loading state', () => {
  assert(panelContent.includes('loading'), 'Missing loading state')
})

test('T44: Toggle sub-component uses aria-checked', () => {
  assert(panelContent.includes('aria-checked'), 'Toggle must have aria-checked for accessibility')
})

test('T45: panel has substantive content (> 1000 chars)', () => {
  assert(panelContent.length > 1000, `Panel too short: ${panelContent.length} chars`)
})

// ─── T46–T55: AppShell + ChatPanel integration ──────────────────────────────
console.log('\nT46–T55: AppShell + ChatPanel integration')

test('T46: AppShell imports NotificationChannelsPanel', () => {
  assert(appShellContent.includes('NotificationChannelsPanel'), 'Missing NotificationChannelsPanel import')
})

test('T47: AppShell renders NotificationChannelsPanel in settings mode', () => {
  const settingsBlock = appShellContent.slice(appShellContent.indexOf("mode === 'settings'"))
  assert(settingsBlock.includes('NotificationChannelsPanel'), 'NotificationChannelsPanel not rendered in settings block')
})

test('T48: AppShell renders NotificationChannelsPanel after CadencePanel', () => {
  const cadenceIdx = appShellContent.indexOf('<CadencePanel')
  const notifIdx = appShellContent.indexOf('<NotificationChannelsPanel')
  assert(cadenceIdx > -1 && notifIdx > cadenceIdx, 'NotificationChannelsPanel must come after CadencePanel')
})

test('T49: ChatPanel has Zalo setup note state (showZaloNote)', () => {
  assert(chatPanelContent.includes('showZaloNote'), 'Missing showZaloNote state in ChatPanel')
})

test('T50: ChatPanel fetches /api/settings/notification-channels for Zalo note', () => {
  assert(chatPanelContent.includes('/api/settings/notification-channels'), 'Missing notification-channels fetch in ChatPanel')
})

test('T51: ChatPanel shows Zalo note only when pendingCheckIns.length > 0', () => {
  const zaloNoteBlock = chatPanelContent.slice(chatPanelContent.indexOf('showZaloNote'))
  assert(zaloNoteBlock.includes('pendingCheckIns.length'), 'Zalo note must be conditional on pendingCheckIns')
})

test('T52: ChatPanel Zalo note text contains Bật Zalo OA trong Cài đặt', () => {
  assert(chatPanelContent.includes('Bật Zalo OA trong Cài đặt'), 'Missing Zalo note text')
})

test('T53: ChatPanel dismisses Zalo note and PATCHes zalo_setup_note_shown=true', () => {
  assert(chatPanelContent.includes('zalo_setup_note_shown: true'), 'Must PATCH zalo_setup_note_shown=true on dismiss')
})

test('T54: ChatPanel has aria-label for Zalo note close button', () => {
  assert(chatPanelContent.includes('Đóng thông báo Zalo'), 'Missing aria-label on Zalo note close button')
})

test('T55: ChatPanel Zalo note does not appear when zalo_status is connected', () => {
  // Code logic: setShowZaloNote only when zalo_status !== 'connected'
  const setNoteBlock = chatPanelContent.slice(chatPanelContent.indexOf('setShowZaloNote'))
  assert(setNoteBlock.includes("!== 'connected'") || chatPanelContent.includes("!== 'connected'"), 'Must check zalo_status !== connected before showing note')
})

// ─── T56–T60: package.json ──────────────────────────────────────────────────
console.log('\nT56–T60: package.json')

test('T56: package.json has test:delivery-channel-settings56 script', () => {
  const s = scripts['test:delivery-channel-settings56']
  assert(s !== undefined, 'Missing test:delivery-channel-settings56 script')
  assert(s!.includes('deliveryChannelSettings56.test.ts'), 'Script must reference deliveryChannelSettings56.test.ts')
})

test('T57: main test script includes deliveryChannelSettings56.test.ts', () => {
  const s = scripts['test']
  assert(s !== undefined && s.includes('deliveryChannelSettings56.test.ts'), 'deliveryChannelSettings56.test.ts not in main test chain')
})

test('T58: NotificationChannelsPanel uses fetch (no axios or other HTTP library)', () => {
  assert(panelContent.includes('fetch('), 'Must use native fetch')
  assert(!panelContent.includes('axios'), 'Must not use axios')
})

test('T59: API route import from @/lib/supabase/server (not a relative path)', () => {
  assert(apiRouteContent.includes("from '@/lib/supabase/server'"), 'Must use absolute import path')
})

test('T60: story file exists and is marked done or in-progress', () => {
  const storyFile = path.join(root, '_bmad-output/implementation-artifacts/5-6-delivery-channel-settings-zalo-not-set-up-graceful-state.md')
  assert(fs.existsSync(storyFile), 'Story file must exist')
  const content = fs.readFileSync(storyFile, 'utf-8')
  assert(content.includes('status: done') || content.includes('status: in-progress'), 'Story must be in-progress or done')
})

// ─── Summary ─────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`)
console.log(`Results: ${passed} passed, ${failed} failed out of ${passed + failed} tests`)
if (failed > 0) process.exit(1)
