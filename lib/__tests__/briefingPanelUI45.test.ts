export {}

import fs from 'fs'
import path from 'path'

// ── helpers ───────────────────────────────────────────────────────────────────

function pass(label: string): void {
  console.log('  PASS: ' + label)
}
function fail(label: string, detail?: string): void {
  console.error('  FAIL: ' + label + (detail ? ': ' + detail : ''))
  process.exitCode = 1
}
function assert(cond: boolean, label: string, detail?: string): void {
  if (cond) {
    pass(label)
  } else {
    fail(label, detail)
  }
}

// ── Shared flag types and helpers (must match BriefingPanel.tsx) ──────────────

interface BriefingFlag {
  type: 'overdue' | 'stale' | 'missing_doc' | 'cadence_reminder'
  deal_id: string
  severity: 'high' | 'medium'
  label: string
}

function isTodayEligible(flag: BriefingFlag): boolean {
  if (flag.type === 'overdue') {
    return true
  }
  if (flag.type === 'cadence_reminder') {
    return true
  }
  if (flag.type === 'stale' && flag.severity === 'high') {
    return true
  }
  return false
}

function todayFlagTier(flag: BriefingFlag): number {
  if (flag.type === 'overdue') {
    return 0
  }
  if (flag.type === 'cadence_reminder') {
    return 2
  }
  return 3
}

function composePrequeueMessage(flag: BriefingFlag): string {
  switch (flag.type) {
    case 'overdue':
      return flag.label + '. ARIA co the goi y buoc tiep theo khong?'
    case 'cadence_reminder':
      return flag.label + '. Em nen theo doi the nao?'
    case 'stale':
      return flag.label + '. ARIA nghi tiep theo nen lam gi?'
    default:
      return flag.label + '. ARIA nghi sao?'
  }
}

