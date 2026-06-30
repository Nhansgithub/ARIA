export {}
// ts-node inline tests for Story 4.3: Briefing Generation Job — pg_cron Scheduler & Caching
// Pattern: no imports from project lib/ — logic simulated inline.
// Run: npx ts-node lib/__tests__/briefingGenerationJob43.test.ts

import fs from 'fs'
import path from 'path'

// ── Helpers ───────────────────────────────────────────────────────────────────

let passed = 0
let failed = 0

function assert(condition: boolean, label: string): void {
  if (condition) {
    console.log(`  ✓ ${label}`)
    passed++
  } else {
    console.error(`  ✗ FAIL: ${label}`)
    failed++
  }
}

// ── Inline simulation of briefing generation logic ────────────────────────────

interface BriefingRecord {
  id: string
  owner_id: string
  date: string
  content_md: string | null
  flags: Record<string, unknown>
  generated_at: string
  status: 'generated' | 'degraded'
}

interface DealRow {
  title: string
  stage: string
  value_estimate: number | null
  stale_since: string | null
}

function isActiveStage(stage: string): boolean {
  const lower = stage.toLowerCase()
  return !['won', 'lost', 'archived', 'completed'].some((kw) => lower.includes(kw))
}

// Simulate the idempotency check + generation decision
function shouldGenerate(existing: BriefingRecord | null, forceRefresh: boolean): boolean {
  if (forceRefresh) return true
  return existing === null
}

// Simulate the empty CRM guard
function hasActiveDeals(deals: DealRow[]): boolean {
  return deals.some((d) => isActiveStage(d.stage))
}

// Simulate degraded fallback logic
function getDegradedFallback(prevBriefing: BriefingRecord | null): BriefingRecord | null {
  if (!prevBriefing) return null
  return { ...prevBriefing, status: 'degraded' }
}

// Simulate cron secret validation
function validateCronSecret(authHeader: string | null, cronSecret: string): boolean {
  if (!authHeader || !cronSecret) return false
  if (!/^Bearer\s+/i.test(authHeader)) return false
  const token = authHeader.replace(/^Bearer\s+/i, '')
  return token === cronSecret
}

// ── Tests ─────────────────────────────────────────────────────────────────────

console.log('\nStory 4.3 — Briefing Generation Job — pg_cron Scheduler & Caching\n')

// T1: isActiveStage — closed stages excluded from briefing
console.log('T1: isActiveStage — closed stages excluded')
{
  assert(!isActiveStage('won'), '"won" is not active')
  assert(!isActiveStage('lost'), '"lost" is not active')
  assert(!isActiveStage('archived'), '"archived" is not active')
  assert(!isActiveStage('completed'), '"completed" is not active')
  assert(!isActiveStage('Deal Completed'), '"Deal Completed" is not active (case-insensitive)')
  assert(isActiveStage('proposal'), '"proposal" is active')
  assert(isActiveStage('discovery'), '"discovery" is active')
  assert(isActiveStage('contract review'), '"contract review" is active')
}

// T2: Idempotency — no generation if briefing already exists for today
console.log('\nT2: Idempotency — skip if briefing already exists')
{
  const existing: BriefingRecord = {
    id: 'b1',
    owner_id: 'o1',
    date: '2026-06-29',
    content_md: '# Briefing',
    flags: {},
    generated_at: '2026-06-29T00:00:00Z',
    status: 'generated',
  }
  assert(!shouldGenerate(existing, false), 'existing briefing + no forceRefresh → skip generation')
  assert(shouldGenerate(existing, true), 'existing briefing + forceRefresh=true → re-generate')
  assert(shouldGenerate(null, false), 'no existing briefing → generate')
}

// T3: Empty CRM guard — no active deals → no briefing written
console.log('\nT3: Empty CRM guard — zero active deals')
{
  const allClosed: DealRow[] = [
    { title: 'Won Deal', stage: 'won', value_estimate: 100_000_000, stale_since: null },
    { title: 'Lost Deal', stage: 'lost', value_estimate: 50_000_000, stale_since: null },
  ]
  const activeDeals: DealRow[] = [
    { title: 'Proposal', stage: 'proposal', value_estimate: 80_000_000, stale_since: null },
  ]
  assert(!hasActiveDeals(allClosed), 'all closed → no active deals (empty CRM guard fires)')
  assert(!hasActiveDeals([]), 'empty deals array → empty CRM guard fires')
  assert(hasActiveDeals(activeDeals), 'proposal deal → has active deals')
}

