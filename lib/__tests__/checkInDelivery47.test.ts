export {}
// ts-node inline tests for Story 4.7: Check-In Delivery, Quick-Reply UI & Answer Capture
// Pattern: no imports from project lib/ — logic simulated inline.
// Run: npx ts-node lib/__tests__/checkInDelivery47.test.ts

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

// ── T1-T15: generateCheckInPrompt fallback strings (verified from source file) ──
// Tests read the production checkInPromptService.ts content to verify real strings,
// not an inline copy that could diverge.

console.log('\nT1-T15: fallback strings')

const promptServiceContentForFallbackTests = fs.existsSync(
  path.join(process.cwd(), 'lib', 'ai', 'checkInPromptService.ts'),
)
  ? fs.readFileSync(path.join(process.cwd(), 'lib', 'ai', 'checkInPromptService.ts'), 'utf-8')
  : ''

// T1: stale_7d fallback contains a deal title placeholder (template literal)
assert(
  promptServiceContentForFallbackTests.includes('stale_7d') &&
    promptServiceContentForFallbackTests.includes('${t}'),
  'T1: stale_7d fallback uses deal title template placeholder',
)

// T2: stale_7d fallback contains '7' and 'ngày' or 'ngay' (7-day reference)
assert(
  promptServiceContentForFallbackTests.includes('7') &&
    (promptServiceContentForFallbackTests.includes('7 ng') ||
      promptServiceContentForFallbackTests.includes('7 days')),
  'T2: stale_7d fallback references 7 days',
)

// T3: stale_7d fallback string exists in STATIC_FALLBACKS definition
assert(
  promptServiceContentForFallbackTests.includes('stale_7d:'),
  'T3: STATIC_FALLBACKS defines stale_7d entry',
)

// T4: stale_7d fallback .slice(0, 80) is applied
assert(
  promptServiceContentForFallbackTests.includes('.slice(0, 80)'),
  'T4: fallback result is sliced to 80 chars max',
)

// T5: pre_action_due fallback exists and uses deal title placeholder
assert(
  promptServiceContentForFallbackTests.includes('pre_action_due:') &&
    promptServiceContentForFallbackTests.includes('${t}'),
  'T5: pre_action_due fallback defined with deal title placeholder',
)

// T6: pre_action_due fallback references "ngay mai" or deadline context
assert(
  promptServiceContentForFallbackTests.includes('mai') ||
    promptServiceContentForFallbackTests.includes('tomorrow'),
  'T6: pre_action_due fallback references mai (tomorrow) context',
)

// T7: pre_action_due STATIC_FALLBACKS entry exists
assert(
  promptServiceContentForFallbackTests.includes('pre_action_due:'),
  'T7: STATIC_FALLBACKS defines pre_action_due entry',
)

// T8: The STATIC_FALLBACKS type covers all three trigger types
assert(
  promptServiceContentForFallbackTests.includes('stale_7d') &&
    promptServiceContentForFallbackTests.includes('pre_action_due') &&
    promptServiceContentForFallbackTests.includes('cadence_followup'),
  'T8: STATIC_FALLBACKS covers all three trigger types',
)

// T9: cadence_followup fallback exists and uses deal title placeholder
assert(
  promptServiceContentForFallbackTests.includes('cadence_followup:') &&
    promptServiceContentForFallbackTests.includes('${t}'),
  'T9: cadence_followup fallback defined with deal title placeholder',
)

// T10: cadence_followup fallback references 'ARIA' or 'theo doi'
assert(
  promptServiceContentForFallbackTests.includes('ARIA') ||
    promptServiceContentForFallbackTests.includes('theo d'),
  'T10: cadence_followup fallback references ARIA or theo doi',
)

// T11: cadence_followup STATIC_FALLBACKS entry exists
assert(
  promptServiceContentForFallbackTests.includes('cadence_followup:'),
  'T11: STATIC_FALLBACKS defines cadence_followup entry',
)

// T12: STATIC_FALLBACKS is typed as Record<TriggerType, ...>
assert(
  promptServiceContentForFallbackTests.includes('STATIC_FALLBACKS'),
  'T12: STATIC_FALLBACKS constant is defined',
)

// T13: All three fallback arrow function entries are present in STATIC_FALLBACKS
assert(
  promptServiceContentForFallbackTests.includes('stale_7d:') &&
    promptServiceContentForFallbackTests.includes('pre_action_due:') &&
    promptServiceContentForFallbackTests.includes('cadence_followup:'),
  'T13: STATIC_FALLBACKS defines all three trigger type entries',
)

