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
  type GetDealParams,
  type GetClientParams,
  type FindSimilarDealsParams,
  type IntelligenceFieldsInput,
} from '@/lib/crm/dealIntelligenceService'
import { getPipelineSummary } from '@/lib/crm/strategyService'

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
      } else if (block.name === 'get_pipeline_summary') {
        const input = block.input as { days_back?: number }
        output = await getPipelineSummary(ownerId, input.days_back)
      } else if (block.name === 'update_intelligence_fields') {
        output = await updateIntelligenceFields(ownerId, block.input as IntelligenceFieldsInput)
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