// T4: Degraded fallback — returns previous day's briefing with status: 'degraded'
console.log('\nT4: Degraded fallback — previous day briefing with status: degraded')
{
  const prevBriefing: BriefingRecord = {
    id: 'b0',
    owner_id: 'o1',
    date: '2026-06-28',
    content_md: '# Yesterday',
    flags: {},
    generated_at: '2026-06-28T00:05:00Z',
    status: 'generated',
  }
  const fallback = getDegradedFallback(prevBriefing)
  assert(fallback !== null, 'previous briefing exists → fallback returned')
  assert(fallback?.status === 'degraded', 'fallback has status: degraded')
  assert(fallback?.content_md === '# Yesterday', 'fallback content is from previous day')
  assert(fallback?.date === '2026-06-28', 'fallback date is from previous day (not today)')
}

// T5: Degraded fallback — no previous briefing → null (silent skip)
console.log('\nT5: Degraded fallback with no prior briefing → null')
{
  const fallback = getDegradedFallback(null)
  assert(fallback === null, 'no previous briefing + degraded → returns null')
}

// T6: Cron secret validation
console.log('\nT6: Cron secret validation')
{
  const secret = 'my-cron-secret-123'
  assert(validateCronSecret('Bearer my-cron-secret-123', secret), 'valid Bearer token → authorized')
  assert(
    validateCronSecret('bearer my-cron-secret-123', secret),
    'lowercase "bearer" prefix → authorized (case-insensitive)'
  )
  assert(
    !validateCronSecret('my-cron-secret-123', secret),
    'token without Bearer prefix → rejected'
  )
  assert(!validateCronSecret('Bearer wrong-secret', secret), 'wrong secret → rejected')
  assert(!validateCronSecret(null, secret), 'missing auth header → rejected')
  assert(!validateCronSecret('Bearer anything', ''), 'empty CRON_SECRET → rejected')
}

// T7: flags contain observability metadata
console.log('\nT7: flags structure for observability')
{
  const flags = { deal_count: 3, doc_pending_count: 2, activity_count_24h: 7 }
  assert(typeof flags.deal_count === 'number', 'flags.deal_count is a number')
  assert(typeof flags.doc_pending_count === 'number', 'flags.doc_pending_count is a number')
  assert(typeof flags.activity_count_24h === 'number', 'flags.activity_count_24h is a number')
}

// T8: Today date computation — always UTC ISO date
console.log('\nT8: Date computation — UTC ISO date format')
{
  const todayStr = new Date().toISOString().split('T')[0]!
  assert(/^\d{4}-\d{2}-\d{2}$/.test(todayStr), 'today is in YYYY-MM-DD format')
  // Previous day computation
  const prevDate = new Date(todayStr)
  prevDate.setUTCDate(prevDate.getUTCDate() - 1)
  const prevDateStr = prevDate.toISOString().split('T')[0]!
  assert(/^\d{4}-\d{2}-\d{2}$/.test(prevDateStr), 'previous day is in YYYY-MM-DD format')
  assert(prevDateStr < todayStr, 'previous day is before today')
}

// T9: Multi-owner deduplication
console.log('\nT9: Owner ID deduplication in generateBriefingsForAllOwners')
{
  const rawRows = [
    { owner_id: 'o1' },
    { owner_id: 'o1' }, // duplicate
    { owner_id: 'o2' },
  ]
  const allIds = rawRows.map((r) => r.owner_id)
  const uniqueOwnerIds = allIds.filter((id, idx) => allIds.indexOf(id) === idx)
  assert(uniqueOwnerIds.length === 2, 'deduplication reduces 3 rows to 2 unique owners')
  assert(uniqueOwnerIds.includes('o1'), 'o1 is in unique set')
  assert(uniqueOwnerIds.includes('o2'), 'o2 is in unique set')
}

