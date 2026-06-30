import 'server-only'
import { createServerClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/crm/activityLogService'

// ── Types ─────────────────────────────────────────────────────────────────────

export type DocumentType =
  | 'proposal'
  | 'contract'
  | 'brief'
  | 'sop'
  | 'report'
  | 'invoice'
  | 'onboarding'
  | 'other'

export type DocumentStatus = 'draft' | 'review' | 'sent' | 'signed' | 'archived'
export type DocumentCreatedBy = 'ai' | 'human'

export interface DocumentRow {
  id: string
  owner_id: string
  deal_id: string | null
  client_id: string | null
  type: DocumentType
  title: string
  status: DocumentStatus
  content_md: string | null
  file_url: string | null
  version: number
  created_by: DocumentCreatedBy
  created_at: string
  updated_at: string
}

export interface CreateDocumentInput {
  deal_id?: string
  client_id?: string
  type: DocumentType
  content_md: string
  created_by: DocumentCreatedBy
  client_name?: string
}

export interface SaveDocumentVersionInput {
  source_id: string
  content_md: string
  created_by: DocumentCreatedBy
}

export interface UpdateDocumentStatusInput {
  id: string
  status: DocumentStatus
  actor: 'ai' | 'user'
}

export interface ListDocumentsParams {
  deal_id?: string
  client_id?: string
  status?: DocumentStatus
  limit?: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildDocumentTitle(
  clientName: string | undefined,
  type: DocumentType,
  version: number,
  date: string
): string {
  const sanitizedName = clientName?.replace(/\s+/g, '') || 'Unknown'
  const capitalizedType = type.charAt(0).toUpperCase() + type.slice(1)
  return `${sanitizedName}_${capitalizedType}_${date}_v${version}`
}

// ── createDocument ────────────────────────────────────────────────────────────

export async function createDocument(
  ownerId: string,
  input: CreateDocumentInput
): Promise<DocumentRow> {
  const supabase = createServerClient()
  const date = new Date().toISOString().split('T')[0]!
  const title = buildDocumentTitle(input.client_name, input.type, 1, date)

  const { data, error } = await supabase
    .from('documents')
    .insert({
      owner_id: ownerId,
      deal_id: input.deal_id ?? null,
      client_id: input.client_id ?? null,
      type: input.type,
      title,
      status: 'draft',
      content_md: input.content_md,
      created_by: input.created_by,
      version: 1,
    })
    .select()
    .single()

  if (error) throw new Error(`createDocument failed: ${error.message}`)

  await logActivity(ownerId, {
    entity_type: 'document',
    entity_id: data.id,
    action: 'document_created',
    actor: input.created_by === 'ai' ? 'ai' : 'user',
    payload: { type: input.type, title },
  })

  return data as DocumentRow
}

// ── saveDocumentVersion ───────────────────────────────────────────────────────

export async function saveDocumentVersion(
  ownerId: string,
  input: SaveDocumentVersionInput
): Promise<DocumentRow> {
  const supabase = createServerClient()

  // Fetch source row with owner guard
  const { data: sourceRaw, error: fetchError } = await supabase
    .from('documents')
    .select('*')
    .eq('id', input.source_id)
    .eq('owner_id', ownerId)
    .single()

  if (fetchError || !sourceRaw) {
    throw new Error(`saveDocumentVersion: document not found or unauthorized`)
  }

  const source = sourceRaw as DocumentRow
  const newVersion = source.version + 1
  const date = new Date().toISOString().split('T')[0]!

  // Parse client name from the existing title (first segment before the first underscore)
  const clientNameFromTitle = source.title.split('_')[0]
  const title = buildDocumentTitle(clientNameFromTitle, source.type, newVersion, date)

  // Insert a NEW row — source row is never mutated (AD-14 versioning rule)
  const { data, error } = await supabase
    .from('documents')
    .insert({
      owner_id: source.owner_id,
      deal_id: source.deal_id,
      client_id: source.client_id,
      type: source.type,
      status: source.status,
      file_url: source.file_url,
      content_md: input.content_md,
      created_by: input.created_by,
      version: newVersion,
      title,
    })
    .select()
    .single()

  if (error) throw new Error(`saveDocumentVersion failed: ${error.message}`)

  await logActivity(ownerId, {
    entity_type: 'document',
    entity_id: data.id,
    action: 'document_edited',
    actor: input.created_by === 'ai' ? 'ai' : 'user',
    payload: {
      previous_version: source.version,
      new_version: newVersion,
    },
  })

  return data as DocumentRow
}

// ── updateDocumentStatus ──────────────────────────────────────────────────────

export async function updateDocumentStatus(
  ownerId: string,
  input: UpdateDocumentStatusInput
): Promise<{ updated: boolean }> {
  const supabase = createServerClient()

  const { data: current, error: fetchError } = await supabase
    .from('documents')
    .select('status')
    .eq('id', input.id)
    .eq('owner_id', ownerId)
    .single()

  if (fetchError || !current) {
    throw new Error(`updateDocumentStatus: document not found or unauthorized`)
  }

  // No-op guard — no write, no log (AD-14)
  if ((current as { status: string }).status === input.status) {
    return { updated: false }
  }

  const { error: updateError } = await supabase
    .from('documents')
    .update({ status: input.status, updated_at: new Date().toISOString() })
    .eq('id', input.id)
    .eq('owner_id', ownerId)

  if (updateError) throw new Error(`updateDocumentStatus failed: ${updateError.message}`)

  const payload: Record<string, unknown> = {
    from_status: (current as { status: string }).status,
    to_status: input.status,
  }
  if (input.status === 'sent') {
    payload.sent_at = new Date().toISOString()
  }

  await logActivity(ownerId, {
    entity_type: 'document',
    entity_id: input.id,
    action: 'status_changed',
    actor: input.actor,
    payload,
  })

  return { updated: true }
}

// ── getDocument ───────────────────────────────────────────────────────────────

export async function getDocument(
  ownerId: string,
  params: { id: string }
): Promise<DocumentRow | null> {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('id', params.id)
    .eq('owner_id', ownerId)
    .maybeSingle()

  if (error) throw new Error(`getDocument failed: ${error.message}`)
  return (data as DocumentRow) ?? null
}

// ── listDocuments ─────────────────────────────────────────────────────────────

export async function listDocuments(
  ownerId: string,
  params: ListDocumentsParams
): Promise<DocumentRow[]> {
  const supabase = createServerClient()
  let q = supabase
    .from('documents')
    .select('*')
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false })
    .limit(Math.min(params.limit ?? 20, 100)) // hard cap at 100 to protect query cost

  if (params.deal_id) q = q.eq('deal_id', params.deal_id)
  if (params.client_id) q = q.eq('client_id', params.client_id)
  if (params.status) q = q.eq('status', params.status)

  const { data, error } = await q
  if (error) throw new Error(`listDocuments failed: ${error.message}`)
  return (data ?? []) as DocumentRow[]
}

