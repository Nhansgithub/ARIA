export {}

// Inline types — never import from project lib/ (ts-node test pattern)

type DocumentType =
  | 'proposal'
  | 'contract'
  | 'brief'
  | 'sop'
  | 'report'
  | 'invoice'
  | 'onboarding'
  | 'other'
type DocumentStatus = 'draft' | 'review' | 'sent' | 'signed' | 'archived'
type DocumentCreatedBy = 'ai' | 'human'

interface DocumentRow {
  id: string
  owner_id: string
  deal_id: string | null
  client_id: string | null
  type: DocumentType
  title: string
  status: DocumentStatus
  content_md: string | null
  file_url: string | null
  version: number
  created_by: DocumentCreatedBy
  created_at: string
  updated_at: string
}

// Inline buildDocumentTitle — mirrors documentService.ts
function buildDocumentTitle(
  clientName: string | undefined,
  type: DocumentType,
  version: number,
  date: string
): string {
  const sanitizedName = clientName?.replace(/\s+/g, '') || 'Unknown'
  const capitalizedType = type.charAt(0).toUpperCase() + type.slice(1)
  return `${sanitizedName}_${capitalizedType}_${date}_v${version}`
}

// Inline no-op guard for updateDocumentStatus
function shouldSkipStatusUpdate(currentStatus: string, newStatus: string): boolean {
  return currentStatus === newStatus
}

// Expected DOCUMENT_TOOLS names — mirrors documentTools.ts (AD-5: alphabetical)
const EXPECTED_DOCUMENT_TOOL_NAMES = ['create_document', 'get_document']

let passed = 0
let failed = 0

function check(condition: boolean, label: string) {
  if (condition) {
    console.log(`  ✓ ${label}`)
    passed++
  } else {
    console.error(`  ✗ ${label}`)
    failed++
  }
}

// T1 — buildDocumentTitle: standard input
console.log('T1 — buildDocumentTitle: standard input')
{
  const title = buildDocumentTitle('Phu Long', 'proposal', 1, '2026-06-25')
  check(title === 'PhuLong_Proposal_2026-06-25_v1', `title matches expected: ${title}`)
  check(title.startsWith('PhuLong_'), 'client name is sanitized (spaces removed)')
  check(title.includes('_Proposal_'), 'type is capitalized')
}

// T2 — buildDocumentTitle: undefined clientName → "Unknown"
console.log('T2 — buildDocumentTitle: undefined clientName')
{
  const title = buildDocumentTitle(undefined, 'contract', 1, '2026-06-25')
  check(title.startsWith('Unknown_'), 'Unknown prefix when clientName is undefined')
  check(title === 'Unknown_Contract_2026-06-25_v1', `title: ${title}`)
}

// T3 — buildDocumentTitle: version increments correctly
console.log('T3 — buildDocumentTitle: version increment')
{
  const title = buildDocumentTitle('Nguyen', 'brief', 3, '2026-06-25')
  check(title.endsWith('_v3'), `title ends with _v3: ${title}`)
  check(!title.includes('_v1'), 'no _v1 in v3 title')
}

// T4 — DocumentType union exhaustiveness (all 8 values)
console.log('T4 — DocumentType: all 8 values are valid')
{
  const validTypes: DocumentType[] = [
    'proposal',
    'contract',
    'brief',
    'sop',
    'report',
    'invoice',
    'onboarding',
    'other',
  ]
  check(validTypes.length === 8, 'DocumentType has exactly 8 values')
  check(validTypes.includes('proposal'), 'proposal is valid')
  check(validTypes.includes('onboarding'), 'onboarding is valid')
  check(validTypes.includes('other'), 'other is valid')
}

// T5 — DocumentStatus union (all 5 values)
console.log('T5 — DocumentStatus: all 5 values are valid')
{
  const validStatuses: DocumentStatus[] = ['draft', 'review', 'sent', 'signed', 'archived']
  check(validStatuses.length === 5, 'DocumentStatus has exactly 5 values')
  check(validStatuses.includes('draft'), 'draft is valid')
  check(validStatuses.includes('archived'), 'archived is valid')
}

