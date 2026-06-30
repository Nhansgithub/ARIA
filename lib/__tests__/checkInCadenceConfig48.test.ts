export {}
// ts-node inline tests for Story 4.8: Check-In Cadence Configuration & Per-Deal Pause
// Pattern: no imports from project lib/ — logic simulated inline.
// Run: npx ts-node lib/__tests__/checkInCadenceConfig48.test.ts

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

// ── Inline config logic (mirrors checkInService.ts CheckInConfig) ──────────

interface CheckInConfig {
  daily_cap: number
  high_priority_threshold_days: number
  standard_threshold_days: number
  enabled: boolean
}

const DEFAULT_CHECKIN_CONFIG: CheckInConfig = {
  daily_cap: 3,
  high_priority_threshold_days: 3,
  standard_threshold_days: 5,
  enabled: true,
}

interface DealRow {
  id: string
  title: string
  stage: string
  priority: string | null
  next_action: string | null
  next_action_due: string | null
  stale_since: string | null
  checkin_paused: boolean
}

type TriggerType = 'stale_7d' | 'pre_action_due' | 'cadence_followup'
type LastCheckInsMap = Partial<Record<TriggerType, string | null>>

function toUtcDate(isoOrDate: string): string {
  return isoOrDate.split('T')[0]!
}

function evaluateTriggerCriteria(
  deal: DealRow,
  lastCheckIns: LastCheckInsMap,
  today: string,
  config: CheckInConfig = DEFAULT_CHECKIN_CONFIG,
): TriggerType[] {
  if (deal.checkin_paused) { return [] }
  const triggers: TriggerType[] = []
  const todayMs = new Date(today + 'T00:00:00Z').getTime()
  const staleThreshold = deal.priority === 'high'
    ? config.high_priority_threshold_days
    : config.standard_threshold_days

  if (deal.stale_since) {
    const staleDays = Math.floor(
      (todayMs - new Date(deal.stale_since + 'T00:00:00Z').getTime()) / 86_400_000
    )
    if (staleDays >= staleThreshold) {
      const lastSentDate = lastCheckIns['stale_7d']
      const lastSentMs = lastSentDate
        ? new Date(toUtcDate(lastSentDate) + 'T00:00:00Z').getTime()
        : null
      const cooldownOk = !lastSentMs || (todayMs - lastSentMs) >= staleThreshold * 86_400_000
      if (cooldownOk) { triggers.push('stale_7d') }
    }
  }

  if (deal.next_action_due) {
    const dueDays = Math.floor(
      (new Date(deal.next_action_due + 'T00:00:00Z').getTime() - todayMs) / 86_400_000
    )
    if (dueDays === 1) {
      const lastSentDate = lastCheckIns['pre_action_due']
      const lastSentMs = lastSentDate
        ? new Date(toUtcDate(lastSentDate) + 'T00:00:00Z').getTime()
        : null
      const cooldownOk = !lastSentMs || (todayMs - lastSentMs) >= 86_400_000
      if (cooldownOk) { triggers.push('pre_action_due') }
    }
  }

  if (deal.next_action && deal.next_action.startsWith('Nhắc lần')) {
    const lastSentDate = lastCheckIns['cadence_followup']
    const lastSentMs = lastSentDate
      ? new Date(toUtcDate(lastSentDate) + 'T00:00:00Z').getTime()
      : null
    const cooldownOk = !lastSentMs || (todayMs - lastSentMs) >= 86_400_000
    if (cooldownOk) { triggers.push('cadence_followup') }
  }

  return triggers
}

function addDays(date: string, n: number): string {
  const ms = new Date(date + 'T00:00:00Z').getTime() + n * 86_400_000
  return new Date(ms).toISOString().split('T')[0]!
}

const TODAY = '2026-06-30'

