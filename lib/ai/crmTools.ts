// lib/ai/crmTools.ts
// Pure data — no 'server-only', no @anthropic-ai/sdk import.
// Shape matches Anthropic.Tool; agentWithTools.ts casts to Anthropic.Tool[].

export const CRM_STUB_TOOLS = [
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
] as const
