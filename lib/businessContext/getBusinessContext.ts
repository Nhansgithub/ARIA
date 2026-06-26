import 'server-only'
import { createServerClient } from '@/lib/supabase/server'
import { MAX_BUSINESS_CONTEXT_CHARS } from './constants'

export { MAX_BUSINESS_CONTEXT_CHARS } from './constants'

export function trimToTokenBudget(content: string): string {
  return content.slice(0, MAX_BUSINESS_CONTEXT_CHARS)
}

/**
 * Fetches the owner's Business Context from the settings table.
 * Returns null if the owner has no context yet or on any DB error (AD-6: graceful degradation).
 * Trims to MAX_BUSINESS_CONTEXT_CHARS and logs a warning if the stored content exceeds the budget.
 */
export async function getBusinessContext(ownerId: string): Promise<string | null> {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('settings')
    .select('business_context')
    .eq('owner_id', ownerId)
    .single()

  // PGRST116 = no rows (new owner with no settings row yet) → no context
  if (error) {
    if (error.code !== 'PGRST116') {
      console.error('[ARIA/businessContext] fetch error', error)
    }
    return null // AD-6: AI call proceeds without context
  }

  const content = data?.business_context
  if (!content) return null

  if (content.length > MAX_BUSINESS_CONTEXT_CHARS) {
    console.warn(
      `[ARIA/businessContext] trimmed ${content.length} → ${MAX_BUSINESS_CONTEXT_CHARS} chars for owner ${ownerId}`
    )
    return trimToTokenBudget(content)
  }

  return content
}
