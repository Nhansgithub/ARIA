export {}
// ts-node inline tests for Story 4.4: Briefing Structure, Detection Logic & Ranking
// Pattern: no imports from project lib/ — logic simulated inline.
// Run: npx ts-node lib/__tests__/briefingStructure44.test.ts

import fs from 'fs'
import path from 'path'

// ── Helpers ───────────────────────────────────────────────────────────────────

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

// ── Inline simulation of briefing structure logic ─────────────────────────────

type DocumentType = 'proposal' | 'contract' | 'brief' | 'sop' | 'report' | 'invoice' | 'onboarding' | 'other'

interface MissingDocumentFlag {
  document_type: DocumentType
  rationale_vi: string
  rationale_en: string
}

interface DealRow {
  id: string
  title: string
  stage: string
  priority: string | null
  value_estimate: number | null
  next_action: string | null
  next_action_due: string | null
  stale_since: string | null
}

interface BriefingFlag {
  type: 'overdue' | 'stale' | 'missing_doc' | 'cadence_reminder'
  deal_id: string
  severity: 'high' | 'medium'
  label: string
}

// ── Simulation: detectMissingDocumentsByStage ─────────────────────────────────

const STAGE_REQUIRED_DOCS: { keywords: string[]; required: DocumentType[] }[] = [
  {
    keywords: ['brief', 'discovery confirmed', 'kickoff', 'onboarding', 'started', 'delivery'],
    required: ['proposal', 'contract', 'brief'],
  },
  {
    keywords: ['contract', 'hợp đồng', 'signed', 'sow', 'negotiation'],
    required: ['proposal', 'contract'],
  },
  {
    keywords: ['proposal', 'đề xuất', 'sent'],
    required: ['proposal'],
  },
]

const MISSING_DOC_RATIONALE: Record<DocumentType, { vi: string; en: string }> = {
  proposal: { vi: 'Đề xuất bằng văn bản giúp kiểm soát kỳ vọng', en: 'A written proposal sets expectations' },
  contract: { vi: 'Hợp đồng bảo vệ cả hai bên', en: 'A signed contract protects both parties' },
  brief: { vi: 'Brief giúp đồng thuận về mục tiêu', en: 'A project brief aligns everyone' },
  sop: { vi: 'SOP giúp chuẩn hóa quy trình', en: 'An SOP standardises the process' },
  report: { vi: 'Báo cáo tiến độ', en: 'A progress report' },
  invoice: { vi: 'Hóa đơn thanh toán', en: 'An invoice for payment' },
  onboarding: { vi: 'Tài liệu onboarding', en: 'An onboarding document' },
  other: { vi: 'Tài liệu cần thiết', en: 'Required document' },
}

function detectMissingDocumentsByStage(
  stage: string,
  existingDocTypes: DocumentType[]
): MissingDocumentFlag[] {
  const lower = stage.toLowerCase()
  let requiredDocs: DocumentType[] = []
  for (const rule of STAGE_REQUIRED_DOCS) {
    if (rule.keywords.some((kw) => lower.includes(kw))) {
      requiredDocs = rule.required
      break
    }
  }
  if (requiredDocs.length === 0) return []
  const existingSet = new Set(existingDocTypes)
  const flags: MissingDocumentFlag[] = []
  for (const docType of requiredDocs) {
    if (!existingSet.has(docType)) {
      const rationale = MISSING_DOC_RATIONALE[docType]
      if (rationale) flags.push({ document_type: docType, rationale_vi: rationale.vi, rationale_en: rationale.en })
    }
  }
  return flags
}

// ── Simulation: getTier ───────────────────────────────────────────────────────

const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 }

function getTier(deal: DealRow, today: string): number {
  if (deal.next_action_due && deal.next_action_due < today) return 0
  if (deal.next_action_due === today) return 1
  if (deal.next_action?.startsWith('Nhắc lần')) return 2
  if (deal.priority === 'high' && deal.stale_since !== null) return 3
  return Infinity
}

// ── Simulation: rankTodayItems ────────────────────────────────────────────────