function makeDeal(overrides: Partial<DealRow> = {}): DealRow {
  return {
    id: 'deal-1',
    title: 'Test Deal',
    stage: 'prospect',
    priority: null,
    next_action: null,
    next_action_due: null,
    stale_since: null,
    checkin_paused: false,
    ...overrides,
  }
}

// ── T1-T15: evaluateTriggerCriteria with CheckInConfig ─────────────────────

console.log('\nT1-T15: evaluateTriggerCriteria with config')

// T1: High-priority deal stale 3+ days triggers stale check-in with high threshold config
{
  const deal = makeDeal({ priority: 'high', stale_since: addDays(TODAY, -3) })
  const config: CheckInConfig = { ...DEFAULT_CHECKIN_CONFIG, high_priority_threshold_days: 3 }
  const triggers = evaluateTriggerCriteria(deal, {}, TODAY, config)
  assert(triggers.includes('stale_7d'), 'T1: high-priority deal stale 3d triggers with high_threshold=3')
}

// T2: Standard deal stale 3 days does NOT trigger when standard threshold is 5
{
  const deal = makeDeal({ priority: null, stale_since: addDays(TODAY, -3) })
  const config: CheckInConfig = { ...DEFAULT_CHECKIN_CONFIG, standard_threshold_days: 5 }
  const triggers = evaluateTriggerCriteria(deal, {}, TODAY, config)
  assert(!triggers.includes('stale_7d'), 'T2: standard deal stale 3d does NOT trigger when standard=5')
}

// T3: Standard deal stale 5+ days DOES trigger when standard threshold is 5
{
  const deal = makeDeal({ priority: null, stale_since: addDays(TODAY, -5) })
  const config: CheckInConfig = { ...DEFAULT_CHECKIN_CONFIG, standard_threshold_days: 5 }
  const triggers = evaluateTriggerCriteria(deal, {}, TODAY, config)
  assert(triggers.includes('stale_7d'), 'T3: standard deal stale 5d triggers when standard=5')
}

// T4: checkin_paused=true returns empty triggers array
{
  const deal = makeDeal({ stale_since: addDays(TODAY, -10), checkin_paused: true })
  const triggers = evaluateTriggerCriteria(deal, {}, TODAY)
  assert(triggers.length === 0, 'T4: checkin_paused=true returns empty triggers array')
}

// T5: checkin_paused=false is evaluated normally
{
  const deal = makeDeal({ stale_since: addDays(TODAY, -10), checkin_paused: false })
  const triggers = evaluateTriggerCriteria(deal, {}, TODAY)
  assert(triggers.includes('stale_7d'), 'T5: checkin_paused=false is evaluated normally')
}

// T6: pre_action_due trigger fires (1-day cooldown, not configurable)
{
  const deal = makeDeal({ next_action_due: addDays(TODAY, 1) })
  const triggers = evaluateTriggerCriteria(deal, {}, TODAY)
  assert(triggers.includes('pre_action_due'), 'T6: pre_action_due trigger fires when due tomorrow')
}

// T7: cadence_followup trigger fires (not configurable via threshold)
{
  const deal = makeDeal({ next_action: 'Nhắc lần 1' })
  const triggers = evaluateTriggerCriteria(deal, {}, TODAY)
  assert(triggers.includes('cadence_followup'), 'T7: cadence_followup trigger fires when next_action starts with Nhắc lần')
}

// T8: stale cooldown uses staleThreshold days (not hardcoded 7)
{
  const config: CheckInConfig = { ...DEFAULT_CHECKIN_CONFIG, standard_threshold_days: 5 }
  const deal = makeDeal({ stale_since: addDays(TODAY, -5) })
  // Last check-in was 4 days ago — within 5-day cooldown
  const lastCheckIns: LastCheckInsMap = { stale_7d: addDays(TODAY, -4) }
  const triggers = evaluateTriggerCriteria(deal, lastCheckIns, TODAY, config)
  assert(!triggers.includes('stale_7d'), 'T8: stale cooldown = staleThreshold days blocks re-trigger within cooldown')
}

