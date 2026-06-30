export {}
// ts-node inline tests for Story 3.5: Missing Document Detection and Teaching
// Pattern: no imports from project lib/ — logic is simulated inline.
// Run: npx ts-node lib/__tests__/missingDocumentDetection35.test.ts

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

// ── Inline type mirrors (no project imports) ──────────────────────────────────

type DocumentType =
  | 'proposal'
  | 'contract'
  | 'brief'
  | 'sop'
  | 'report'
  | 'invoice'
  | 'onboarding'
  | 'other'

interface MissingDocumentFlag {
  document_type: DocumentType
  rationale_vi: string
  rationale_en: string
}

// ── Inline detection logic (mirrors missingDocumentService.ts) ────────────────

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
  proposal: {
    vi: 'Đề xuất bằng văn bản giúp anh kiểm soát kỳ vọng và có căn cứ để theo dõi — không có nó, khách dễ hiểu sai phạm vi.',
    en: 'A written proposal sets expectations and creates an accountability baseline — without it, scope misalignment is hard to catch early.',
  },
  contract: {
    vi: 'Hợp đồng bảo vệ cả hai bên nếu có tranh chấp về phạm vi hoặc thanh toán — anh nên có bản ký trước khi bắt đầu.',
    en: 'A signed contract protects both parties if scope or payment disputes arise — you should have it before work begins.',
  },
  brief: {
    vi: 'Brief giúp cả team và khách đồng thuận về mục tiêu trước khi thực hiện — thiếu nó thường dẫn đến scope creep.',
    en: 'A project brief aligns everyone on goals before execution — missing it is the most common cause of scope creep.',
  },
  sop: { vi: 'SOP placeholder', en: 'SOP placeholder' },
  report: { vi: 'Report placeholder', en: 'Report placeholder' },
  invoice: { vi: 'Invoice placeholder', en: 'Invoice placeholder' },
  onboarding: { vi: 'Onboarding placeholder', en: 'Onboarding placeholder' },
  other: { vi: 'Other placeholder', en: 'Other placeholder' },
}

interface SimDeal {
  stage: string
  status?: string
  predicted_outcome?: string
}

interface SimDoc {
  type: DocumentType
  status: 'draft' | 'review' | 'sent' | 'signed' | 'archived'
}

function simulateDetect(deal: SimDeal, existingDocs: SimDoc[]): MissingDocumentFlag[] {
  // Suppress for archived / likely_lost
  if (deal.status === 'archived' || deal.predicted_outcome === 'likely_lost') return []

  const stage = (deal.stage ?? '').toLowerCase()

  let requiredDocs: DocumentType[] = []
  for (const rule of STAGE_REQUIRED_DOCS) {
    if (rule.keywords.some((kw) => stage.includes(kw))) {
      requiredDocs = rule.required
      break
    }
  }

  if (requiredDocs.length === 0) return []

  const activeStatuses = new Set(['draft', 'review', 'sent', 'signed'])
  const existingTypes = new Set(
    existingDocs.filter((d) => activeStatuses.has(d.status)).map((d) => d.type)
  )

  const flags: MissingDocumentFlag[] = []
  for (const docType of requiredDocs) {
    if (!existingTypes.has(docType)) {
      const rationale = MISSING_DOC_RATIONALE[docType]
      flags.push({
        document_type: docType,
        rationale_vi: rationale.vi,
        rationale_en: rationale.en,
      })
    }
  }
  return flags
}

// ── Tests ─────────────────────────────────────────────────────────────────────

console.log('\nStory 3.5 — Missing Document Detection Tests\n')

// T1: STAGE_REQUIRED_DOCS has entries for proposal, contract, and delivery stages
console.log('T1: STAGE_REQUIRED_DOCS mapping correctness')
{
  const proposalRule = STAGE_REQUIRED_DOCS.find((r) => r.keywords.includes('proposal'))
  const contractRule = STAGE_REQUIRED_DOCS.find((r) => r.keywords.includes('contract'))
  const kickoffRule = STAGE_REQUIRED_DOCS.find((r) => r.keywords.includes('kickoff'))

  assert(proposalRule !== undefined, 'proposal rule exists')
  assert(proposalRule?.required.includes('proposal') === true, 'proposal rule requires proposal doc')
  assert(contractRule !== undefined, 'contract rule exists')
  assert(contractRule?.required.includes('proposal') === true, 'contract rule requires proposal doc')
  assert(contractRule?.required.includes('contract') === true, 'contract rule requires contract doc')
  assert(kickoffRule !== undefined, 'kickoff/delivery rule exists')
  assert(kickoffRule?.required.includes('brief') === true, 'delivery rule requires brief doc')
}

// T2: Proposal stage, no existing docs → proposal flag returned
console.log('\nT2: Proposal stage, no docs → proposal flagged')
{
  const flags = simulateDetect({ stage: 'proposal' }, [])
  assert(flags.length === 1, 'exactly 1 flag returned')
  assert(flags[0]?.document_type === 'proposal', 'flag is for proposal')
  assert(typeof flags[0]?.rationale_vi === 'string' && flags[0].rationale_vi.length > 10, 'VI rationale is non-empty')
  assert(typeof flags[0]?.rationale_en === 'string' && flags[0].rationale_en.length > 10, 'EN rationale is non-empty')
}

