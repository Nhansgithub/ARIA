import 'server-only'
import { createServerClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/crm/activityLogService'

// ── listDeals ─────────────────────────────────────────────────────────────────

export interface ListDealsParams {
  stage?: string
  is_stub?: boolean
  limit?: number
}

export interface DealSummary {
  id: string
  client_id: string
  title: string
  service_type: string
  stage: string
  value_estimate: number | null
  is_stub: boolean
  stale_since: string | null
  predicted_outcome: string | null
  created_at: string
}

export async function listDeals(ownerId: string, params: ListDealsParams): Promise<DealSummary[]> {
  const supabase = createServerClient()
  let query = supabase
    .from('deals')
    .select(
      'id, client_id, title, service_type, stage, value_estimate, is_stub, stale_since, predicted_outcome, created_at'
    )
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false })
    .limit(Math.min(params.limit ?? 20, 50))

  if (params.stage !== undefined) {
    query = query.eq('stage', params.stage)
  }
  if (params.is_stub !== undefined) {
    query = query.eq('is_stub', params.is_stub)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []) as DealSummary[]
}

// ── updateDeal ────────────────────────────────────────────────────────────────

export interface UpdateDealInput {
  id: string
  actor: 'ai' | 'user'
  title?: string
  stage?: string
  service_type?: 'web_design' | 'web_app' | 'automation' | 'other'
  value_estimate?: number
  client_stated_need?: string
  next_action?: string
  next_action_due?: string
  notes?: string
  priority?: 'high' | 'medium' | 'low'
  is_stub?: boolean
  status?: string
  checkin_paused?: boolean // Story 4.8 — per-deal pause
}

export interface UpdateDealResult {
  updated: boolean
  changedFields: string[]
  protectedFields: string[]
}

