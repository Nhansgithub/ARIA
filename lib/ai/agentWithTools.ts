import 'server-only'
import Anthropic from '@anthropic-ai/sdk'
import { getAnthropicApiKey } from '@/lib/secrets'
import { runTools } from './toolRunner'
import type { AriaModel } from './models'
import type { ChatTurn } from './streamChat'

const MAX_TOOL_ITERATIONS = 3

const LANG_DIRECTIVE: Record<'vi' | 'en', string> = {
  vi: 'LANGUAGE: Vietnamese (vi). Address the Owner as "Anh". Acknowledge difficulties obliquely. Avoid urgency or pressure language. Respond entirely in Vietnamese.',
  en: 'LANGUAGE: English (en). Be direct and analytical. Lead with the recommendation, then evidence. No filler phrases ("Great question!", "Certainly!").',
}

export interface AgentWithToolsOptions {
  model: AriaModel
  specialist: string
  systemPrompt: string
  tools: readonly { name: string; description: string; input_schema: object }[]
  messages: ChatTurn[]
  businessContext?: string
  detectedLang?: 'vi' | 'en'
  ownerId: string
}

export function runAgentWithTools(options: AgentWithToolsOptions): ReadableStream<Uint8Array> {
  const client = new Anthropic({ apiKey: getAnthropicApiKey() })
  const encoder = new TextEncoder()

  // AD-5: stable specialist prompt (cached) + volatile language directive
  const system: Anthropic.TextBlockParam[] = [
    { type: 'text', text: options.systemPrompt, cache_control: { type: 'ephemeral' } },
  ]
  if (options.detectedLang) {
    system.push({ type: 'text', text: LANG_DIRECTIVE[options.detectedLang] })
  }

  // AD-5: sort tools alphabetically for cache stability
  const tools = [...options.tools].sort((a, b) => a.name.localeCompare(b.name)) as Anthropic.Tool[]

  // Assemble base messages with stable prefix first (AD-5)
  const baseMessages: Anthropic.MessageParam[] = []
  if (options.businessContext) {
    baseMessages.push({
      role: 'user',
      content: [
        {
          type: 'text',
          text: `<business_context>\n${options.businessContext}\n</business_context>`,
          cache_control: { type: 'ephemeral' },
        },
      ],
    })
    baseMessages.push({ role: 'assistant', content: 'Understood.' })
  }
  baseMessages.push(...(options.messages as Anthropic.MessageParam[]))

  return new ReadableStream({
    async start(controller) {
      const allMessages = [...baseMessages]
      let iteration = 0

      try {
        while (iteration < MAX_TOOL_ITERATIONS) {
          const response = await client.messages.create(
            {
              model: options.model,
              max_tokens: 4096,
              system,
              tools,
              messages: allMessages,
            },
            {
              headers: { 'anthropic-beta': 'prompt-caching-2024-07-31' },
              signal: AbortSignal.timeout(30_000),
            }
          )

          const toolUseBlocks = response.content.filter(
            (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
          )

          if (response.stop_reason !== 'tool_use' || toolUseBlocks.length === 0) {
            // Final text response — emit as one chunk
            const textBlock = response.content.find((b) => b.type === 'text')
            if (textBlock && textBlock.type === 'text') {
              controller.enqueue(encoder.encode(textBlock.text))
            } else {
              // No text block in a non-tool response — surface as degraded (AD-6)
              controller.enqueue(encoder.encode('\n\n[ARIA error: Empty response from AI]'))
            }
            controller.close()
            return
          }

          // Execute tools and extend message history for next round
          const toolResults = await runTools(toolUseBlocks, options.ownerId)
          allMessages.push({ role: 'assistant', content: response.content })
          allMessages.push({ role: 'user', content: toolResults })
          iteration++
        }

        // Safety: max iterations reached — final call WITHOUT tools to force text synthesis
        const finalResponse = await client.messages.create(
          {
            model: options.model,
            max_tokens: 4096,
            system,
            messages: allMessages,
          },
          {
            headers: { 'anthropic-beta': 'prompt-caching-2024-07-31' },
            signal: AbortSignal.timeout(30_000),
          }
        )

        const textBlock = finalResponse.content.find((b) => b.type === 'text')
        if (textBlock && textBlock.type === 'text') {
          controller.enqueue(encoder.encode(textBlock.text))
        } else {
          controller.enqueue(encoder.encode('\n\n[ARIA error: Empty response from AI]'))
        }
        controller.close()
      } catch (err) {
        // AD-6: sentinel triggers Story 1.6 degraded banner on the client
        const errMsg = err instanceof Error ? err.message : 'Unknown error'
        controller.enqueue(encoder.encode(`\n\n[ARIA error: ${errMsg}]`))
        controller.close()
      }
    },
  })
}
