// lib/ai/documentTools.ts
// Pure data — no 'server-only', no @anthropic-ai/sdk import.
// Shape matches Anthropic.Tool; toolRunner.ts casts to Anthropic.Tool[].

export const DOCUMENT_TOOLS = [
  {
    name: 'create_document',
    description:
      'Create a new document draft for a deal or client. Called after outline approval. Returns the new document id and title.',
    input_schema: {
      type: 'object' as const,
      properties: {
        deal_id: {
          type: 'string',
          description: 'ID of the linked deal (optional)',
        },
        client_id: {
          type: 'string',
          description: 'ID of the linked client (optional)',
        },
        type: {
          type: 'string',
          description: 'Document type: proposal|contract|brief|sop|report|invoice|onboarding|other',
        },
        content_md: {
          type: 'string',
          description: 'Full document content in Markdown',
        },
        client_name: {
          type: 'string',
          description: 'Client name for the document title (optional)',
        },
      },
      required: ['type', 'content_md'] as readonly string[],
    },
  },
  {
    name: 'get_document',
    description:
      'Fetch a document by id. Returns the full document row including content_md, status, and version.',
    input_schema: {
      type: 'object' as const,
      properties: {
        id: {
          type: 'string',
          description: 'Document row id',
        },
      },
      required: ['id'] as readonly string[],
    },
  },
  {
    name: 'save_document_revision',
    description:
      'Save a revised version of an existing document (AI-authored). Creates a new version row (version=N+1, created_by=ai). Returns the new document row including its id and version.',
    input_schema: {
      type: 'object' as const,
      properties: {
        document_id: {
          type: 'string',
          description: 'ID of the source document to revise',
        },
        content_md: {
          type: 'string',
          description: 'Full revised document content in Markdown',
        },
        revision_instruction: {
          type: 'string',
          description: 'Short description of what was changed (logged for audit trail)',
        },
      },
      required: ['document_id', 'content_md', 'revision_instruction'] as readonly string[],
    },
  },
] as const