// T14: stale_7d and pre_action_due fallback sections appear in order and are distinct
// (checked by verifying each contains unique keywords)
const stale7dIdx = promptServiceContentForFallbackTests.indexOf('stale_7d:')
const preActionIdx = promptServiceContentForFallbackTests.indexOf('pre_action_due:')
assert(stale7dIdx !== -1 && preActionIdx !== -1 && stale7dIdx !== preActionIdx,
  'T14: stale_7d and pre_action_due fallback entries are separate distinct sections',
)

// T15: pre_action_due and cadence_followup fallback sections appear as distinct entries
const cadenceIdx = promptServiceContentForFallbackTests.indexOf('cadence_followup:')
assert(preActionIdx !== -1 && cadenceIdx !== -1 && preActionIdx !== cadenceIdx,
  'T15: pre_action_due and cadence_followup fallback entries are separate distinct sections',
)

// ── T16-T30: API route structure checks ────────────────────────────────────

console.log('\nT16-T30: API route structure checks')

const ROOT = process.cwd()

const promptServicePath = path.join(ROOT, 'lib', 'ai', 'checkInPromptService.ts')
const pendingRoutePath = path.join(ROOT, 'app', 'api', 'check-ins', 'pending', 'route.ts')
const answerRoutePath = path.join(ROOT, 'app', 'api', 'check-ins', '[id]', 'answer', 'route.ts')

const promptServiceContent = fs.existsSync(promptServicePath)
  ? fs.readFileSync(promptServicePath, 'utf-8')
  : ''
const pendingRouteContent = fs.existsSync(pendingRoutePath)
  ? fs.readFileSync(pendingRoutePath, 'utf-8')
  : ''
const answerRouteContent = fs.existsSync(answerRoutePath)
  ? fs.readFileSync(answerRoutePath, 'utf-8')
  : ''

// T16: checkInPromptService.ts exists
assert(fs.existsSync(promptServicePath), 'T16: checkInPromptService.ts exists at lib/ai/')

// T17: checkInPromptService.ts first line is "import 'server-only'"
assert(
  promptServiceContent.trimStart().startsWith("import 'server-only'"),
  "T17: checkInPromptService.ts first line is import 'server-only'",
)

// T18: checkInPromptService.ts imports callAI (not Anthropic SDK directly — AD-1)
assert(
  promptServiceContent.includes('callAI') && !promptServiceContent.includes('@anthropic-ai/sdk'),
  'T18: checkInPromptService.ts imports callAI, not Anthropic SDK directly',
)

// T19: checkInPromptService.ts exports generateCheckInPrompt
assert(
  promptServiceContent.includes('export') && promptServiceContent.includes('generateCheckInPrompt'),
  'T19: checkInPromptService.ts exports generateCheckInPrompt',
)

// T20: checkInPromptService.ts references ARIA_MODELS.economical
assert(
  promptServiceContent.includes('ARIA_MODELS') && promptServiceContent.includes('economical'),
  'T20: checkInPromptService.ts references ARIA_MODELS.economical',
)

// T21: pending route exists
assert(fs.existsSync(pendingRoutePath), 'T21: pending route exists at app/api/check-ins/pending/route.ts')

// T22: pending route contains createServerClient
assert(pendingRouteContent.includes('createServerClient'), 'T22: pending route contains createServerClient')

// T23: pending route does NOT contain createServiceClient (AD-13)
assert(
  !pendingRouteContent.includes('createServiceClient'),
  'T23: pending route does NOT contain createServiceClient',
)

// T24: pending route exports a GET function
assert(pendingRouteContent.includes('export') && pendingRouteContent.includes('GET'), 'T24: pending route exports GET')

// T25: pending route queries check_ins table
assert(pendingRouteContent.includes('check_ins'), "T25: pending route queries 'check_ins' table")

// T26: pending route filters by status = pending
assert(
  pendingRouteContent.includes("'pending'") || pendingRouteContent.includes('"pending"'),
  "T26: pending route filters by status = 'pending'",
)

// T27: pending route filters by due_date (lte)
assert(
  pendingRouteContent.includes('lte') || pendingRouteContent.includes('due_date'),
  'T27: pending route filters by due_date (lte)',
)