function rankTodayItems(deals: DealRow[], today: string): DealRow[] {
  return deals
    .map((d) => ({ d, tier: getTier(d, today) }))
    .filter(({ tier }) => tier !== Infinity)
    .sort((a, b) => {
      if (a.tier !== b.tier) return a.tier - b.tier
      const pa = PRIORITY_ORDER[a.d.priority ?? ''] ?? 3
      const pb = PRIORITY_ORDER[b.d.priority ?? ''] ?? 3
      if (pa !== pb) return pa - pb
      return (b.d.value_estimate ?? 0) - (a.d.value_estimate ?? 0)
    })
    .slice(0, 3)
    .map(({ d }) => d)
}

// ── Simulation: computeStructuredFlags ───────────────────────────────────────

function computeStructuredFlags(
  deals: DealRow[],
  docsByDeal: Map<string, string[]>,
  today: string
): BriefingFlag[] {
  const flags: BriefingFlag[] = []
  for (const deal of deals) {
    if (deal.next_action_due && deal.next_action_due < today) {
      flags.push({
        type: 'overdue',
        deal_id: deal.id,
        severity: 'high',
        label: `${deal.title}: next action overdue since ${deal.next_action_due}`,
      })
    }
    if (deal.stale_since !== null) {
      const daysStale = Math.floor(
        (new Date(today + 'T00:00:00Z').getTime() -
          new Date(deal.stale_since + 'T00:00:00Z').getTime()) /
          86_400_000
      )
      flags.push({
        type: 'stale',
        deal_id: deal.id,
        severity: deal.priority === 'high' ? 'high' : 'medium',
        label: `${deal.title}: no activity for ${daysStale} days`,
      })
    }
    // Only when not already overdue (overdue takes precedence over cadence_reminder)
    if (
      (!deal.next_action_due || deal.next_action_due >= today) &&
      deal.next_action?.startsWith('Nhắc lần')
    ) {
      flags.push({
        type: 'cadence_reminder',
        deal_id: deal.id,
        severity: 'medium',
        label: deal.next_action,
      })
    }
    const existingTypes = (docsByDeal.get(deal.id) ?? []) as DocumentType[]
    const missingFlags = detectMissingDocumentsByStage(deal.stage, existingTypes)
    for (const mf of missingFlags) {
      flags.push({
        type: 'missing_doc',
        deal_id: deal.id,
        severity: 'medium',
        label: `${deal.title}: missing ${mf.document_type}`,
      })
    }
  }
  return flags
}

// ── Test data helpers ─────────────────────────────────────────────────────────

const TODAY = '2026-06-30'
const YESTERDAY = '2026-06-29'
const TOMORROW = '2026-07-01'

function makeDeal(overrides: Partial<DealRow> & { id: string; title: string; stage: string }): DealRow {
  return {
    priority: null,
    value_estimate: null,
    next_action: null,
    next_action_due: null,
    stale_since: null,
    ...overrides,
  }
}

// ── Tests: detectMissingDocumentsByStage ─────────────────────────────────────

console.log('\n▸ detectMissingDocumentsByStage — pure function')

// T1-T5: stage matching
assert(
  detectMissingDocumentsByStage('Proposal sent', []).some((f) => f.document_type === 'proposal'),
  'T1: proposal stage with no docs → missing proposal'
)
assert(
  detectMissingDocumentsByStage('Proposal sent', ['proposal']).length === 0,
  'T2: proposal stage with existing proposal → no missing'
)
assert(
  detectMissingDocumentsByStage('Contract review', []).length === 2,
  'T3: contract stage with no docs → missing proposal + contract'
)
assert(
  detectMissingDocumentsByStage('Contract review', ['proposal']).length === 1,
  'T4: contract stage with proposal → only contract missing'
)
assert(
  detectMissingDocumentsByStage('Contract review', ['proposal', 'contract']).length === 0,
  'T5: contract stage fully covered → no missing'
)

// T6-T10: stage keywords
assert(
  detectMissingDocumentsByStage('đề xuất đã gửi', []).some((f) => f.document_type === 'proposal'),
  'T6: Vietnamese proposal keyword → missing proposal'
)
assert(
  detectMissingDocumentsByStage('hợp đồng ký', []).length === 2,
  'T7: Vietnamese contract keyword → missing proposal + contract'
)
assert(
  detectMissingDocumentsByStage('kickoff', []).length === 3,
  'T8: kickoff stage → missing proposal + contract + brief'
)
assert(
  detectMissingDocumentsByStage('Discovery', []).length === 0,
  'T9: discovery stage (no keyword match) → no required docs'
)
assert(
  detectMissingDocumentsByStage('', []).length === 0,
  'T10: empty stage → no required docs'
)

