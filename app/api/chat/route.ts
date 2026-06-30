import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { isPrivacyNoticeAcknowledged } from '@/lib/privacy/checkPrivacyNotice'
import { streamChat } from '@/lib/ai/streamChat'
import { runAgentWithTools } from '@/lib/ai/agentWithTools'
import { runVisionExtraction } from '@/lib/ai/visionExtraction'
import { CRM_STUB_TOOLS } from '@/lib/ai/crmTools'
import { DI_TOOLS } from '@/lib/ai/dealIntelligenceTools'
import { STRATEGY_TOOLS } from '@/lib/ai/strategyTools'
import { DOCUMENT_CREATION_TOOLS } from '@/lib/ai/documentCreationTools'
import { DOCUMENT_REVISION_TOOLS } from '@/lib/ai/documentRevisionTools'
import { PIPELINE_STATUS_TOOLS } from '@/lib/ai/pipelineStatusTools'
import { classifyIntent, SPECIALIST_SYSTEM_PROMPTS, INTENT_MODEL_MAP } from '@/lib/ai/orchestrator'
import { detectLanguage } from '@/lib/language/detectLanguage'
import { getBusinessContext } from '@/lib/businessContext/getBusinessContext'
import type { ChatTurn } from '@/lib/ai/streamChat'
import { trimMessages } from '@/lib/ai/contextManager'

// NOTE: CHAT_SYSTEM_PROMPT removed — each intent bucket has its own specialist
// prompt in lib/ai/orchestrator.ts (AC-8, Story 1.2).

