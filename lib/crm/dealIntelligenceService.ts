import 'server-only'
import { createServerClient } from '@/lib/supabase/server'

// ── get_deal ──────────────────────────────────────────────────────────────────

export interface GetDealParams {
  id?: string
  title?: string
}

export interface DealRecord {
  id: string
  client_id: string
  title: string
  service_type: string
  stage: string
  value_estimate: number | null
  client_stated_need: string | null
  inferred_real_need: string | null
  risk_flags: unknown[]
  opportunity_signals: unknown[]
  predicted_outcome: string | null
  prediction_reason: string | null
  similar_deals: SimilarDealEntry[]
  notes: string | null
  stale_since: string | null // date ISO string, or null
  stall_diagnosis: string | null // last written stall diagnosis, or null
  days_stalled: number | null // computed server-side; null if stale_since is null
  current_date: string // server-side date injection for seasonal context
}

function withStaleDerivedFields(
  data: Omit<DealRecord, 'days_stalled' | 'current_date'>
): DealRecord {
  const staleDays = data.stale_since
    ? Math.floor((Date.now() - new Date(data.stale_since + 'T00:00:00Z').getTime()) / 86_400_000)
    : null
  return {
    ...data,
    days_stalled: staleDays,
    current_date: new Date().toISOString().split('T')[0]!,
  }
}

export async function getDeal(ownerId: string, params: GetDealParams): Promise<DealRecord | null> {
  const supabase = createServerClient()
  const q = supabase
    .from('deals')
    .select(
      'id, client_id, title, service_type, stage, value_estimate, client_stated_need, inferred_real_need, risk_flags, opportunity_signals, predicted_outcome, prediction_reason, similar_deals, notes, stale_since, stall_diagnosis'
    )
    .eq('owner_id', ownerId)

  if (params.id) {
    const { data, error } = await q.eq('id', params.id).single()
    if (error) throw new Error(`getDeal failed: ${error.message}`)
    return withStaleDerivedFields(
      data as unknown as Omit<DealRecord, 'days_stalled' | 'current_date'>
    )
  }
  if (params.title) {
    const { data, error } = await q.ilike('title', `%${params.title}%`).limit(1)
    if (error) throw new Error(`getDeal failed: ${error.message}`)
    const row = (data ?? [])[0] ?? null
    return row
      ? withStaleDerivedFields(row as unknown as Omit<DealRecord, 'days_stalled' | 'current_date'>)
      : null
  }
  throw new Error('getDeal requires id or title')
}

// ── get_client ────────────────────────────────────────────────────────────────

export interface GetClientParams {
  id?: string
  name?: string
}

export interface ClientRecord {
  id: string
  name: string
  company: string | null
  industry: string | null
  relationship_stage: string | null
  decision_maker: string | null
  known_hesitations: string | null
  language_pref: string
}

export async function getClient(
  ownerId: string,
  params: GetClientParams
): Promise<ClientRecord | null> {
  const supabase = createServerClient()
  const q = supabase
    .from('clients')
    .select(
      'id, name, company, industry, relationship_stage, decision_maker, known_hesitations, language_pref'
    )
    .eq('owner_id', ownerId)

  if (params.id) {
    const { data, error } = await q.eq('id', params.id).single()
    if (error) throw new Error(`getClient failed: ${error.message}`)
    return data
  }
  if (params.name) {
    const { data, error } = await q.ilike('name', `%${params.name}%`).limit(1)
    if (error) throw new Error(`getClient failed: ${error.message}`)
    return (data ?? [])[0] ?? null
  }
  throw new Error('getClient requires id or name')
}

// ── find_similar_deals ────────────────────────────────────────────────────────

export interface SimilarDealEntry {
  deal_id: string
  similarity_reason: string
}

export interface FindSimilarDealsParams {
  service_type?: string
  industry?: string
  exclude_deal_id?: string
}

export interface SimilarDealRecord {
  id: string
  title: string
  service_type: string
  stage: string
  value_estimate: number | null
  predicted_outcome: string | null
  prediction_reason: string | null
  client_name: string | null
  client_industry: string | null
  similarity_reason: string
}

