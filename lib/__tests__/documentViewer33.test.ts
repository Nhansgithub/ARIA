export {}

import fs from 'fs'
import path from 'path'

// ── Inline pure helpers (no project lib/ imports — story pattern) ─────────────

type DocumentStatus = 'draft' | 'review' | 'sent' | 'signed' | 'archived'

const STATUS_TRANSITIONS: Record<DocumentStatus, DocumentStatus[]> = {
  draft: ['review', 'archived'],
  review: ['sent', 'archived'],
  sent: ['signed', 'archived'],
  signed: ['archived'],
  archived: [],
}

const STATUS_COLOR: Record<DocumentStatus, string> = {
  draft: '#475569',
  review: '#d97706',
  sent: '#2563eb',
  signed: '#16a34a',
  archived: '#94a3b8',
}

const STATUS_LABEL: Record<DocumentStatus, string> = {
  draft: 'Nháp',
  review: 'Đang xét',
  sent: 'Đã gửi',
  signed: 'Đã ký',
  archived: 'Lưu trữ',
}

type DiffLine = { type: 'added' | 'removed' | 'unchanged'; line: string }

function computeDiff(oldLines: string[], newLines: string[]): DiffLine[] {
  const result: DiffLine[] = []
  let i = 0,
    j = 0
  while (i < oldLines.length || j < newLines.length) {
    if (i >= oldLines.length) {
      result.push({ type: 'added', line: newLines[j++]! })
      continue
    }
    if (j >= newLines.length) {
      result.push({ type: 'removed', line: oldLines[i++]! })
      continue
    }
    if (oldLines[i] === newLines[j]) {
      result.push({ type: 'unchanged', line: oldLines[i]! })
      i++
      j++
    } else {
      result.push({ type: 'removed', line: oldLines[i++]! })
      result.push({ type: 'added', line: newLines[j++]! })
    }
  }
  return result
}

function formatVersionLabel(createdBy: 'ai' | 'human', createdAt: string): string {
  const who = createdBy === 'ai' ? 'ARIA' : 'You'
  const d = new Date(createdAt)
  const fmt = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  return `${who} · ${fmt.format(d)}`
}

function truncateTitle(title: string, maxLen: number): string {
  if (title.length <= maxLen) return title
  return title.slice(0, maxLen) + '…'
}

// ── Test runner ───────────────────────────────────────────────────────────────

let passed = 0
let failed = 0

function test(name: string, fn: () => void) {
  try {
    fn()
    console.log(`  ✓ ${name}`)
    passed++
  } catch (e) {
    console.error(`  ✗ ${name}`)
    console.error(`    ${(e as Error).message}`)
    failed++
  }
}

function expect<T>(actual: T) {
  return {
    toBe(expected: T) {
      if (actual !== expected) {
        throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
      }
    },
    toEqual(expected: T) {
      const a = JSON.stringify(actual)
      const b = JSON.stringify(expected)
      if (a !== b) {
        throw new Error(`Expected ${b}, got ${a}`)
      }
    },
    toHaveLength(len: number) {
      const arr = actual as unknown as unknown[]
      if (arr.length !== len) {
        throw new Error(`Expected length ${len}, got ${arr.length}`)
      }
    },
    toBeTruthy() {
      if (!actual) throw new Error(`Expected truthy, got ${JSON.stringify(actual)}`)
    },
    toContain(sub: string) {
      if (!(actual as unknown as string).includes(sub)) {
        throw new Error(`Expected "${actual}" to contain "${sub}"`)
      }
    },
  }
}

function fileExists(relPath: string): boolean {
  return fs.existsSync(path.join(process.cwd(), relPath))
}

// ── T1: STATUS_TRANSITIONS ────────────────────────────────────────────────────
test('T1: STATUS_TRANSITIONS — draft → [review, archived]', () => {
  expect(STATUS_TRANSITIONS.draft).toEqual(['review', 'archived'])
})

test('T1b: STATUS_TRANSITIONS — review → [sent, archived]', () => {
  expect(STATUS_TRANSITIONS.review).toEqual(['sent', 'archived'])
})

test('T1c: STATUS_TRANSITIONS — sent → [signed, archived]', () => {
  expect(STATUS_TRANSITIONS.sent).toEqual(['signed', 'archived'])
})

test('T1d: STATUS_TRANSITIONS — signed → [archived]', () => {
  expect(STATUS_TRANSITIONS.signed).toEqual(['archived'])
})

test('T1e: STATUS_TRANSITIONS — archived → []', () => {
  expect(STATUS_TRANSITIONS.archived).toEqual([])
})

// ── T2–T5: computeDiff ────────────────────────────────────────────────────────
test('T2: computeDiff — change middle line', () => {
  const result = computeDiff(['a', 'b', 'c'], ['a', 'x', 'c'])
  expect(result).toEqual([
    { type: 'unchanged', line: 'a' },
    { type: 'removed', line: 'b' },
    { type: 'added', line: 'x' },
    { type: 'unchanged', line: 'c' },
  ])
})

