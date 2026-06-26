import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { isPrivacyNoticeAcknowledged } from '@/lib/privacy/checkPrivacyNotice'
import { streamChat } from '@/lib/ai/streamChat'
import { classifyIntent, SPECIALIST_SYSTEM_PROMPTS, INTENT_MODEL_MAP } from '@/lib/ai/orchestrator'
import { detectLanguage } from '@/lib/language/detectLanguage'
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

  // AD-1: orchestrator intercept — classify intent before streaming.
  // Uses callAI() with the economical model (AD-4: cheap/fast).
  // Never throws: any failure silently falls back to general_chat (AD-6).
  const classification = await classifyIntent(messages)

  // Route to specialist: system prompt + model selected by orchestrator (AC-8)
  const stream = streamChat({
    model: INTENT_MODEL_MAP[classification.intent],
    specialist: classification.intent,
    systemPrompt: SPECIALIST_SYSTEM_PROMPTS[classification.intent],
    messages,
    detectedLang,
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