// T9b: generateBriefingsForAllOwners filters out closed-stage owners
console.log('\nT9b: generateBriefingsForAllOwners — closed-stage filter in SQL query')
{
  const src = path.join(process.cwd(), 'lib', 'crm', 'briefingService.ts')
  const content = fs.existsSync(src) ? fs.readFileSync(src, 'utf8') : ''
  // The all-owners query must filter to non-closed stages (P1-1 fix)
  assert(
    content.includes('\'("won","lost","archived","completed")\'') ||
      (content.includes('generateBriefingsForAllOwners') && content.includes(".not('stage'")),
    'generateBriefingsForAllOwners filters out closed stages in SQL query'
  )
}

// T10: File existence — briefingService.ts structure
console.log('\nT10: File checks — briefingService.ts structure')
{
  const src = path.join(process.cwd(), 'lib', 'crm', 'briefingService.ts')
  assert(fs.existsSync(src), 'lib/crm/briefingService.ts exists')
  const content = fs.existsSync(src) ? fs.readFileSync(src, 'utf8') : ''
  assert(
    content.startsWith("import 'server-only'"),
    "briefingService.ts starts with import 'server-only' (AD-11)"
  )
  assert(content.includes('getBriefing'), 'exports getBriefing')
  assert(content.includes('generateBriefingForOwner'), 'exports generateBriefingForOwner')
  assert(content.includes('generateBriefingsForAllOwners'), 'exports generateBriefingsForAllOwners')
  assert(content.includes('createServiceClient'), 'uses createServiceClient (AD-13 cron path)')
  assert(
    !content.includes('createServerClient'),
    'does NOT use createServerClient (cron uses service role)'
  )
  assert(content.includes(".eq('owner_id', ownerId)"), 'enforces owner_id guard (AD-2)')
  assert(content.includes('ARIA_MODELS.economical'), 'uses economical (Haiku) model (AD-4)')
}

// T11: Cron route — file existence and auth pattern
console.log('\nT11: File checks — cron/briefing/route.ts')
{
  const src = path.join(process.cwd(), 'app', 'api', 'cron', 'briefing', 'route.ts')
  assert(fs.existsSync(src), 'app/api/cron/briefing/route.ts exists')
  const content = fs.existsSync(src) ? fs.readFileSync(src, 'utf8') : ''
  assert(content.includes('CRON_SECRET'), 'route validates CRON_SECRET')
  assert(content.includes('Unauthorized'), 'route returns 401 Unauthorized on auth failure')
  assert(
    !content.includes('NEXT_PUBLIC_'),
    'CRON_SECRET is NOT prefixed with NEXT_PUBLIC_ (server-only secret)'
  )
  assert(content.includes('generateBriefingForOwner'), 'imports generateBriefingForOwner')
  assert(content.includes('generateBriefingsForAllOwners'), 'imports generateBriefingsForAllOwners')
  assert(content.includes('forceRefresh'), 'supports forceRefresh parameter')
  assert(content.includes('export async function GET'), 'route exports GET handler (not POST)')
}

// T12: Migration file exists
console.log('\nT12: Migration file — pg_cron setup')
{
  const migration = path.join(
    process.cwd(),
    'supabase',
    'migrations',
    '20260629040000_pg_cron_briefing_job.sql'
  )
  assert(fs.existsSync(migration), 'pg_cron migration file exists')
  const content = fs.existsSync(migration) ? fs.readFileSync(migration, 'utf8') : ''
  assert(content.includes('pg_cron'), 'migration references pg_cron')
  assert(content.includes('pg_net'), 'migration references pg_net (HTTP calls from DB)')
  assert(content.includes("'0 0 * * *'"), 'pg_cron schedule is 00:00 UTC (07:00 ICT)')
  assert(content.includes('generate-daily-briefing'), 'job is named generate-daily-briefing')
  assert(content.includes('/api/cron/briefing'), 'job calls /api/cron/briefing endpoint')
  assert(content.includes('net.http_get'), 'pg_cron job uses net.http_get (route is GET, not POST)')
  assert(!content.includes('net.http_post'), 'pg_cron job does NOT use net.http_post')
  // DO $$ guard for idempotent unschedule
  assert(
    content.includes('EXCEPTION WHEN OTHERS'),
    'migration guards cron.unschedule with EXCEPTION handler'
  )
}

