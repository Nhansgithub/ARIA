import 'server-only'
import { createServerClient } from '@/lib/supabase/server'
import { updateDeal, updateClient } from '@/lib/crm/crmService'
import { logActivity } from '@/lib/crm/activityLogService'

// ── checkStubEnrichment ───────────────────────────────────────────────────────

export interface StubEnrichmentResult {
  isEnriched: boolean
  missingFields: string[]
}

export async function checkStubEnrichment(
  ownerId: string,
  dealId: string
): Promise<StubEnrichmentResult> {
  const supabase = createServerClient()

  const { data, error } = await supabase
    .from('deals')
    .select('id, client_stated_need, service_type, stage, value_estimate, is_stub')
    .eq('id', dealId)
    .eq('owner_id', ownerId)
    .single()

  if (error || !data) throw new Error(error?.message ?? 'Deal not found')
  if (!data.is_stub) throw new Error('Record is not a stub')

  const requiredFields = ['client_stated_need', 'service_type', 'stage', 'value_estimate'] as const
  const missingFields: string[] = []

  for (const field of requiredFields) {
    const val = data[field as keyof typeof data]
    if (val === null || val === undefined || val === '') {
      missingFields.push(field)
    }
  }

  return { isEnriched: missingFields.length === 0, missingFields }
}

// ── promoteStub ───────────────────────────────────────────────────────────────

export interface PromoteStubInput {
  entity_type: 'client' | 'deal'
  entity_id: string
  actor: 'ai' | 'user'
}

export interface PromoteStubResult {
  promoted: boolean
  entity_id: string
  missingFields?: string[]
}

export async function promoteStub(
  ownerId: string,
  input: PromoteStubInput
): Promise<PromoteStubResult> {
  if (input.entity_type === 'deal') {
    const enrichment = await checkStubEnrichment(ownerId, input.entity_id)
    if (!enrichment.isEnriched) {
      return {
        promoted: false,
        entity_id: input.entity_id,
        missingFields: enrichment.missingFields,
      }
    }

    const dealResult = await updateDeal(ownerId, {
      id: input.entity_id,
      actor: input.actor,
      is_stub: false,
    })
    if (!dealResult.updated) return { promoted: true, entity_id: input.entity_id }
  } else {
    const supabase = createServerClient()
    const { data, error } = await supabase
      .from('clients')
      .select('id, name, company')
      .eq('id', input.entity_id)
      .eq('owner_id', ownerId)
      .single()

    if (error || !data) throw new Error(error?.message ?? 'Client not found')

    const missing: string[] = []
    if (!data.name) missing.push('name')
    if (!data.company) missing.push('company')

    if (missing.length > 0) {
      return { promoted: false, entity_id: input.entity_id, missingFields: missing }
    }

    const clientResult = await updateClient(ownerId, {
      id: input.entity_id,
      actor: input.actor,
      is_stub: false,
    })
    if (!clientResult.updated) return { promoted: true, entity_id: input.entity_id }
  }

  await logActivity(ownerId, {
    entity_type: input.entity_type,
    entity_id: input.entity_id,
    action: 'stub_promoted',
    actor: input.actor,
    payload: {},
  })

  return { promoted: true, entity_id: input.entity_id }
}

// ── archiveStub ───────────────────────────────────────────────────────────────

export interface ArchiveStubInput {
  entity_type: 'client' | 'deal'
  entity_id: string
  actor: 'ai' | 'user'
}

export interface ArchiveStubResult {
  archived: boolean
  entity_id: string
}

export async function archiveStub(
  ownerId: string,
  input: ArchiveStubInput
): Promise<ArchiveStubResult> {
  let updated: boolean

  if (input.entity_type === 'deal') {
    const result = await updateDeal(ownerId, {
      id: input.entity_id,
      actor: input.actor,
      status: 'archived',
    })
    updated = result.updated
  } else {
    const result = await updateClient(ownerId, {
      id: input.entity_id,
      actor: input.actor,
      status: 'archived',
    })
    updated = result.updated
  }

  if (!updated) return { archived: true, entity_id: input.entity_id }

  await logActivity(ownerId, {
    entity_type: input.entity_type,
    entity_id: input.entity_id,
    action: 'stub_archived',
    actor: input.actor,
    payload: { reason: 'archived_via_conversation' },
  })

  return { archived: true, entity_id: input.entity_id }
}

// ── findStaleStubs ────────────────────────────────────────────────────────────

export interface StaleStubRecord {
  id: string
  title: string
  client_id: string
  created_at: string
  daysSinceUpdate: number
}

export async function findStaleStubs(
  ownerId: string,
  idleThresholdDays = 14
): Promise<StaleStubRecord[]> {
  const supabase = createServerClient()

  const { data: stubs, error } = await supabase
    .from('deals')
    .select('id, title, client_id, created_at')
    .eq('owner_id', ownerId)
    .eq('is_stub', true)
    .neq('status', 'archived')

  if (error) throw new Error(error.message)
  if (!stubs || stubs.length === 0) return []

  const cutoff = new Date(Date.now() - idleThresholdDays * 24 * 60 * 60 * 1000).toISOString()
  const staleRecords: StaleStubRecord[] = []

  // TODO(perf): batch with a single subquery when stub count grows
  for (const stub of stubs) {
    const { data: recentLog } = await supabase
      .from('activity_log')
      .select('id')
      .eq('owner_id', ownerId)
      .eq('entity_id', stub.id)
      .gte('created_at', cutoff)
      .limit(1)

    if (!recentLog || recentLog.length === 0) {
      const ageMs = Date.now() - new Date(stub.created_at as string).getTime()
      const daysSinceUpdate = Math.floor(ageMs / (24 * 60 * 60 * 1000))
      staleRecords.push({
        id: stub.id as string,
        title: stub.title as string,
        client_id: stub.client_id as string,
        created_at: stub.created_at as string,
        daysSinceUpdate,
      })
    }
  }

  staleRecords.sort((a, b) => b.daysSinceUpdate - a.daysSinceUpdate)
  return staleRecords
}