export async function POST(req: NextRequest) {
  const supabase = createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // AD-10: privacy gate — every AI call requires prior acknowledgement
  const acknowledged = await isPrivacyNoticeAcknowledged(user.id)
  if (!acknowledged) {
    return new Response(
      JSON.stringify({ requiresAcknowledgement: true, status: 'awaiting_privacy_ack' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const body = await req.json()
  const messages = body.messages as ChatTurn[]
  const imageBase64 = body.imageBase64 as string | undefined
  const imageMediaType = body.imageMediaType as string | undefined

  // Story 1.3: detect language of the latest user turn for response mirroring (AC-1–AC-3).
  // Uses the text content of the last user message — the image is a separate body field.
  // Passes undefined (not 'en') when no user turn exists so the language directive is skipped.
  // AD-5: language detection must use the original full messages array (before trimming).
  const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user')
  const detectedLang = lastUserMsg ? detectLanguage(lastUserMsg.content) : undefined

  // Story 1.13: context budget — trim older turns when the conversation grows long.
  // AD-12: trim proxy: if messages > 20, keep last 10 (OQ-9 tuning dial).
  // Must happen AFTER detectLanguage (uses original array) but BEFORE all AI calls.
  const { trimmed: messagesForAI, wasTrimmed } = trimMessages(messages)
  if (wasTrimmed) console.log('[ARIA/context] Messages trimmed for context budget')

  // Story 1.9: vision path — image presence overrides intent classification (AC-3).
  // Skip classifyIntent entirely; route directly to the high-judgment vision specialist (AD-4).
  if (imageBase64 && imageMediaType) {
    // P1: Validate MIME type server-side before use as Storage contentType (MIME injection defence).
    const ALLOWED_VISION_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
    if (!ALLOWED_VISION_TYPES.has(imageMediaType)) {
      return new Response(JSON.stringify({ error: 'Unsupported image type' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // P1: Cap base64 payload server-side — client-side limit is trivially bypassed (DoS defence).
    // 10 MB binary → ceil(10*1024*1024 * 4/3) ≈ 13_981_013 chars; add 1024 for padding slack.
    const MAX_BASE64_LEN = 13_982_037
    if (imageBase64.length > MAX_BASE64_LEN) {
      return new Response(JSON.stringify({ error: 'Image payload too large' }), {
        status: 413,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Upload to owner-scoped Supabase Storage (AD-9, AD-2, AD-13). Non-fatal on failure.
    const ext =
      imageMediaType === 'image/png' ? 'png' : imageMediaType === 'image/webp' ? 'webp' : 'jpg'
    const storagePath = `${user.id}/${Date.now()}.${ext}`
    const imageBuffer = Buffer.from(imageBase64, 'base64')
    const { error: uploadError } = await supabase.storage
      .from('screenshots')
      .upload(storagePath, imageBuffer, { contentType: imageMediaType, upsert: false })
    if (uploadError) {
      console.warn('[vision] Storage upload failed:', uploadError.message)
    }

    const businessContext = await getBusinessContext(user.id)
    const userText = lastUserMsg?.content ?? ''

    const visionStream = runVisionExtraction({
      imageBase64,
      imageMediaType,
      userText,
      messages: messagesForAI,
      detectedLang,
      businessContext: businessContext ?? undefined,
      ownerId: user.id,
    })

    return new Response(visionStream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  }

  // Story 1.4: fetch Business Context and classify intent in parallel (AD-5, AC-1).
  // getBusinessContext returns null on any DB error or missing context — chat proceeds normally (AD-6).
  // classifyIntent is the slow path (~5s max); getBusinessContext (~50ms) adds zero wall-clock time.
  const [businessContext, classification] = await Promise.all([
    getBusinessContext(user.id),
    classifyIntent(messagesForAI),
  ])

  // Route to specialist: crm_action uses the agentic tool loop; all others use direct streaming.
  let stream: ReadableStream<Uint8Array>

  if (classification.intent === 'crm_action') {
    stream = runAgentWithTools({
      model: INTENT_MODEL_MAP[classification.intent],
      specialist: classification.intent,
      systemPrompt: SPECIALIST_SYSTEM_PROMPTS[classification.intent],
      tools: CRM_STUB_TOOLS,
      messages: messagesForAI,
      detectedLang,
      businessContext: businessContext ?? undefined,
      ownerId: user.id,
    })
  } else if (classification.intent === 'deal_intelligence') {
    stream = runAgentWithTools({
      model: INTENT_MODEL_MAP[classification.intent],
      specialist: classification.intent,
      systemPrompt: SPECIALIST_SYSTEM_PROMPTS[classification.intent],
      tools: DI_TOOLS,
      messages: messagesForAI,
      detectedLang,
      businessContext: businessContext ?? undefined,
      ownerId: user.id,
    })
  } else if (classification.intent === 'strategy') {
    stream = runAgentWithTools({
      model: INTENT_MODEL_MAP[classification.intent],
      specialist: classification.intent,
      systemPrompt: SPECIALIST_SYSTEM_PROMPTS[classification.intent],
      tools: STRATEGY_TOOLS,
      messages: messagesForAI,
      detectedLang,
      businessContext: businessContext ?? undefined,
      ownerId: user.id,
    })
  } else if (classification.intent === 'document_creation') {
    stream = runAgentWithTools({
      model: INTENT_MODEL_MAP[classification.intent],
      specialist: classification.intent,
      systemPrompt: SPECIALIST_SYSTEM_PROMPTS[classification.intent],
      tools: DOCUMENT_CREATION_TOOLS,
      messages: messagesForAI,
      detectedLang,
      businessContext: businessContext ?? undefined,
      ownerId: user.id,
    })
  } else if (classification.intent === 'pipeline_status') {
    stream = runAgentWithTools({
      model: INTENT_MODEL_MAP[classification.intent],
      specialist: classification.intent,
      systemPrompt: SPECIALIST_SYSTEM_PROMPTS[classification.intent],
      tools: PIPELINE_STATUS_TOOLS,
      messages: messagesForAI,
      detectedLang,
      businessContext: businessContext ?? undefined,
      ownerId: user.id,
    })
  } else if (classification.intent === 'document_revision') {
    stream = runAgentWithTools({
      model: INTENT_MODEL_MAP[classification.intent],
      specialist: classification.intent,
      systemPrompt: SPECIALIST_SYSTEM_PROMPTS[classification.intent],
      tools: DOCUMENT_REVISION_TOOLS,
      messages: messagesForAI,
      detectedLang,
      businessContext: businessContext ?? undefined,
      ownerId: user.id,
    })
  } else {
    // general_chat — no tools, economical model, bare streaming
    stream = streamChat({
      model: INTENT_MODEL_MAP[classification.intent],
      specialist: classification.intent,
      systemPrompt: SPECIALIST_SYSTEM_PROMPTS[classification.intent],
      messages: messagesForAI,
      detectedLang,
      businessContext: businessContext ?? undefined,
    })
  }

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
