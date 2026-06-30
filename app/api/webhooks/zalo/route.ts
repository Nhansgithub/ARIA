import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

// AD-13: webhook route — createServiceClient() (no user session available)
// AD-14: activity_log is append-only
// v1 stub: log all inbound Zalo events to activity_log, no business logic yet.
// Zalo OA webhooks use GET for verification and POST for events.
// TODO v2: verify Zalo MAC/OA-Signature header once OA registration is complete.
// Mitigation for v1: configure infrastructure-level IP allowlisting for Zalo's documented IP ranges.

export async function GET(request: NextRequest): Promise<NextResponse> {
  // Zalo OA verifies webhook endpoints via GET with a challenge parameter
  const { searchParams } = new URL(request.url)
  const challenge = searchParams.get('challenge')
  if (challenge) return NextResponse.json({ challenge })
  return new NextResponse(null, { status: 200 })
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return new NextResponse(null, { status: 400 })
  }

  const supabase = createServiceClient()

  // Log all inbound webhook events — no business logic in v1
  await supabase
    .from('activity_log')
    .insert({
      owner_id: 'system',
      entity_type: 'zalo_webhook',
      entity_id: 'inbound',
      action: 'zalo_event_received',
      actor: 'system',
      payload: body as Record<string, unknown>,
    })
    .then(
      () => {},
      () => {}
    )

  return new NextResponse(null, { status: 200 })
}
