// lib/ai/dealIntelligenceTools.ts
// Pure data — no 'server-only', no @anthropic-ai/sdk import.
// Shape matches Anthropic.Tool; agentWithTools.ts casts to Anthropic.Tool[].

export const DI_TOOLS = [
  {
    name: 'find_similar_deals',
    description:
      'Find past deals with similar service type or client industry for pattern matching. Always call this to populate "Based on your past deals…" reasoning. Returns up to 5 deals.',
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
    name: 'get_activity_log',
    description:
      'Fetch the activity log for a specific deal. Use when the Owner asks about history, recent changes, or what happened to a deal. Returns entries in chronological order with actor (ai|user), action, payload, and created_at.',
    input_schema: {
      type: 'object' as const,
      properties: {
        entity_id: {
          type: 'string',
          description: 'Deal UUID to query',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of log entries to return (default: 50)',
        },
      },
      required: ['entity_id'] as readonly string[],
    },
  },
  {
    name: 'get_client',
    description:
      'Fetch a client record by UUID or name. Use after get_deal to load client context (industry, relationship_stage, decision_maker).',
    input_schema: {
      type: 'object' as const,
      properties: {
        id: { type: 'string', description: 'Client UUID (preferred)' },
        name: { type: 'string', description: 'Client name to search (partial match)' },
      },
      required: [] as readonly string[],
    },
  },
  {
    name: 'get_deal',
    description:
      'Fetch a specific deal by UUID or title. Always call this first when the Owner mentions a deal — load the full deal context before analysis. Returns standard deal fields plus stale_since (ISO date of last activity), stall_diagnosis (last written diagnosis), and days_stalled (computed server-side — 0 or positive means stalled, null means never stalled).',
    input_schema: {
      type: 'object' as const,
      properties: {
        id: { type: 'string', description: 'Deal UUID (preferred if known)' },
        title: { type: 'string', description: 'Deal title to search (partial match)' },
      },
      required: [] as readonly string[],
    },
  },
  {
    name: 'get_pricing_floors',
    description:
      "Fetch the Owner's pricing benchmarks (floor and ceiling per service type). Call this in Step 1 alongside get_deal and get_client — use the result to check if the deal's value_estimate is below floor for its service_type. Returns an object keyed by service_type (web_design, web_app, automation, other) with floor (VND), optional ceiling (VND), and currency fields. Returns {} if no benchmarks configured.",
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [] as readonly string[],
    },
  },
  {
    name: 'update_intelligence_fields',
    description:
      'Idempotently update AI-maintained Intelligence Fields on a deal. Only writes fields with changed values; logs changes with actor=ai (AD-14). Call ONCE after composing the response — never mid-analysis.',
    input_schema: {
      type: 'object' as const,
      properties: {
        deal_id: { type: 'string', description: 'Deal UUID to update (required)' },
        inferred_real_need: {
          type: 'string',
          description: 'The underlying need distinct from the stated need',
        },
        risk_flags: {
          type: 'array',
          description:
            'Risk flags with severity. Each item: {flag: string, severity: HIGH|MEDIUM|LOW, noted_at: ISO date}',
          items: {
            type: 'object' as const,
            properties: {
              flag: { type: 'string' },
              severity: { type: 'string', enum: ['HIGH', 'MEDIUM', 'LOW'] },
              noted_at: { type: 'string' },
            },
          },
        },
        opportunity_signals: {
          type: 'array',
          description: 'Positive deal signals. Each item: {signal: string}',
          items: {
            type: 'object' as const,
            properties: { signal: { type: 'string' } },
          },
        },
        predicted_outcome: {
          type: 'string',
          enum: ['likely_win', 'uncertain', 'at_risk', 'likely_lost'],
          description: 'AI-predicted deal outcome',
        },
        prediction_reason: {
          type: 'string',
          description: 'Reason for the prediction',
        },
        similar_deals: {
          type: 'array',
          description: 'Similar past deals. Each item: {deal_id: uuid, similarity_reason: string}',
          items: {
            type: 'object' as const,
            properties: {
              deal_id: { type: 'string' },
              similarity_reason: { type: 'string' },
            },
          },
        },
        stall_diagnosis: {
          type: 'string',
          description:
            'Stall diagnosis — one sentence naming the probable cause and cultural/seasonal context. Write when the deal has been quiet for ≥7 days.',
        },
      },
      required: ['deal_id'] as readonly string[],
    },
  },
] as const