// T11-T13: rationale included
const proposalFlags = detectMissingDocumentsByStage('Proposal sent', [])
const proposalFlag = proposalFlags[0]
assert(
  proposalFlags.length === 1 && proposalFlag !== undefined && typeof proposalFlag.rationale_vi === 'string' && proposalFlag.rationale_vi.length > 0,
  'T11: missing flag has non-empty rationale_vi'
)
assert(
  proposalFlags.length === 1 && proposalFlag !== undefined && typeof proposalFlag.rationale_en === 'string' && proposalFlag.rationale_en.length > 0,
  'T12: missing flag has non-empty rationale_en'
)
assert(
  detectMissingDocumentsByStage('sent quote', []).length === 1,
  'T13: "sent quote" keyword → matches proposal stage rule'
)

// ── Tests: getTier ────────────────────────────────────────────────────────────

console.log('\n▸ getTier — ranking tier assignment')

// T14-T21: tier cases
assert(
  getTier(makeDeal({ id: '1', title: 'A', stage: 'Proposal', next_action_due: YESTERDAY }), TODAY) === 0,
  'T14: past due → tier 0 (overdue)'
)
assert(
  getTier(makeDeal({ id: '1', title: 'A', stage: 'Proposal', next_action_due: TODAY }), TODAY) === 1,
  'T15: due today → tier 1'
)
assert(
  getTier(makeDeal({ id: '1', title: 'A', stage: 'Proposal', next_action: 'Nhắc lần 1: theo dõi' }), TODAY) === 2,
  'T16: cadence reminder → tier 2'
)
assert(
  getTier(makeDeal({ id: '1', title: 'A', stage: 'Discovery', priority: 'high', stale_since: '2026-06-20' }), TODAY) === 3,
  'T17: high-priority stale → tier 3'
)
assert(
  getTier(makeDeal({ id: '1', title: 'A', stage: 'Discovery', priority: 'medium', stale_since: '2026-06-20' }), TODAY) === Infinity,
  'T18: medium-priority stale → Infinity (not in Today)'
)
assert(
  getTier(makeDeal({ id: '1', title: 'A', stage: 'Discovery' }), TODAY) === Infinity,
  'T19: no flags → Infinity'
)
assert(
  getTier(makeDeal({ id: '1', title: 'A', stage: 'Proposal', next_action_due: TOMORROW }), TODAY) === Infinity,
  'T20: future due date → Infinity (not today or overdue)'
)
// Overdue takes precedence over cadence
assert(
  getTier(makeDeal({ id: '1', title: 'A', stage: 'Proposal', next_action_due: YESTERDAY, next_action: 'Nhắc lần 1' }), TODAY) === 0,
  'T21: overdue + cadence → tier 0 (overdue wins)'
)

// ── Tests: rankTodayItems ─────────────────────────────────────────────────────

console.log('\n▸ rankTodayItems — ordering and max-3 cap')

const dealOverdue = makeDeal({ id: 'a', title: 'Overdue Deal', stage: 'Proposal', next_action_due: YESTERDAY })
const dealDueToday = makeDeal({ id: 'b', title: 'Due Today', stage: 'Proposal', next_action_due: TODAY })
const dealCadence = makeDeal({ id: 'c', title: 'Cadence', stage: 'Proposal', next_action: 'Nhắc lần 1: theo dõi' })
const dealHighStale = makeDeal({ id: 'd', title: 'High Stale', stage: 'Discovery', priority: 'high', stale_since: '2026-06-20' })
const dealNone = makeDeal({ id: 'e', title: 'No Flag', stage: 'Discovery' })

// T22: overdue comes first
const ranked22 = rankTodayItems([dealDueToday, dealOverdue], TODAY)
assert(ranked22[0]?.id === 'a', 'T22: overdue deal ranked before due-today deal')

