import 'server-only'
import { createServerClient } from '@/lib/supabase/server'

/**
 * Upserts the owner's Business Context and writes an activity log entry (AD-14).
 * Throws on settings write failure. Activity log failure is non-fatal (logged, not thrown).
 */
export async function updateBusinessContext(
  ownerId: string,
  content: string,
  actor: 'ai' | 'user'
): Promise<void> {
  const supabase = createServerClient()

  const { error: upsertError } = await supabase
    .from('settings')
    .upsert({ owner_id: ownerId, business_context: content }, { onConflict: 'owner_id' })

  if (upsertError) throw upsertError

  // AD-14: append-only activity log — never UPDATE or DELETE
  const { error: logError } = await supabase.from('activity_log').insert({
    owner_id: ownerId,
    entity_type: 'settings',
    entity_id: ownerId, // settings are owner-scoped; no separate entity UUID
    action: 'business_context_updated',
    actor,
    payload: { length: content.length },
  })

  if (logError) {
    // Non-fatal: settings were saved successfully; log failure should not roll back the update
    console.error('[ARIA/businessContext] activity log write failed', logError)
  }
}
