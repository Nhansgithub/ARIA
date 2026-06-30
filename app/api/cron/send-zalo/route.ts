import { timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { isZaloConfigured } from '@/lib/zalo/zaloTokenService'
import { sendZaloMessage } from '@/lib/zalo/zaloService'
import { formatBriefingForZalo } from '@/lib/zalo/briefingZaloFormatter'
import { formatCheckInForZalo } from '@/lib/zalo/checkInZaloFormatter'

// AD-13: cron/system route — createServiceClient()
// AD-8: Zalo is secondary channel; in-app record already written before this runs
// AD-6: never throws; returns { ok: false, error } on failure paths
// CRON_SECRET: server-only env var — never logged
// NOTE: access_token is sent as HTTP header per Zalo OA API spec; configure
// proxy log scrubbing to redact 'access_token' headers in production.

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

async function logFailure(supabase: ReturnType<typeof createServiceClient>, ownerId: string, action: string, errorMsg: string) {
  await supabase.from('activity_log').insert({
    owner_id: ownerId,
    entity_type: 'notification',
    entity_id: ownerId,
    action,
    actor: 'ai',
    payload: { error: errorMsg },
  }).then(() => {}, () => {})
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!validateCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!isZaloConfigured()) {
    return NextResponse.json({ skipped: 'Zalo not configured' })
  }

  const supabase = createServiceClient()

  // Query connected owners once — reused for both briefings and check-ins
  const { data: owners } = await supabase
    .from('settings')
    .select('owner_id, zalo_access_token, zalo_user_id')
    .eq('zalo_status', 'connected')
    .not('zalo_access_token', 'is', null)
    .not('zalo_user_id', 'is', null)

  const today = new Date().toISOString().slice(0, 10)
  let briefingsSent = 0
  let briefingsFailed = 0
  let checkInsSent = 0
  let checkInsFailed = 0

  // ─── Briefings ───────────────────────────────────────────────────────────
  for (const owner of owners ?? []) {
    if (!owner.zalo_access_token || !owner.zalo_user_id) continue

    const { data: briefing } = await supabase
      .from('briefings')
      .select('id, summary, owner_id, zalo_status')
      .eq('owner_id', owner.owner_id)
      .eq('zalo_status', 'pending')
      .gte('created_at', `${today}T00:00:00Z`)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!briefing) continue

    const { data: deals } = await supabase
      .from('deals')
      .select('title, priority, next_action')
      .eq('owner_id', owner.owner_id)
      .in('priority', ['high', 'medium'])
      .order('priority', { ascending: true })
      .limit(5)

    const dateLabel = new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'numeric' })
    const text = formatBriefingForZalo({
      owner_name: owner.owner_id.slice(0, 6),
      date_label: dateLabel,
      summary: briefing.summary ?? '',
      deals: (deals ?? []).map(d => ({ title: d.title, priority: d.priority ?? 'low', next_action: d.next_action ?? undefined })),
    })

    const result = await sendZaloMessage({ accessToken: owner.zalo_access_token, userId: owner.zalo_user_id, text })
    const now = new Date().toISOString()

    if (result.ok) {
      const { error: updateErr } = await supabase
        .from('briefings').update({ zalo_status: 'sent', updated_at: now }).eq('id', briefing.id)
      if (updateErr) {
        await logFailure(supabase, owner.owner_id, 'zalo_briefing_status_update_failed', updateErr.message)
      }
      briefingsSent++
    } else {
      const { error: updateErr } = await supabase
        .from('briefings').update({ zalo_status: 'failed', updated_at: now }).eq('id', briefing.id)
      if (updateErr) {
        console.warn('[ARIA/send-zalo] briefing failed-status update failed:', updateErr.message)
      }
      await logFailure(supabase, owner.owner_id, 'zalo_briefing_failed', result.error ?? 'unknown')
      briefingsFailed++
    }
  }

  // ─── Check-ins ───────────────────────────────────────────────────────────
  for (const owner of owners ?? []) {
    if (!owner.zalo_access_token || !owner.zalo_user_id) continue

    const { data: checkIns } = await supabase
      .from('check_ins')
      .select('id, deal_id, prompt_template, owner_id, zalo_status, deals(title)')
      .eq('owner_id', owner.owner_id)
      .eq('zalo_status', 'pending')
      .eq('status', 'pending')
      .lte('scheduled_at', new Date().toISOString())
      .order('scheduled_at', { ascending: true })
      .limit(10)

    for (const ci of checkIns ?? []) {
      const dealsRaw = ci.deals as unknown
      const dealTitle = (
        Array.isArray(dealsRaw)
          ? (dealsRaw as Array<{ title: string }>)[0]?.title
          : (dealsRaw as { title: string } | null)?.title
      ) ?? ci.deal_id

      const text = formatCheckInForZalo({
        deal_title: dealTitle,
        prompt: ci.prompt_template || 'Bạn có cập nhật nào cho deal này không?',
      })

      const result = await sendZaloMessage({ accessToken: owner.zalo_access_token, userId: owner.zalo_user_id, text })
      const now = new Date().toISOString()

      if (result.ok) {
        const { error: updateErr } = await supabase
          .from('check_ins').update({ zalo_status: 'sent', updated_at: now }).eq('id', ci.id)
        if (updateErr) {
          await logFailure(supabase, owner.owner_id, 'zalo_check_in_status_update_failed', updateErr.message)
        }
        checkInsSent++
      } else {
        const { error: updateErr } = await supabase
          .from('check_ins').update({ zalo_status: 'failed', updated_at: now }).eq('id', ci.id)
        if (updateErr) {
          console.warn('[ARIA/send-zalo] check-in failed-status update failed:', updateErr.message)
        }
        await logFailure(supabase, owner.owner_id, 'zalo_check_in_failed', result.error ?? 'unknown')
        checkInsFailed++
      }
    }
  }

  return NextResponse.json({ briefings: { sent: briefingsSent, failed: briefingsFailed }, check_ins: { sent: checkInsSent, failed: checkInsFailed } })
}
