// lib/__tests__/contextManager113.test.ts
// ts-node inline pattern — NEVER import from project lib/ files

export {} // ES module scope — prevents TSC redeclaration errors (Story 1.11 fix)

// --- Inline trimMessages logic (copy from lib/ai/contextManager.ts) ---
interface ChatTurn {
  role: 'user' | 'assistant'
  content: string
}

interface TrimResult {
  trimmed: ChatTurn[]
  wasTrimmed: boolean
}

const MAX_MESSAGES = 20
const KEEP_MESSAGES = 10

function trimMessages(messages: ChatTurn[]): TrimResult {
  if (messages.length <= MAX_MESSAGES) {
    return { trimmed: messages.slice(), wasTrimmed: false }
  }
  return { trimmed: messages.slice(-KEEP_MESSAGES), wasTrimmed: true }
}

// --- RenderItem union type (inline copy from ChatPanel.tsx) ---
type RenderItem =
  { kind: 'message'; msg: ChatTurn } | { kind: 'divider'; id: string; label: string }

// --- Test harness ---
let passed = 0,
  failed = 0
function t(label: string, fn: () => void) {
  try {
    fn()
    console.log(`  ✓ ${label}`)
    passed++
  } catch (e) {
    console.error(`  ✗ ${label}:`, e instanceof Error ? e.message : e)
    failed++
  }
}
function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg)
}

console.log('=== contextManager113.test.ts ===\n')

// T1 — 5 messages at or below maxTurns: returns unchanged, wasTrimmed false
t('T1 — 5 messages returns all 5 untrimmed (wasTrimmed: false)', () => {
  const msgs: ChatTurn[] = Array.from({ length: 5 }, (_, i) => ({
    role: i % 2 === 0 ? 'user' : 'assistant',
    content: `msg ${i}`,
  }))
  const result = trimMessages(msgs)
  assert(result.wasTrimmed === false, 'wasTrimmed should be false')
  assert(result.trimmed.length === 5, `expected 5, got ${result.trimmed.length}`)
  assert(result.trimmed !== msgs, 'should return a copy, not the same reference')
})

// T2 — 20 messages (at boundary): returns all 20 untrimmed, wasTrimmed false
t('T2 — 20 messages returns all 20 untrimmed (wasTrimmed: false)', () => {
  const msgs: ChatTurn[] = Array.from({ length: 20 }, (_, i) => ({
    role: i % 2 === 0 ? 'user' : 'assistant',
    content: `msg ${i}`,
  }))
  const result = trimMessages(msgs)
  assert(result.wasTrimmed === false, 'wasTrimmed should be false')
  assert(result.trimmed.length === 20, `expected 20, got ${result.trimmed.length}`)
})

// T3 — 21 messages (over boundary): returns last 10, wasTrimmed true
t('T3 — 21 messages returns last 10 (wasTrimmed: true)', () => {
  const msgs: ChatTurn[] = Array.from({ length: 21 }, (_, i) => ({
    role: i % 2 === 0 ? 'user' : 'assistant',
    content: `msg ${i}`,
  }))
  const result = trimMessages(msgs)
  assert(result.wasTrimmed === true, 'wasTrimmed should be true')
  assert(result.trimmed.length === 10, `expected 10, got ${result.trimmed.length}`)
})

// T4 — 30 messages: returns last 10 and wasTrimmed true
t('T4 — 30 messages returns last 10 (wasTrimmed: true)', () => {
  const msgs: ChatTurn[] = Array.from({ length: 30 }, (_, i) => ({
    role: i % 2 === 0 ? 'user' : 'assistant',
    content: `msg ${i}`,
  }))
  const result = trimMessages(msgs)
  assert(result.wasTrimmed === true, 'wasTrimmed should be true')
  assert(result.trimmed.length === 10, `expected 10, got ${result.trimmed.length}`)
})

// T5 — trimmed result ends with the last message from the original array
t('T5 — trimmed result ends with the last message from original array', () => {
  const msgs: ChatTurn[] = Array.from({ length: 25 }, (_, i) => ({
    role: i % 2 === 0 ? 'user' : 'assistant',
    content: `msg ${i}`,
  }))
  const result = trimMessages(msgs)
  const lastOriginal = msgs[msgs.length - 1]
  const lastTrimmed = result.trimmed[result.trimmed.length - 1]
  assert(lastTrimmed === lastOriginal, 'last element of trimmed should be last element of original')
})

// T6 — 0 messages: returns empty array and wasTrimmed false
t('T6 — 0 messages returns empty array (wasTrimmed: false)', () => {
  const result = trimMessages([])
  assert(result.wasTrimmed === false, 'wasTrimmed should be false')
  assert(result.trimmed.length === 0, `expected 0, got ${result.trimmed.length}`)
})

// T7 — RenderItem union: 'message' and 'divider' are distinct discriminator values
t("T7 — RenderItem union: 'message' and 'divider' are distinct discriminators", () => {
  const msg: ChatTurn = { role: 'user', content: 'hello' }
  const messageItem: RenderItem = { kind: 'message', msg }
  const dividerItem: RenderItem = { kind: 'divider', id: '1', label: 'New topic started — 09:00' }

  assert(messageItem.kind === 'message', "message item kind should be 'message'")
  assert(dividerItem.kind === 'divider', "divider item kind should be 'divider'")
  assert(
    (messageItem.kind as string) !== (dividerItem.kind as string),
    'discriminator values should differ'
  )

  // Type-narrowing check
  if (messageItem.kind === 'message') {
    assert(messageItem.msg.content === 'hello', 'should access msg.content after narrowing')
  }
  if (dividerItem.kind === 'divider') {
    assert(typeof dividerItem.label === 'string', 'should access label after narrowing')
    assert(typeof dividerItem.id === 'string', 'should access id after narrowing')
  }
})

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
