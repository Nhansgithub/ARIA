import 'server-only'
import Anthropic from '@anthropic-ai/sdk'
import { randomUUID } from 'crypto'
import { getAnthropicApiKey } from '@/lib/secrets'
import { ARIA_MODELS } from './models'
import type { AriaModel } from './models'

export type AIEnvelope<T = string> =
  | { status: 'ok'; data: T }
  | { status: 'degraded'; data: null; degraded_reason: string }
  | { status: 'error'; data: null; degraded_reason: string }

export interface CallAIOptions {
  model: AriaModel
  specialist: string
  systemPrompt: string
  tools?: Anthropic.Tool[]
  businessContext?: string
  messages: Anthropic.MessageParam[]
  maxTokens?: number
  timeoutMs?: number
}

function logTokenUsage(params: {
  model: string
  specialist: string
  input_tokens: number
  output_tokens: number
  cache_read_input_tokens: number
  cache_creation_input_tokens: number
  latency_ms: number
  call_id: string
}): void {
  console.log('[ARIA/ai]', JSON.stringify(params))
}

export async function callAI(options: CallAIOptions): Promise<AIEnvelope> {
  const callId = randomUUID()
  const startTime = Date.now()
  const client = new Anthropic({ apiKey: getAnthropicApiKey() })

  const timeoutMs = options.timeoutMs ?? 10_000
  const maxTokens = options.maxTokens ?? (options.model === ARIA_MODELS.economical ? 1024 : 4096)

  // AD-5: system prompt is the first cache_control breakpoint (byte-stable per specialist)
  const system: Anthropic.TextBlockParam[] = [
    {
      type: 'text',
      text: options.systemPrompt,
      cache_control: { type: 'ephemeral' },
    },
  ]

  // Sort tools deterministically for cache stability (AD-5)
  const tools = options.tools
    ? [...options.tools].sort((a, b) => a.name.localeCompare(b.name))
    : undefined

  // AD-5: assemble stable prefix first, then volatile content
  const messages: Anthropic.MessageParam[] = []

  if (options.businessContext) {
    // Second cache_control breakpoint — Business Context is stable within a session
    messages.push({
      role: 'user',
      content: [
        {
          type: 'text',
          text: `<business_context>\n${options.businessContext}\n</business_context>`,
          cache_control: { type: 'ephemeral' },
        },
      ],
    })
    // Ack turn to maintain alternating user/assistant pattern
    messages.push({ role: 'assistant', content: 'Understood.' })
  }

  // Volatile content: CRM entities, conversation turns, user message — no cache_control
  messages.push(...options.messages)

  try {
    const response = await client.messages.create(
      {
        model: options.model,
        max_tokens: maxTokens,
        system,
        tools,
        messages,
      },
      {
        signal: AbortSignal.timeout(timeoutMs),
        headers: { 'anthropic-beta': 'prompt-caching-2024-07-31' },
      }
    )

    const latencyMs = Date.now() - startTime
    const usage = response.usage as {
      input_tokens: number
      output_tokens: number
      cache_read_input_tokens?: number
      cache_creation_input_tokens?: number
    }

    logTokenUsage({
      model: options.model,
      specialist: options.specialist,
      input_tokens: usage.input_tokens,
      output_tokens: usage.output_tokens,
      cache_read_input_tokens: usage.cache_read_input_tokens ?? 0,
      cache_creation_input_tokens: usage.cache_creation_input_tokens ?? 0,
      latency_ms: latencyMs,
      call_id: callId,
    })

    const textBlock = response.content.find((b) => b.type === 'text')
    const data = textBlock && textBlock.type === 'text' ? textBlock.text : ''
    return { status: 'ok', data }
  } catch (err: unknown) {
    const latencyMs = Date.now() - startTime
    logTokenUsage({
      model: options.model,
      specialist: options.specialist,
      input_tokens: 0,
      output_tokens: 0,
      cache_read_input_tokens: 0,
      cache_creation_input_tokens: 0,
      latency_ms: latencyMs,
      call_id: callId,
    })

    if (err instanceof Anthropic.RateLimitError) {
      return {
        status: 'degraded',
        data: null,
        degraded_reason: 'Rate limit reached — please retry shortly',
      }
    }

    if (err instanceof Error) {
      if (
        err.name === 'AbortError' ||
        err.name === 'TimeoutError' ||
        err.name === 'APITimeoutError'
      ) {
        return { status: 'degraded', data: null, degraded_reason: 'Request timed out' }
      }
      return { status: 'degraded', data: null, degraded_reason: err.message }
    }

    return { status: 'error', data: null, degraded_reason: 'Unknown error occurred' }
  }
}
