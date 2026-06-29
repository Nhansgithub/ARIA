import 'server-only'
import Anthropic from '@anthropic-ai/sdk'
import { getAnthropicApiKey } from '@/lib/secrets'
import { ARIA_MODELS } from './models'
import { CRM_STUB_TOOLS } from './crmTools'
import { runTools } from './toolRunner'
import type { ChatTurn } from './streamChat'

const VISION_SPECIALIST_PROMPT = `You are ARIA, an AI business consultant for a Vietnamese service agency founder.
You have received an image (screenshot, photo, or document) from the Owner.

EXTRACTION PROTOCOL — follow this sequence exactly:

Step 1 — READ & EXTRACT:
Read the image carefully. Extract every deal-relevant detail:
  - Client name, company name, contact person
  - Service requested or stated need
  - Budget or price mentions (in VND or USD)
  - Timeline expectations or urgency signals
  - Any objections, concerns, or hesitations

Step 2 — STATE WHAT YOU FOUND:
  Legible: [list each extracted field explicitly]
  Unreadable: [state exactly what you could not read — do NOT guess or fabricate]

Step 3 — CREATE CRM RECORDS (if enough context):
  If you extracted at minimum a client name:
  a. Call find_similar_clients(name, company) FIRST to check for duplicates.
  b. If no match found: call create_client_stub then create_deal_stub with the extracted data.
  c. Confirm: "Em đã tạo hồ sơ cho [name]..." (VI) or "I've created a stub for [name]..." (EN).
  d. Ask EXACTLY 2 targeted follow-up questions to fill the most important gaps.
  If the image lacks a client name: ask the Owner to clarify before creating any records.

OMISSION RULE: Never guess unreadable content. Never fabricate a name, number, or date.
State explicitly what was and was not legible.`

const MAX_TOOL_ITERATIONS = 2
const VISION_TIMEOUT_MS = 30_000

const LANG_DIRECTIVE: Record<'vi' | 'en', string> = {
  vi: 'LANGUAGE: Vietnamese (vi). Address the Owner as "Anh". Respond entirely in Vietnamese.',
  en: 'LANGUAGE: English (en). Be direct. Lead with findings, then questions.',
}

export interface VisionExtractionOptions {
  imageBase64: string
  imageMediaType: string
  userText: string
  messages: ChatTurn[]
  businessContext?: string
  detectedLang?: 'vi' | 'en'
  ownerId: string
}

export function runVisionExtraction(options: VisionExtractionOptions): ReadableStream<Uint8Array> {
  const {
    imageBase64,
    imageMediaType,
    userText,
    messages,
    businessContext,
    detectedLang,
    ownerId,
  } = options
  const client = new Anthropic({ apiKey: getAnthropicApiKey() })
  const encoder = new TextEncoder()

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        // AD-5: stable prefix with cache_control + volatile language directive
        const system: Anthropic.TextBlockParam[] = [
          {
            type: 'text',
            text: VISION_SPECIALIST_PROMPT,
            cache_control: { type: 'ephemeral' },
          },
        ]
        if (businessContext) {
          // AD-5: cache_control on businessContext so it doesn't invalidate the prompt cache prefix.
          system.push({
            type: 'text',
            text: `\n\nOwner Business Context:\n${businessContext}`,
            cache_control: { type: 'ephemeral' },
          })
        }
        if (detectedLang) {
          system.push({ type: 'text', text: `\n\n${LANG_DIRECTIVE[detectedLang]}` })
        }

        // AD-5: sort tools alphabetically for cache stability
        const tools = [...CRM_STUB_TOOLS].sort((a, b) =>
          a.name.localeCompare(b.name)
        ) as Anthropic.Tool[]

        // History = all turns except the last user message (image is in current turn, FR-35)
        const history: Anthropic.MessageParam[] = messages
          .slice(0, -1)
          .map((m) => ({ role: m.role, content: m.content }))

        // Build the image + text content block for this turn
        const visionContent: Anthropic.ContentBlockParam[] = [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: imageMediaType as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif',
              data: imageBase64,
            },
          },
        ]
        if (userText.trim()) {
          visionContent.push({ type: 'text', text: userText.trim() })
        }

        const allMessages: Anthropic.MessageParam[] = [
          ...history,
          { role: 'user', content: visionContent },
        ]

        let iteration = 0

        while (iteration < MAX_TOOL_ITERATIONS) {
          const response = await client.messages.create(
            {
              model: ARIA_MODELS.highJudgment, // AD-4: vision always high-judgment
              max_tokens: 4096,
              system,
              tools,
              messages: allMessages,
            },
            {
              headers: { 'anthropic-beta': 'prompt-caching-2024-07-31' },
              signal: AbortSignal.timeout(VISION_TIMEOUT_MS),
            }
          )

          const toolUseBlocks = response.content.filter(
            (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
          )

          if (response.stop_reason !== 'tool_use' || toolUseBlocks.length === 0) {
            const text = response.content
              .filter((b): b is Anthropic.TextBlock => b.type === 'text')
              .map((b) => b.text)
              .join('')
            // AD-9: log token usage
            console.log(
              `[vision] tokens: input=${response.usage?.input_tokens ?? 0} output=${response.usage?.output_tokens ?? 0} specialist=vision_input`
            )
            controller.enqueue(encoder.encode(text || '\n\n[ARIA error: Empty response from AI]'))
            controller.close()
            return
          }

          const toolResults = await runTools(toolUseBlocks, ownerId)
          allMessages.push({ role: 'assistant', content: response.content })
          allMessages.push({ role: 'user', content: toolResults })
          iteration++
        }

        // Max iterations reached — final call without tools to force text synthesis
        const finalResponse = await client.messages.create(
          {
            model: ARIA_MODELS.highJudgment,
            max_tokens: 4096,
            system,
            messages: allMessages,
          },
          {
            headers: { 'anthropic-beta': 'prompt-caching-2024-07-31' },
            signal: AbortSignal.timeout(VISION_TIMEOUT_MS),
          }
        )
        const finalText = finalResponse.content
          .filter((b): b is Anthropic.TextBlock => b.type === 'text')
          .map((b) => b.text)
          .join('')
        console.log(
          `[vision] tokens: input=${finalResponse.usage?.input_tokens ?? 0} output=${finalResponse.usage?.output_tokens ?? 0} specialist=vision_input`
        )
        controller.enqueue(encoder.encode(finalText || '\n\n[ARIA error: Empty response from AI]'))
        controller.close()
      } catch (err) {
        // AD-6: sentinel triggers degraded banner in ChatPanel
        const errMsg = err instanceof Error ? err.message : 'Unknown error'
        controller.enqueue(encoder.encode(`\n\n[ARIA error: ${errMsg}]`))
        controller.close()
      }
    },
  })
}
