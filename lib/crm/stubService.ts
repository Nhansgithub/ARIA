import 'server-only'
import { createServerClient } from '@/lib/supabase/server'

export interface ClientStubInput {
  name: string
  company?: string
  industry?: string
  language_pref?: 'vi' | 'en'
  notes?: string
}

export interface DealStubInput {
  client_id: string
  title?: string
  service_type?: 'web_design' | 'web_app' | 'automation' | 'other'
  client_stated_need?: string
  value_estimate?: number
  stage?: string
}

export async function createClientStub(
  ownerId: string,
  input: ClientStubInput
): Promise<{ id: string; name: string; company: string | null }> {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('clients')
    .insert({
      owner_id: ownerId,
      name: input.name,
      company: input.company ?? null,
      industry: input.industry ?? null,
      language_pref: input.language_pref ?? 'vi',
      notes: input.notes ?? null,
      is_stub: true,
    })
    .select('id, name, company')
    .single()

  if (error || !data) {
    throw new Error(`Failed to create client stub: ${error?.message ?? 'no data returned'}`)
  }

  const { error: logError } = await supabase.from('activity_log').insert({
    owner_id: ownerId,
    entity_type: 'client',
    entity_id: data.id,
    action: 'client_stub_created',
    actor: 'ai',
    payload: { name: data.name, company: data.company },
  })
  if (logError) console.error('[stubService] activity_log insert failed:', logError)

  return data
}

export async function createDealStub(
  ownerId: string,
  input: DealStubInput
): Promise<{ id: string; title: string }> {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('deals')
    .insert({
      owner_id: ownerId,
      client_id: input.client_id,
      title: input.title ?? 'New deal',
      service_type: input.service_type ?? 'other',
      client_stated_need: input.client_stated_need ?? null,
      value_estimate: input.value_estimate ?? null,
      stage: input.stage ?? 'prospect',
      is_stub: true,
    })
    .select('id, title')
    .single()

  if (error || !data) {
    throw new Error(`Failed to create deal stub: ${error?.message ?? 'no data returned'}`)
  }

  const { error: logError } = await supabase.from('activity_log').insert({
    owner_id: ownerId,
    entity_type: 'deal',
    entity_id: data.id,
    action: 'deal_stub_created',
    actor: 'ai',
    payload: { title: data.title, client_id: input.client_id },
  })
  if (logError) console.error('[stubService] activity_log insert failed:', logError)

  return data
}

export async function findSimilarClients(
  ownerId: string,
  query: { name?: string; company?: string }
): Promise<Array<{ id: string; name: string; company: string | null }>> {
  const supabase = createServerClient()
  const q = supabase.from('clients').select('id, name, company').eq('owner_id', ownerId)

  // Use OR semantics so either a name match OR a company match counts as a duplicate candidate.
  // Chained .ilike() calls in PostgREST use AND, which would miss real duplicates.
  const conditions: string[] = []
  if (query.name) conditions.push(`name.ilike.%${query.name}%`)
  if (query.company) conditions.push(`company.ilike.%${query.company}%`)

  const { data, error } =
    conditions.length > 0 ? await q.or(conditions.join(',')).limit(5) : await q.limit(5)

  if (error) throw new Error(`findSimilarClients failed: ${error.message}`)
  return data ?? []
}
