import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/crm/activityLogService'

// AD-13: owner-initiated route — createServerClient() (cookie-based JWT, RLS enforced)
// logActivity uses createServerClient() internally — correct for owner routes

const VALID_ANSWERS = ['yes', 'no', 'later', 'skipped'] as const
type AnswerValue = (typeof VALID_ANSWERS)[number]

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const supabase = createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = params.id
  let body: { answer?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const rawAnswer = body.answer
  if (typeof rawAnswer !== 'string' || !VALID_ANSWERS.includes(rawAnswer as AnswerValue)) {
    return NextResponse.json({ error: 'Invalid answer value' }, { status: 400 })
  }
  const answer = rawAnswer as AnswerValue

  // Fetch deal_id first (needed for activity log) — also validates ownership (AD-2)
  const { data: existing, error: fetchError } = await supabase
    .from('check_ins')
    .select('deal_id')
    .eq('owner_id', user.id)
    .eq('id', id)
    .single()

  if (fetchError || !existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const now = new Date().toISOString()
  const status = answer === 'skipped' ? 'skipped' : 'sent'

  const { error: updateError } = await supabase
    .from('check_ins')
    .update({
      status,
      answered_at: now,
      sent_at: now,
      answer: { value: answer },
    })
    .eq('owner_id', user.id) // AD-2: must be present
    .eq('id', id)

  if (updateError) {
    console.error('[ARIA/check-ins/answer] update error:', updateError.message)
    return NextResponse.json({ error: 'update_error' }, { status: 500 })
  }

  // Write activity log (fire-and-forget — AD-14 append-only)
  logActivity(user.id, {
    entity_type: 'deal',
    entity_id: existing.deal_id,
    action: 'checkin_answered',
    actor: 'user',
    payload: { answer, check_in_id: id },
  }).catch((err) => console.warn('[ARIA/check-ins/answer] logActivity failed:', err))

  return NextResponse.json({ ok: true })
}
