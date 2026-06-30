import 'server-only'

// AD-11: lib/zalo/ is server-only
// Check-in messages use numbered reply format so users can respond with a number.
// Zalo OA does not support quick-reply buttons via OA message API — numbered text is the fallback.

const ZALO_MAX_LENGTH = 2000
const TAIL = '\n\nXem đầy đủ trong app ARIA.'

export interface CheckInForZalo {
  deal_title: string
  prompt: string
  options?: string[]
}

export function formatCheckInForZalo(c: CheckInForZalo): string {
  const lines: string[] = []
  lines.push(`💬 ARIA nhắc nhở — ${c.deal_title}`)
  lines.push('')
  lines.push(c.prompt)

  if (c.options && c.options.length > 0) {
    lines.push('')
    lines.push('Trả lời bằng số:')
    c.options.forEach((opt, i) => lines.push(`${i + 1}. ${opt}`))
  }

  const body = lines.join('\n')
  if (body.length + TAIL.length <= ZALO_MAX_LENGTH) return body
  return body.slice(0, ZALO_MAX_LENGTH - TAIL.length) + TAIL
}
