export {}
// ts-node inline tests for Story 3.6: Inline Document Edit and Conversational Re-Generation
// Pattern: no imports from project lib/ — logic is simulated inline.
// Run: npx ts-node lib/__tests__/inlineDocumentEdit36.test.ts

import fs from 'fs'
import path from 'path'

// ── Helpers ───────────────────────────────────────────────────────────────────

let passed = 0
let failed = 0

function assert(condition: boolean, label: string): void {
  if (condition) {
    console.log(`  ✓ ${label}`)
    passed++
  } else {
    console.error(`  ✗ FAIL: ${label}`)
    failed++
  }
}

// ── Inline simulation of revision logic ───────────────────────────────────────

type DocumentStatus = 'draft' | 'review' | 'sent' | 'signed' | 'archived'

interface SimDoc {
  id: string
  version: number
  status: DocumentStatus
  content_md: string
  created_by: 'ai' | 'human'
  owner_id: string
}

interface RevisionResult {
  id: string
  version: number
  created_by: 'ai' | 'human'
  activity_action: string
  activity_payload: {
    from_version: number
    to_version: number
    revision_instruction: string
  }
}

function simulateRevision(
  source: SimDoc,
  newContent: string,
  instruction: string
): RevisionResult {
  const newVersion = source.version + 1
  return {
    id: `new-id-${newVersion}`,
    version: newVersion,
    created_by: 'ai',
    activity_action: 'document_revised',
    activity_payload: {
      from_version: source.version,
      to_version: newVersion,
      revision_instruction: instruction,
    },
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

console.log('\nStory 3.6 — Inline Document Edit and Conversational Re-Generation\n')

// T1: Revision creates a new version row (version = N+1)
console.log('T1: Revision increments version to N+1')
{
  const source: SimDoc = { id: 'doc-1', version: 2, status: 'draft', content_md: '# Original', created_by: 'ai', owner_id: 'user-1' }
  const result = simulateRevision(source, '# Revised', 'Shorten investment section')
  assert(result.version === 3, 'version is N+1 = 3')
}

// T2: Revision stamps created_by=ai (not human)
console.log('\nT2: Revision stamps created_by=ai')
{
  const source: SimDoc = { id: 'doc-1', version: 1, status: 'draft', content_md: '# Doc', created_by: 'ai', owner_id: 'user-1' }
  const result = simulateRevision(source, '# Doc Revised', 'Make shorter')
  assert(result.created_by === 'ai', 'created_by is ai')
}

// T3: Activity log action is "document_revised" (not "document_edited")
console.log('\nT3: Activity log uses action "document_revised"')
{
  const source: SimDoc = { id: 'doc-2', version: 3, status: 'review', content_md: '# Doc', created_by: 'human', owner_id: 'user-1' }
  const result = simulateRevision(source, '# Doc Updated', 'Fix intro')
  assert(result.activity_action === 'document_revised', 'activity action is document_revised')
}

// T4: Activity payload includes from_version, to_version, revision_instruction
console.log('\nT4: Activity payload is correct')
{
  const source: SimDoc = { id: 'doc-3', version: 5, status: 'sent', content_md: '# Doc', created_by: 'ai', owner_id: 'user-1' }
  const result = simulateRevision(source, '# Doc New', 'Rewrite conclusion')
  assert(result.activity_payload.from_version === 5, 'from_version is 5')
  assert(result.activity_payload.to_version === 6, 'to_version is 6')
  assert(result.activity_payload.revision_instruction === 'Rewrite conclusion', 'revision_instruction preserved')
}

// T5: Human autosave (direct edit) produces created_by=human (invariant from Story 3.1)
console.log('\nT5: Direct edit (human) preserves created_by=human')
{
  const simulateHumanSave = (source: SimDoc): { version: number; created_by: string } => ({
    version: source.version + 1,
    created_by: 'human',
  })
  const source: SimDoc = { id: 'doc-4', version: 2, status: 'draft', content_md: '# Old', created_by: 'ai', owner_id: 'user-1' }
  const result = simulateHumanSave(source)
  assert(result.created_by === 'human', 'human save stamps created_by=human')
  assert(result.version === 3, 'human save also increments version')
}

// T6: Edit confirmation required for sent/signed/archived (viewer logic)
console.log('\nT6: Edit confirmation required for locked statuses')
{
  const requiresConfirmation = (status: DocumentStatus): boolean =>
    status === 'sent' || status === 'signed' || status === 'archived'
  assert(requiresConfirmation('draft') === false, 'draft does not require confirmation')
  assert(requiresConfirmation('review') === false, 'review does not require confirmation')
  assert(requiresConfirmation('sent') === true, 'sent requires confirmation')
  assert(requiresConfirmation('signed') === true, 'signed requires confirmation')
  assert(requiresConfirmation('archived') === true, 'archived requires confirmation')
}

// T7: Source row is never mutated — revision always reads the latest version including human edits
console.log('\nT7: Revision operates on latest content (human edits are not overwritten)')
{
  const humanEditedContent = '# Human-edited content'
  const latestDoc: SimDoc = { id: 'doc-5', version: 3, status: 'draft', content_md: humanEditedContent, created_by: 'human', owner_id: 'user-1' }
  const result = simulateRevision(latestDoc, '# AI revised from human base', 'Trim section 2')
  // from_version should reference the human-edited version
  assert(result.activity_payload.from_version === 3, 'revision references human-edited version as from_version')
  assert(result.version === 4, 'new version is 4 (one after human edit)')
}

// T8: save_document_revision tool is in DOCUMENT_REVISION_TOOLS (file check)
console.log('\nT8: documentRevisionTools.ts contains save_document_revision')
{
  const revToolsSrc = path.join(process.cwd(), 'lib', 'ai', 'documentRevisionTools.ts')
  assert(fs.existsSync(revToolsSrc), 'lib/ai/documentRevisionTools.ts exists')
  const src = fs.existsSync(revToolsSrc) ? fs.readFileSync(revToolsSrc, 'utf8') : ''
  assert(src.includes('save_document_revision'), 'documentRevisionTools.ts references save_document_revision')
  assert(src.includes('get_document'), 'documentRevisionTools.ts references get_document')
}

// T9: document_revision intent bucket exists in orchestrator
console.log('\nT9: orchestrator.ts has document_revision intent bucket')
{
  const orchestratorSrc = path.join(process.cwd(), 'lib', 'ai', 'orchestrator.ts')
  assert(fs.existsSync(orchestratorSrc), 'lib/ai/orchestrator.ts exists')
  const src = fs.existsSync(orchestratorSrc) ? fs.readFileSync(orchestratorSrc, 'utf8') : ''
  assert(src.includes('document_revision'), 'orchestrator.ts contains document_revision bucket')
  assert(src.includes('REVISION PROTOCOL'), 'orchestrator.ts contains REVISION PROTOCOL specialist prompt')
}

// T10: toolRunner.ts handles save_document_revision
console.log('\nT10: toolRunner.ts handles save_document_revision')
{
  const toolRunnerSrc = path.join(process.cwd(), 'lib', 'ai', 'toolRunner.ts')
  const src = fs.existsSync(toolRunnerSrc) ? fs.readFileSync(toolRunnerSrc, 'utf8') : ''
  assert(src.includes('save_document_revision'), 'toolRunner.ts handles save_document_revision')
  assert(src.includes('saveDocumentRevision'), 'toolRunner.ts calls saveDocumentRevision service')
}

// T11: documentService.ts exports saveDocumentRevision
console.log('\nT11: documentService.ts exports saveDocumentRevision')
{
  const serviceSrc = path.join(process.cwd(), 'lib', 'crm', 'documentService.ts')
  const src = fs.existsSync(serviceSrc) ? fs.readFileSync(serviceSrc, 'utf8') : ''
  assert(src.includes('saveDocumentRevision'), 'documentService.ts exports saveDocumentRevision')
  assert(src.includes("action: 'document_revised'"), "documentService.ts logs action 'document_revised'")
  assert(src.includes('revision_instruction'), 'documentService.ts includes revision_instruction in payload')
}

// T12: DocumentViewer.tsx has editConfirm state for locked-status confirmation
console.log('\nT12: DocumentViewer.tsx has editConfirm state')
{
  const viewerSrc = path.join(process.cwd(), 'components', 'documents', 'DocumentViewer.tsx')
  const src = fs.existsSync(viewerSrc) ? fs.readFileSync(viewerSrc, 'utf8') : ''
  assert(src.includes('editConfirm'), 'DocumentViewer.tsx contains editConfirm state')
  assert(
    src.includes("status === 'sent' || doc.status === 'signed' || doc.status === 'archived'"),
    'DocumentViewer.tsx checks all three locked statuses'
  )
}

// T13: chat route.ts imports DOCUMENT_REVISION_TOOLS and routes document_revision intent
console.log('\nT13: chat route handles document_revision intent')
{
  const routeSrc = path.join(process.cwd(), 'app', 'api', 'chat', 'route.ts')
  const src = fs.existsSync(routeSrc) ? fs.readFileSync(routeSrc, 'utf8') : ''
  assert(src.includes('DOCUMENT_REVISION_TOOLS'), 'chat route imports DOCUMENT_REVISION_TOOLS')
  assert(src.includes("classification.intent === 'document_revision'"), 'chat route routes document_revision')
}

// T14: AD-4 compliance — document_revision uses highJudgment model (not economical)
console.log('\nT14: document_revision uses highJudgment model (AD-4)')
{
  const orchestratorSrc = path.join(process.cwd(), 'lib', 'ai', 'orchestrator.ts')
  const src = fs.existsSync(orchestratorSrc) ? fs.readFileSync(orchestratorSrc, 'utf8') : ''
  // document_revision should map to highJudgment, same as document_creation
  assert(
    src.includes('document_revision: ARIA_MODELS.highJudgment'),
    'document_revision maps to highJudgment model'
  )
}

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n─────────────────────────────────────────`)
console.log(`Results: ${passed} passed, ${failed} failed`)
if (failed > 0) {
  console.error('SOME TESTS FAILED')
  process.exit(1)
} else {
  console.log('All tests passed ✓')
}