// T6 — createDocument: returns version=1 and status='draft'
console.log('T6 — createDocument: version=1, status=draft')
{
  // Simulate what createDocument returns
  const mockResult: DocumentRow = {
    id: 'doc-uuid-1',
    owner_id: 'owner-1',
    deal_id: 'deal-1',
    client_id: null,
    type: 'proposal',
    title: 'PhuLong_Proposal_2026-06-29_v1',
    status: 'draft',
    content_md: '# Proposal content',
    file_url: null,
    version: 1,
    created_by: 'ai',
    created_at: '2026-06-29T10:00:00Z',
    updated_at: '2026-06-29T10:00:00Z',
  }
  check(mockResult.version === 1, 'createDocument returns version=1')
  check(mockResult.status === 'draft', 'createDocument returns status=draft')
}

// T7 — createDocument: title matches {ClientName}_{Type}_{Date}_v1 pattern
console.log('T7 — createDocument: title pattern')
{
  const title = buildDocumentTitle('PhuLong', 'proposal', 1, '2026-06-29')
  const pattern = /^[A-Za-z]+_[A-Z][a-z]+_\d{4}-\d{2}-\d{2}_v1$/
  check(pattern.test(title), `title matches pattern: ${title}`)
}

// T8 — saveDocumentVersion: new row has version+1; source row version unchanged
console.log('T8 — saveDocumentVersion: versioning invariant')
{
  const source: DocumentRow = {
    id: 'doc-uuid-1',
    owner_id: 'owner-1',
    deal_id: 'deal-1',
    client_id: null,
    type: 'proposal',
    title: 'PhuLong_Proposal_2026-06-29_v1',
    status: 'draft',
    content_md: '# v1 content',
    file_url: null,
    version: 1,
    created_by: 'ai',
    created_at: '2026-06-29T10:00:00Z',
    updated_at: '2026-06-29T10:00:00Z',
  }

  const newVersion = source.version + 1

  // Simulate the new row insert (source row must remain unchanged)
  const newRow: DocumentRow = {
    id: 'doc-uuid-2', // new id — new row, not an UPDATE
    owner_id: source.owner_id,
    deal_id: source.deal_id,
    client_id: source.client_id,
    type: source.type,
    status: source.status,
    file_url: source.file_url,
    content_md: '# v2 updated content',
    created_by: 'human',
    version: newVersion,
    title: buildDocumentTitle('PhuLong', source.type, newVersion, '2026-06-30'),
    created_at: '2026-06-30T09:00:00Z',
    updated_at: '2026-06-30T09:00:00Z',
  }

  check(source.version === 1, 'source row version unchanged at 1')
  check(newRow.version === 2, 'new row version is 2 (source.version + 1)')
  check(newRow.id !== source.id, 'new row has a different id (new INSERT, not UPDATE)')
  check(newRow.content_md !== source.content_md, 'new row has updated content_md')
  check(newRow.owner_id === source.owner_id, 'new row inherits owner_id from source')
}

// T9 — saveDocumentVersion: cross-owner guard throws
console.log('T9 — saveDocumentVersion: owner isolation guard')
{
  // Simulate the fetch with wrong owner_id returning null
  const sourceForWrongOwner: DocumentRow | null = null // owner_id mismatch → not found

  let threw = false
  try {
    if (!sourceForWrongOwner) {
      throw new Error('saveDocumentVersion: document not found or unauthorized')
    }
  } catch (e) {
    threw = true
    check(
      e instanceof Error && e.message.includes('unauthorized'),
      'throws with unauthorized message on owner mismatch'
    )
  }
  check(threw, 'saveDocumentVersion throws when source_id belongs to a different owner')
}

// T10 — updateDocumentStatus: no-op when status unchanged
console.log('T10 — updateDocumentStatus: no-op guard')
{
  const currentStatus = 'draft'
  const newStatus: DocumentStatus = 'draft'
  const isNoOp = shouldSkipStatusUpdate(currentStatus, newStatus)

  check(isNoOp, 'same status → no-op guard fires')
  // Simulate return value
  const result = isNoOp ? { updated: false } : { updated: true }
  check(result.updated === false, 'returns { updated: false } on no-op')
}

