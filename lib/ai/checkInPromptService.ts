import 'server-only'
import { callAI } from '@/lib/ai/callAI'
import { ARIA_MODELS } from '@/lib/ai/models'

type TriggerType = 'stale_7d' | 'pre_action_due' | 'cadence_followup'

// AD-6 static fallbacks — returned when AI is unavailable
const STATIC_FALLBACKS: Record<TriggerType, (title: string) => string> = {
  stale_7d: (t) =>
    `Giao dịch ${t} chưa có hoạt động 7 ngày. Bạn có kế hoạch gì tiếp theo?`,
  pre_action_due: (t) =>
    `Hành động cho ${t} đến hạn ngày mai. Bạn đã chuẩn bị chưa?`,
  cadence_followup: (t) =>
    `Đã đến lúc theo dõi ${t}. Bạn muốn ARIA hỗ trợ gì?`,
}

// AD-5: system prompt is the stable prefix — cache_control applied by callAI automatically
const SYSTEM_PROMPT = `Bạn là trợ lý kinh doanh AI viết câu hỏi check-in ngắn gọn bằng tiếng Việt.
Trả về CHỈ một câu hỏi, không có giải thích, không có tiêu đề, không có dấu nháy.
Tối đa 80 ký tự.`

export async function generateCheckInPrompt(
  dealTitle: string,
  triggerType: TriggerType,
  today: string,
): Promise<string> {
  const triggerContext: Record<TriggerType, string> = {
    stale_7d: 'Giao dịch đã không có hoạt động trong 7 ngày',
    pre_action_due: 'Hành động tiếp theo đến hạn vào ngày mai',
    cadence_followup: 'Đến lúc theo dõi theo lịch định kỳ',
  }

  const userMessage = `Deal: "${dealTitle}"
Tình huống: ${triggerContext[triggerType]}
Ngày hôm nay: ${today}
Viết một câu hỏi check-in ngắn cho chủ doanh nghiệp về deal này.`

  const result = await callAI({
    model: ARIA_MODELS.economical,
    specialist: 'check-in-prompt',
    systemPrompt: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
    maxTokens: 120,
    timeoutMs: 8_000,
  })

  if (result.status !== 'ok' || !result.data) {
    // AD-6: graceful fallback — never throw
    return STATIC_FALLBACKS[triggerType](dealTitle).slice(0, 80)
  }

  const trimmed = result.data.trim().replace(/^["']|["']$/g, '').slice(0, 80)
  return trimmed || STATIC_FALLBACKS[triggerType](dealTitle).slice(0, 80)
}
