import 'server-only'

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required server environment variable: ${name}`)
  return value
}

// Claude / Anthropic
export const getAnthropicApiKey = () => requireEnv('ANTHROPIC_API_KEY')

// Supabase — service-role key is for scheduler/system tasks only (AD-13, Story 0.6)
export const getSupabaseServiceRoleKey = () => requireEnv('SUPABASE_SERVICE_ROLE_KEY')

// Zalo OA
export const getZaloOaAppId = () => requireEnv('ZALO_OA_APP_ID')
export const getZaloOaAppSecret = () => requireEnv('ZALO_OA_APP_SECRET')

// SMTP / email delivery
export const getSmtpHost = () => requireEnv('SMTP_HOST')
export const getSmtpPort = () => requireEnv('SMTP_PORT')
export const getSmtpUser = () => requireEnv('SMTP_USER')
export const getSmtpPass = () => requireEnv('SMTP_PASS')

// Zalo token encryption — 64-hex-char AES-256 key (see lib/crypto.ts)
export const getZaloTokenEncryptionKey = () => requireEnv('ZALO_TOKEN_ENCRYPTION_KEY')