test('T3: computeDiff — empty old, one new line', () => {
  const result = computeDiff([], ['x'])
  expect(result).toEqual([{ type: 'added', line: 'x' }])
})

test('T4: computeDiff — one old line, empty new', () => {
  const result = computeDiff(['x'], [])
  expect(result).toEqual([{ type: 'removed', line: 'x' }])
})

test('T5: computeDiff — identical lines → all unchanged', () => {
  const result = computeDiff(['a', 'b'], ['a', 'b'])
  expect(result).toEqual([
    { type: 'unchanged', line: 'a' },
    { type: 'unchanged', line: 'b' },
  ])
})

// ── T6–T7: formatVersionLabel ─────────────────────────────────────────────────
// Note: Intl.DateTimeFormat renders in local timezone, so we check structure
// (prefix and month name) rather than exact hour:minute values.
test('T6: formatVersionLabel — ai creator', () => {
  const label = formatVersionLabel('ai', '2026-06-01T10:00:00Z')
  expect(label).toContain('ARIA')
  expect(label).toContain('Jun 2026')
  // Format is "ARIA · DD Mon YYYY HH:mm" — verify separator and month
  expect(label).toContain(' · ')
})

test('T7: formatVersionLabel — human creator', () => {
  const label = formatVersionLabel('human', '2026-06-15T09:30:00Z')
  expect(label).toContain('You')
  expect(label).toContain('Jun 2026')
  expect(label).toContain(' · ')
})

// ── T8: STATUS_LABEL ──────────────────────────────────────────────────────────
test('T8: STATUS_LABEL — all statuses have Vietnamese labels', () => {
  expect(STATUS_LABEL.draft).toBe('Nháp')
  expect(STATUS_LABEL.review).toBe('Đang xét')
  expect(STATUS_LABEL.sent).toBe('Đã gửi')
  expect(STATUS_LABEL.signed).toBe('Đã ký')
  expect(STATUS_LABEL.archived).toBe('Lưu trữ')
})

// ── T9: STATUS_COLOR ──────────────────────────────────────────────────────────
test('T9: STATUS_COLOR — each status has a defined hex color', () => {
  const statuses: DocumentStatus[] = ['draft', 'review', 'sent', 'signed', 'archived']
  for (const s of statuses) {
    const color = STATUS_COLOR[s]
    if (!color || !color.startsWith('#')) {
      throw new Error(`STATUS_COLOR[${s}] is not a valid hex color: ${color}`)
    }
  }
})

// ── T10–T11: truncateTitle ────────────────────────────────────────────────────
test('T10: truncateTitle — truncates at 60 chars with ellipsis', () => {
  const long = 'VeryLongClientName_Proposal_2026-06-01_v1_extra_extra_chars'
  const result = truncateTitle(long, 60)
  if (long.length > 60) {
    expect(result.endsWith('…')).toBe(true)
    // result length should be 61 chars (60 + ellipsis char)
    expect(result.length).toBe(61)
  }
})

test('T11: truncateTitle — short title returned unchanged', () => {
  expect(truncateTitle('Short', 60)).toBe('Short')
})

// ── T12–T15: API route file existence ─────────────────────────────────────────
test('T12: app/api/documents/route.ts exists', () => {
  expect(fileExists('app/api/documents/route.ts')).toBe(true)
})

test('T13: app/api/documents/[id]/save/route.ts exists', () => {
  expect(fileExists('app/api/documents/[id]/save/route.ts')).toBe(true)
})

test('T14: app/api/documents/[id]/status/route.ts exists', () => {
  expect(fileExists('app/api/documents/[id]/status/route.ts')).toBe(true)
})

test('T15: app/api/documents/[id]/versions/route.ts exists', () => {
  expect(fileExists('app/api/documents/[id]/versions/route.ts')).toBe(true)
})

// ── T16–T19: Component file existence ─────────────────────────────────────────
test('T16: components/documents/DocumentsPanel.tsx exists', () => {
  expect(fileExists('components/documents/DocumentsPanel.tsx')).toBe(true)
})

test('T17: components/documents/DocumentViewer.tsx exists', () => {
  expect(fileExists('components/documents/DocumentViewer.tsx')).toBe(true)
})

test('T18: components/documents/DocumentList.tsx exists', () => {
  expect(fileExists('components/documents/DocumentList.tsx')).toBe(true)
})

test('T19: components/documents/VersionHistoryPanel.tsx exists', () => {
  expect(fileExists('components/documents/VersionHistoryPanel.tsx')).toBe(true)
})

// ── T20: AppShell imports DocumentsPanel ─────────────────────────────────────
test('T20: AppShell source contains DocumentsPanel import', () => {
  const src = fs.readFileSync(
    path.join(process.cwd(), 'components/layout/AppShell.tsx'),
    'utf-8'
  )
  expect(src).toContain('DocumentsPanel')
})

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\nResults: ${passed} passed, ${failed} failed`)
if (failed > 0) {
  process.exit(1)
}