// T23: due-today before cadence
const ranked23 = rankTodayItems([dealCadence, dealDueToday], TODAY)
assert(ranked23[0]?.id === 'b', 'T23: due-today ranked before cadence reminder')

// T24: cadence before high stale
const ranked24 = rankTodayItems([dealHighStale, dealCadence], TODAY)
assert(ranked24[0]?.id === 'c', 'T24: cadence reminder ranked before high-stale')

// T25: deal with no flag excluded
const ranked25 = rankTodayItems([dealNone, dealOverdue], TODAY)
assert(ranked25.length === 1 && ranked25[0]?.id === 'a', 'T25: deal with no flag excluded from Today')

// T26: max 3 cap enforced
const manyDeals = [
  makeDeal({ id: '1', title: 'D1', stage: 'Proposal', next_action_due: YESTERDAY }),
  makeDeal({ id: '2', title: 'D2', stage: 'Proposal', next_action_due: YESTERDAY }),
  makeDeal({ id: '3', title: 'D3', stage: 'Proposal', next_action_due: TODAY }),
  makeDeal({ id: '4', title: 'D4', stage: 'Proposal', next_action_due: TODAY }),
]
assert(rankTodayItems(manyDeals, TODAY).length === 3, 'T26: max 3 today items enforced')

// T27: empty input → empty output
assert(rankTodayItems([], TODAY).length === 0, 'T27: empty deal list → empty ranked list')

// T28: within same tier, high priority ranks before medium
const highPrio = makeDeal({ id: 'h', title: 'High', stage: 'Proposal', next_action_due: YESTERDAY, priority: 'high' })
const medPrio = makeDeal({ id: 'm', title: 'Med', stage: 'Proposal', next_action_due: YESTERDAY, priority: 'medium' })
const ranked28 = rankTodayItems([medPrio, highPrio], TODAY)
assert(ranked28[0]?.id === 'h', 'T28: within same tier, high priority before medium')

// T29: within same tier+priority, higher value_estimate first
const highVal = makeDeal({ id: 'hv', title: 'HighVal', stage: 'Proposal', next_action_due: YESTERDAY, priority: 'high', value_estimate: 10000 })
const lowVal = makeDeal({ id: 'lv', title: 'LowVal', stage: 'Proposal', next_action_due: YESTERDAY, priority: 'high', value_estimate: 1000 })
const ranked29 = rankTodayItems([lowVal, highVal], TODAY)
assert(ranked29[0]?.id === 'hv', 'T29: within same tier+priority, higher value_estimate first')

// T30: null priority treated as lowest within tier
const nullPrio = makeDeal({ id: 'n', title: 'NullPrio', stage: 'Proposal', next_action_due: YESTERDAY, priority: null })
const medPrio2 = makeDeal({ id: 'm2', title: 'Med2', stage: 'Proposal', next_action_due: YESTERDAY, priority: 'medium' })
const ranked30 = rankTodayItems([nullPrio, medPrio2], TODAY)
assert(ranked30[0]?.id === 'm2', 'T30: null priority ranks after medium within same tier')

// T31: all 4 tier types sorted correctly (first 3 returned)
const ranked31 = rankTodayItems([dealHighStale, dealCadence, dealDueToday, dealOverdue], TODAY)
assert(
  ranked31[0]?.id === 'a' && ranked31[1]?.id === 'b' && ranked31[2]?.id === 'c',
  'T31: full tier order: overdue=0, due-today=1, cadence=2 (high-stale=3 excluded by cap)'
)

// ── Tests: computeStructuredFlags ────────────────────────────────────────────

console.log('\n▸ computeStructuredFlags — flag type, severity, label')

const emptyDocs = new Map<string, string[]>()

// T32: overdue deal produces overdue flag with severity:high
const overdueDeal = makeDeal({ id: 'od', title: 'OverdueDeal', stage: 'Proposal', next_action_due: YESTERDAY })
const odFlags = computeStructuredFlags([overdueDeal], emptyDocs, TODAY)
const odOverdue = odFlags.find((f) => f.type === 'overdue')
assert(odOverdue !== undefined && odOverdue.severity === 'high', 'T32: overdue flag has severity:high')