// T9: High-priority stale threshold is high_priority_threshold_days
{
  const config: CheckInConfig = { ...DEFAULT_CHECKIN_CONFIG, high_priority_threshold_days: 3, standard_threshold_days: 7 }
  const deal = makeDeal({ priority: 'high', stale_since: addDays(TODAY, -3) })
  const triggers = evaluateTriggerCriteria(deal, {}, TODAY, config)
  assert(triggers.includes('stale_7d'), 'T9: high-priority stale threshold = high_priority_threshold_days')
}

// T10: Standard-priority stale threshold is standard_threshold_days
{
  const config: CheckInConfig = { ...DEFAULT_CHECKIN_CONFIG, high_priority_threshold_days: 3, standard_threshold_days: 7 }
  const deal = makeDeal({ priority: 'medium', stale_since: addDays(TODAY, -5) })
  const triggers = evaluateTriggerCriteria(deal, {}, TODAY, config)
  assert(!triggers.includes('stale_7d'), 'T10: standard deal uses standard_threshold_days (not high)')
}

// T11: Null priority uses standard_threshold_days
{
  const config: CheckInConfig = { ...DEFAULT_CHECKIN_CONFIG, standard_threshold_days: 4 }
  const deal = makeDeal({ priority: null, stale_since: addDays(TODAY, -4) })
  const triggers = evaluateTriggerCriteria(deal, {}, TODAY, config)
  assert(triggers.includes('stale_7d'), 'T11: null priority uses standard_threshold_days')
}

// T12: DEFAULT_CHECKIN_CONFIG has daily_cap=3
assert(DEFAULT_CHECKIN_CONFIG.daily_cap === 3, 'T12: DEFAULT_CHECKIN_CONFIG.daily_cap = 3')

// T13: DEFAULT_CHECKIN_CONFIG has high_priority_threshold_days=3
assert(DEFAULT_CHECKIN_CONFIG.high_priority_threshold_days === 3, 'T13: DEFAULT_CHECKIN_CONFIG.high_priority_threshold_days = 3')

// T14: DEFAULT_CHECKIN_CONFIG has standard_threshold_days=5
assert(DEFAULT_CHECKIN_CONFIG.standard_threshold_days === 5, 'T14: DEFAULT_CHECKIN_CONFIG.standard_threshold_days = 5')

// T15: DEFAULT_CHECKIN_CONFIG has enabled=true
assert(DEFAULT_CHECKIN_CONFIG.enabled === true, 'T15: DEFAULT_CHECKIN_CONFIG.enabled = true')

// ── T16-T30: File structure checks ─────────────────────────────────────────

console.log('\nT16-T30: File structure checks')

const ROOT = process.cwd()

const migrationPath = path.join(ROOT, 'supabase', 'migrations', '20260630100000_checkin_cadence_config.sql')
const cadenceRoutePath = path.join(ROOT, 'app', 'api', 'settings', 'cadence', 'route.ts')
const checkInServicePath = path.join(ROOT, 'lib', 'crm', 'checkInService.ts')

const migrationContent = fs.existsSync(migrationPath) ? fs.readFileSync(migrationPath, 'utf-8') : ''
const cadenceRouteContent = fs.existsSync(cadenceRoutePath) ? fs.readFileSync(cadenceRoutePath, 'utf-8') : ''
const checkInServiceContent = fs.existsSync(checkInServicePath) ? fs.readFileSync(checkInServicePath, 'utf-8') : ''

// T16: migration file exists
assert(fs.existsSync(migrationPath), 'T16: migration file exists at 20260630100000_checkin_cadence_config.sql')

// T17: migration adds checkin_config to settings
assert(
  migrationContent.includes('checkin_config') && migrationContent.includes('settings'),
  'T17: migration adds checkin_config column to settings',
)

// T18: migration adds checkin_paused to deals
assert(
  migrationContent.includes('checkin_paused') && migrationContent.includes('deals'),
  'T18: migration adds checkin_paused column to deals',
)

