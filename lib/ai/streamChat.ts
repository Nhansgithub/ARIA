import 'server-only'
import Anthropic from '@anthropic-ai/sdk'
import { getAnthropicApiKey } from '@/lib/secrets'
import type { AriaModel } from './models'

export interface ChatTurn {
  role: 'user' | 'assistant'
  content: string
}

export interface StreamChatOptions {
  model: AriaModel
  specialist: string
  systemPrompt: string
  businessContext?: string
  messages: ChatTurn[]
  detectedLang?: 'vi' | 'en'
}

// Language directives injected as a volatile (non-cached) system block (AD-5).
// Vietnamese register: B2B formal address + oblique tone + no urgency language.
// English register: direct, recommendation-first, no filler phrases.
const LANG_DIRECTIVE: Record<'vi' | 'en', string> = {
  vi: 'LANGUAGE: Vietnamese (vi). Address the Owner as "Anh". Acknowledge difficulties obliquely. Avoid urgency or pressure language. Respond entirely in Vietnamese.',
  en: 'LANGUAGE: English (en). Be direct and analytical. Lead with the recommendation, then evidence. No filler phrases ("Great question!", "Certainly!").',
}

export function streamChat(options: StreamChatOptions): ReadableStream<Uint8Array> {
  const client = new Anthropic({ apiKey: getAnthropicApiKey() })
  const encoder = new TextEncoder()

  // AD-5: block 1 (cached) = stable specialist prompt; block 2 (volatile) = language directive
  const system: Anthropic.TextBlockParam[] = [
    {
      type: 'text',
      text: options.systemPrompt,
      cache_control: { type: 'ephemeral' }, // last cache breakpoint — everything before is cached
    },
  ]
  // Language directive is volatile (changes per message) and intentionally has no cache_control.
  // It sits after the last cache breakpoint so block 1 cache hits are unaffected (AD-5).
  if (options.detectedLang) {
    system.push({
      type: 'text',
      text: LANG_DIRECTIVE[options.detectedLang],
    })
  }

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
            model: options.model,
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
            model: options.model,
            specialist: options.specialist,
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