// T33: stale deal with high priority → severity:high
const highStaleDeal = makeDeal({ id: 'hs', title: 'HighStaleDeal', stage: 'Discovery', priority: 'high', stale_since: '2026-06-20' })
const hsFlags = computeStructuredFlags([highStaleDeal], emptyDocs, TODAY)
const hsStale = hsFlags.find((f) => f.type === 'stale')
assert(hsStale !== undefined && hsStale.severity === 'high', 'T33: stale deal with high priority → severity:high')

// T34: stale deal with medium priority → severity:medium
const medStaleDeal = makeDeal({ id: 'ms', title: 'MedStaleDeal', stage: 'Discovery', priority: 'medium', stale_since: '2026-06-20' })
const msFlags = computeStructuredFlags([medStaleDeal], emptyDocs, TODAY)
const msStale = msFlags.find((f) => f.type === 'stale')
assert(msStale !== undefined && msStale.severity === 'medium', 'T34: stale deal with medium priority → severity:medium')

// T35: stale deal label includes days count
const staleDeal = makeDeal({ id: 'sd', title: 'StaleDeal', stage: 'Discovery', stale_since: '2026-06-20' })
const sdFlags = computeStructuredFlags([staleDeal], emptyDocs, TODAY)
const sdStale = sdFlags.find((f) => f.type === 'stale')
assert(sdStale !== undefined && sdStale.label.includes('10 days'), 'T35: stale flag label contains days-stale count (10 days)')

// T36: cadence reminder produces cadence_reminder flag with severity:medium
const cadenceDeal = makeDeal({ id: 'cd', title: 'CadenceDeal', stage: 'Proposal', next_action: 'Nhắc lần 1: theo dõi — đã 3 ngày' })
const cdFlags = computeStructuredFlags([cadenceDeal], emptyDocs, TODAY)
const cdCadence = cdFlags.find((f) => f.type === 'cadence_reminder')
assert(cdCadence !== undefined && cdCadence.severity === 'medium', 'T36: cadence_reminder flag has severity:medium')

// T37: cadence_reminder label is the next_action string
assert(cdCadence !== undefined && cdCadence.label === 'Nhắc lần 1: theo dõi — đã 3 ngày', 'T37: cadence_reminder label is the next_action string')

// T38: proposal stage missing doc → missing_doc flag
const proposalDeal = makeDeal({ id: 'pd', title: 'PropDeal', stage: 'Proposal sent' })
const pdFlags = computeStructuredFlags([proposalDeal], emptyDocs, TODAY)
const pdMissing = pdFlags.find((f) => f.type === 'missing_doc')
assert(pdMissing !== undefined, 'T38: proposal stage with no docs → missing_doc flag generated')

// T39: missing_doc flag has severity:medium
assert(pdMissing !== undefined && pdMissing.severity === 'medium', 'T39: missing_doc flag has severity:medium')

// T40: missing_doc label contains deal title and doc type
assert(
  pdMissing !== undefined && pdMissing.label.includes('PropDeal') && pdMissing.label.includes('proposal'),
  'T40: missing_doc label includes deal title and document type'
)

// T41: existing proposal → no missing_doc flag
const docsWithProp = new Map([['pd', ['proposal']]])
const pdFlagsWithDoc = computeStructuredFlags([proposalDeal], docsWithProp, TODAY)
assert(
  pdFlagsWithDoc.filter((f) => f.type === 'missing_doc').length === 0,
  'T41: existing proposal doc → no missing_doc flag for that deal'
)

// T42: deal with no flags → no flags output
const cleanDeal = makeDeal({ id: 'cl', title: 'Clean', stage: 'Discovery' })
const cleanFlags = computeStructuredFlags([cleanDeal], emptyDocs, TODAY)
assert(cleanFlags.length === 0, 'T42: deal with no flags → empty flags output')

// T43: multiple deals → flags for each
const multiDeals = [overdueDeal, staleDeal]
const multiFlags = computeStructuredFlags(multiDeals, emptyDocs, TODAY)
assert(
  multiFlags.some((f) => f.deal_id === 'od') && multiFlags.some((f) => f.deal_id === 'sd'),
  'T43: flags from multiple deals all included'
)

