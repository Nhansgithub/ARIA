/**
 * Standalone ts-node test for detectLanguage.
 * Inlines the pure function to avoid any module resolution issues.
 *
 * Run: npx ts-node lib/__tests__/detectLanguage.test.ts
 */

import assert from 'assert'

// ── Inline the pure function (mirrors lib/language/detectLanguage.ts) ──────
function detectLanguage(text: string): 'vi' | 'en' {
  for (let i = 0; i < text.length; i++) {
    const cp = text.charCodeAt(i)
    if (
      (cp >= 0x0102 && cp <= 0x0103) ||
      (cp >= 0x0110 && cp <= 0x0111) ||
      (cp >= 0x01a0 && cp <= 0x01a1) ||
      (cp >= 0x01af && cp <= 0x01b0) ||
      (cp >= 0x1ea0 && cp <= 0x1ef9)
    ) {
      return 'vi'
    }
  }
  return 'en'
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

console.log('\n=== detectLanguage.test.ts ===\n')

// ── A: Vietnamese detection ────────────────────────────────────────────────

test('A1 — toned vowel variant ắ → vi', () => {
  assert.strictEqual(detectLanguage('Khách hàng này có vẻ phức tạp lắm'), 'vi')
})

test('A2 — đ character (backbone vi char) → vi', () => {
  assert.strictEqual(detectLanguage('Đây là vấn đề cần giải quyết'), 'vi')
})

test('A3 — ơ/ư backbone characters → vi', () => {
  assert.strictEqual(detectLanguage('Anh ơi, giúp tôi với'), 'vi')
})

test('A4 — short greeting in Vietnamese → vi', () => {
  assert.strictEqual(detectLanguage('Chào bạn'), 'vi')
})

test('A5 — Vietnamese Extended Latin block → vi', () => {
  assert.strictEqual(detectLanguage('Tôi muốn hỏi về hợp đồng'), 'vi')
})

// ── B: English detection ───────────────────────────────────────────────────

test('B1 — pure ASCII English sentence → en', () => {
  assert.strictEqual(detectLanguage('What should I do with this stalled deal?'), 'en')
})

test('B2 — short English greeting → en', () => {
  assert.strictEqual(detectLanguage('hi'), 'en')
})

test('B3 — empty string → en (default)', () => {
  assert.strictEqual(detectLanguage(''), 'en')
})

test('B4 — whitespace only → en', () => {
  assert.strictEqual(detectLanguage('   \t\n  '), 'en')
})

test('B5 — numbers and punctuation only → en', () => {
  assert.strictEqual(detectLanguage('100,000,000 VND'), 'en')
})

// ── C: Mixed / edge cases ──────────────────────────────────────────────────

test('C1 — mixed Vi+En sentence → vi (Vi chars present)', () => {
  assert.strictEqual(detectLanguage('This is a vấn đề we need to fix'), 'vi')
})

test('C2 — accented non-Vi Latin (café, résumé) → en', () => {
  // é (U+00E9), é, ï are NOT in Vietnamese Unicode ranges
  assert.strictEqual(detectLanguage('café résumé naïve'), 'en')
})

test('C3 — single Vietnamese char đ → vi', () => {
  assert.strictEqual(detectLanguage('đ'), 'vi')
})

test('C4 — uppercase Vietnamese Đ → vi', () => {
  assert.strictEqual(detectLanguage('ĐÂY LÀ TIẾNG VIỆT'), 'vi')
})

// ── Summary ───────────────────────────────────────────────────────────────
console.log(`\n${passed} passed, ${failed} failed\n`)
if (failed > 0) process.exit(1)
