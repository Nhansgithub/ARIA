export const ARIA_MODELS = {
  economical: 'claude-haiku-4-5-20251001',
  highJudgment: 'claude-sonnet-4-6',
} as const

export type AriaModel = (typeof ARIA_MODELS)[keyof typeof ARIA_MODELS]