// T44: each flag has all required fields
const allFlags = computeStructuredFlags([overdueDeal, staleDeal], emptyDocs, TODAY)
const allHaveFields = allFlags.every(
  (f) => typeof f.type === 'string' && typeof f.deal_id === 'string' && typeof f.severity === 'string' && typeof f.label === 'string'
)
assert(allHaveFields, 'T44: every flag has type, deal_id, severity, label fields')

// T45: high_flag_count computed correctly
const highFlagCount = allFlags.filter((f) => f.severity === 'high').length
assert(highFlagCount >= 1, 'T45: at least one severity:high flag from overdue + stale-high-priority set')

// T76: overdue deal with cadence next_action → only overdue flag, no cadence_reminder (P2-3 fix)
const overdueCadenceDeal = makeDeal({
  id: 'oc',
  title: 'OverdueCadence',
  stage: 'Proposal',
  next_action_due: YESTERDAY,
  next_action: 'Nhắc lần 1: theo dõi — đã 3 ngày',
})
const ocFlags = computeStructuredFlags([overdueCadenceDeal], emptyDocs, TODAY)
assert(ocFlags.some((f) => f.type === 'overdue'), 'T76a: overdue deal emits overdue flag')
assert(!ocFlags.some((f) => f.type === 'cadence_reminder'), 'T76b: overdue deal does NOT also emit cadence_reminder (overdue takes precedence)')

// ── Tests: file structure — briefingService.ts ────────────────────────────────

console.log('\n▸ briefingService.ts — file structure & API compliance')

const briefingPath = path.join(process.cwd(), 'lib', 'crm', 'briefingService.ts')
const briefingContent = fs.existsSync(briefingPath) ? fs.readFileSync(briefingPath, 'utf8') : ''

// T46: starts with server-only (AD-11)
assert(briefingContent.trimStart().startsWith("import 'server-only'"), "T46: briefingService starts with import 'server-only' (AD-11)")

// T47: imports detectMissingDocumentsByStage from missingDocumentService
assert(
  briefingContent.includes('detectMissingDocumentsByStage') && briefingContent.includes('missingDocumentService'),
  'T47: briefingService imports detectMissingDocumentsByStage from missingDocumentService'
)

// T48: exports BriefingFlag type
assert(briefingContent.includes('export interface BriefingFlag'), 'T48: BriefingFlag interface is exported')

// T49: BriefingFlag has all required flag type values
assert(
  briefingContent.includes("'overdue' | 'stale' | 'missing_doc' | 'cadence_reminder'"),
  "T49: BriefingFlag type field includes all four flag types"
)

// T50: BriefingFlag severity field
assert(
  briefingContent.includes("severity: 'high' | 'medium'"),
  "T50: BriefingFlag severity field is 'high' | 'medium'"
)

// T51: DealRow includes id and priority fields
assert(briefingContent.includes('priority: string | null'), 'T51: DealRow interface includes priority field')

// T52: DocRow includes deal_id field
assert(briefingContent.includes('deal_id: string'), 'T52: DocRow interface includes deal_id field')

// T53: doc query selects deal_id
assert(
  briefingContent.includes("'deal_id, type, status'") || briefingContent.includes("deal_id, type"),
  'T53: doc query selects deal_id'
)

// T54: deal query selects id and priority
assert(
  briefingContent.includes('id, title, stage, priority') || briefingContent.includes("'id, title, stage, priority"),
  'T54: deal query selects id, title, stage, priority'
)

// T55: getTier function exported
assert(briefingContent.includes('export function getTier'), 'T55: getTier function is exported')

// T56: rankTodayItems function exported
assert(briefingContent.includes('export function rankTodayItems'), 'T56: rankTodayItems function is exported')

// T57: computeStructuredFlags function exported
assert(briefingContent.includes('export function computeStructuredFlags'), 'T57: computeStructuredFlags function is exported')

// T58: flags payload has items key
assert(briefingContent.includes('items: structuredFlags'), 'T58: flags payload includes items: structuredFlags')

// T59: AD-2 compliance — owner_id on all queries
const ownerIdCount = (briefingContent.match(/'owner_id'/g) ?? []).length
assert(ownerIdCount >= 4, 'T59: at least 4 owner_id references across queries (AD-2)')

