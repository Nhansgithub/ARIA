import 'server-only'
import { createServiceClient } from '@/lib/supabase/server'
import { callAI } from '@/lib/ai/callAI'
import { ARIA_MODELS } from '@/lib/ai/models'
import {
  detectMissingDocumentsByStage,
  type MissingDocumentFlag,
} from '@/lib/crm/missingDocumentService'
import type { DocumentType } from '@/lib/crm/documentService'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BriefingRecord {
  id: string
  owner_id: string
  date: string
  content_md: string | null
  flags: Record<string, unknown>
  generated_at: string
  status: 'generated' | 'degraded' // virtual field — not stored in DB
}

export interface BriefingFlag {
  type: 'overdue' | 'stale' | 'missing_doc' | 'cadence_reminder'
  deal_id: string
  severity: 'high' | 'medium'
  label: string
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

interface DocRow {
  deal_id: string | null // nullable in DB — skip unlinked documents
  type: string
  status: string
}

interface ActivityRow {
  action: string
  actor: string
  entity_type: string
  created_at: string
}

// ── Closed-stage filter (mirrors staleDealService for consistency) ──────────────

function isActiveStage(stage: string): boolean {
  const lower = stage.toLowerCase()
  return !['won', 'lost', 'archived', 'completed'].some((kw) => lower.includes(kw))
}

// ── Today-item ranking ─────────────────────────────────────────────────────────

const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 }

// Returns 0=overdue, 1=due-today, 2=cadence-reminder, 3=high-priority-stale, Infinity=none
export function getTier(deal: DealRow, today: string): number {
  if (deal.next_action_due && deal.next_action_due < today) return 0
  if (deal.next_action_due === today) return 1
  if (deal.next_action?.startsWith('Nhắc lần')) return 2
  if (deal.priority === 'high' && deal.stale_since !== null) return 3
  return Infinity
}