function buildSimilarityReason(
  params: FindSimilarDealsParams,
  record: { service_type: string; client_industry: string | null }
): string {
  if (params.service_type && params.industry) {
    // client_industry is non-null here: the client-side industry filter above excludes records where c?.industry is null
    return `Same service type (${record.service_type}) and client industry (${record.client_industry!})`
  }
  if (params.service_type) {
    return `Same service type (${record.service_type})`
  }
  if (params.industry) {
    return `Same client industry (${record.client_industry ?? params.industry})`
  }
  return `Similar past deal (${record.service_type})`
}

export async function findSimilarDeals(
  ownerId: string,
  params: FindSimilarDealsParams
): Promise<SimilarDealRecord[]> {
  const supabase = createServerClient()

  // Supabase returns joined relations as arrays; we cast via unknown for safety.
  type DealRow = {
    id: string
    title: string
    service_type: string
    stage: string
    value_estimate: number | null
    predicted_outcome: string | null
    prediction_reason: string | null
    clients:
      | { name: string; industry: string | null }
      | { name: string; industry: string | null }[]
      | null
  }

  let q = supabase
    .from('deals')
    .select(
      'id, title, service_type, stage, value_estimate, predicted_outcome, prediction_reason, clients!inner(name, industry)'
    )
    .eq('owner_id', ownerId)
    .eq('is_stub', false) // exclude stubs from pattern matching (FR-37)

  if (params.exclude_deal_id) {
    q = q.neq('id', params.exclude_deal_id)
  }
  if (params.service_type) {
    q = q.eq('service_type', params.service_type)
  }

  const { data, error } = await q.limit(10)
  if (error) throw new Error(`findSimilarDeals failed: ${error.message}`)

  const rows = (data as unknown as DealRow[]) ?? []

  // Normalize clients — Supabase may return array or object depending on join type
  function clientOf(raw: DealRow['clients']): { name: string; industry: string | null } | null {
    if (!raw) return null
    return Array.isArray(raw) ? (raw[0] ?? null) : raw
  }

  // Apply industry filter client-side (avoids complex join filter in PostgREST)
  const filtered = params.industry
    ? rows.filter((d) => {
        const c = clientOf(d.clients)
        return c?.industry?.toLowerCase().includes(params.industry!.toLowerCase()) ?? false
      })
    : rows

  return filtered.slice(0, 5).map((d) => {
    const c = clientOf(d.clients)
    return {
      id: d.id,
      title: d.title,
      service_type: d.service_type,
      stage: d.stage,
      value_estimate: d.value_estimate,
      predicted_outcome: d.predicted_outcome,
      prediction_reason: d.prediction_reason,
      client_name: c?.name ?? null,
      client_industry: c?.industry ?? null,
      similarity_reason: buildSimilarityReason(params, {
        service_type: d.service_type,
        client_industry: c?.industry ?? null,
      }),
    }
  })
}

// ── get_pricing_floors ────────────────────────────────────────────────────────

export interface PricingBenchmark {
  floor: number // minimum price in VND
  ceiling?: number // optional upper benchmark in VND
  currency: string // always 'VND' for now
}

export type PricingBenchmarks = Record<string, PricingBenchmark>

export async function getPricingFloors(ownerId: string): Promise<PricingBenchmarks> {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('settings')
    .select('pricing_benchmarks')
    .eq('owner_id', ownerId)
    .single()

  if (error || !data) return {} // no settings row → no benchmarks (not an error)
  return (data.pricing_benchmarks as PricingBenchmarks) ?? {}
}

// ── update_intelligence_fields ────────────────────────────────────────────────

export interface IntelligenceFieldsInput {
  deal_id: string
  inferred_real_need?: string
  risk_flags?: unknown[]
  opportunity_signals?: unknown[]
  predicted_outcome?: 'likely_win' | 'uncertain' | 'at_risk' | 'likely_lost'
  prediction_reason?: string
  similar_deals?: SimilarDealEntry[]
  stall_diagnosis?: string
  source?: string
}