// T60: uses createServiceClient (AD-13 — cron path)
assert(briefingContent.includes('createServiceClient()'), 'T60: uses createServiceClient (AD-13 — cron/system path)')

// T61: uses ARIA_MODELS.economical (AD-4 — Haiku)
assert(briefingContent.includes('ARIA_MODELS.economical'), 'T61: uses ARIA_MODELS.economical for Haiku (AD-4)')

// T62-T66: system prompt contains all 5 section keywords
const promptIdx = briefingContent.indexOf('BRIEFING_SYSTEM_PROMPT')
const promptSection = briefingContent.slice(promptIdx, promptIdx + 3000)
assert(promptSection.includes('Today') || promptSection.includes('Hôm nay'), 'T62: system prompt references Today / Hôm nay section')
assert(promptSection.includes('Pipeline Snapshot') || promptSection.includes('pipeline'), 'T63: system prompt references Pipeline Snapshot section')
assert(promptSection.includes('Documents Pending') || promptSection.includes('Tài liệu'), 'T64: system prompt references Documents Pending section')
assert(promptSection.includes('This Week') || promptSection.includes('Trọng tâm'), 'T65: system prompt references This Week Focus section')
assert(promptSection.includes('Slow') || promptSection.includes('chậm'), 'T66: system prompt references Slow-Moving Deals section')

// T67: system prompt says max 3 for Today
assert(promptSection.includes('max 3') || promptSection.includes('3 items'), 'T67: system prompt specifies max 3 Today items')

// T68: degraded fallback preserved from Story 4.3
assert(briefingContent.includes("status: 'degraded'"), "T68: degraded fallback preserved (AD-6)")

// T69: upsert uses onConflict owner_id,date (AD-7)
assert(briefingContent.includes("onConflict: 'owner_id,date'"), 'T69: upsert uses onConflict owner_id,date (AD-7)')

// ── Tests: file structure — missingDocumentService.ts ───────────────────────

console.log('\n▸ missingDocumentService.ts — pure function added')

const missingDocPath = path.join(process.cwd(), 'lib', 'crm', 'missingDocumentService.ts')
const missingDocContent = fs.existsSync(missingDocPath) ? fs.readFileSync(missingDocPath, 'utf8') : ''

// T70: starts with server-only (AD-11)
assert(missingDocContent.trimStart().startsWith("import 'server-only'"), "T70: missingDocumentService starts with import 'server-only' (AD-11)")

// T71: detectMissingDocumentsByStage is exported as a non-async function
assert(
  missingDocContent.includes('export function detectMissingDocumentsByStage'),
  'T71: detectMissingDocumentsByStage exported as a sync (pure) function'
)

// T72: no DB call (no supabase) inside detectMissingDocumentsByStage body
const pureStart = missingDocContent.indexOf('export function detectMissingDocumentsByStage')
const pureEnd = missingDocContent.indexOf('\nexport async function detectMissingDocuments', pureStart)
const pureBody = pureEnd > pureStart
  ? missingDocContent.slice(pureStart, pureEnd)
  : missingDocContent.slice(pureStart, pureStart + 800)
assert(!pureBody.includes('supabase'), 'T72: detectMissingDocumentsByStage has no supabase DB calls (pure function)')

// T73: original detectMissingDocuments still present (no regression)
assert(
  missingDocContent.includes('export async function detectMissingDocuments('),
  'T73: original async detectMissingDocuments still present (no regression)'
)

// T74: pure function uses STAGE_REQUIRED_DOCS (shared rules)
assert(pureBody.includes('STAGE_REQUIRED_DOCS'), 'T74: pure function uses STAGE_REQUIRED_DOCS (shared rule set)')

// T75: pure function uses MISSING_DOC_RATIONALE (shared rationale)
assert(pureBody.includes('MISSING_DOC_RATIONALE'), 'T75: pure function uses MISSING_DOC_RATIONALE')

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(60)}`)
console.log(`Story 4.4 tests: ${passed} passed, ${failed} failed`)
if (failed > 0) {
  console.error(`\n✗ ${failed} test(s) failed`)
  process.exit(1)
} else {
  console.log(`\n✓ All ${passed} tests passed`)
}
