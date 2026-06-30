import 'server-only'

// AD-11: lib/email/ is server-only

export interface BriefingFlagItem {
  severity: 'high' | 'medium'
  type: string
}

export interface BriefingEmailInput {
  date: string // YYYY-MM-DD
  content_md: string | null
  flags: { items?: BriefingFlagItem[] } | null
}

export interface BriefingEmailOutput {
  subject: string
  text: string
}

const UNSUBSCRIBE_VI =
  'Để huỷ nhận email, đăng nhập ARIA > Cài đặt > Kênh thông báo.'
const UNSUBSCRIBE_EN =
  'To unsubscribe, sign in to ARIA > Settings > Notification Channels.'

function stripMarkdown(md: string): string {
  return md
    .replace(/#{1,6}\s*/g, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/^\s*[-*]\s+/gm, '• ')
    .trim()
}

function formatDateVi(isoDate: string): string {
  const [year, month, day] = isoDate.split('-')
  return `${day}/${month}/${year}`
}

export function formatBriefingEmail(
  briefing: BriefingEmailInput,
  lang: 'vi' | 'en' = 'vi',
): BriefingEmailOutput {
  const hasHighUrgency = (briefing.flags?.items ?? []).some((f) => f.severity === 'high')

  let subject: string
  if (lang === 'vi') {
    const dateLabel = formatDateVi(briefing.date)
    subject = hasHighUrgency
      ? `[Cần xử lý] ARIA Tóm tắt — ${dateLabel}`
      : `ARIA Tóm tắt — ${dateLabel}`
  } else {
    subject = hasHighUrgency
      ? `[Action needed] ARIA Briefing — ${briefing.date}`
      : `ARIA Briefing — ${briefing.date}`
  }

  const bodyContent = briefing.content_md
    ? stripMarkdown(briefing.content_md).slice(0, 2000)
    : lang === 'vi'
      ? 'Không có nội dung briefing hôm nay.'
      : 'No briefing content available today.'

  const footer = lang === 'vi' ? UNSUBSCRIBE_VI : UNSUBSCRIBE_EN
  const text = `${bodyContent}\n\n---\n${footer}`

  return { subject, text }
}