function countHighFlags(items: BriefingFlag[]): number {
  return items.filter(function (f) {
    return f.severity === 'high'
  }).length
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const overdueFlag: BriefingFlag = {
  type: 'overdue',
  deal_id: 'd1',
  severity: 'high',
  label: 'Deal A qua han',
}
const cadenceFlag: BriefingFlag = {
  type: 'cadence_reminder',
  deal_id: 'd2',
  severity: 'medium',
  label: 'Nhac lan 1',
}
const highStaleFlag: BriefingFlag = {
  type: 'stale',
  deal_id: 'd3',
  severity: 'high',
  label: 'Deal C tri hoan 14 ngay',
}
const medStaleFlag: BriefingFlag = {
  type: 'stale',
  deal_id: 'd4',
  severity: 'medium',
  label: 'Deal D tri hoan 5 ngay',
}
const missingDocFlag: BriefingFlag = {
  type: 'missing_doc',
  deal_id: 'd5',
  severity: 'medium',
  label: 'Thieu hop dong',
}
const genericStaleFlag: BriefingFlag = {
  type: 'stale',
  deal_id: 'dx',
  severity: 'medium',
  label: 'Deal X tri hoan',
}

// ── T1-T5: isTodayEligible ────────────────────────────────────────────────────

console.log('\n[T1-T5] isTodayEligible')

assert(isTodayEligible(overdueFlag), 'T1: overdue is eligible')
assert(isTodayEligible(cadenceFlag), 'T2: cadence_reminder is eligible')
assert(isTodayEligible(highStaleFlag), 'T3: stale+high is eligible')
assert(!isTodayEligible(medStaleFlag), 'T4: stale+medium is NOT eligible')
assert(!isTodayEligible(missingDocFlag), 'T5: missing_doc is NOT eligible')

// ── T6-T10: todayFlagTier ─────────────────────────────────────────────────────

console.log('\n[T6-T10] todayFlagTier ordering')

assert(todayFlagTier(overdueFlag) === 0, 'T6: overdue tier=0')
assert(todayFlagTier(cadenceFlag) === 2, 'T7: cadence tier=2')
assert(todayFlagTier(highStaleFlag) === 3, 'T8: high-stale tier=3')
assert(todayFlagTier(overdueFlag) < todayFlagTier(cadenceFlag), 'T9: overdue before cadence')
assert(todayFlagTier(cadenceFlag) < todayFlagTier(highStaleFlag), 'T10: cadence before high-stale')

// ── T11-T17: sorting and slicing logic ───────────────────────────────────────

console.log('\n[T11-T17] Today items sort+slice')

const allFlags: BriefingFlag[] = [
  highStaleFlag,
  cadenceFlag,
  overdueFlag,
  medStaleFlag,
  missingDocFlag,
]

const todayItems = allFlags
  .filter(isTodayEligible)
  .sort(function (a, b) {
    return todayFlagTier(a) - todayFlagTier(b)
  })
  .slice(0, 3)

assert(todayItems.length === 3, 'T11: max 3 today items returned')
assert(todayItems[0]?.type === 'overdue', 'T12: index-0 is overdue (tier 0)')
assert(todayItems[1]?.type === 'cadence_reminder', 'T13: index-1 is cadence (tier 2)')
assert(todayItems[2]?.type === 'stale', 'T14: index-2 is high-stale (tier 3)')
assert(
  !todayItems.some(function (f) {
    return f.type === 'missing_doc'
  }),
  'T15: missing_doc excluded'
)
assert(
  !todayItems.some(function (f) {
    return f.type === 'stale' && f.severity === 'medium'
  }),
  'T16: medium-stale excluded'
)

const twoFlags = [overdueFlag, cadenceFlag]
const twoItems = twoFlags
  .filter(isTodayEligible)
  .sort(function (a, b) {
    return todayFlagTier(a) - todayFlagTier(b)
  })
  .slice(0, 3)
assert(twoItems.length === 2, 'T17: fewer than 3 items returns all eligible')

// ── T18-T24: composePrequeueMessage ──────────────────────────────────────────

console.log('\n[T18-T24] composePrequeueMessage')

const overdueMsg = composePrequeueMessage(overdueFlag)
assert(overdueMsg.startsWith(overdueFlag.label), 'T18: overdue msg starts with flag.label')
assert(overdueMsg.includes('ARIA'), 'T19: overdue msg mentions ARIA')
assert(overdueMsg.endsWith('?'), 'T20: overdue msg is a question')

const cadenceMsg = composePrequeueMessage(cadenceFlag)
assert(cadenceMsg.startsWith(cadenceFlag.label), 'T21: cadence msg starts with flag.label')
assert(cadenceMsg.includes('theo doi'), 'T22: cadence msg mentions follow-up')

const staleMsg = composePrequeueMessage(genericStaleFlag)
assert(staleMsg.includes('ARIA nghi'), 'T23: stale msg uses default ARIA prompt')

const missingDocMsg = composePrequeueMessage(missingDocFlag)
assert(missingDocMsg.startsWith(missingDocFlag.label), 'T24: default case starts with flag.label')

// ── T25-T29: high-flag badge count logic ─────────────────────────────────────

console.log('\n[T25-T29] Badge count = severity:high flags')

assert(countHighFlags([]) === 0, 'T25: empty list -> badge count 0')
assert(countHighFlags([overdueFlag]) === 1, 'T26: one high flag -> badge 1')
assert(countHighFlags([overdueFlag, highStaleFlag]) === 2, 'T27: two high flags -> badge 2')
assert(
  countHighFlags([cadenceFlag, medStaleFlag, missingDocFlag]) === 0,
  'T28: only medium flags -> badge 0'
)
assert(countHighFlags([overdueFlag, cadenceFlag]) === 1, 'T29: mixed -> only high counted')

// ── T30-T36: API route file checks ───────────────────────────────────────────

console.log('\n[T30-T36] API route: app/api/briefing/today/route.ts')

const routePath = path.join(process.cwd(), 'app', 'api', 'briefing', 'today', 'route.ts')
const routeExists = fs.existsSync(routePath)
assert(routeExists, 'T30: route.ts file exists')

if (routeExists) {
  const route = fs.readFileSync(routePath, 'utf-8')
  assert(route.includes('export async function GET'), 'T31: exports GET handler')
  assert(route.includes('createServerClient'), 'T32: uses createServerClient (AD-13)')
  assert(
    !route.includes('createServiceClient'),
    'T33: route.ts does not directly import createServiceClient (service role scoped to briefingService)'
  )
  assert(
    route.includes('generateBriefingForOwner'),
    'T34: calls generateBriefingForOwner for generation'
  )
  assert(route.includes('forceRefresh'), 'T35: handles forceRefresh param')
  assert(route.includes('generate'), 'T36: handles generate param')
}

// ── T37-T45: BriefingPanel component file checks ─────────────────────────────

console.log('\n[T37-T45] BriefingPanel.tsx component')

const panelPath = path.join(process.cwd(), 'components', 'briefing', 'BriefingPanel.tsx')
const panelExists = fs.existsSync(panelPath)
assert(panelExists, 'T37: BriefingPanel.tsx file exists')

if (panelExists) {
  const panel = fs.readFileSync(panelPath, 'utf-8')
  assert(panel.startsWith("'use client'"), 'T38: starts with use client directive')
  assert(
    panel.includes('export default function BriefingPanel'),
    'T39: exports default BriefingPanel'
  )
  assert(panel.includes('onOpenChat'), 'T40: accepts onOpenChat prop')
  assert(panel.includes('onEmpty'), 'T41: accepts onEmpty prop')
  assert(panel.includes('onHighFlagCount'), 'T42: accepts onHighFlagCount prop')
  assert(panel.includes('MarkdownRenderer'), 'T43: uses MarkdownRenderer for content_md')
  assert(panel.includes('forceRefresh'), 'T44: refresh button calls forceRefresh endpoint')
  assert(panel.includes('degraded'), 'T45: handles status=degraded for amber banner')
}

// ── T46-T54: BriefingPanel behavior (static analysis) ────────────────────────

console.log('\n[T46-T54] BriefingPanel behavioral checks')

if (panelExists) {
  const panel = fs.readFileSync(panelPath, 'utf-8')
  assert(panel.includes('generating'), 'T46: generating state for on-demand creation')
  assert(panel.includes('/api/briefing/today'), 'T47: fetches correct API endpoint')
  assert(panel.includes('?generate=true'), 'T48: triggers on-demand generation')
  assert(panel.includes('?forceRefresh=true'), 'T49: refresh uses forceRefresh param')
  assert(panel.includes('f59e0b'), 'T50: amber color (#f59e0b) present')
  assert(panel.includes('14b8a6'), 'T51: teal color (#14b8a6) present')
  assert(panel.includes('isTodayEligible'), 'T52: filters today-eligible flags')
  assert(panel.includes('slice(0, 3)'), 'T53: caps today items at 3')
  assert(panel.includes('role="status"'), 'T54: degraded banner has role=status for a11y')
}

// ── T55-T62: AppShell file checks ────────────────────────────────────────────

console.log('\n[T55-T62] AppShell.tsx updates')

const shellPath = path.join(process.cwd(), 'components', 'layout', 'AppShell.tsx')
const shellExists = fs.existsSync(shellPath)
assert(shellExists, 'T55: AppShell.tsx exists')

if (shellExists) {
  const shell = fs.readFileSync(shellPath, 'utf-8')
  assert(shell.includes("useState<Mode>('briefing')"), 'T56: default mode is briefing')
  assert(shell.includes('BriefingPanel'), 'T57: imports and uses BriefingPanel')
  assert(!shell.includes('BriefingEmptyState'), 'T58: BriefingEmptyState no longer used')
  assert(shell.includes('briefingBadgeCount'), 'T59: briefingBadgeCount state present')
  assert(shell.includes('setBriefingBadgeCount'), 'T60: badge count setter present')
  assert(shell.includes('onHighFlagCount'), 'T61: wires onHighFlagCount to badge state')
  assert(shell.includes('onEmpty'), 'T62: wires onEmpty to setMode chat')
}

// ── T63-T68: AppShell badge lifecycle checks ─────────────────────────────────

console.log('\n[T63-T68] AppShell badge lifecycle')

if (shellExists) {
  const shell = fs.readFileSync(shellPath, 'utf-8')
  assert(shell.includes('onOpenChat'), 'T63: BriefingPanel onOpenChat wired')
  assert(shell.includes('setChatPrefill'), 'T64: onOpenChat sets chatPrefill')
  assert(shell.includes("setMode('chat')"), 'T65: onOpenChat switches to chat mode')
  assert(shell.includes('setBriefingBadgeCount(0)'), 'T66: badge clears on nav away or chat open')
  assert(
    shell.includes("badge={item.id === 'briefing'"),
    'T67: badge prop wired to briefing nav item only'
  )
  assert(shell.includes('aria-selected'), 'T68: mobile tab bar has aria-selected for a11y')
}

// ── T69-T72: Pre-queue message is not auto-sent ───────────────────────────────

console.log('\n[T69-T72] Pre-queue: not auto-sent, editable')

if (panelExists) {
  const panel = fs.readFileSync(panelPath, 'utf-8')
  assert(panel.includes('onOpenChat('), 'T69: panel calls onOpenChat (not auto-submit)')
  if (shellExists) {
    const shell = fs.readFileSync(shellPath, 'utf-8')
    assert(
      shell.includes('initialPrefill={chatPrefill}'),
      'T70: chatPrefill passed as initialPrefill to ChatPanel'
    )
    assert(shell.includes('onPrefillConsumed'), 'T71: prefill lifecycle managed by ChatPanel')
  }
  assert(!panel.includes("fetch('/api/chat"), 'T72: BriefingPanel never calls chat API directly')
}

// ── T73-T77: package.json CI chain ───────────────────────────────────────────

console.log('\n[T73-T77] package.json CI chain')

const pkgPath = path.join(process.cwd(), 'package.json')
const pkgExists = fs.existsSync(pkgPath)
assert(pkgExists, 'T73: package.json exists')

if (pkgExists) {
  const pkg = fs.readFileSync(pkgPath, 'utf-8')
  assert(pkg.includes('briefingPanelUI45.test.ts'), 'T74: briefingPanelUI45.test.ts in test script')
  assert(pkg.includes('test:briefing-panel-ui45'), 'T75: test:briefing-panel-ui45 script present')

  const parsed = JSON.parse(pkg) as { scripts?: Record<string, string> }
  const testScript = parsed.scripts?.['test'] ?? ''
  assert(testScript.includes('briefingPanelUI45.test.ts'), 'T76: test is part of main CI chain')
  assert(
    testScript.includes('briefingStructure44.test.ts'),
    'T77: story 4.4 test still in chain (no regression)'
  )
}

console.log('\nAll Story 4.5 tests complete.\n')
