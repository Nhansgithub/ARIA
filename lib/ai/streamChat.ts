import 'server-only'
import Anthropic from '@anthropic-ai/sdk'
import { getAnthropicApiKey } from '@/lib/secrets'
import { ARIA_MODELS } from './models'

export interface ChatTurn {
  role: 'user' | 'assistant'
  content: string
}

export interface StreamChatOptions {
  systemPrompt: string
  businessContext?: string
  messages: ChatTurn[]
}

export function streamChat(options: StreamChatOptions): ReadableStream<Uint8Array> {
  const client = new Anthropic({ apiKey: getAnthropicApiKey() })
  const encoder = new TextEncoder()

  // AD-5: system prompt is the first cache_control breakpoint
  const system: Anthropic.TextBlockParam[] = [
    {
      type: 'text',
      text: options.systemPrompt,
      cache_control: { type: 'ephemeral' },
    },
  ]

  // AD-5: assemble stable prefix first, then volatile conversation turns
  const messages: Anthropic.MessageParam[] = []

  if (options.businessContext) {
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
    messages.push({ role: 'assistant', content: 'Understood.' })
  }

  messages.push(...(options.messages as Anthropic.MessageParam[]))

  return new ReadableStream({
    async start(controller) {
      try {
        // TODO: pass AbortSignal through to the SDK once Anthropic supports it,
        // so a client Stop cancels server-side token consumption too.
        const stream = client.messages.stream(
          {
            model: ARIA_MODELS.highJudgment,
            max_tokens: 4096,
            system,
            messages,
          },
          {
            headers: { 'anthropic-beta': 'prompt-caching-2024-07-31' },
          }
        )

        for await (const chunk of stream) {
          if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
            controller.enqueue(encoder.encode(chunk.delta.text))
          }
        }

        // AD-5 observability: log token usage after stream completes
        const finalMessage = await stream.finalMessage()
        const usage = finalMessage.usage as {
          input_tokens: number
          output_tokens: number
          cache_read_input_tokens?: number
          cache_creation_input_tokens?: number
        }
        console.log(
          '[ARIA/stream]',
          JSON.stringify({
            model: ARIA_MODELS.highJudgment,
            specialist: 'chat',
            input_tokens: usage.input_tokens,
            output_tokens: usage.output_tokens,
            cache_read_input_tokens: usage.cache_read_input_tokens ?? 0,
            cache_creation_input_tokens: usage.cache_creation_input_tokens ?? 0,
          })
        )

        controller.close()
      } catch (err) {
        // AD-6: never leave the client hanging — write an error sentinel and close
        const errMsg = err instanceof Error ? err.message : 'Unknown error'
        controller.enqueue(encoder.encode(`\n\n[ARIA error: ${errMsg}]`))
        controller.close()
      }
    },
  })
}