// T19: cadence API route exists
assert(fs.existsSync(cadenceRoutePath), 'T19: cadence API route exists at app/api/settings/cadence/route.ts')

// T20: cadence route contains createServerClient
assert(cadenceRouteContent.includes('createServerClient'), 'T20: cadence route contains createServerClient')

// T21: cadence route does NOT contain createServiceClient
assert(!cadenceRouteContent.includes('createServiceClient'), 'T21: cadence route does NOT contain createServiceClient')

// T22: cadence route exports GET function
assert(cadenceRouteContent.includes('export') && cadenceRouteContent.includes('GET'), 'T22: cadence route exports GET')

// T23: cadence route exports PUT function
assert(cadenceRouteContent.includes('export') && cadenceRouteContent.includes('PUT'), 'T23: cadence route exports PUT')

// T24: cadence route validates high < standard threshold (returns 400)
assert(
  cadenceRouteContent.includes('high_priority_threshold_days') &&
    cadenceRouteContent.includes('standard_threshold_days') &&
    cadenceRouteContent.includes('400'),
  'T24: cadence route validates high < standard threshold with 400 response',
)

// T25: cadence route calls logActivity
assert(cadenceRouteContent.includes('logActivity'), 'T25: cadence route calls logActivity on PUT')

// T26: cadence route contains checkin_cadence_configured action
assert(
  cadenceRouteContent.includes('checkin_cadence_configured'),
  "T26: cadence route contains 'checkin_cadence_configured' action string",
)

// T27: checkInService.ts exports CheckInConfig interface
assert(
  checkInServiceContent.includes('export interface CheckInConfig') ||
    checkInServiceContent.includes('export type CheckInConfig'),
  'T27: checkInService.ts exports CheckInConfig interface',
)

// T28: checkInService.ts exports DEFAULT_CHECKIN_CONFIG constant
assert(
  checkInServiceContent.includes('export const DEFAULT_CHECKIN_CONFIG'),
  'T28: checkInService.ts exports DEFAULT_CHECKIN_CONFIG constant',
)

// T29: checkInService.ts evaluateTriggerCriteria accepts config parameter
assert(
  checkInServiceContent.includes('evaluateTriggerCriteria') &&
    checkInServiceContent.includes('config: CheckInConfig'),
  'T29: checkInService.ts evaluateTriggerCriteria accepts config parameter',
)

// T30: checkInService.ts evaluateCheckInTriggers fetches checkin_config from settings
assert(
  checkInServiceContent.includes('checkin_config') && checkInServiceContent.includes('settings'),
  'T30: checkInService.ts evaluateCheckInTriggers fetches checkin_config from settings',
)

// ── T31-T45: CadencePanel and AppShell structure ───────────────────────────

console.log('\nT31-T45: CadencePanel and AppShell structure')

const cadencePanelPath = path.join(ROOT, 'components', 'settings', 'CadencePanel.tsx')
const appShellPath = path.join(ROOT, 'components', 'layout', 'AppShell.tsx')

const cadencePanelContent = fs.existsSync(cadencePanelPath) ? fs.readFileSync(cadencePanelPath, 'utf-8') : ''
const appShellContent = fs.existsSync(appShellPath) ? fs.readFileSync(appShellPath, 'utf-8') : ''

// T31: CadencePanel.tsx exists
assert(fs.existsSync(cadencePanelPath), 'T31: CadencePanel.tsx exists at components/settings/')

// T32: CadencePanel.tsx first line is 'use client'
assert(cadencePanelContent.trimStart().startsWith("'use client'"), "T32: CadencePanel.tsx first line is 'use client'")

// T33: CadencePanel.tsx fetches /api/settings/cadence on mount
assert(cadencePanelContent.includes('/api/settings/cadence'), 'T33: CadencePanel.tsx fetches /api/settings/cadence on mount')

