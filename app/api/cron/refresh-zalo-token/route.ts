import { timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { isZaloConfigured, refreshAccessToken } from '@/lib/zalo/zaloTokenService'

// AD-13: cron/system route — createServiceClient()
// CRON_SECRET: server-only env var — never logged
// Runs every 55 minutes; refreshes Zalo access tokens before they expire (1-hour TTL)

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

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!validateCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!isZaloConfigured()) {
    return NextResponse.json({ skipped: 'Zalo not configured' })
  }

  const supabase = createServiceClient()

  // Find owners with connected Zalo whose token may need refreshing
  // Refresh if token was issued more than 50 minutes ago (10-min buffer before 1-hour expiry)
  const refreshCutoff = new Date(Date.now() - 50 * 60 * 1000).toISOString()

  const { data: owners, error: queryError } = await supabase
    .from('settings')
    .select('owner_id, encrypted_zalo_refresh_token, zalo_token_issued_at')
    .eq('zalo_status', 'connected')
    .not('encrypted_zalo_refresh_token', 'is', null)
    .or(`zalo_token_issued_at.is.null,zalo_token_issued_at.lt.${refreshCutoff}`)

  if (queryError) {
    console.error('[ARIA/refresh-zalo-token] query error:', queryError.message)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  let refreshed = 0
  let failed = 0

  for (const owner of owners ?? []) {
    if (!owner.encrypted_zalo_refresh_token) {
      failed++
      continue
    }

    const result = await refreshAccessToken(owner.encrypted_zalo_refresh_token)
    const now = new Date().toISOString()

    if (result.ok && result.access_token) {
      const { error: updateErr } = await supabase
        .from('settings')
        .update({
          zalo_access_token: result.access_token,
          encrypted_zalo_refresh_token: result.refresh_token ?? owner.encrypted_zalo_refresh_token,
          zalo_token_issued_at: now,
          updated_at: now,
        })
        .eq('owner_id', owner.owner_id)
      if (updateErr) {
        console.warn('[ARIA/refresh-zalo-token] update failed:', updateErr.message)
        failed++
      } else {
        // AD-14: activity_log is append-only — log via direct insert (cron context)
        await supabase
          .from('activity_log')
          .insert({
            owner_id: owner.owner_id,
            entity_type: 'settings',
            entity_id: owner.owner_id,
            action: 'zalo_token_refreshed',
            actor: 'ai',
            payload: {},
          })
          .then(
            () => {},
            (err: unknown) => console.warn('[ARIA/refresh-zalo-token] log failed:', err)
          )
        refreshed++
      }
    } else {
      // Refresh failed — mark token_expired so delivery falls back to email
      const { error: statusErr } = await supabase
        .from('settings')
        .update({ zalo_status: 'token_expired', updated_at: now })
        .eq('owner_id', owner.owner_id)
      if (statusErr) {
        console.warn(
          '[ARIA/refresh-zalo-token] token_expired status update failed:',
          statusErr.message
        )
      }
      await supabase
        .from('activity_log')
        .insert({
          owner_id: owner.owner_id,
          entity_type: 'settings',
          entity_id: owner.owner_id,
          action: 'zalo_token_refresh_failed',
          actor: 'ai',
          payload: { error: result.error ?? 'unknown' },
        })
        .then(
          () => {},
          () => {}
        )
      failed++
    }
  }

  return NextResponse.json({ refreshed, failed })
}
