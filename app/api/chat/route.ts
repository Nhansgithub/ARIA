import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { isPrivacyNoticeAcknowledged } from '@/lib/privacy/checkPrivacyNotice'
import { streamChat } from '@/lib/ai/streamChat'
import type { ChatTurn } from '@/lib/ai/streamChat'

const CHAT_SYSTEM_PROMPT = `You are ARIA, an AI business consultant for a Vietnamese service agency founder.
Answer helpfully in the same language as the user's message (Vietnamese or English).
Be direct, analytical, and explain your reasoning.`

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

  // AD-1: streaming call routed through lib/ai/streamChat.ts — no SDK usage in app/
  const stream = streamChat({
    systemPrompt: CHAT_SYSTEM_PROMPT,
    messages,
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
