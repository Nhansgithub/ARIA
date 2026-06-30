// lib/ai/crmTools.ts
// Pure data — no 'server-only', no @anthropic-ai/sdk import.
// Shape matches Anthropic.Tool; agentWithTools.ts casts to Anthropic.Tool[].

export const CRM_STUB_TOOLS = [
  {
    name: 'archive_stub',
    description:
      'Archive a stub client or deal by setting status=archived. Use when the Owner discards or merges a stub. This is NOT a delete — the record is preserved for audit. Always confirm with the Owner before archiving.',
    input_schema: {
      type: 'object' as const,
      properties: {
        entity_type: {
          type: 'string',
          enum: ['client', 'deal'],
          description: 'Type of entity to archive',
        },
        entity_id: { type: 'string', description: 'UUID of the stub record to archive' },
        actor: {
          type: 'string',
          enum: ['ai', 'user'],
          description:
            '"user" when the Owner requested it; "ai" if ARIA auto-archives after confirmed idle',
        },
      },
      required: ['entity_type', 'entity_id', 'actor'] as readonly string[],
    },
  },
  {
    name: 'check_stub_enrichment',
    description:
      'Check whether a deal stub has all four required enrichment fields (client_stated_need, service_type, stage, value_estimate). Returns isEnriched and a list of missing fields. Call before promote_stub.',
    input_schema: {
      type: 'object' as const,
      properties: {
        entity_id: { type: 'string', description: 'UUID of the deal stub to check' },
      },
      required: ['entity_id'] as readonly string[],
    },
  },
  {
    name: 'create_client_stub',
    description:
      'Create a new client stub record. Only call AFTER find_similar_clients confirms no match exists. The stub will be enriched in later CRM conversations.',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'Client contact name (required)' },
        company: { type: 'string', description: 'Company or business name' },
        industry: {
          type: 'string',
          description: 'Industry: F&B, retail, professional_services, or other',
        },
        language_pref: {
          type: 'string',
          enum: ['vi', 'en'],
          description: "Client's preferred language",
        },
        notes: { type: 'string', description: 'Context from the conversation' },
      },
      required: ['name'] as readonly string[],
    },
  },
  {
    name: 'create_deal_stub',
    description:
      'Create a new deal stub linked to a client. Always call create_client_stub first (or use find_similar_clients result) to obtain the client_id.',
    input_schema: {
      type: 'object' as const,
      properties: {
        client_id: { type: 'string', description: 'UUID of the client record (required)' },
        title: { type: 'string', description: 'Brief deal description' },
        service_type: {
          type: 'string',
          enum: ['web_design', 'web_app', 'automation', 'other'],
          description: 'Service type',
        },
        client_stated_need: {
          type: 'string',
          description: 'What the client said they want, verbatim',
        },
        value_estimate: { type: 'number', description: 'Estimated deal value in VND' },
        stage: {
          type: 'string',
          description: 'Deal stage — e.g. prospect, qualified, proposal',
        },
      },
      required: ['client_id'] as readonly string[],
    },
  },
  {
    name: 'find_similar_clients',
    description:
      'Search for existing clients by name or company. ALWAYS call this first when the Owner mentions a new client, to avoid creating duplicates.',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'Client or contact name to search' },
        company: { type: 'string', description: 'Company or business name to search' },
      },
      required: [] as readonly string[],
    },
  },
  {
    name: 'get_client',
    description:
      'Retrieve a client record by id or name. Use to read current client state before updating or for Deal Intelligence context.',
    input_schema: {
      type: 'object' as const,
      properties: {
        id: { type: 'string', description: 'Client UUID (preferred — exact match)' },
        name: {
          type: 'string',
          description: 'Client name (fuzzy match — use when id is unknown)',
        },
      },
      required: [] as readonly string[],
    },
  },
  {
    name: 'get_deal',
    description:
      'Retrieve a deal record by id or title. Use to read current deal state before updating or for Deal Intelligence context.',
    input_schema: {
      type: 'object' as const,
      properties: {
        id: { type: 'string', description: 'Deal UUID (preferred — exact match)' },
        title: {
          type: 'string',
          description: 'Deal title (fuzzy match — use when id is unknown)',
        },
      },
      required: [] as readonly string[],
    },
  },
  {
    name: 'list_deals',
    description:
      'List deals for the Owner with optional filters. Use for pipeline queries like "what are my active deals?" or "show me all prospects". Returns up to 20 deals by default.',
    input_schema: {
      type: 'object' as const,
      properties: {
        stage: {
          type: 'string',
          description:
            'Filter by stage — e.g. prospect, qualified, proposal, negotiation, won, lost',
        },
        is_stub: { type: 'boolean', description: 'Set false to exclude stub records from results' },
        limit: { type: 'number', description: 'Maximum results to return (default 20, max 50)' },
      },
      required: [] as readonly string[],
    },
  },
  {
    name: 'log_activity',
    description:
      'Append an activity log entry for a client, deal, or document event not covered by a field write — e.g. a phone call noted by the Owner, a stage-change note, or a custom action.',
    input_schema: {
      type: 'object' as const,
      properties: {
        entity_type: {
          type: 'string',
          enum: ['client', 'deal', 'document', 'settings'],
          description: 'The type of entity this log entry is about',
        },
        entity_id: { type: 'string', description: 'UUID of the entity' },
        action: {
          type: 'string',
          description:
            'Descriptive action string e.g. "phone_call_noted", "stage_changed", "note_added"',
        },
        actor: {
          type: 'string',
          enum: ['ai', 'user'],
          description:
            '"user" when the Owner provided the information; "ai" when ARIA acted autonomously',
        },
        payload: {
          type: 'object',
          description:
            'Optional jsonb payload capturing relevant context (old/new values, note text, etc.)',
        },
      },
      required: ['entity_type', 'entity_id', 'action', 'actor'] as readonly string[],
    },
  },
  {
    name: 'promote_stub',
    description:
      'Promote an enriched stub to a full record by setting is_stub=false. Call check_stub_enrichment first to confirm all required fields are present. Promotion is a state transition on the same record — it does NOT create a new record.',
    input_schema: {
      type: 'object' as const,
      properties: {
        entity_type: {
          type: 'string',
          enum: ['client', 'deal'],
          description: 'Type of entity to promote',
        },
        entity_id: { type: 'string', description: 'UUID of the stub record to promote' },
        actor: {
          type: 'string',
          enum: ['ai', 'user'],
          description: '"user" if the Owner provided the final fields; "ai" if ARIA inferred them',
        },
      },
      required: ['entity_type', 'entity_id', 'actor'] as readonly string[],
    },
  },
  {
    name: 'update_client',
    description:
      'Update one or more fields on an existing client record. Only supply fields that have changed — unsupplied fields are untouched. Set actor="user" when the Owner provided the new information; actor="ai" when ARIA is inferring it.',
    input_schema: {
      type: 'object' as const,
      properties: {
        id: { type: 'string', description: 'Client UUID (required)' },
        actor: {
          type: 'string',
          enum: ['ai', 'user'],
          description: '"user" if the Owner stated this; "ai" if ARIA inferred it',
        },
        name: { type: 'string' },
        company: { type: 'string' },
        email: { type: 'string' },
        phone: { type: 'string' },
        industry: { type: 'string' },
        company_size: { type: 'string', enum: ['solo', 'small', 'medium', 'enterprise'] },
        relationship_stage: {
          type: 'string',
          enum: ['cold', 'warming', 'trusted', 'long_term'],
        },
        decision_maker: { type: 'string', description: 'Name/role of the actual decision-maker' },
        communication_style: { type: 'string' },
        known_hesitations: { type: 'string' },
        language_pref: { type: 'string', enum: ['vi', 'en'] },
        notes: { type: 'string' },
      },
      required: ['id', 'actor'] as readonly string[],
    },
  },
  {
    name: 'update_deal',
    description:
      'Update one or more fields on an existing deal record. Only supply fields that have changed — unsupplied fields are untouched. Use update_intelligence_fields for AI-maintained analysis fields (inferred_real_need, risk_flags, etc.). Set actor="user" when the Owner stated this; actor="ai" when ARIA infers it. Use checkin_paused=true/false to pause or resume check-in reminders for a deal.',
    input_schema: {
      type: 'object' as const,
      properties: {
        id: { type: 'string', description: 'Deal UUID (required)' },
        actor: {
          type: 'string',
          enum: ['ai', 'user'],
          description: '"user" if the Owner stated this; "ai" if ARIA inferred it',
        },
        title: { type: 'string' },
        stage: {
          type: 'string',
          description: 'Deal stage — e.g. prospect, qualified, proposal, negotiation, won, lost',
        },
        service_type: { type: 'string', enum: ['web_design', 'web_app', 'automation', 'other'] },
        value_estimate: { type: 'number', description: 'Estimated deal value in VND' },
        client_stated_need: { type: 'string', description: 'What the client said they want' },
        next_action: { type: 'string', description: 'Next action ARIA recommends' },
        next_action_due: { type: 'string', description: 'ISO date for next action due' },
        notes: { type: 'string' },
        priority: { type: 'string', enum: ['high', 'medium', 'low'] },
        checkin_paused: {
          type: 'boolean',
          description:
            'Set to true to pause all check-in reminders for this deal. Set to false to resume.',
        },
      },
      required: ['id', 'actor'] as readonly string[],
    },
  },
] as const
