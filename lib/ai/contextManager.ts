import 'server-only'

import type { ChatTurn } from './streamChat'

// AD-12: Context budget — trim older turns when the conversation grows long.
// Threshold: trim when messages > MAX_MESSAGES; keep last KEEP_MESSAGES turns.
// This is a turn-count proxy for the ~40K token budget (OQ-9 tuning dial).
// At ~2K tokens/turn average (user + assistant), 20 turns ≈ 40K tokens.
// Exact token counting requires the Anthropic tokenizer — future enhancement.

const MAX_MESSAGES = 20
const KEEP_MESSAGES = 10

export interface TrimResult {
  trimmed: ChatTurn[]
  wasTrimmed: boolean
}

export function trimMessages(messages: ChatTurn[]): TrimResult {
  if (messages.length <= MAX_MESSAGES) {
    return { trimmed: messages.slice(), wasTrimmed: false }
  }
  return { trimmed: messages.slice(-KEEP_MESSAGES), wasTrimmed: true }
}
