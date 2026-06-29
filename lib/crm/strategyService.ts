import 'server-only'
import { createServerClient } from '@/lib/supabase/server'

// ── PipelineSummary types ──────────────────────────────────────────────────────

export interface PipelineDealRow {
  id: string
  title: string
  service_type: string
  stage: string
  predicted_outcome: string | null
  risk_flag_types: string[] // extracted flag names from risk_flags jsonb array
  created_at: string
}

export interface PipelineSummary {
  total_deals: number
  by_stage: Record<string, number>
  by_service_type: Record<string, number>
  by_predicted_outcome: Record<string, number>
  recent_deals: PipelineDealRow[]
  days_back: number
}

// ── getPipelineSummary ─────────────────────────────────────────────────────────

export async function getPipelineSummary(ownerId: string, daysBack = 90): Promise<PipelineSummary> {
  const empty: PipelineSummary = {
    total_deals: 0,
    by_stage: {},
    by_service_type: {},
    by_predicted_outcome: {},
    recent_deals: [],
    days_back: daysBack,
  }

  try {
    const supabase = createServerClient()
    const since = new Date(Date.now() - daysBack * 86_400_000).toISOString()

    const { data, error } = await supabase
      .from('deals')
      .select('id, title, service_type, stage, predicted_outcome, risk_flags, created_at')
      .eq('owner_id', ownerId)
      .eq('is_stub', false)
      .gte('created_at', since)
      .order('created_at', { ascending: false })

    if (error || !data) return empty

    const by_stage: Record<string, number> = {}
    const by_service_type: Record<string, number> = {}
    const by_predicted_outcome: Record<string, number> = {}
    const recent_deals: PipelineDealRow[] = []

    for (const row of data) {
      // Aggregate counts
      by_stage[row.stage] = (by_stage[row.stage] ?? 0) + 1
      by_service_type[row.service_type] = (by_service_type[row.service_type] ?? 0) + 1
      if (row.predicted_outcome) {
        by_predicted_outcome[row.predicted_outcome] =
          (by_predicted_outcome[row.predicted_outcome] ?? 0) + 1
      }

      // Extract risk flag names from jsonb array
      const riskFlags = Array.isArray(row.risk_flags) ? row.risk_flags : []
      const risk_flag_types = riskFlags
        .map((f: unknown) =>
          typeof f === 'object' && f !== null && 'flag' in f
            ? String((f as { flag: unknown }).flag)
            : ''
        )
        .filter(Boolean)

      recent_deals.push({
        id: row.id,
        title: row.title,
        service_type: row.service_type,
        stage: row.stage,
        predicted_outcome: row.predicted_outcome,
        risk_flag_types,
        created_at: row.created_at,
      })
    }

    return {
      total_deals: data.length,
      by_stage,
      by_service_type,
      by_predicted_outcome,
      recent_deals,
      days_back: daysBack,
    }
  } catch {
    return empty // AD-6: never throw — return empty summary so Claude can still reason
  }
}
