// lib/ai/documentCreationTools.ts
// Pure data — no 'server-only', no @anthropic-ai/sdk import.
// Combined tool set for the document_creation specialist: document tools + CRM read tools.

import { DOCUMENT_TOOLS } from './documentTools'
import { CRM_STUB_TOOLS } from './crmTools'

const CRM_READ_TOOLS = CRM_STUB_TOOLS.filter(
  (t) => t.name === 'get_deal' || t.name === 'get_client'
)

// Alphabetically sorted: create_document < get_client < get_deal < get_document (AD-5)
export const DOCUMENT_CREATION_TOOLS = [...DOCUMENT_TOOLS, ...CRM_READ_TOOLS].sort((a, b) =>
  a.name.localeCompare(b.name)
)
