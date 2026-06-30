import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { isZaloConfigured, exchangeCredentialsForTokens } from '@/lib/zalo/zaloTokenService'

// AD-13: owner request path — createServerClient()
// AD-11: Zalo tokens stored server-side only; never returned to client

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isZaloConfigured()) {
    return NextResponse.json(
      { error: 'Zalo OA chưa được cấu hình trên máy chủ. Liên hệ admin để thêm ZALO_APP_ID và ZALO_SECRET_KEY.' },
      { status: 503 },
    )
  }

  const supabase = createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const raw = body as Record<string, unknown>
  const zaloUserId = raw.zalo_user_id
  if (typeof zaloUserId !== 'string' || !zaloUserId.trim()) {
    return NextResponse.json({ error: 'zalo_user_id là bắt buộc' }, { status: 400 })
  }
  if (!/^\d+$/.test(zaloUserId.trim())) {
    return NextResponse.json({ error: 'zalo_user_id phải là số' }, { status: 400 })
  }

  // Exchange credentials for tokens via Zalo OA token endpoint
  const tokenResult = await exchangeCredentialsForTokens()
  if (!tokenResult.ok) {
    return NextResponse.json(
      { error: `Không thể kết nối Zalo OA — kiểm tra App ID / Secret Key. (${tokenResult.error ?? 'unknown'})` },
      { status: 502 },
    )
  }

  const now = new Date().toISOString()
  const { error: dbError } = await supabase
    .from('settings')
    .upsert(
      {
        owner_id: user.id,
        zalo_user_id: zaloUserId.trim(),
        zalo_access_token: tokenResult.access_token,
        encrypted_zalo_refresh_token: tokenResult.refresh_token ?? null,
        zalo_token_issued_at: now,
        zalo_status: 'connected',
        updated_at: now,
      },
      { onConflict: 'owner_id' },
    )

  if (dbError) {
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, message: 'Zalo OA đã kết nối — ARIA sẽ gửi thông báo qua Zalo.' })
}
