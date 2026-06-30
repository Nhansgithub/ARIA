// lib/ai/documentRevisionTools.ts
// Pure data — no 'server-only', no @anthropic-ai/sdk import.
// Tool set for the document_revision specialist: get_document + save_document_revision.

import { DOCUMENT_TOOLS } from './documentTools'

// Alphabetically sorted (AD-5): get_document < save_document_revision
export const DOCUMENT_REVISION_TOOLS = DOCUMENT_TOOLS.filter(
  (t) => t.name === 'get_document' || t.name === 'save_document_revision'
).sort((a, b) => a.name.localeCompare(b.name))
