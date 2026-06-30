import 'server-only'

// AD-11: lib/email/ is server-only

export interface CheckInEmailInput {
  deal_title: string
  prompt_template: string | null
}

export interface CheckInEmailOutput {
  subject: string
  text: string
}

const UNSUBSCRIBE_VI = 'Để huỷ nhận email, đăng nhập ARIA > Cài đặt > Kênh thông báo.'
const UNSUBSCRIBE_EN = 'To unsubscribe, sign in to ARIA > Settings > Notification Channels.'

const REPLY_INSTRUCTIONS_VI = `Trả lời 1, 2, hoặc 3 trong app ARIA:
1. Có
2. Không
3. Để sau`

const REPLY_INSTRUCTIONS_EN = `Reply 1, 2, or 3 in the ARIA app:
1. Yes
2. No
3. Later`

export function formatCheckInEmail(
  checkIn: CheckInEmailInput,
  lang: 'vi' | 'en' = 'vi'
): CheckInEmailOutput {
  const subject =
    lang === 'vi'
      ? `ARIA Nhắc nhở — ${checkIn.deal_title}`
      : `ARIA Check-in — ${checkIn.deal_title}`

  const greeting = lang === 'vi' ? 'Xin chào,' : 'Hello,'
  const dealLine =
    lang === 'vi'
      ? `ARIA có một nhắc nhở check-in cho deal: ${checkIn.deal_title}`
      : `ARIA has a check-in reminder for deal: ${checkIn.deal_title}`

  const prompt =
    checkIn.prompt_template ||
    (lang === 'vi'
      ? 'Bạn có cập nhật nào cho deal này không?'
      : 'Do you have any updates for this deal?')

  const replyInstructions = lang === 'vi' ? REPLY_INSTRUCTIONS_VI : REPLY_INSTRUCTIONS_EN
  const footer = lang === 'vi' ? UNSUBSCRIBE_VI : UNSUBSCRIBE_EN

  const text = `${greeting}\n\n${dealLine}\n\n${prompt}\n\n${replyInstructions}\n\n---\n${footer}`

  return { subject, text }
}
