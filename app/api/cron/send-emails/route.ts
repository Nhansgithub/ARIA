import { timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email/emailService'
import { formatBriefingEmail } from '@/lib/email/briefingEmailFormatter'
import { formatCheckInEmail } from '@/lib/email/checkInEmailFormatter'

// AD-13: cron/system route — createServiceClient() (no owner request context)
// CRON_SECRET: server-only env var — never logged, never exposed to client
// Story 5.5: skips records where zalo_status='sent' — Zalo delivery takes priority (AD-8)

function validateCronSecret(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return false
  const authHeader = request.headers.get('authorization')
  if (!authHeader || !/^Bearer\s+/i.test(authHeader)) return false
  const incoming = authHeader.replace(/^Bearer\s+/i, '').trim()
  const a = Buffer.from(incoming)
  const b = Buffer.from(cronSecret)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

async function logFailure(
  supabase: ReturnType<typeof createServiceClient>,
  ownerId: string,
  entityId: string,
  error: string
): Promise<void> {
  // Log directly with service client — logActivity() uses createServerClient() which fails in cron context
  await supabase
    .from('activity_log')
    .insert({
      owner_id: ownerId,
      entity_type: 'settings',
      entity_id: entityId,
      action: 'email_delivery_failed',
      actor: 'ai',
      payload: { error },
    })
    .then(
      () => {},
      (err: unknown) => console.warn('[ARIA/send-emails] activity log failed:', err)
    )
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!validateCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const today = new Date().toISOString().split('T')[0]!

  let briefingsSent = 0
  let checkInsSent = 0
  let failedCount = 0

  // ── 1. Briefing emails ─────────────────────────────────────────────────────
  const { data: briefings, error: briefingError } = await supabase
    .from('briefings')
    .select('id, owner_id, date, content_md, flags')
    .eq('date', today)
    .is('email_sent_at', null)
    .neq('zalo_status', 'sent')
    .limit(100)

  if (briefingError) {
    console.error('[ARIA/send-emails] briefing query error:', briefingError.message)
  }

  for (const b of briefings ?? []) {
    const { data: userRecord } = await supabase.auth.admin.getUserById(b.owner_id)
    const email = userRecord?.user?.email
    if (!email) {
      failedCount++
      continue
    }

    const { subject, text } = formatBriefingEmail(
      {
        date: b.date,
        content_md: b.content_md,
        flags: b.flags as { items?: Array<{ severity: 'high' | 'medium'; type: string }> } | null,
      },
      'vi'
    )

    const result = await sendEmail({ to: email, subject, text })
    if (result.ok) {
      const { error: updateErr } = await supabase
        .from('briefings')
        .update({ email_sent_at: new Date().toISOString() })
        .eq('id', b.id)
      if (updateErr)
        console.warn(
          '[ARIA/send-emails] failed to stamp briefing email_sent_at:',
          updateErr.message
        )
      briefingsSent++
    } else {
      await logFailure(supabase, b.owner_id, b.id, result.error ?? 'unknown')
      failedCount++
    }
  }

  // ── 2. Check-in emails ─────────────────────────────────────────────────────
  const { data: checkIns, error: checkInError } = await supabase
    .from('check_ins')
    .select('id, owner_id, deal_id, prompt_template, deals!inner(title)')
    .eq('status', 'pending')
    .is('email_sent_at', null)
    .neq('zalo_status', 'sent')
    .limit(100)

  if (checkInError) {
    console.error('[ARIA/send-emails] check-in query error:', checkInError.message)
  }

  for (const ci of checkIns ?? []) {
    const { data: userRecord } = await supabase.auth.admin.getUserById(ci.owner_id)
    const email = userRecord?.user?.email
    if (!email) {
      failedCount++
      continue
    }

    const dealsRaw = ci.deals as unknown
    const rawTitle =
      (Array.isArray(dealsRaw)
        ? (dealsRaw as Array<{ title: string }>)[0]?.title
        : (dealsRaw as { title: string } | null)?.title) ?? ci.deal_id
    const dealTitle = rawTitle.replace(/[\r\n]+/g, ' ').slice(0, 200)
    const { subject, text } = formatCheckInEmail(
      { deal_title: dealTitle, prompt_template: ci.prompt_template },
      'vi'
    )

    const result = await sendEmail({ to: email, subject, text })
    if (result.ok) {
      const { error: updateErr } = await supabase
        .from('check_ins')
        .update({ email_sent_at: new Date().toISOString() })
        .eq('id', ci.id)
      if (updateErr)
        console.warn(
          '[ARIA/send-emails] failed to stamp check_in email_sent_at:',
          updateErr.message
        )
      checkInsSent++
    } else {
      await logFailure(supabase, ci.owner_id, ci.id, result.error ?? 'unknown')
      failedCount++
    }
  }

  return NextResponse.json({
    sent: { briefings: briefingsSent, checkIns: checkInsSent },
    failed: failedCount,
  })
}