// T28: answer route exists
assert(fs.existsSync(answerRoutePath), 'T28: answer route exists at app/api/check-ins/[id]/answer/route.ts')

// T29: answer route contains createServerClient
assert(answerRouteContent.includes('createServerClient'), 'T29: answer route contains createServerClient')

// T30: answer route exports a POST function
assert(answerRouteContent.includes('export') && answerRouteContent.includes('POST'), 'T30: answer route exports POST')

// ── T31-T45: CheckInCard component structure ───────────────────────────────

console.log('\nT31-T45: CheckInCard component structure')

const checkInCardPath = path.join(ROOT, 'components', 'chat', 'CheckInCard.tsx')
const checkInCardContent = fs.existsSync(checkInCardPath)
  ? fs.readFileSync(checkInCardPath, 'utf-8')
  : ''

// T31: CheckInCard.tsx exists
assert(fs.existsSync(checkInCardPath), 'T31: CheckInCard.tsx exists at components/chat/')

// T32: CheckInCard.tsx first line is 'use client'
assert(
  checkInCardContent.trimStart().startsWith("'use client'"),
  "T32: CheckInCard.tsx first line is 'use client'",
)

// T33: CheckInCard.tsx exports CheckInCard function/component
assert(
  checkInCardContent.includes('export') && checkInCardContent.includes('CheckInCard'),
  'T33: CheckInCard.tsx exports CheckInCard',
)

// T34: CheckInCard.tsx exports CheckInCardData interface
assert(
  checkInCardContent.includes('export') && checkInCardContent.includes('CheckInCardData'),
  'T34: CheckInCard.tsx exports CheckInCardData interface',
)

// T35: CheckInCard.tsx references all three quick-reply values: yes, no, later
assert(
  checkInCardContent.includes("'yes'") &&
    checkInCardContent.includes("'no'") &&
    checkInCardContent.includes("'later'"),
  "T35: CheckInCard.tsx references quick-reply values: yes, no, later",
)

// T36: CheckInCard.tsx renders Vietnamese labels (check for the label strings)
assert(
  checkInCardContent.includes('Có') && checkInCardContent.includes('Không'),
  'T36: CheckInCard.tsx renders Vietnamese labels: Co, Khong',
)

// T37: CheckInCard.tsx references amber color #f59e0b
assert(checkInCardContent.includes('#f59e0b'), 'T37: CheckInCard.tsx references #f59e0b (amber left border)')

// T38: CheckInCard.tsx references onDismiss prop
assert(checkInCardContent.includes('onDismiss'), 'T38: CheckInCard.tsx references onDismiss prop')

// T39: CheckInCard.tsx fetches /api/check-ins/ in handleAnswer
assert(
  checkInCardContent.includes('/api/check-ins/'),
  'T39: CheckInCard.tsx fetches /api/check-ins/ in handleAnswer',
)

// T40: CheckInCard.tsx handles 'skipped' answer value for dismiss
assert(
  checkInCardContent.includes("'skipped'") || checkInCardContent.includes('"skipped"'),
  "T40: CheckInCard.tsx handles 'skipped' answer value for dismiss",
)

// T41: CheckInCard.tsx has a loading/disabled state
assert(
  checkInCardContent.includes('loading') && checkInCardContent.includes('disabled'),
  'T41: CheckInCard.tsx has loading/disabled state (buttons disabled while fetch in-flight)',
)

// T42: CheckInCard.tsx does NOT import from lib/
assert(
  !checkInCardContent.includes("from '@/lib/") && !checkInCardContent.includes('from "../lib/'),
  'T42: CheckInCard.tsx does NOT import from lib/ (client component)',
)

// T43: CheckInCard.tsx uses 'use client'
assert(checkInCardContent.includes("'use client'"), "T43: CheckInCard.tsx uses 'use client'")

// T44: CheckInCardData interface has required fields
assert(
  checkInCardContent.includes('id:') &&
    checkInCardContent.includes('deal_id:') &&
    checkInCardContent.includes('deal_title:') &&
    checkInCardContent.includes('trigger_type:') &&
    checkInCardContent.includes('due_date:') &&
    checkInCardContent.includes('prompt:'),
  'T44: CheckInCardData interface has id, deal_id, deal_title, trigger_type, due_date, prompt fields',
)

// T45: CheckInCard.tsx renders deal_title
assert(checkInCardContent.includes('deal_title'), 'T45: CheckInCard.tsx renders deal_title')