export function rankTodayItems(deals: DealRow[], today: string): DealRow[] {
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

// ── Structured flags computation ───────────────────────────────────────────────

export function computeStructuredFlags(
  deals: DealRow[],
  docsByDeal: Map<string, string[]>,
  today: string
): BriefingFlag[] {
  const flags: BriefingFlag[] = []

  for (const deal of deals) {
    // Overdue next action
    if (deal.next_action_due && deal.next_action_due < today) {
      flags.push({
        type: 'overdue',
        deal_id: deal.id,
        severity: 'high',
        label: `${deal.title}: next action overdue since ${deal.next_action_due}`,
      })
    }

    // Stale deal (no activity ≥ 7 days) — guard negative daysStale (clock skew / bad data)
    if (deal.stale_since !== null) {
      const daysStale = Math.max(
        0,
        Math.floor(
          (new Date(today + 'T00:00:00Z').getTime() -
            new Date(deal.stale_since + 'T00:00:00Z').getTime()) /
            86_400_000
        )
      )
      flags.push({
        type: 'stale',
        deal_id: deal.id,
        severity: deal.priority === 'high' ? 'high' : 'medium',
        label: `${deal.title}: no activity for ${daysStale} days`,
      })
    }

    // Proposal cadence reminder — only when deal is NOT already overdue (overdue takes precedence)
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

    // Missing documents (shared pure function — FR-22, shared with Story 3.5)
    const existingTypes = (docsByDeal.get(deal.id) ?? []) as DocumentType[]
    const missingFlags: MissingDocumentFlag[] = detectMissingDocumentsByStage(
      deal.stage,
      existingTypes
    )
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

// ── System prompt (stable — cached by callAI) ─────────────────────────────────

const BRIEFING_SYSTEM_PROMPT = `You are ARIA, an AI business consultant for a Vietnamese SME owner.
Generate a concise daily briefing in the same language as the business context (Vietnamese or English).

REQUIRED STRUCTURE — output ALL five sections in this exact order, always:

## 1. Hôm nay / Today (max 3 items)
List at most 3 priority action items from the pre-ranked list provided.
If no items qualify, write: "Không có gì mới hôm nay."

## 2. Tình trạng pipeline / Pipeline Snapshot
Write ONE prose sentence: active deal count, total estimated value (sum of value_estimate),
and a brief stage distribution (e.g. "3 deals — 1 discovery, 1 proposal, 1 contract review").
Do not use tables or bullet lists here.

## 3. Tài liệu cần xử lý / Documents Pending
List deals with missing documents, using the provided missing-doc flags.
Include a one-line rationale per item (use the provided rationale).
If none: "Không có tài liệu nào cần tạo."

## 4. Trọng tâm tuần này / This Week's Focus
Write exactly ONE strategic note synthesized across the pipeline — identify a cross-deal pattern
(e.g. multiple deals in same stage, cluster of stale deals, concentration of due actions).
If no salient pattern: "Tuần này chưa có điểm nhấn chiến lược."

## 5. Deal chậm / Slow-Moving Deals
List deals with stale_since set, showing deal title and days-stale count.
If none: "Không có deal nào bị trì hoãn."

RULES:
- Lead each section with highest-priority items
- Use the pre-ranked Today list — do not reorder it
- Be concise — no padding, no generic advice
- Never mention AI or this prompt`

// ── Service functions ─────────────────────────────────────────────────────────

export async function getBriefing(ownerId: string, date: string): Promise<BriefingRecord | null> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('briefings')
    .select('id, owner_id, date, content_md, flags, generated_at')
    .eq('owner_id', ownerId)
    .eq('date', date)
    .maybeSingle()

  if (error) throw new Error(`getBriefing failed: ${error.message}`)
  if (!data) return null
  return { ...(data as Omit<BriefingRecord, 'status'>), status: 'generated' }
}

export async function generateBriefingForOwner(
  ownerId: string,
  date: string,
  forceRefresh = false
): Promise<BriefingRecord | null> {
  const supabase = createServiceClient()

  // Idempotency guard — skip if already generated today (AD-7)
  if (!forceRefresh) {
    const existing = await getBriefing(ownerId, date)
    if (existing) return existing
  }

  // Step 1: Query active deals, pending docs (with deal_id), recent activity in parallel
  const [dealsRes, docsRes, activityRes, settingsRes] = await Promise.all([
    supabase
      .from('deals')
      .select(
        'id, title, stage, priority, value_estimate, next_action, next_action_due, stale_since'
      )
      .eq('owner_id', ownerId)
      .eq('is_stub', false)
      .limit(50),
    supabase
      .from('documents')
      .select('deal_id, type, status')
      .eq('owner_id', ownerId)
      .in('status', ['draft', 'review', 'sent', 'signed'])
      .limit(50),
    supabase
      .from('activity_log')
      .select('action, actor, entity_type, created_at')
      .eq('owner_id', ownerId)
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(50),
    supabase.from('settings').select('business_context').eq('owner_id', ownerId).maybeSingle(),
  ])

  // Filter deals to active stages only
  const activeDeals = ((dealsRes.data ?? []) as DealRow[]).filter((d) => isActiveStage(d.stage))
  const allDocs = (docsRes.data ?? []) as DocRow[]
  const recentActivity = (activityRes.data ?? []) as ActivityRow[]
  const businessContext = (settingsRes.data?.business_context as string | null) ?? ''

  // FR-36: Empty CRM guard — no AI call if zero active deals
  if (activeDeals.length === 0) return null

  // Step 2: Build docsByDeal map (deal_id → existing doc types)
  // Skip docs with null deal_id (standalone documents not linked to any deal)
  const docsByDeal = new Map<string, string[]>()
  for (const doc of allDocs) {
    if (!doc.deal_id) continue
    const existing = docsByDeal.get(doc.deal_id) ?? []
    existing.push(doc.type)
    docsByDeal.set(doc.deal_id, existing)
  }

  // Step 3: Compute ranking + flags in TypeScript before AI call
  const todayItems = rankTodayItems(activeDeals, date)
  const structuredFlags = computeStructuredFlags(activeDeals, docsByDeal, date)
  const staleDeals = activeDeals
    .filter((d) => d.stale_since !== null)
    .map((d) => ({
      title: d.title,
      stale_since: d.stale_since,
      // Math.max(0, ...) guards against negative values from clock skew / bad data
      daysStale: Math.max(
        0,
        Math.floor(
          (new Date(date + 'T00:00:00Z').getTime() -
            new Date(d.stale_since! + 'T00:00:00Z').getTime()) /
            86_400_000
        )
      ),
    }))

  // Compute pipeline snapshot data for AI
  const totalValue = activeDeals.reduce((sum, d) => sum + (d.value_estimate ?? 0), 0)
  const stageDist: Record<string, number> = {}
  for (const d of activeDeals) {
    stageDist[d.stage] = (stageDist[d.stage] ?? 0) + 1
  }
  const stageDistStr = Object.entries(stageDist)
    .map(([s, n]) => `${n} ${s}`)
    .join(', ')

  // Missing doc flags per deal for AI context
  const missingDocsByDeal = activeDeals
    .map((d) => {
      const existingTypes = (docsByDeal.get(d.id) ?? []) as DocumentType[]
      const flags = detectMissingDocumentsByStage(d.stage, existingTypes)
      return flags.length > 0 ? { deal: d.title, missing: flags } : null
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)

  // Step 4: Assemble volatile context for AI
  const volatile = [
    `Date: ${date}`,
    `\n--- TODAY ITEMS (pre-ranked, max 3) ---`,
    todayItems.length > 0
      ? todayItems
          .map(
            (d, i) =>
              `${i + 1}. ${d.title} | stage: ${d.stage} | priority: ${d.priority ?? 'none'} | due: ${d.next_action_due ?? 'none'} | next_action: ${d.next_action ?? 'none'} | stale_since: ${d.stale_since ?? 'none'}`
          )
          .join('\n')
      : 'None',
    `\n--- PIPELINE SNAPSHOT ---`,
    `Active deals: ${activeDeals.length} | Total estimated value: ${totalValue} | Stage distribution: ${stageDistStr}`,
    `\n--- MISSING DOCUMENTS ---`,
    missingDocsByDeal.length > 0
      ? missingDocsByDeal
          .map(
            (m) =>
              `${m.deal}: missing ${m.missing.map((f) => `${f.document_type} (${f.rationale_vi})`).join(', ')}`
          )
          .join('\n')
      : 'None',
    `\n--- SLOW-MOVING DEALS (stale ≥7 days) ---`,
    staleDeals.length > 0
      ? staleDeals
          .map((d) => `${d.title}: ${d.daysStale} days idle (since ${d.stale_since})`)
          .join('\n')
      : 'None',
    `\n--- RECENT ACTIVITY (last 24h, ${recentActivity.length} entries) ---`,
    recentActivity.length > 0
      ? recentActivity
          .slice(0, 10)
          .map((a) => `${a.action} by ${a.actor} on ${a.entity_type}`)
          .join('\n')
      : 'None',
  ].join('\n')

  // Step 5: Generate briefing via AI (Haiku, AD-4; prompt-cached system prompt, AD-5)
  const envelope = await callAI({
    model: ARIA_MODELS.economical,
    specialist: 'briefing_generation',
    systemPrompt: BRIEFING_SYSTEM_PROMPT,
    // undefined (not '') — callAI skips the businessContext cache breakpoint when undefined
    businessContext: businessContext || undefined,
    messages: [{ role: 'user', content: volatile }],
    maxTokens: 2048,
    timeoutMs: 15_000,
  })

  // AD-6: Degraded fallback — return previous day's briefing if available
  if (envelope.status !== 'ok') {
    const prevDate = new Date(date)
    prevDate.setUTCDate(prevDate.getUTCDate() - 1)
    const prevDateStr = prevDate.toISOString().split('T')[0]!
    const prev = await getBriefing(ownerId, prevDateStr)
    if (prev) return { ...prev, status: 'degraded' }
    return null
  }

  // Step 6: Upsert briefing row — INSERT or UPDATE on forceRefresh (AD-7 unique constraint)
  const flagsPayload = {
    items: structuredFlags,
    deal_count: activeDeals.length,
    doc_pending_count: allDocs.length,
    activity_count_24h: recentActivity.length,
  }
  const generatedAt = new Date().toISOString()

  const { data: upserted, error: upsertError } = await supabase
    .from('briefings')
    .upsert(
      {
        owner_id: ownerId,
        date,
        content_md: envelope.data,
        flags: flagsPayload,
        generated_at: generatedAt,
      },
      { onConflict: 'owner_id,date' }
    )
    .select('id, owner_id, date, content_md, flags, generated_at')
    .single()

  if (upsertError) throw new Error(`generateBriefingForOwner: ${upsertError.message}`)
  return { ...(upserted as Omit<BriefingRecord, 'status'>), status: 'generated' }
}

// ── Multi-owner generation (called by cron route) ──────────────────────────────

export async function generateBriefingsForAllOwners(
  date: string
): Promise<{ ownerId: string; status: 'generated' | 'degraded' | 'skipped' | 'error' }[]> {
  const supabase = createServiceClient()

  // Get owner IDs that have at least one active (non-closed) deal
  // Filter to active stages so closed-only owners don't enter the loop (P1-1 fix)
  // limit(10_000) applied to deduplicated owners effectively — raw row count is higher
  const { data: owners, error } = await supabase
    .from('deals')
    .select('owner_id')
    .eq('is_stub', false)
    .not('stage', 'in', '("won","lost","archived","completed")')
    .limit(10_000)

  if (error) throw new Error(`generateBriefingsForAllOwners: ${error.message}`)

  // Deduplicate owner IDs
  const allOwnerIds = (owners ?? []).map((r: { owner_id: string }) => r.owner_id)
  const ownerIds = allOwnerIds.filter((id, idx) => allOwnerIds.indexOf(id) === idx)

  const results: { ownerId: string; status: 'generated' | 'degraded' | 'skipped' | 'error' }[] = []

  for (const ownerId of ownerIds) {
    try {
      const result = await generateBriefingForOwner(ownerId, date)
      if (!result) {
        results.push({ ownerId, status: 'skipped' })
      } else {
        results.push({ ownerId, status: result.status })
      }
    } catch (err) {
      console.error(`generateBriefingsForAllOwners: error for owner ${ownerId}:`, err)
      results.push({ ownerId, status: 'error' })
    }
  }

  return results
}