// ── saveDocumentRevision ──────────────────────────────────────────────────────

export interface SaveDocumentRevisionInput {
  source_id: string
  content_md: string
  revision_instruction: string
}

export async function saveDocumentRevision(
  ownerId: string,
  input: SaveDocumentRevisionInput
): Promise<DocumentRow> {
  const supabase = createServerClient()

  // Fetch source with owner guard (AD-2)
  const { data: sourceRaw, error: fetchError } = await supabase
    .from('documents')
    .select('*')
    .eq('id', input.source_id)
    .eq('owner_id', ownerId)
    .single()

  if (fetchError || !sourceRaw) {
    throw new Error(`saveDocumentRevision: document not found or unauthorized`)
  }

  const source = sourceRaw as DocumentRow
  const newVersion = source.version + 1
  const date = new Date().toISOString().split('T')[0]!
  const clientNameFromTitle = source.title.split('_')[0]
  const title = buildDocumentTitle(clientNameFromTitle, source.type, newVersion, date)

  // INSERT new row — source row is never mutated (AD-14)
  const { data, error } = await supabase
    .from('documents')
    .insert({
      owner_id: source.owner_id,
      deal_id: source.deal_id,
      client_id: source.client_id,
      type: source.type,
      status: 'draft' as DocumentStatus,
      file_url: null,
      content_md: input.content_md,
      created_by: 'ai' as DocumentCreatedBy,
      version: newVersion,
      title,
    })
    .select()
    .single()

  if (error) throw new Error(`saveDocumentRevision failed: ${error.message}`)

  // Fire-and-forget: log failure must not roll back the successful revision row
  logActivity(ownerId, {
    entity_type: 'document',
    entity_id: data.id,
    action: 'document_revised',
    actor: 'ai',
    payload: {
      from_version: source.version,
      to_version: newVersion,
      revision_instruction: input.revision_instruction,
    },
  }).catch((err) => console.warn('[saveDocumentRevision] logActivity failed:', err))

  return data as DocumentRow
}

// ── listDocumentVersions ──────────────────────────────────────────────────────

export async function listDocumentVersions(
  ownerId: string,
  documentId: string
): Promise<DocumentRow[]> {
  const supabase = createServerClient()

  const { data: target, error: fetchError } = await supabase
    .from('documents')
    .select('deal_id, client_id, type, title')
    .eq('id', documentId)
    .eq('owner_id', ownerId)
    .single()

  if (fetchError || !target) {
    throw new Error(`listDocumentVersions: document not found or unauthorized`)
  }

  const row = target as { deal_id: string | null; client_id: string | null; type: string; title: string }

  // Derive the stable title prefix ({ClientName}_{Type}_) to isolate this document family.
  // Without a root_document_id column, grouping by deal_id+type alone would mix multiple
  // independent document families of the same type on the same deal.
  const titleSegments = row.title.split('_')
  const titlePrefix = `${titleSegments[0]}_${titleSegments[1]}_` // e.g. "PhuLong_Proposal_"

  let q = supabase
    .from('documents')
    .select('*')
    .eq('owner_id', ownerId)
    .eq('type', row.type)
    .ilike('title', `${titlePrefix}%`)
    .order('version', { ascending: true })

  if (row.deal_id) {
    q = q.eq('deal_id', row.deal_id)
  } else if (row.client_id) {
    q = q.eq('client_id', row.client_id)
  }

  const { data, error } = await q
  if (error) throw new Error(`listDocumentVersions failed: ${error.message}`)
  return (data ?? []) as DocumentRow[]
}
