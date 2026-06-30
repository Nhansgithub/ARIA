import 'server-only'
import { createServerClient } from '@/lib/supabase/server'
import type { DocumentType } from '@/lib/crm/documentService'

// ── Stage → required document mapping ────────────────────────────────────────
// Each stage keyword (lower-case) maps to the SET of document types that MUST
// exist before that stage is considered "document-complete".
// The check is additive: contract stage also requires a proposal.

export const STAGE_REQUIRED_DOCS: { keywords: string[]; required: DocumentType[] }[] = [
  // delivery / kickoff → needs proposal + contract + brief
  {
    keywords: ['brief', 'discovery confirmed', 'kickoff', 'onboarding', 'started', 'delivery'],
    required: ['proposal', 'contract', 'brief'],
  },
  // contract stage → needs proposal + contract
  {
    keywords: ['contract', 'hợp đồng', 'signed', 'sow', 'negotiation'],
    required: ['proposal', 'contract'],
  },
  // proposal stage → needs proposal
  {
    keywords: ['proposal', 'đề xuất', 'sent'],
    required: ['proposal'],
  },
]

// ── Static teaching rationale ─────────────────────────────────────────────────
// Rationale is NOT AI-generated — it is static copy per document type.
// FR-22: guidance stance requires an explanation of WHY the document matters now.

export const MISSING_DOC_RATIONALE: Record<DocumentType, { vi: string; en: string }> = {
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
  sop: {
    vi: 'SOP giúp chuẩn hóa quy trình và giảm thiểu rủi ro khi thực hiện dự án.',
    en: 'An SOP standardises the process and reduces execution risk.',
  },
  report: {
    vi: 'Báo cáo giúp khách hàng thấy rõ tiến độ và giá trị công việc đã thực hiện.',
    en: 'A report gives the client clear visibility into progress and value delivered.',
  },
  invoice: {
    vi: 'Hóa đơn là căn cứ thanh toán chính thức — không có nó, anh khó đòi tiền đúng hạn.',
    en: 'An invoice is the formal payment trigger — without it, timely collection becomes difficult.',
  },
  onboarding: {
    vi: 'Tài liệu onboarding giúp khách bắt đầu sử dụng dịch vụ nhanh hơn và giảm câu hỏi lặp lại.',
    en: 'An onboarding document helps the client get started faster and reduces repetitive support queries.',
  },
  other: {
    vi: 'Tài liệu này cần thiết để đảm bảo mọi bên đều có thông tin đầy đủ.',
    en: 'This document ensures all parties have the information they need.',
  },
}

// ── MissingDocumentFlag ───────────────────────────────────────────────────────

export interface MissingDocumentFlag {
  document_type: DocumentType
  rationale_vi: string
  rationale_en: string
}

// ── detectMissingDocuments ────────────────────────────────────────────────────

/**
 * Checks which document types are expected for the deal's current stage and
 * which ones already exist in the DB, then returns computed flags.
 *
 * Rules:
 * - Returns [] for archived deals or deals predicted as likely_lost.
 * - Read-only: no writes, no flags table (AD-14).
 * - Owner guard on every query (AD-2).
 */
/**
 * Pure (no-DB) variant: given a stage string and the set of existing document types,
 * returns missing-document flags. Use this from cron/service contexts where the
 * calling code already has deal + doc data fetched. Shares STAGE_REQUIRED_DOCS and
 * MISSING_DOC_RATIONALE with the DB-backed detectMissingDocuments (FR-22).
 *
 * BOUNDARY: This function has no DB dependency and is safe to call from cron paths.
 * The other function in this file — detectMissingDocuments — uses createServerClient()
 * (cookie-based, request-scoped). Never call detectMissingDocuments from a cron context.
 */
export function detectMissingDocumentsByStage(
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
      flags.push({ document_type: docType, rationale_vi: rationale.vi, rationale_en: rationale.en })
    }
  }
  return flags
}

export async function detectMissingDocuments(
  ownerId: string,
  dealId: string
): Promise<MissingDocumentFlag[]> {
  const supabase = createServerClient()

  // 1. Fetch the deal (owner-scoped — AD-2)
  const { data: deal, error: dealError } = await supabase
    .from('deals')
    .select('id, stage, status, predicted_outcome')
    .eq('id', dealId)
    .eq('owner_id', ownerId)
    .single()

  if (dealError || !deal) return []

  // 2. Suppress for archived / likely_lost deals
  const suppressed =
    (deal as { status?: string | null }).status === 'archived' ||
    (deal as { predicted_outcome?: string | null }).predicted_outcome === 'likely_lost'
  if (suppressed) return []

  const stage: string = ((deal as { stage?: string | null }).stage ?? '').toLowerCase()

  // 3. Determine required document types for this stage
  let requiredDocs: DocumentType[] = []
  for (const rule of STAGE_REQUIRED_DOCS) {
    if (rule.keywords.some((kw) => stage.includes(kw))) {
      requiredDocs = rule.required
      break // first matching rule wins (ordered most-specific first)
    }
  }

  if (requiredDocs.length === 0) return [] // no doc requirements for this stage

  // 4. Fetch existing documents for this deal (owner-scoped — AD-2)
  //    Only count docs with active statuses (draft/review/sent/signed).
  const { data: existingDocs, error: docsError } = await supabase
    .from('documents')
    .select('type, status')
    .eq('deal_id', dealId)
    .eq('owner_id', ownerId)
    .in('status', ['draft', 'review', 'sent', 'signed'])

  if (docsError) return []

  const existingTypes = new Set(
    (existingDocs ?? []).map((d: { type: string }) => d.type as DocumentType)
  )

  // 5. Compute missing types and return flags
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
