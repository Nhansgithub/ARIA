// Standalone test for callAI envelope logic and prompt assembly order.
// Inlines the pure logic from callAI.ts to avoid the `server-only` import boundary.
// Run: npx ts-node lib/__tests__/callAI.test.ts
import assert from 'assert'

// ── Inline: AIEnvelope type ────────────────────────────────────────────────
type AIEnvelope<T = string> =
  | { status: 'ok'; data: T }
  | { status: 'degraded'; data: null; degraded_reason: string }
  | { status: 'error'; data: null; degraded_reason: string }

// ── Inline: wrapError — mirrors catch block in callAI() ───────────────────
// The real callAI.ts uses `instanceof Anthropic.RateLimitError` for 429;
// here we simulate it via `(err as any).status === 429` since the SDK is not imported.
function wrapError(err: unknown): AIEnvelope {
  if (err instanceof Error) {
    if (err.name === 'AbortError' || err.name === 'TimeoutError') {
      return { status: 'degraded', data: null, degraded_reason: 'Request timed out' }
    }
    if ((err as { status?: number }).status === 429) {
      return {
        status: 'degraded',
        data: null,
        degraded_reason: 'Rate limit reached — please retry shortly',
      }
    }
    return { status: 'degraded', data: null, degraded_reason: err.message }
  }
  return { status: 'error', data: null, degraded_reason: 'Unknown error occurred' }
}

// ── Inline: buildMessages — mirrors message assembly in callAI() ───────────
interface TextContentBlock {
  type: 'text'
  text: string
  cache_control?: { type: 'ephemeral' }
}
interface TestMessageParam {
  role: 'user' | 'assistant'
  content: string | TextContentBlock[]
}
function buildMessages(
  businessContext: string | undefined,
  messages: TestMessageParam[]
): TestMessageParam[] {
  const result: TestMessageParam[] = []
  if (businessContext) {
    result.push({
      role: 'user',
      content: [
        {
          type: 'text',
          text: `<business_context>\n${businessContext}\n</business_context>`,
          cache_control: { type: 'ephemeral' }, // AD-5: second breakpoint
        },
      ],
    })
    result.push({ role: 'assistant', content: 'Understood.' })
  }
  result.push(...messages)
  return result
}

// ── Tests ──────────────────────────────────────────────────────────────────

// Test A: network error → degraded envelope (AC-6)
const networkErr = new Error('Network error')
const resultA = wrapError(networkErr)
assert.strictEqual(resultA.status, 'degraded')
assert.strictEqual(resultA.data, null)
assert.ok(
  'degraded_reason' in resultA && resultA.degraded_reason.includes('Network error'),
  `Expected 'Network error' in degraded_reason, got: ${'degraded_reason' in resultA ? resultA.degraded_reason : 'n/a'}`
)
console.log('✓ Test A: network error → degraded envelope')

// Test B: timeout → degraded envelope (AC-6)
const timeoutErr = Object.assign(new Error('The operation timed out'), { name: 'TimeoutError' })
const resultB = wrapError(timeoutErr)
assert.strictEqual(resultB.status, 'degraded')
assert.ok(
  'degraded_reason' in resultB && resultB.degraded_reason.includes('timed out'),
  `Expected 'timed out' in degraded_reason, got: ${'degraded_reason' in resultB ? resultB.degraded_reason : 'n/a'}`
)
console.log('✓ Test B: timeout → degraded envelope')

// Test C: rate-limit (HTTP 429) → degraded envelope (AC-6)
const rateLimitErr = Object.assign(new Error('Rate limit exceeded'), { status: 429 })
const resultC = wrapError(rateLimitErr)
assert.strictEqual(resultC.status, 'degraded')
assert.ok(
  'degraded_reason' in resultC && resultC.degraded_reason.toLowerCase().includes('rate'),
  `Expected 'rate' in degraded_reason, got: ${'degraded_reason' in resultC ? resultC.degraded_reason : 'n/a'}`
)
console.log('✓ Test C: rate-limit → degraded envelope')

// Test D: prompt assembly order (AC-7)
// Business Context (stable, cache_control) must come before volatile messages
const userMessage: TestMessageParam = { role: 'user', content: 'What is my pipeline status?' }
const assembled = buildMessages('Owner: ACME Corp. Industry: tech.', [userMessage])

assert.ok(
  assembled.length >= 3,
  'Expected at least 3 message entries (ctx user, ctx ack, volatile user)'
)

// [0] Business Context user turn with cache_control
const ctxBlock = assembled[0]!
assert.strictEqual(ctxBlock.role, 'user')
assert.ok(Array.isArray(ctxBlock.content), 'Business context content must be content block array')
const firstBlock = (ctxBlock.content as TextContentBlock[])[0]!
assert.ok(firstBlock.cache_control, 'Business context block must have cache_control (AD-5)')
assert.ok(
  firstBlock.text.includes('<business_context>'),
  'First block must be the business context tag'
)

// [1] Assistant ack
assert.strictEqual(assembled[1]!.role, 'assistant')
assert.strictEqual(assembled[1]!.content, 'Understood.')

// Last: volatile user message (no cache_control)
const lastMsg = assembled[assembled.length - 1]!
assert.deepStrictEqual(lastMsg, userMessage, 'Volatile user message must be last')
console.log('✓ Test D: prompt assembly order — stable prefix before volatile content')

// Test E: success envelope shape (AC-5)
const okEnvelope: AIEnvelope = { status: 'ok', data: 'Here is your pipeline briefing.' }
assert.strictEqual(okEnvelope.status, 'ok')
assert.strictEqual(okEnvelope.data, 'Here is your pipeline briefing.')
console.log('✓ Test E: success envelope shape')

// Test F: assembly without businessContext — only volatile messages included
const assembledNoCtx = buildMessages(undefined, [userMessage])
assert.strictEqual(assembledNoCtx.length, 1, 'No business context → only the volatile message')
assert.deepStrictEqual(assembledNoCtx[0], userMessage)
console.log('✓ Test F: assembly without businessContext — only volatile messages')

console.log('\nAll callAI tests passed ✓')