// T3: Contract stage, no docs → both proposal and contract flagged
console.log('\nT3: Contract stage, no docs → proposal + contract flagged')
{
  const flags = simulateDetect({ stage: 'contract stage' }, [])
  const types = flags.map((f) => f.document_type)
  assert(flags.length === 2, 'exactly 2 flags returned')
  assert(types.includes('proposal'), 'proposal is flagged')
  assert(types.includes('contract'), 'contract is flagged')
}

// T4: Contract stage, proposal already exists → only contract flagged
console.log('\nT4: Contract stage, proposal present → only contract flagged')
{
  const flags = simulateDetect({ stage: 'contract stage' }, [
    { type: 'proposal', status: 'sent' },
  ])
  assert(flags.length === 1, 'exactly 1 flag returned')
  assert(flags[0]?.document_type === 'contract', 'flag is for contract')
}

// T5: Kickoff stage, no docs → proposal + contract + brief all flagged
console.log('\nT5: Kickoff stage, no docs → 3 flags')
{
  const flags = simulateDetect({ stage: 'kickoff' }, [])
  assert(flags.length === 3, 'exactly 3 flags returned')
  const types = flags.map((f) => f.document_type)
  assert(types.includes('proposal'), 'proposal flagged')
  assert(types.includes('contract'), 'contract flagged')
  assert(types.includes('brief'), 'brief flagged')
}

// T6: All docs present → no flags (idempotency)
console.log('\nT6: All docs present at kickoff → no flags (idempotency)')
{
  const flags = simulateDetect({ stage: 'kickoff' }, [
    { type: 'proposal', status: 'sent' },
    { type: 'contract', status: 'signed' },
    { type: 'brief', status: 'draft' },
  ])
  assert(flags.length === 0, 'no flags when all docs exist')
}

// T7: Archived deal → no flags suppressed
console.log('\nT7: Archived deal → suppressed (no flags)')
{
  const flags = simulateDetect({ stage: 'proposal', status: 'archived' }, [])
  assert(flags.length === 0, 'archived deal returns no flags')
}

// T8: likely_lost predicted_outcome → suppressed
console.log('\nT8: likely_lost predicted deal → suppressed (no flags)')
{
  const flags = simulateDetect({ stage: 'contract stage', predicted_outcome: 'likely_lost' }, [])
  assert(flags.length === 0, 'likely_lost deal returns no flags')
}

// T9: Discovery/unrelated stage → no required docs
console.log('\nT9: Discovery stage → no required docs')
{
  const flags = simulateDetect({ stage: 'discovery' }, [])
  assert(flags.length === 0, 'discovery stage has no doc requirements')
}

// T10: Archived doc (status=archived) is not counted as "present"
console.log('\nT10: Archived document not counted — flag still returned')
{
  const flags = simulateDetect({ stage: 'proposal' }, [
    { type: 'proposal', status: 'archived' },
  ])
  assert(flags.length === 1, 'archived doc does not satisfy requirement')
  assert(flags[0]?.document_type === 'proposal', 'proposal is still flagged')
}

// T11: Vietnamese stage keyword — "đề xuất" → proposal flagged
console.log('\nT11: Vietnamese stage keyword "đề xuất" → proposal flagged')
{
  const flags = simulateDetect({ stage: 'đang ở giai đoạn đề xuất' }, [])
  assert(flags.length === 1, '1 flag from Vietnamese stage text')
  assert(flags[0]?.document_type === 'proposal', 'proposal flagged from Vietnamese keyword')
}

// T9b: "discovery confirmed" stage → 3 flags
console.log('\nT9b: "discovery confirmed" stage → 3 flags')
{
  const flags = simulateDetect({ stage: 'discovery confirmed' }, [])
  assert(flags.length === 3, '"discovery confirmed" stage produces 3 flags')
  const types = flags.map((f) => f.document_type)
  assert(types.includes('proposal'), 'proposal flagged for discovery confirmed')
  assert(types.includes('contract'), 'contract flagged for discovery confirmed')
  assert(types.includes('brief'), 'brief flagged for discovery confirmed')
}

// T12: File existence check — missingDocumentService.ts must exist
console.log('\nT12: missingDocumentService.ts file existence')
{
  const serviceFile = path.join(process.cwd(), 'lib', 'crm', 'missingDocumentService.ts')
  assert(fs.existsSync(serviceFile), 'lib/crm/missingDocumentService.ts exists')
}

// T13: File existence check — orchestrator.ts must contain MISSING DOCUMENT CHECK
console.log('\nT13: orchestrator.ts contains MISSING DOCUMENT CHECK section')
{
  const orchestratorFile = path.join(process.cwd(), 'lib', 'ai', 'orchestrator.ts')
  assert(fs.existsSync(orchestratorFile), 'lib/ai/orchestrator.ts exists')
  const contents = fs.readFileSync(orchestratorFile, 'utf8')
  assert(contents.includes('MISSING DOCUMENT CHECK'), 'orchestrator.ts contains MISSING DOCUMENT CHECK')
  assert(
    contents.includes('Anh có muốn em soạn'),
    'orchestrator.ts contains Vietnamese offer to draft'
  )
}

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n─────────────────────────────────────────`)
console.log(`Results: ${passed} passed, ${failed} failed`)
if (failed > 0) {
  console.error('SOME TESTS FAILED')
  process.exit(1)
} else {
  console.log('All tests passed ✓')
}