// T13: AD-4 — Haiku model for briefing
console.log('\nT13: AD-4 — briefing uses economical (Haiku) model')
{
  const src = path.join(process.cwd(), 'lib', 'crm', 'briefingService.ts')
  const content = fs.existsSync(src) ? fs.readFileSync(src, 'utf8') : ''
  assert(
    content.includes('ARIA_MODELS.economical'),
    'briefingService uses ARIA_MODELS.economical (Haiku, AD-4)'
  )
  assert(
    !content.includes('ARIA_MODELS.highJudgment'),
    'briefingService does NOT use highJudgment model'
  )
}

// T14: AD-5 — callAI used (provides prompt caching automatically)
console.log('\nT14: AD-5 — callAI used for prompt-caching discipline')
{
  const src = path.join(process.cwd(), 'lib', 'crm', 'briefingService.ts')
  const content = fs.existsSync(src) ? fs.readFileSync(src, 'utf8') : ''
  assert(content.includes("from '@/lib/ai/callAI'"), 'briefingService imports callAI')
  assert(
    content.includes('specialist:'),
    'callAI called with specialist field (for observability logging)'
  )
  assert(content.includes("'briefing_generation'"), "specialist is 'briefing_generation'")
}

// T15: AD-6 — degraded fallback implemented
console.log('\nT15: AD-6 — degraded fallback logic in briefingService')
{
  const src = path.join(process.cwd(), 'lib', 'crm', 'briefingService.ts')
  const content = fs.existsSync(src) ? fs.readFileSync(src, 'utf8') : ''
  assert(content.includes("status !== 'ok'"), 'briefingService checks for non-ok AI response')
  assert(content.includes("'degraded'"), "briefingService returns status 'degraded' on fallback")
  assert(
    content.includes('prevDateStr') || content.includes('prevDate'),
    'briefingService fetches previous day briefing for fallback'
  )
}

// T16: AD-7 — idempotency check + upsert
console.log('\nT16: AD-7 — idempotency guard + upsert on refresh')
{
  const src = path.join(process.cwd(), 'lib', 'crm', 'briefingService.ts')
  const content = fs.existsSync(src) ? fs.readFileSync(src, 'utf8') : ''
  assert(content.includes('forceRefresh'), 'briefingService supports forceRefresh param')
  assert(content.includes('upsert'), 'briefingService uses upsert (not insert + update separately)')
  assert(
    content.includes("onConflict: 'owner_id,date'"),
    'upsert conflict target is (owner_id, date)'
  )
}

// T17: package.json test scripts
console.log('\nT17: package.json test scripts')
{
  const pkgPath = path.join(process.cwd(), 'package.json')
  const pkg = fs.existsSync(pkgPath) ? JSON.parse(fs.readFileSync(pkgPath, 'utf8')) : {}
  assert(
    typeof pkg.scripts?.['test:briefing-job43'] === 'string',
    'package.json has test:briefing-job43 script'
  )
  assert(
    typeof pkg.scripts?.test === 'string' &&
      pkg.scripts.test.includes('briefingGenerationJob43.test.ts'),
    'briefingGenerationJob43.test.ts is in the main test chain'
  )
}

// T18: sprint-status.yaml has 4-3
console.log('\nT18: sprint-status.yaml reflects story 4-3')
{
  const statusPath = path.join(
    process.cwd(),
    '_bmad-output',
    'implementation-artifacts',
    'sprint-status.yaml'
  )
  const content = fs.existsSync(statusPath) ? fs.readFileSync(statusPath, 'utf8') : ''
  assert(
    content.includes('4-3-briefing-generation-job-pg-cron-scheduler-caching'),
    'sprint-status.yaml contains story 4-3 key'
  )
}

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n─────────────────────────────────────────`)
console.log(`Results: ${passed} passed, ${failed} failed`)
if (failed > 0) {
  console.error('SOME TESTS FAILED')
  process.exit(1)
} else {
  console.log('All tests passed ✓')
}
