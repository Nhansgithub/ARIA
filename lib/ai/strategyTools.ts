// lib/ai/strategyTools.ts
// Pure data — no 'server-only', no @anthropic-ai/sdk import.
// Shape matches Anthropic.Tool; agentWithTools.ts casts to Anthropic.Tool[].

export const STRATEGY_TOOLS = [
  {
    name: 'find_similar_deals',
    description:
      'Find past deals with similar service type or client industry for pattern matching. Use to ground strategy advice in "Based on your past X deals…" reasoning. Returns up to 5 deals.',
    input_schema: {
      type: 'object' as const,
      properties: {
        service_type: {
          type: 'string',
          enum: ['web_design', 'web_app', 'automation', 'other'],
          description: 'Service type to match',
        },
        industry: {
          type: 'string',
          description: 'Client industry (e.g. F&B, retail, professional_services)',
        },
        exclude_deal_id: {
          type: 'string',
          description: 'Deal UUID to exclude (the current deal)',
        },
      },
      required: [] as readonly string[],
    },
  },
  {
    name: 'get_pipeline_summary',
    description:
      "Fetch a summary of the Owner's full deal pipeline for cross-deal pattern analysis. Returns: total deal counts by stage, counts by service_type, counts by predicted_outcome, and a list of deals from the past 90 days (id, title, service_type, stage, predicted_outcome, risk_flag_types, created_at). Use this to ground strategy advice in the Owner's actual data and to detect cross-deal patterns (≥3 deals sharing a trait).",
    input_schema: {
      type: 'object' as const,
      properties: {
        days_back: {
          type: 'number',
          description: 'Rolling window in days (default 90)',
        },
      },
      required: [] as readonly string[],
    },
  },
] as const