export async function updateIntelligenceFields(
  ownerId: string,
  input: IntelligenceFieldsInput
): Promise<{ updated: boolean; changedFields: string[]; protectedFields: string[] }> {
  const supabase = createServerClient()

  // Fetch current values (AD-14: idempotent — compare before writing)
  const { data: current, error: fetchError } = await supabase
    .from('deals')
    .select(
      'inferred_real_need, risk_flags, opportunity_signals, predicted_outcome, prediction_reason, similar_deals, stall_diagnosis'
    )
    .eq('id', input.deal_id)
    .eq('owner_id', ownerId)
    .single()

  if (fetchError || !current) {
    throw new Error(`updateIntelligenceFields: deal not found or unauthorized`)
  }

  // Detect changed fields — JSON.stringify for deep equality on jsonb columns
  const changedFields: string[] = []
  const updates: Record<string, unknown> = {}

  function hasChanged(newVal: unknown, currentVal: unknown): boolean {
    if (newVal === undefined) return false
    return JSON.stringify(newVal) !== JSON.stringify(currentVal)
  }

  if (hasChanged(input.inferred_real_need, current.inferred_real_need)) {
    updates.inferred_real_need = input.inferred_real_need
    changedFields.push('inferred_real_need')
  }
  if (hasChanged(input.risk_flags, current.risk_flags)) {
    updates.risk_flags = input.risk_flags
    changedFields.push('risk_flags')
  }
  if (hasChanged(input.opportunity_signals, current.opportunity_signals)) {
    updates.opportunity_signals = input.opportunity_signals
    changedFields.push('opportunity_signals')
  }
  if (hasChanged(input.predicted_outcome, current.predicted_outcome)) {
    updates.predicted_outcome = input.predicted_outcome
    changedFields.push('predicted_outcome')
  }
  if (hasChanged(input.prediction_reason, current.prediction_reason)) {
    updates.prediction_reason = input.prediction_reason
    changedFields.push('prediction_reason')
  }
  if (hasChanged(input.similar_deals, current.similar_deals)) {
    updates.similar_deals = input.similar_deals
    changedFields.push('similar_deals')
  }
  if (hasChanged(input.stall_diagnosis, current.stall_diagnosis)) {
    updates.stall_diagnosis = input.stall_diagnosis
    changedFields.push('stall_diagnosis')
  }

  // No-op: nothing changed — log nothing (AD-14)
  if (changedFields.length === 0) {
    return { updated: false, changedFields: [], protectedFields: [] }
  }

  // Human-edit protection: 24h window (same pattern as updateDeal in crmService.ts)
  const { data: latestLog } = await supabase
    .from('activity_log')
    .select('actor, created_at')
    .eq('owner_id', ownerId)
    .eq('entity_type', 'deal')
    .eq('entity_id', input.deal_id)
    .order('created_at', { ascending: false })
    .maybeSingle()

  if (latestLog && latestLog.actor === 'user') {
    const ageMs = Date.now() - new Date(latestLog.created_at as string).getTime()
    if (ageMs < 24 * 60 * 60 * 1000) {
      const protectedFields = [...changedFields]
      return { updated: false, changedFields: [], protectedFields }
    }
  }

  const { error: updateError } = await supabase
    .from('deals')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', input.deal_id)
    .eq('owner_id', ownerId)

  if (updateError) {
    throw new Error(`updateIntelligenceFields update failed: ${updateError.message}`)
  }

  // Append activity log entry for changed fields (AD-14: append-only, never UPDATE)
  const { error: logError } = await supabase.from('activity_log').insert({
    owner_id: ownerId,
    entity_type: 'deal',
    entity_id: input.deal_id,
    action: 'intelligence_fields_updated',
    actor: 'ai',
    payload: {
      changedFields,
      values: updates,
      ...(input.source ? { source: input.source } : {}),
    },
  })
  if (logError)
    throw new Error(`updateIntelligenceFields: activity_log insert failed: ${logError.message}`)

  return { updated: true, changedFields, protectedFields: [] }
}

// ── get_activity_log ──────────────────────────────────────────────────────────

export interface ActivityLogEntry {
  id: string
  entity_type: string
  entity_id: string
  action: string
  actor: 'ai' | 'user'
  payload: Record<string, unknown>
  created_at: string
}

export async function getActivityLog(
  ownerId: string,
  entityId: string,
  limit?: number
): Promise<ActivityLogEntry[]> {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('activity_log')
    .select('id, entity_type, entity_id, action, actor, payload, created_at')
    .eq('owner_id', ownerId)
    .eq('entity_id', entityId)
    .order('created_at', { ascending: true })
    .limit(limit ?? 50)

  if (error) throw new Error(`getActivityLog failed: ${error.message}`)
  return (data ?? []) as ActivityLogEntry[]
}
