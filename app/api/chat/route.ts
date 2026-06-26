import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { isPrivacyNoticeAcknowledged } from '@/lib/privacy/checkPrivacyNotice'
import { streamChat } from '@/lib/ai/streamChat'
import { classifyIntent, SPECIALIST_SYSTEM_PROMPTS, INTENT_MODEL_MAP } from '@/lib/ai/orchestrator'
import { detectLanguage } from '@/lib/language/detectLanguage'
import { getBusinessContext } from '@/lib/businessContext/getBusinessContext'
import type { ChatTurn } from '@/lib/ai/streamChat'

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

  // Story 1.3: detect language of the latest user turn for response mirroring (AC-1–AC-3).
  // Passes undefined (not 'en') when no user turn exists so the language directive is skipped.
  const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user')
  const detectedLang = lastUserMsg ? detectLanguage(lastUserMsg.content) : undefined

  // Story 1.4: fetch Business Context and classify intent in parallel (AD-5, AC-1).
  // getBusinessContext returns null on any DB error or missing context — chat proceeds normally (AD-6).
  // classifyIntent is the slow path (~5s max); getBusinessContext (~50ms) adds zero wall-clock time.
  const [businessContext, classification] = await Promise.all([
    getBusinessContext(user.id),
    classifyIntent(messages),
  ])

  // Route to specialist: system prompt + model selected by orchestrator (Story 1.2)
  const stream = streamChat({
    model: INTENT_MODEL_MAP[classification.intent],
    specialist: classification.intent,
    systemPrompt: SPECIALIST_SYSTEM_PROMPTS[classification.intent],
    messages,
    detectedLang,
    businessContext: businessContext ?? undefined,
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
