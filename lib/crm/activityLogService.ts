import 'server-only'
import { createServerClient } from '@/lib/supabase/server'

export interface LogActivityParams {
  entity_type: 'client' | 'deal' | 'document' | 'settings'
  entity_id: string
  action: string
  actor: 'ai' | 'user'
  payload?: Record<string, unknown>
}

export interface ActivityLogRow {
  id: string
  owner_id: string
  entity_type: string
  entity_id: string
  action: string
  actor: string
  payload: Record<string, unknown>
  created_at: string
  // NOTE: no updated_at — this table is append-only (AD-14)
}

export async function logActivity(ownerId: string, params: LogActivityParams): Promise<void> {
  const supabase = createServerClient()
  const { error } = await supabase.from('activity_log').insert({
    owner_id: ownerId,
    entity_type: params.entity_type,
    entity_id: params.entity_id,
    action: params.action,
    actor: params.actor,
    payload: params.payload ?? {},
  })
  if (error) throw new Error(`logActivity failed: ${error.message}`)
}

export async function getActivityLog(
  ownerId: string,
  params: { entity_id: string; entity_type?: string; limit?: number }
): Promise<ActivityLogRow[]> {
  const supabase = createServerClient()
  let q = supabase
    .from('activity_log')
    .select('id, owner_id, entity_type, entity_id, action, actor, payload, created_at')
    .eq('owner_id', ownerId)
    .eq('entity_id', params.entity_id)
    .order('created_at', { ascending: false })
    .limit(params.limit ?? 20)

  if (params.entity_type) {
    q = q.eq('entity_type', params.entity_type)
  }

  const { data, error } = await q
  if (error) throw new Error(`getActivityLog failed: ${error.message}`)
  return (data ?? []) as ActivityLogRow[]
}
