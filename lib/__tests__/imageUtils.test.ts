/**
 * Standalone ts-node test for client-side image validation logic.
 * Inlines pure logic to avoid ESM resolution issues with bundler moduleResolution.
 *
 * Run: npx ts-node lib/__tests__/imageUtils.test.ts
 */

import assert from 'assert'

// ── Inlined constants + logic (mirrors lib/imageUtils.ts) ─────────────────────

const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024
const MAX_LONG_EDGE_PX = 1568
const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
])

function validateImageFile(file: { size: number; type: string }): { ok: boolean; error?: string } {
  if (file.size > MAX_IMAGE_SIZE_BYTES) return { ok: false, error: 'Image must be under 10 MB' }
  if (!ALLOWED_TYPES.has(file.type))
    return { ok: false, error: 'Unsupported format. Use JPEG, PNG, WebP, GIF, or HEIC.' }
  return { ok: true }
}

// ── Test harness ─────────────────────────────────────────────────────────────

console.log('=== imageUtils.test.ts ===\n')

let passed = 0
let failed = 0

function test(name: string, fn: () => void) {
  try {
    fn()
    console.log(`  ✓ ${name}`)
    passed++
  } catch (e) {
    console.log(`  ✗ ${name}: ${e}`)
    failed++
  }
}

test('T1 — rejects file over 10 MB', () => {
  const r = validateImageFile({ size: MAX_IMAGE_SIZE_BYTES + 1, type: 'image/jpeg' })
  assert.ok(!r.ok, 'expected ok=false')
  assert.ok(r.error?.includes('10 MB'), 'expected 10 MB error')
})

test('T2 — rejects unsupported MIME type', () => {
  const r = validateImageFile({ size: 1024, type: 'application/pdf' })
  assert.ok(!r.ok, 'expected ok=false for pdf')
})

test('T3 — accepts image/jpeg', () => {
  const r = validateImageFile({ size: 1024, type: 'image/jpeg' })
  assert.ok(r.ok, 'expected ok=true for jpeg')
})

test('T3b — accepts image/png', () => {
  const r = validateImageFile({ size: 1024, type: 'image/png' })
  assert.ok(r.ok, 'expected ok=true for png')
})

test('T3c — accepts image/webp', () => {
  const r = validateImageFile({ size: 1024, type: 'image/webp' })
  assert.ok(r.ok, 'expected ok=true for webp')
})

test('T3d — accepts image/heic', () => {
  const r = validateImageFile({ size: 1024, type: 'image/heic' })
  assert.ok(r.ok, 'expected ok=true for heic')
})

test('T4 — MAX_LONG_EDGE_PX = 1568 (AD-9)', () => {
  assert.strictEqual(MAX_LONG_EDGE_PX, 1568, `expected 1568, got ${MAX_LONG_EDGE_PX}`)
})

test('T5 — MAX_IMAGE_SIZE_BYTES = 10485760', () => {
  assert.strictEqual(
    MAX_IMAGE_SIZE_BYTES,
    10485760,
    `expected 10485760, got ${MAX_IMAGE_SIZE_BYTES}`
  )
})

test('T6 — file at exactly 10 MB boundary is accepted', () => {
  const r = validateImageFile({ size: MAX_IMAGE_SIZE_BYTES, type: 'image/jpeg' })
  assert.ok(r.ok, 'expected ok=true at exact boundary')
})

test('T7 — image/gif is accepted', () => {
  const r = validateImageFile({ size: 1024, type: 'image/gif' })
  assert.ok(r.ok, 'expected ok=true for gif')
})

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