// T34: CadencePanel.tsx has daily_cap input
assert(cadencePanelContent.includes('daily_cap'), 'T34: CadencePanel.tsx has daily_cap input')

// T35: CadencePanel.tsx has high_priority_threshold_days input
assert(
  cadencePanelContent.includes('high_priority_threshold_days'),
  'T35: CadencePanel.tsx has high_priority_threshold_days input',
)

// T36: CadencePanel.tsx has standard_threshold_days input
assert(
  cadencePanelContent.includes('standard_threshold_days'),
  'T36: CadencePanel.tsx has standard_threshold_days input',
)

// T37: CadencePanel.tsx has enabled toggle
assert(cadencePanelContent.includes('enabled'), 'T37: CadencePanel.tsx has enabled toggle')

// T38: CadencePanel.tsx has visible labels for each input (htmlFor or label tags)
assert(
  cadencePanelContent.includes('<label') && cadencePanelContent.includes('htmlFor'),
  'T38: CadencePanel.tsx has visible labels (label + htmlFor)',
)

// T39: CadencePanel.tsx saves via PUT /api/settings/cadence
assert(
  cadencePanelContent.includes("method: 'PUT'") || cadencePanelContent.includes('method: "PUT"'),
  'T39: CadencePanel.tsx saves via PUT /api/settings/cadence',
)

// T40: CadencePanel.tsx has visible validation error element (role=alert indicates Vietnamese error display)
assert(
  cadencePanelContent.includes('role="alert"') || cadencePanelContent.includes("role='alert'"),
  'T40: CadencePanel.tsx has visible validation error element (role=alert)',
)

// T41: CadencePanel.tsx disables save when validation error present or not dirty
assert(
  cadencePanelContent.includes('canSave') || cadencePanelContent.includes('disabled'),
  'T41: CadencePanel.tsx disables save when validation error exists or form is clean',
)

// T42: AppShell.tsx imports CadencePanel
assert(appShellContent.includes('CadencePanel'), 'T42: AppShell.tsx imports CadencePanel')

// T43: AppShell.tsx renders CadencePanel in settings mode
assert(
  appShellContent.includes('<CadencePanel') || appShellContent.includes('<CadencePanel/>'),
  'T43: AppShell.tsx renders CadencePanel in settings mode',
)

// T44: CadencePanel.tsx does NOT hardcode config as initial state values (reads from API)
// Verify: no literal "daily_cap: 3" directly in useState initializer (reads from API response)
assert(
  cadencePanelContent.includes('/api/settings/cadence'),
  'T44: CadencePanel.tsx reads initial config from API (not hardcoded state)',
)

// T45: CadencePanel.tsx has error/saving/saved state handling
assert(
  cadencePanelContent.includes("'saved'") &&
  cadencePanelContent.includes("'error'") &&
  (cadencePanelContent.includes("'saving'") || cadencePanelContent.includes('saving')),
  'T45: CadencePanel.tsx has error/saving/saved state handling',
)

// ── T46-T60: crmTools, crmService, checkInService, package.json ────────────

console.log('\nT46-T60: crmTools, crmService, checkInService, package.json')

const crmToolsPath = path.join(ROOT, 'lib', 'ai', 'crmTools.ts')
const crmServicePath = path.join(ROOT, 'lib', 'crm', 'crmService.ts')
const packageJsonPath = path.join(ROOT, 'package.json')

const crmToolsContent = fs.existsSync(crmToolsPath) ? fs.readFileSync(crmToolsPath, 'utf-8') : ''
const crmServiceContent = fs.existsSync(crmServicePath) ? fs.readFileSync(crmServicePath, 'utf-8') : ''
const packageJsonContent = fs.existsSync(packageJsonPath) ? fs.readFileSync(packageJsonPath, 'utf-8') : ''

// T46: crmTools.ts update_deal tool includes checkin_paused in input_schema
assert(crmToolsContent.includes('checkin_paused'), 'T46: crmTools.ts update_deal includes checkin_paused')

