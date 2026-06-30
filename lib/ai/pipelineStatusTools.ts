// lib/ai/pipelineStatusTools.ts
// Pure data — no 'server-only', no @anthropic-ai/sdk import.
// Read-only tool set for the pipeline_status specialist (AD-5: alphabetically sorted).

import { DI_TOOLS } from './dealIntelligenceTools'
import { CRM_STUB_TOOLS } from './crmTools'
import { STRATEGY_TOOLS } from './strategyTools'

function requireTool<T extends readonly { name: string }[]>(
  arr: T,
  name: string,
  source: string
): T[number] {
  const tool = arr.find((t) => t.name === name)
  if (!tool) throw new Error(`pipelineStatusTools: '${name}' missing from ${source} — tool was renamed or removed`)
  return tool
}

const GET_ACTIVITY_LOG = requireTool(DI_TOOLS, 'get_activity_log', 'dealIntelligenceTools')
const GET_DEAL = requireTool(DI_TOOLS, 'get_deal', 'dealIntelligenceTools')
const GET_PIPELINE_SUMMARY = requireTool(STRATEGY_TOOLS, 'get_pipeline_summary', 'strategyTools')
const LIST_DEALS = requireTool(CRM_STUB_TOOLS, 'list_deals', 'crmTools')

// Alphabetically sorted (AD-5): get_activity_log < get_deal < get_pipeline_summary < list_deals
export const PIPELINE_STATUS_TOOLS = [
  GET_ACTIVITY_LOG,
  GET_DEAL,
  GET_PIPELINE_SUMMARY,
  LIST_DEALS,
].sort((a, b) => a.name.localeCompare(b.name))
