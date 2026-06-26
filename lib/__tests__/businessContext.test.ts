/**
 * Standalone ts-node test for businessContext utility logic.
 * Inlines the pure trimToTokenBudget logic to avoid server-only boundary.
 *
 * Run: npx ts-node lib/__tests__/businessContext.test.ts
 */

import assert from 'assert'

// ── Inline pure logic (mirrors lib/businessContext/getBusinessContext.ts) ──
const MAX_BUSINESS_CONTEXT_CHARS = 8_000

function trimToTokenBudget(content: string): string {
  return content.slice(0, MAX_BUSINESS_CONTEXT_CHARS)
}

// ── Test harness ───────────────────────────────────────────────────────────
let passed = 0
let failed = 0

function test(name: string, fn: () => void): void {
  try {
    fn()
    console.log(`  ✓ ${name}`)
    passed++
  } catch (err) {
    console.error(`  ✗ ${name}`)
    console.error(`    ${err instanceof Error ? err.message : err}`)
    failed++
  }
}

console.log('\n=== businessContext.test.ts ===\n')

// ── A: trim boundary ───────────────────────────────────────────────────────

test('A1 — empty string → empty string (no trim)', () => {
  assert.strictEqual(trimToTokenBudget(''), '')
})

test('A2 — content exactly at limit → returned unchanged', () => {
  const content = 'x'.repeat(MAX_BUSINESS_CONTEXT_CHARS)
  const result = trimToTokenBudget(content)
  assert.strictEqual(result.length, MAX_BUSINESS_CONTEXT_CHARS)
  assert.strictEqual(result, content)
})

test('A3 — content one char over limit → trimmed to exactly MAX_CHARS', () => {
  const result = trimToTokenBudget('x'.repeat(MAX_BUSINESS_CONTEXT_CHARS + 1))
  assert.strictEqual(result.length, MAX_BUSINESS_CONTEXT_CHARS)
})

test('A4 — large content → trimmed to exactly MAX_CHARS', () => {
  const result = trimToTokenBudget('x'.repeat(20_000))
  assert.strictEqual(result.length, MAX_BUSINESS_CONTEXT_CHARS)
})

test('A5 — trim preserves content order (first MAX_CHARS chars)', () => {
  const content = 'ABCDE'.repeat(2_000) // 10,000 chars
  const result = trimToTokenBudget(content)
  assert.strictEqual(result, content.slice(0, MAX_BUSINESS_CONTEXT_CHARS))
})

// ── B: constant value ──────────────────────────────────────────────────────

test('B1 — MAX_BUSINESS_CONTEXT_CHARS is 8000', () => {
  assert.strictEqual(MAX_BUSINESS_CONTEXT_CHARS, 8_000)
})

// ── Summary ───────────────────────────────────────────────────────────────
console.log(`\n${passed} passed, ${failed} failed\n`)
if (failed > 0) process.exit(1)