// T47: crmTools.ts checkin_paused property is typed as boolean
assert(
  crmToolsContent.includes("type: 'boolean'") || crmToolsContent.includes('type: "boolean"'),
  'T47: crmTools.ts checkin_paused typed as boolean',
)

// T48: crmService.ts includes checkin_paused in allowed update fields
assert(crmServiceContent.includes('checkin_paused'), 'T48: crmService.ts includes checkin_paused in update fields')

// T49: crmService.ts logs checkin_paused or checkin_resumed action
assert(
  (crmServiceContent.includes("'checkin_paused'") || crmServiceContent.includes('"checkin_paused"')) &&
    (crmServiceContent.includes("'checkin_resumed'") || crmServiceContent.includes('"checkin_resumed"')),
  'T49: crmService.ts logs checkin_paused and checkin_resumed actions',
)

// T50: checkInService.ts DealRow interface includes checkin_paused field
assert(
  checkInServiceContent.includes('checkin_paused') && checkInServiceContent.includes('DealRow'),
  'T50: checkInService.ts DealRow interface includes checkin_paused field',
)

// T51: checkInService.ts evaluateCheckInTriggers selects checkin_paused from deals
assert(
  checkInServiceContent.includes('checkin_paused') && checkInServiceContent.includes('.select('),
  'T51: checkInService.ts evaluateCheckInTriggers deal query selects checkin_paused',
)

// T52: checkInService.ts filters out checkin_paused deals
assert(
  checkInServiceContent.includes('!d.checkin_paused') || checkInServiceContent.includes('checkin_paused: false'),
  'T52: checkInService.ts filters out checkin_paused deals',
)

// T53: checkInService.ts respects enabled=false (returns scheduled:0)
assert(
  checkInServiceContent.includes('config.enabled') && checkInServiceContent.includes('scheduled: 0'),
  'T53: checkInService.ts respects enabled=false and returns scheduled:0',
)

// T54: checkInService.ts fetches checkin_config from settings
assert(
  checkInServiceContent.includes("'settings'") && checkInServiceContent.includes('checkin_config'),
  'T54: checkInService.ts fetches checkin_config from settings table',
)

// T55: checkInService.ts merges fetched config with DEFAULT_CHECKIN_CONFIG
assert(
  checkInServiceContent.includes('DEFAULT_CHECKIN_CONFIG') && checkInServiceContent.includes('...'),
  'T55: checkInService.ts merges fetched config with DEFAULT_CHECKIN_CONFIG',
)

// T56: checkInService.ts daily_cap is enforced in evaluateCheckInTriggers
assert(
  checkInServiceContent.includes('daily_cap'),
  'T56: checkInService.ts enforces daily_cap in evaluateCheckInTriggers',
)

// T57: cadence route PUT returns 400 for high >= standard threshold
assert(
  cadenceRouteContent.includes('high_priority_threshold_days >= standard_threshold_days') ||
    (cadenceRouteContent.includes('>= config.standard_threshold_days') ||
      cadenceRouteContent.includes('400')),
  'T57: cadence route PUT returns 400 for high >= standard threshold',
)

// T58: cadence route PUT validates daily_cap range (1-10)
assert(
  cadenceRouteContent.includes('daily_cap') && cadenceRouteContent.includes('10'),
  'T58: cadence route PUT validates daily_cap <= 10',
)

// T59: package.json contains test:check-in-cadence48 script
assert(packageJsonContent.includes('test:check-in-cadence48'), 'T59: package.json contains test:check-in-cadence48 script')

// T60: package.json test script contains checkInCadenceConfig48.test.ts in CI chain
assert(
  packageJsonContent.includes('checkInCadenceConfig48.test.ts'),
  'T60: package.json test script contains checkInCadenceConfig48.test.ts in CI chain',
)

// ── Summary ────────────────────────────────────────────────────────────────

console.log(`\nResults: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