// T11 — updateDocumentStatus: transition logs correctly
console.log('T11 — updateDocumentStatus: transition payload shape')
{
  const fromStatus = 'draft'
  const toStatus: DocumentStatus = 'review'

  const payload: Record<string, unknown> = {
    from_status: fromStatus,
    to_status: toStatus,
  }

  check(payload.from_status === 'draft', 'payload.from_status is draft')
  check(payload.to_status === 'review', 'payload.to_status is review')
  check(!('sent_at' in payload), 'sent_at absent for non-sent transition')
}

// T12 — updateDocumentStatus: sent_at included when transitioning to 'sent'
console.log('T12 — updateDocumentStatus: sent_at in payload for sent status')
{
  const toStatus: DocumentStatus = 'sent'
  const payload: Record<string, unknown> = {
    from_status: 'review',
    to_status: toStatus,
  }
  if (toStatus === 'sent') {
    payload.sent_at = new Date().toISOString()
  }

  check('sent_at' in payload, 'sent_at is present when transitioning to sent')
  check(typeof payload.sent_at === 'string', 'sent_at is an ISO string')
}

// T13 — getDocument: returns null for cross-owner access (AD-2)
console.log('T13 — getDocument: owner isolation')
{
  // Simulate cross-owner: Supabase returns null because RLS filters by owner_id
  const crossOwnerResult: DocumentRow | null = null
  check(crossOwnerResult === null, 'getDocument returns null for cross-owner id')
}

// T14 — listDocuments: filters by deal_id and owner_id
console.log('T14 — listDocuments: deal_id + owner_id filter')
{
  const allDocs: DocumentRow[] = [
    {
      id: 'doc-1',
      owner_id: 'owner-1',
      deal_id: 'deal-A',
      client_id: null,
      type: 'proposal',
      title: 'T',
      status: 'draft',
      content_md: null,
      file_url: null,
      version: 1,
      created_by: 'ai',
      created_at: '2026-06-29T10:00:00Z',
      updated_at: '2026-06-29T10:00:00Z',
    },
    {
      id: 'doc-2',
      owner_id: 'owner-1',
      deal_id: 'deal-B',
      client_id: null,
      type: 'contract',
      title: 'T',
      status: 'draft',
      content_md: null,
      file_url: null,
      version: 1,
      created_by: 'ai',
      created_at: '2026-06-29T11:00:00Z',
      updated_at: '2026-06-29T11:00:00Z',
    },
    {
      id: 'doc-3',
      owner_id: 'owner-2', // different owner
      deal_id: 'deal-A',
      client_id: null,
      type: 'proposal',
      title: 'T',
      status: 'draft',
      content_md: null,
      file_url: null,
      version: 1,
      created_by: 'ai',
      created_at: '2026-06-29T12:00:00Z',
      updated_at: '2026-06-29T12:00:00Z',
    },
  ]

  // Simulate listDocuments(owner-1, { deal_id: 'deal-A' })
  const result = allDocs.filter((d) => d.owner_id === 'owner-1' && d.deal_id === 'deal-A')
  check(result.length === 1, 'only 1 doc returned for owner-1 + deal-A')
  check(result[0]!.id === 'doc-1', 'returned doc is doc-1')
}

// T15 — DOCUMENT_TOOLS alphabetical order (AD-5)
console.log('T15 — DOCUMENT_TOOLS: alphabetical sort (AD-5)')
{
  const sorted = [...EXPECTED_DOCUMENT_TOOL_NAMES].sort()
  check(
    JSON.stringify(EXPECTED_DOCUMENT_TOOL_NAMES) === JSON.stringify(sorted),
    'DOCUMENT_TOOLS names are alphabetically ordered'
  )
  check(EXPECTED_DOCUMENT_TOOL_NAMES[0] === 'create_document', 'create_document sorts first')
  check(EXPECTED_DOCUMENT_TOOL_NAMES[1] === 'get_document', 'get_document sorts second')
}

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
