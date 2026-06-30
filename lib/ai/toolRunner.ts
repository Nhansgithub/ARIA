import 'server-only'
import type Anthropic from '@anthropic-ai/sdk'
import {
  createClientStub,
  createDealStub,
  findSimilarClients,
  type ClientStubInput,
  type DealStubInput,
} from '@/lib/crm/stubService'
import {
  getDeal,
  getClient,
  findSimilarDeals,
  getPricingFloors,
  updateIntelligenceFields,
  getActivityLog,
  type GetDealParams,
  type GetClientParams,
  type FindSimilarDealsParams,
  type IntelligenceFieldsInput,
} from '@/lib/crm/dealIntelligenceService'
import {
  createDocument,
  getDocument,
  saveDocumentRevision,
  type CreateDocumentInput,
} from '@/lib/crm/documentService'
import { getPipelineSummary } from '@/lib/crm/strategyService'
import { logActivity } from '@/lib/crm/activityLogService'
import {
  listDeals,
  updateDeal,
  updateClient,
  type ListDealsParams,
  type UpdateDealInput,
  type UpdateClientInput,
} from '@/lib/crm/crmService'
import {
  checkStubEnrichment,
  promoteStub,
  archiveStub,
  type PromoteStubInput,
  type ArchiveStubInput,
} from '@/lib/crm/stubLifecycleService'

export async function runTools(
  toolUseBlocks: Anthropic.ToolUseBlock[],
  ownerId: string
): Promise<Anthropic.ToolResultBlockParam[]> {
  const results: Anthropic.ToolResultBlockParam[] = []

  for (const block of toolUseBlocks) {
    try {
      let output: unknown

      if (block.name === 'find_similar_clients') {
        output = await findSimilarClients(
          ownerId,
          block.input as { name?: string; company?: string }
        )
      } else if (block.name === 'create_client_stub') {
        output = await createClientStub(ownerId, block.input as ClientStubInput)
      } else if (block.name === 'create_deal_stub') {
        output = await createDealStub(ownerId, block.input as DealStubInput)
      } else if (block.name === 'get_deal') {
        output = await getDeal(ownerId, block.input as GetDealParams)
      } else if (block.name === 'get_client') {
        output = await getClient(ownerId, block.input as GetClientParams)
      } else if (block.name === 'find_similar_deals') {
        output = await findSimilarDeals(ownerId, block.input as FindSimilarDealsParams)
      } else if (block.name === 'get_pricing_floors') {
        output = await getPricingFloors(ownerId)
      } else if (block.name === 'get_activity_log') {
        const input = block.input as { entity_id: string; limit?: number }
        output = await getActivityLog(ownerId, input.entity_id, input.limit)
      } else if (block.name === 'get_pipeline_summary') {
        const input = block.input as { days_back?: number }
        output = await getPipelineSummary(ownerId, input.days_back)
      } else if (block.name === 'update_intelligence_fields') {
        const inp = block.input as IntelligenceFieldsInput
        // source is server-stamped provenance — not in tool schema, always overrides any caller value
        output = await updateIntelligenceFields(ownerId, { ...inp, source: 'deal_intelligence' })
      } else if (block.name === 'log_activity') {
        const { entity_type, entity_id, action, actor, payload } = block.input as {
          entity_type: 'client' | 'deal' | 'document' | 'settings'
          entity_id: string
          action: string
          actor: 'ai' | 'user'
          payload?: Record<string, unknown>
        }
        await logActivity(ownerId, { entity_type, entity_id, action, actor, payload })
        output = { logged: true }
      } else if (block.name === 'list_deals') {
        output = await listDeals(ownerId, block.input as ListDealsParams)
      } else if (block.name === 'update_deal') {
        output = await updateDeal(ownerId, block.input as UpdateDealInput)
      } else if (block.name === 'update_client') {
        output = await updateClient(ownerId, block.input as UpdateClientInput)
      } else if (block.name === 'check_stub_enrichment') {
        const input = block.input as { entity_id: string }
        output = await checkStubEnrichment(ownerId, input.entity_id)
      } else if (block.name === 'promote_stub') {
        output = await promoteStub(ownerId, block.input as PromoteStubInput)
      } else if (block.name === 'archive_stub') {
        output = await archiveStub(ownerId, block.input as ArchiveStubInput)
      } else if (block.name === 'create_document') {
        // created_by is not in the tool schema — always stamp 'ai' server-side
        const inp = block.input as Omit<CreateDocumentInput, 'created_by'> & {
          client_name?: string
        }
        const result = await createDocument(ownerId, { ...inp, created_by: 'ai' })
        output = {
          id: result.id,
          title: result.title,
          status: result.status,
          version: result.version,
        }
      } else if (block.name === 'get_document') {
        const inp = block.input as { id: string }
        const result = await getDocument(ownerId, { id: inp.id })
        output = result ?? { error: 'Document not found' }
      } else if (block.name === 'save_document_revision') {
        const inp = block.input as {
          document_id?: string
          content_md?: string
          revision_instruction?: string
        }
        if (!inp.document_id || !inp.content_md || !inp.revision_instruction) {
          throw new Error(
            'save_document_revision: missing required fields (document_id, content_md, revision_instruction)'
          )
        }
        const result = await saveDocumentRevision(ownerId, {
          source_id: inp.document_id,
          content_md: inp.content_md,
          revision_instruction: inp.revision_instruction,
        })
        output = {
          id: result.id,
          version: result.version,
          title: result.title,
          status: result.status,
        }
      } else {
        throw new Error(`Unknown tool: ${block.name}`)
      }

      results.push({
        type: 'tool_result',
        tool_use_id: block.id,
        content: JSON.stringify(output),
      })
    } catch (err) {
      results.push({
        type: 'tool_result',
        tool_use_id: block.id,
        is_error: true,
        content: err instanceof Error ? err.message : 'Tool execution failed',
      })
    }
  }

  return results
}
