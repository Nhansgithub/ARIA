import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { generateBriefingForOwner } from '@/lib/crm/briefingService'

// AD-13: reads via createServerClient() (owner-scoped, RLS-enforced).
// On-demand generation uses generateBriefingForOwner (service-role) — acceptable as a
// system/scheduler task triggered on demand; not serving raw owner data via service role.

export async function GET(request: NextRequest): Promise<NextResponse> {
  const supabase = createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const today = new Date().toISOString().split('T')[0]!
  const { searchParams } = new URL(request.url)
  const generate = searchParams.get('generate') === 'true'
  const forceRefresh = searchParams.get('forceRefresh') === 'true'

  // On-demand generation (force-refresh path) — service role is acceptable here
  if (forceRefresh) {
    try {
      const generated = await generateBriefingForOwner(user.id, today, true)
      if (!generated) return NextResponse.json({ briefing: null })
      return NextResponse.json({ briefing: generated })
    } catch (err) {
      console.error('[ARIA/briefing/today] forceRefresh generation error:', err)
      return NextResponse.json({ error: 'generation_error' }, { status: 500 })
    }
  }

  // Read today's cached briefing via owner-scoped client (AD-13)
  const { data, error } = await supabase
    .from('briefings')
    .select('id, owner_id, date, content_md, flags, generated_at')
    .eq('owner_id', user.id)
    .eq('date', today)
    .maybeSingle()

  if (error) {
    console.error('[ARIA/briefing/today] fetch error:', error.message)
    return NextResponse.json({ error: 'fetch_error' }, { status: 500 })
  }

  if (!data) {
    if (!generate) {
      // No cached briefing — caller may retry with ?generate=true
      return NextResponse.json({ briefing: null })
    }
    // On-demand generation — service role acceptable (system task)
    try {
      const generated = await generateBriefingForOwner(user.id, today, false)
      if (!generated) return NextResponse.json({ briefing: null })
      return NextResponse.json({ briefing: generated })
    } catch (err) {
      console.error('[ARIA/briefing/today] on-demand generation error:', err)
      return NextResponse.json({ error: 'generation_error' }, { status: 500 })
    }
  }

  return NextResponse.json({
    briefing: { ...(data as Record<string, unknown>), status: 'generated' as const },
  })
}
