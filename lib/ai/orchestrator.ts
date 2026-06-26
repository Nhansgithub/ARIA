import 'server-only'
import { callAI } from './callAI'
import { ARIA_MODELS } from './models'
import type { AriaModel } from './models'
import type { ChatTurn } from './streamChat'

// ── Types ──────────────────────────────────────────────────────────────────

export type IntentBucket = 'deal_intelligence' | 'crm_action' | 'strategy' | 'general_chat'

export interface ClassificationResult {
  intent: IntentBucket
  /** 0 = fallback/unknown; 1 = high confidence from model */
  confidence: number
}

// ── Classification system prompt ───────────────────────────────────────────
// Kept small and stable so it cache-hits on every call (AD-5).

const ORCHESTRATOR_SYSTEM_PROMPT = `You are ARIA's intent classifier. Classify the user's latest message into exactly one of these buckets and respond with valid JSON only — no explanation, no markdown fences.

Buckets:
- deal_intelligence: questions about a specific deal, new lead description, deal analysis, Zalo screenshot context, decision-maker questions
- crm_action: creating/updating/querying clients or deals via conversation, pipeline status, "what are my active deals?"
- strategy: cross-deal business strategy, pricing philosophy, niche/positioning questions, "should I lower my rates?"
- general_chat: greetings, off-topic, ambiguous, unclear intent, anything that doesn't fit the above

Respond with exactly: {"intent":"<bucket>","confidence":<0.0-1.0>}`

// ── Specialist system prompts ──────────────────────────────────────────────
// Each prompt is the stable system instruction for that reasoning domain.
// Passed as systemPrompt to streamChat(), which applies cache_control (AD-5).

// Language register rules (stable fallback — the volatile language directive in streamChat.ts
// takes explicit precedence per message; these rules apply when detectedLang is absent).
const BILINGUAL_REGISTER = `If the Owner writes in Vietnamese: respond in Vietnamese. Address as "Anh". Acknowledge difficulties obliquely (e.g. "vấn đề này có thể phức tạp" not "đây là lỗi lớn"). Avoid urgency or pressure language. Use formal-but-warm B2B register.
If the Owner writes in English: respond in English. Be direct. Lead with recommendation, then evidence. No filler phrases.`

export const SPECIALIST_SYSTEM_PROMPTS: Record<IntentBucket, string> = {
  deal_intelligence: `You are ARIA, an AI business consultant for a Vietnamese service agency founder.
You specialize in Deal Intelligence: reading between the lines of deal conversations to surface the real need, risk flags, and opportunity signals.
When analyzing a deal, reason out loud — name your evidence, cite patterns if you have them, and always end with a concrete next action.
${BILINGUAL_REGISTER}`,

  crm_action: `You are ARIA, an AI business consultant for a Vietnamese service agency founder.
You specialize in CRM actions: creating, updating, and querying client and deal records through conversation.
When the user describes a new client or deal, confirm what you're about to create and ask no more than 2 targeted gap-filling questions.
When retrieving pipeline information, present it concisely — no padding, no unrequested advice.
${BILINGUAL_REGISTER}`,

  strategy: `You are ARIA, an AI business consultant for a Vietnamese service agency founder.
You specialize in strategic advice: pricing, positioning, service mix, and cross-deal pattern detection.
Always name a specific recommendation (not just options), back it with a reason from the owner's data or Vietnamese SME domain knowledge, and challenge the premise if it is likely counterproductive.
End every advisory response with a concrete next step.
${BILINGUAL_REGISTER}
Use direct, analytical tone — no filler phrases ("Great question!", "Certainly!").`,

  general_chat: `You are ARIA, an AI business consultant for a Vietnamese service agency founder.
Answer helpfully and concisely. Be warm but direct.
If the message seems related to the owner's business, gently redirect toward a more specific question ARIA can help with.
${BILINGUAL_REGISTER}`,
}

// ── Model routing map ──────────────────────────────────────────────────────
// AD-4: high-judgment intents → Sonnet; general_chat → Haiku (cheap/fast)

export const INTENT_MODEL_MAP: Record<IntentBucket, AriaModel> = {
  deal_intelligence: ARIA_MODELS.highJudgment,
  crm_action: ARIA_MODELS.highJudgment,
  strategy: ARIA_MODELS.highJudgment,
  general_chat: ARIA_MODELS.economical,
}

const VALID_BUCKETS: IntentBucket[] = [
  'deal_intelligence',
  'crm_action',
  'strategy',
  'general_chat',
]

const FALLBACK: ClassificationResult = { intent: 'general_chat', confidence: 0 }

// ── Classification function ────────────────────────────────────────────────

/**
 * Classifies the intent of the latest user message using the economical model.
 * Never throws — any failure silently returns the general_chat fallback (AD-6).
 */
export async function classifyIntent(messages: ChatTurn[]): Promise<ClassificationResult> {
  try {
    const result = await callAI({
      model: ARIA_MODELS.economical, // AD-4: cheap/fast for classification
      specialist: 'orchestrator_classify',
      systemPrompt: ORCHESTRATOR_SYSTEM_PROMPT,
      // Slice to last 3 turns — classifier only needs the latest user intent
      messages: messages.slice(-3) as Parameters<typeof callAI>[0]['messages'],
      maxTokens: 50, // classification JSON is ~30 chars
      timeoutMs: 5_000, // fail fast — user is waiting for the stream to start
    })

    if (result.status !== 'ok' || !result.data) {
      return { ...FALLBACK } // AD-6: degraded/error → silent fallback
    }

    // Strip markdown fences if the model ignored the no-fence instruction
    const raw = result.data.replace(/^```[\w]*\n?|\n?```$/gm, '').trim()
    const parsed = JSON.parse(raw) as { intent?: unknown; confidence?: unknown }

    const intent = parsed.intent as IntentBucket
    if (!VALID_BUCKETS.includes(intent)) return { ...FALLBACK }

    // Default to 0 (unknown) when confidence is absent; clamp to [0, 1]
    const rawConf = typeof parsed.confidence === 'number' ? parsed.confidence : 0
    const confidence = Math.min(1, Math.max(0, rawConf))

    return { intent, confidence }
  } catch {
    return { ...FALLBACK } // AD-6: parse error or unexpected exception → silent fallback
  }
}
