import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

// AD-13: owner request path — createServerClient()
// AD-2: all queries include owner_id

const VALID_ZALO_STATUSES = ['not_configured', 'connected', 'token_expired'] as const
type ZaloStatus = (typeof VALID_ZALO_STATUSES)[number]

// Allowlist: only these fields may be written by the owner via PATCH.
// zalo_status is intentionally absent — set by the Story 5.3 cron job only.
const OWNER_WRITABLE_FIELDS = ['email_enabled', 'zalo_setup_note_shown'] as const
type OwnerWritableField = (typeof OWNER_WRITABLE_FIELDS)[number]

interface NotificationChannelSettings {
  email_enabled: boolean
  zalo_status: ZaloStatus
  zalo_setup_note_shown: boolean
}

const DEFAULTS: NotificationChannelSettings = {
  email_enabled: true,
  zalo_status: 'not_configured',
  zalo_setup_note_shown: false,
}

export async function GET(): Promise<NextResponse> {
  const supabase = createServerClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('settings')
    .select('email_enabled, zalo_status, zalo_setup_note_shown')
    .eq('owner_id', user.id)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  const settings: NotificationChannelSettings = data
    ? {
        email_enabled: data.email_enabled ?? DEFAULTS.email_enabled,
        zalo_status: ((VALID_ZALO_STATUSES as readonly string[]).includes(data.zalo_status)
          ? data.zalo_status
          : DEFAULTS.zalo_status) as ZaloStatus,
        zalo_setup_note_shown: data.zalo_setup_note_shown ?? DEFAULTS.zalo_setup_note_shown,
      }
    : DEFAULTS

  return NextResponse.json(
    {
      settings,
      zalo_server_configured: !!(process.env.ZALO_APP_ID && process.env.ZALO_SECRET_KEY),
    },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const supabase = createServerClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (typeof body !== 'object' || body === null) {
    return NextResponse.json({ error: 'Body must be an object' }, { status: 400 })
  }

  const raw = body as Record<string, unknown>

  // Reject any key outside the explicit allowlist — denylist approach misses future sensitive columns
  const unknownKeys = Object.keys(raw).filter(
    (k) => !(OWNER_WRITABLE_FIELDS as readonly string[]).includes(k)
  )
  if (unknownKeys.length > 0) {
    return NextResponse.json(
      { error: `Unknown or read-only fields: ${unknownKeys.join(', ')}` },
      { status: 400 }
    )
  }

  const patch: Partial<Record<OwnerWritableField, boolean>> = {}

  if ('email_enabled' in raw) {
    if (typeof raw.email_enabled !== 'boolean') {
      return NextResponse.json({ error: 'email_enabled must be a boolean' }, { status: 400 })
    }
    patch.email_enabled = raw.email_enabled as boolean
  }

  if ('zalo_setup_note_shown' in raw) {
    if (typeof raw.zalo_setup_note_shown !== 'boolean') {
      return NextResponse.json(
        { error: 'zalo_setup_note_shown must be a boolean' },
        { status: 400 }
      )
    }
    patch.zalo_setup_note_shown = raw.zalo_setup_note_shown as boolean
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'No writable fields provided' }, { status: 400 })
  }

  // upsert scoped by owner_id in payload + RLS; the .eq() filter after upsert is a PostgREST no-op
  const { error } = await supabase
    .from('settings')
    .upsert(
      { owner_id: user.id, ...patch, updated_at: new Date().toISOString() },
      { onConflict: 'owner_id' }
    )

  if (error) {
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  return new NextResponse(null, { status: 204 })
}
