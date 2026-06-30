import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { generateCheckInPrompt } from '@/lib/ai/checkInPromptService'

// AD-13: owner-initiated route — createServerClient() (RLS-enforced, cookie-based JWT)
// Service-role client must NOT be used here — this path serves owner data

export async function GET(): Promise<NextResponse> {
  const supabase = createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const today = new Date().toISOString().split('T')[0]!

  // Fetch pending check-ins due today or earlier (AD-2: owner scoped)
  const { data: checkIns, error } = await supabase
    .from('check_ins')
    .select('id, deal_id, trigger_type, due_date, prompt_template')
    .eq('owner_id', user.id)
    .eq('status', 'pending')
    .lte('due_date', today)
    .order('due_date', { ascending: true })
    .limit(10)

  if (error) {
    console.error('[ARIA/check-ins/pending] fetch error:', error.message)
    return NextResponse.json({ error: 'fetch_error' }, { status: 500 })
  }

  const rows = checkIns ?? []
  if (rows.length === 0) return NextResponse.json({ checkIns: [] })

  // Batch-fetch all deal titles in one query (avoids N+1 — AD-2: owner scoped)
  const dealIds = rows.map((ci) => ci.deal_id)
  const { data: dealsData, error: dealsError } = await supabase
    .from('deals')
    .select('id, title')
    .eq('owner_id', user.id)
    .in('id', dealIds)

  if (dealsError) {
    console.warn('[ARIA/check-ins/pending] deals batch fetch error:', dealsError.message)
  }

  const dealTitleMap = new Map<string, string>()
  for (const deal of dealsData ?? []) {
    dealTitleMap.set(deal.id, deal.title ?? 'Giao dịch')
  }

  const cards = []

  for (const ci of rows) {
    const dealTitle = dealTitleMap.get(ci.deal_id) ?? 'Giao dịch'

    // Use cached prompt_template or generate + persist
    let prompt: string
    const cached = typeof ci.prompt_template === 'string' ? ci.prompt_template : null
    if (cached) {
      prompt = cached
    } else {
      prompt = await generateCheckInPrompt(dealTitle, ci.trigger_type, today)
      // Persist generated prompt for caching (AD-5)
      const { error: cacheWriteError } = await supabase
        .from('check_ins')
        .update({ prompt_template: prompt })
        .eq('owner_id', user.id)
        .eq('id', ci.id)
      if (cacheWriteError) {
        console.warn('[ARIA/check-ins/pending] cache write failed:', ci.id, cacheWriteError.message)
      }
    }

    cards.push({
      id: ci.id,
      deal_id: ci.deal_id,
      deal_title: dealTitle,
      trigger_type: ci.trigger_type,
      due_date: ci.due_date,
      prompt,
    })
  }

  return NextResponse.json({ checkIns: cards })
}
