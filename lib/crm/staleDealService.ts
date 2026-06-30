import 'server-only'
import { createServerClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/crm/activityLogService'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CadenceConfig {
  staleThresholdDays: number // default 7 — idle days before marking stale
  firstFollowUpDays: number // default 3 — proposal cadence step 1
  secondFollowUpDays: number // default 7 — proposal cadence step 2
}

export const DEFAULT_CADENCE: CadenceConfig = {
  staleThresholdDays: 7,
  firstFollowUpDays: 3,
  secondFollowUpDays: 7,
}

export interface StaleDealResult {
  dealId: string
  title: string
  daysIdle: number
  wasMarkedStale: boolean
  alreadyStale: boolean
  cadenceStep: 1 | 2 | null
  cadenceReset: boolean
}

// ── Stage classification helpers ───────────────────────────────────────────────

export function isClosedStage(stage: string): boolean {
  const lower = stage.toLowerCase()
  return ['won', 'lost', 'archived', 'completed', 'signed'].some((kw) => lower.includes(kw))
}

export function isProposalStage(stage: string): boolean {
  const lower = stage.toLowerCase()
  return ['proposal', 'đề xuất', 'sent quote', 'quote sent'].some((kw) => lower.includes(kw))
}

export function computeCadenceStep(daysIdle: number, config: CadenceConfig): 1 | 2 | null {
  if (daysIdle >= config.secondFollowUpDays) return 2
  if (daysIdle >= config.firstFollowUpDays) return 1
  return null
}

// ── Config reader ──────────────────────────────────────────────────────────────

export async function getCadenceConfig(ownerId: string): Promise<CadenceConfig> {
  const supabase = createServerClient()
  const { data } = await supabase
    .from('settings')
    .select('cadence_config')
    .eq('owner_id', ownerId)
    .maybeSingle()

  if (!data?.cadence_config) return { ...DEFAULT_CADENCE }
  const persisted = data.cadence_config as Partial<CadenceConfig>
  return {
    staleThresholdDays: persisted.staleThresholdDays ?? DEFAULT_CADENCE.staleThresholdDays,
    firstFollowUpDays: persisted.firstFollowUpDays ?? DEFAULT_CADENCE.firstFollowUpDays,
    secondFollowUpDays: persisted.secondFollowUpDays ?? DEFAULT_CADENCE.secondFollowUpDays,
  }
}

// ── Detection engine ───────────────────────────────────────────────────────────

export async function detectAndFlagStaleDeals(
  ownerId: string,
  config: CadenceConfig = DEFAULT_CADENCE
): Promise<StaleDealResult[]> {
  const supabase = createServerClient()

  // Step 1: Fetch active non-stub deals
  const { data: rawDeals, error: dealsError } = await supabase
    .from('deals')
    .select('id, title, stage, stale_since, next_action, next_action_due')
    .eq('owner_id', ownerId)
    .eq('is_stub', false)
    .limit(100)

  if (dealsError) throw new Error(`detectAndFlagStaleDeals: ${dealsError.message}`)

  // Empty CRM guard: skip closed stages
  const activeDeals = (rawDeals ?? []).filter((d) => !isClosedStage(d.stage as string))
  if (activeDeals.length === 0) return []

  const todayStr = new Date().toISOString().split('T')[0]!
  const results: StaleDealResult[] = []

  for (const deal of activeDeals) {
    // Step 2: Get most recent activity_log entry for this deal
    const { data: logEntries } = await supabase
      .from('activity_log')
      .select('actor, created_at')
      .eq('owner_id', ownerId)
      .eq('entity_id', deal.id)
      .eq('entity_type', 'deal')
      .order('created_at', { ascending: false })
      .limit(1)

    const lastEntry = (logEntries ?? [])[0] as { actor: string; created_at: string } | undefined

    // Skip deals with no activity history — can't compute idle without a baseline
    if (!lastEntry) continue

    const lastActivityDateStr = lastEntry.created_at.split('T')[0]!
    const daysIdle = Math.floor(
      (new Date(todayStr + 'T00:00:00Z').getTime() -
        new Date(lastActivityDateStr + 'T00:00:00Z').getTime()) /
        86_400_000
    )

    const alreadyStale = deal.stale_since !== null
    let wasMarkedStale = false

    // Step 3: Mark stale (idempotent — only if stale_since is currently null)
    if (daysIdle >= config.staleThresholdDays && !alreadyStale) {
      const { error: updateError } = await supabase
        .from('deals')
        .update({ stale_since: lastActivityDateStr })
        .eq('id', deal.id)
        .eq('owner_id', ownerId)
        .is('stale_since', null)

      if (!updateError) {
        wasMarkedStale = true
        // Fire-and-forget: log failure must not roll back the stale_since write
        logActivity(ownerId, {
          entity_type: 'deal',
          entity_id: deal.id,
          action: 'stale_detected',
          actor: 'ai',
          payload: { days_idle: daysIdle, stale_since: lastActivityDateStr },
        }).catch((err) => console.warn('staleDealService stale_detected log failed:', err))
      }
    }

    // Step 4: Proposal cadence
    let cadenceStep: 1 | 2 | null = null
    let cadenceReset = false

    if (isProposalStage(deal.stage as string)) {
      const currentNextAction = deal.next_action as string | null
      // Reset cadence if last activity was by user and deal is no longer idle enough
      if (
        lastEntry.actor === 'user' &&
        daysIdle < config.firstFollowUpDays &&
        typeof currentNextAction === 'string' &&
        currentNextAction.startsWith('Nhắc lần')
      ) {
        await supabase
          .from('deals')
          .update({ next_action: null, next_action_due: null })
          .eq('id', deal.id)
          .eq('owner_id', ownerId)
        cadenceReset = true
      } else if (daysIdle >= config.firstFollowUpDays) {
        cadenceStep = computeCadenceStep(daysIdle, config)

        if (cadenceStep !== null) {
          const cadenceMessage =
            cadenceStep === 1
              ? `Nhắc lần 1: Theo dõi đề xuất — đã ${daysIdle} ngày chưa có phản hồi`
              : `Nhắc lần 2: Theo dõi đề xuất — đã ${daysIdle} ngày chưa có phản hồi`

          // Idempotency: compare cadence step prefix, not full message (day count changes daily)
          const alreadyAtStep1 =
            cadenceStep === 1 &&
            typeof currentNextAction === 'string' &&
            currentNextAction.startsWith('Nhắc lần 1')
          const alreadyAtStep2 =
            cadenceStep === 2 &&
            typeof currentNextAction === 'string' &&
            currentNextAction.startsWith('Nhắc lần 2')
          const stepChanged = !(alreadyAtStep1 || alreadyAtStep2)

          if (stepChanged) {
            await supabase
              .from('deals')
              .update({ next_action: cadenceMessage, next_action_due: todayStr })
              .eq('id', deal.id)
              .eq('owner_id', ownerId)

            // Fire-and-forget: log failure must not roll back the deal update
            logActivity(ownerId, {
              entity_type: 'deal',
              entity_id: deal.id,
              action: 'follow_up_cadence_flagged',
              actor: 'ai',
              payload: { days_idle: daysIdle, cadence_step: cadenceStep },
            }).catch((err) =>
              console.warn('staleDealService follow_up_cadence_flagged log failed:', err)
            )
          }
        }
      }
    }

    results.push({
      dealId: deal.id,
      title: deal.title as string,
      daysIdle,
      wasMarkedStale,
      alreadyStale,
      cadenceStep,
      cadenceReset,
    })
  }

  return results
}