export async function updateDeal(
  ownerId: string,
  input: UpdateDealInput
): Promise<UpdateDealResult> {
  const supabase = createServerClient()

  const { data: current, error: fetchError } = await supabase
    .from('deals')
    .select(
      'id, title, stage, stage_history, service_type, value_estimate, client_stated_need, next_action, next_action_due, notes, priority, is_stub, status, checkin_paused'
    )
    .eq('id', input.id)
    .eq('owner_id', ownerId)
    .single()

  if (fetchError || !current) throw new Error(fetchError?.message ?? 'Deal not found')

  const candidateFields = [
    'title',
    'stage',
    'service_type',
    'value_estimate',
    'client_stated_need',
    'next_action',
    'next_action_due',
    'notes',
    'priority',
    'is_stub',
    'status',
    'checkin_paused', // Story 4.8 — per-deal pause
  ] as const

  const hasChanged = (a: unknown, b: unknown) => JSON.stringify(a) !== JSON.stringify(b)

  let changedFields: string[] = []
  const updates: Record<string, unknown> = {}

  for (const field of candidateFields) {
    if (
      input[field] !== undefined &&
      hasChanged(current[field as keyof typeof current], input[field])
    ) {
      changedFields.push(field)
      updates[field] = input[field]
    }
  }

  // Human-edit protection: pragmatic 24h window per AD-14. Avoids N+1 per-field queries.
  // If the most recent activity log entry for this deal was by a human within 24h, all
  // AI-written changes are flagged as protected rather than silently overwriting.
  let protectedFields: string[] = []
  if (input.actor === 'ai' && changedFields.length > 0) {
    const { data: latestLog } = await supabase
      .from('activity_log')
      .select('actor, created_at')
      .eq('owner_id', ownerId)
      .eq('entity_type', 'deal')
      .eq('entity_id', input.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (latestLog && latestLog.actor === 'user') {
      const ageMs = Date.now() - new Date(latestLog.created_at as string).getTime()
      if (ageMs < 24 * 60 * 60 * 1000) {
        protectedFields = [...changedFields]
        changedFields = []
      }
    }
  }

  if (changedFields.length === 0) {
    return { updated: false, changedFields: [], protectedFields }
  }

  if (changedFields.includes('stage') && input.stage !== undefined) {
    const existingHistory: unknown[] = Array.isArray(current.stage_history)
      ? (current.stage_history as unknown[])
      : []
    updates.stage_history = [
      ...existingHistory,
      {
        from_stage: current.stage,
        to_stage: input.stage,
        changed_at: new Date().toISOString(),
      },
    ]
  }

  const logValues = { ...updates }
  updates.updated_at = new Date().toISOString()

  const { error: updateError } = await supabase
    .from('deals')
    .update(updates)
    .eq('id', input.id)
    .eq('owner_id', ownerId)

  if (updateError) throw new Error(updateError.message)

  await logActivity(ownerId, {
    entity_type: 'deal',
    entity_id: input.id,
    action: 'deal_updated',
    actor: input.actor,
    payload: { changedFields, values: logValues },
  })

  // Story 4.8: log specific pause/resume action when checkin_paused changes
  if (changedFields.includes('checkin_paused') && typeof input.checkin_paused === 'boolean') {
    logActivity(ownerId, {
      entity_type: 'deal',
      entity_id: input.id,
      action: input.checkin_paused ? 'checkin_paused' : 'checkin_resumed',
      actor: input.actor,
      payload: {},
    }).catch((err) => console.warn('updateDeal: checkin pause activity log failed:', err))
  }

  return { updated: true, changedFields, protectedFields }
}

// ── updateClient ──────────────────────────────────────────────────────────────

export interface UpdateClientInput {
  id: string
  actor: 'ai' | 'user'
  name?: string
  company?: string
  email?: string
  phone?: string
  industry?: string
  company_size?: 'solo' | 'small' | 'medium' | 'enterprise'
  relationship_stage?: 'cold' | 'warming' | 'trusted' | 'long_term'
  decision_maker?: string
  communication_style?: string
  known_hesitations?: string
  language_pref?: 'vi' | 'en'
  notes?: string
  is_stub?: boolean
  status?: string
}

export interface UpdateClientResult {
  updated: boolean
  changedFields: string[]
  protectedFields: string[]
}

export async function updateClient(
  ownerId: string,
  input: UpdateClientInput
): Promise<UpdateClientResult> {
  const supabase = createServerClient()

  const { data: current, error: fetchError } = await supabase
    .from('clients')
    .select(
      'id, name, company, email, phone, industry, company_size, relationship_stage, decision_maker, communication_style, known_hesitations, language_pref, notes, is_stub, status'
    )
    .eq('id', input.id)
    .eq('owner_id', ownerId)
    .single()

  if (fetchError || !current) throw new Error(fetchError?.message ?? 'Client not found')

  const candidateFields = [
    'name',
    'company',
    'email',
    'phone',
    'industry',
    'company_size',
    'relationship_stage',
    'decision_maker',
    'communication_style',
    'known_hesitations',
    'language_pref',
    'notes',
    'is_stub',
    'status',
  ] as const

  const hasChanged = (a: unknown, b: unknown) => JSON.stringify(a) !== JSON.stringify(b)

  let changedFields: string[] = []
  const updates: Record<string, unknown> = {}

  for (const field of candidateFields) {
    if (
      input[field] !== undefined &&
      hasChanged(current[field as keyof typeof current], input[field])
    ) {
      changedFields.push(field)
      updates[field] = input[field]
    }
  }

  // Human-edit protection: same 24h window pattern as updateDeal (AD-14)
  let protectedFields: string[] = []
  if (input.actor === 'ai' && changedFields.length > 0) {
    const { data: latestLog } = await supabase
      .from('activity_log')
      .select('actor, created_at')
      .eq('owner_id', ownerId)
      .eq('entity_type', 'client')
      .eq('entity_id', input.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (latestLog && latestLog.actor === 'user') {
      const ageMs = Date.now() - new Date(latestLog.created_at as string).getTime()
      if (ageMs < 24 * 60 * 60 * 1000) {
        protectedFields = [...changedFields]
        changedFields = []
      }
    }
  }

  if (changedFields.length === 0) {
    return { updated: false, changedFields: [], protectedFields }
  }

  const logValues = { ...updates }
  updates.updated_at = new Date().toISOString()

  const { error: updateError } = await supabase
    .from('clients')
    .update(updates)
    .eq('id', input.id)
    .eq('owner_id', ownerId)

  if (updateError) throw new Error(updateError.message)

  await logActivity(ownerId, {
    entity_type: 'client',
    entity_id: input.id,
    action: 'client_updated',
    actor: input.actor,
    payload: { changedFields, values: logValues },
  })

  return { updated: true, changedFields, protectedFields }
}
