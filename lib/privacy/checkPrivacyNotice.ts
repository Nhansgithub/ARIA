import 'server-only'
import { createServerClient } from '@/lib/supabase/server'

/**
 * Returns true if the owner has explicitly acknowledged the AI-processing privacy notice.
 * Returns false if acknowledgement is pending (modal must be shown before any AI call that
 * transmits owner PII to the Anthropic API). (AD-10, AC-1)
 */
export async function isPrivacyNoticeAcknowledged(ownerId: string): Promise<boolean> {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('settings')
    .select('ai_processing_notice_acknowledged_at')
    .eq('owner_id', ownerId)
    .single()

  // PGRST116 = no rows found (new owner with no settings row yet) → not acknowledged
  if (error && error.code !== 'PGRST116') {
    throw error
  }
  return data?.ai_processing_notice_acknowledged_at != null
}