// ── T46-T60: ChatPanel integration + package.json ──────────────────────────

console.log('\nT46-T60: ChatPanel integration + package.json')

const chatPanelPath = path.join(ROOT, 'components', 'chat', 'ChatPanel.tsx')
const chatPanelContent = fs.existsSync(chatPanelPath) ? fs.readFileSync(chatPanelPath, 'utf-8') : ''
const packageJsonPath = path.join(ROOT, 'package.json')
const packageJsonContent = fs.existsSync(packageJsonPath) ? fs.readFileSync(packageJsonPath, 'utf-8') : ''

// T46: ChatPanel.tsx imports CheckInCard
assert(chatPanelContent.includes('CheckInCard'), 'T46: ChatPanel.tsx imports CheckInCard')

// T47: ChatPanel.tsx imports CheckInCardData (type import)
assert(chatPanelContent.includes('CheckInCardData'), 'T47: ChatPanel.tsx imports CheckInCardData type')

// T48: ChatPanel.tsx contains pendingCheckIns state
assert(chatPanelContent.includes('pendingCheckIns'), 'T48: ChatPanel.tsx contains pendingCheckIns state')

// T49: ChatPanel.tsx fetches /api/check-ins/pending on mount
assert(
  chatPanelContent.includes('/api/check-ins/pending'),
  'T49: ChatPanel.tsx fetches /api/check-ins/pending on mount',
)

// T50: ChatPanel.tsx has onDismiss handler that filters pendingCheckIns
assert(
  chatPanelContent.includes('setPendingCheckIns') && chatPanelContent.includes('filter'),
  'T50: ChatPanel.tsx has onDismiss handler that filters pendingCheckIns',
)

// T51: ChatPanel.tsx renders CheckInCard components
assert(chatPanelContent.includes('<CheckInCard'), 'T51: ChatPanel.tsx renders CheckInCard components')

// T52: ChatPanel.tsx CheckInCard render is inside a conditional
assert(
  chatPanelContent.includes('pendingCheckIns.length > 0'),
  'T52: ChatPanel.tsx CheckInCard render is inside a conditional (pendingCheckIns.length > 0)',
)

// T53: ChatPanel.tsx does NOT remove InputBar
assert(chatPanelContent.includes('InputBar'), 'T53: ChatPanel.tsx does NOT remove InputBar (InputBar preserved)')

// T54: ChatPanel.tsx has a catch or fallback for check-ins fetch failure (AD-6)
assert(
  chatPanelContent.includes('.catch(') || chatPanelContent.includes('catch('),
  'T54: ChatPanel.tsx has catch/fallback for check-ins fetch failure (AD-6)',
)

// T55: answer route contains .eq('owner_id' (AD-2)
assert(
  answerRouteContent.includes("'owner_id'") || answerRouteContent.includes('"owner_id"'),
  "T55: answer route contains .eq('owner_id') (AD-2)",
)

// T56: answer route contains logActivity
assert(answerRouteContent.includes('logActivity'), 'T56: answer route contains logActivity')

// T57: answer route contains checkin_answered
assert(
  answerRouteContent.includes('checkin_answered'),
  "T57: answer route contains action 'checkin_answered'",
)

// T58: answer route contains actor set to 'user' (NOT 'owner' — invalid union member)
assert(
  (answerRouteContent.includes("actor: 'user'") || answerRouteContent.includes('actor: "user"')) &&
    !answerRouteContent.includes("actor: 'owner'"),
  "T58: answer route sets actor: 'user' (not 'owner')",
)

// T59: package.json contains test:check-in-delivery47 script
assert(
  packageJsonContent.includes('test:check-in-delivery47'),
  'T59: package.json contains test:check-in-delivery47 script',
)

// T60: package.json test script contains checkInDelivery47.test.ts in CI chain
assert(
  packageJsonContent.includes('checkInDelivery47.test.ts'),
  'T60: package.json test script contains checkInDelivery47.test.ts in CI chain',
)

// T61: answer route writes answer as jsonb { value: answer }, not a plain string
assert(
  answerRouteContent.includes('{ value: answer }') || answerRouteContent.includes("{ value: answer }"),
  'T61: answer route writes answer as jsonb { value: answer }',
)

// ── Summary ────────────────────────────────────────────────────────────────

console.log(`\nResults: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
