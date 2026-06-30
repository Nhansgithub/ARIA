import 'server-only'

// AD-11: lib/zalo/ is server-only
// Zalo OA messages are plain text; no markdown supported.
// Hard limit: 2000 chars per Zalo message. Truncate with a "see full" tail.

const ZALO_MAX_LENGTH = 2000
const TAIL = '\n\nXem đầy đủ trong app ARIA.'

export interface BriefingForZalo {
  owner_name: string
  date_label: string
  summary: string
  deals: Array<{ title: string; priority: string; next_action?: string }>
}

export function formatBriefingForZalo(b: BriefingForZalo): string {
  const lines: string[] = []
  lines.push(`📋 Briefing ARIA — ${b.date_label}`)
  lines.push(`Xin chào ${b.owner_name}!`)
  lines.push('')

  if (b.summary) lines.push(b.summary)

  if (b.deals.length > 0) {
    lines.push('')
    lines.push('Deals ưu tiên hôm nay:')
    for (const d of b.deals) {
      const priority = d.priority === 'high' ? '🔴' : d.priority === 'medium' ? '🟡' : '⚪'
      let line = `${priority} ${d.title}`
      if (d.next_action) line += `\n   → ${d.next_action}`
      lines.push(line)
    }
  }

  const body = lines.join('\n')
  if (body.length + TAIL.length <= ZALO_MAX_LENGTH) return body
  return body.slice(0, ZALO_MAX_LENGTH - TAIL.length) + TAIL
}
