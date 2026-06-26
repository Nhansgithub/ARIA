import 'server-only'
import { createServerClient } from '@/lib/supabase/server'

/**
 * Deletes a deal and its associated screenshot from Storage.
 * Activity log entry is appended (AD-14: append-only, prior entries retained).
 * Storage delete is best-effort — a failure is logged but does not abort the DB delete.
 * Must use createServerClient() (AD-13: never createServiceClient() for owner data).
 */
export async function deleteDeal(ownerId: string, dealId: string): Promise<void> {
  const supabase = createServerClient()

  const { data: deal } = await supabase
    .from('deals')
    .select('title, file_url')
    .eq('id', dealId)
    .eq('owner_id', ownerId)
    .single()

  if (deal?.file_url) {
    const { error: storageError } = await supabase.storage
      .from('screenshots')
      .remove([deal.file_url])
    if (storageError) {
      console.error(
        '[deleteService] Storage delete failed for deal',
        dealId,
        '— continuing with DB delete:',
        storageError
      )
    }
  }

  await supabase.from('deals').delete().eq('id', dealId).eq('owner_id', ownerId)

  // AD-14: activity_log is append-only; prior entries for this deal are intentionally retained
  const { error: logError } = await supabase.from('activity_log').insert({
    owner_id: ownerId,
    entity_type: 'deal',
    entity_id: dealId,
    action: 'deal_deleted',
    actor: 'user',
    payload: { deal_title: deal?.title ?? dealId },
  })
  if (logError) {
    console.error('[deleteService] activity_log insert failed for deal', dealId, ':', logError)
  }
}

/**
 * Deletes a client and cleans up screenshots for all linked deals before the cascade.
 * ON DELETE CASCADE in the schema removes child deal/document/check_in rows after this.
 * Activity log entry is appended (AD-14).
 */
export async function deleteClient(ownerId: string, clientId: string): Promise<void> {
  const supabase = createServerClient()

  const { data: client } = await supabase
    .from('clients')
    .select('name')
    .eq('id', clientId)
    .eq('owner_id', ownerId)
    .single()

  // Collect all deal screenshot paths before the cascade removes the deal rows
  const { data: deals } = await supabase
    .from('deals')
    .select('id, file_url')
    .eq('client_id', clientId)
    .eq('owner_id', ownerId)

  const screenshotPaths = (deals ?? []).map((d) => d.file_url).filter(Boolean) as string[]

  if (screenshotPaths.length > 0) {
    const { error: storageError } = await supabase.storage
      .from('screenshots')
      .remove(screenshotPaths)
    if (storageError) {
      console.error(
        '[deleteService] Storage delete failed for client',
        clientId,
        '— continuing with DB delete:',
        storageError
      )
    }
  }

  // DB delete: ON DELETE CASCADE removes linked deals, documents, check_ins
  await supabase.from('clients').delete().eq('id', clientId).eq('owner_id', ownerId)

  // AD-14: activity_log entries referencing deleted entities are intentionally retained
  const { error: logError } = await supabase.from('activity_log').insert({
    owner_id: ownerId,
    entity_type: 'client',
    entity_id: clientId,
    action: 'client_deleted',
    actor: 'user',
    payload: { client_name: client?.name ?? clientId },
  })
  if (logError) {
    console.error('[deleteService] activity_log insert failed for client', clientId, ':', logError)
  }
}
