import 'server-only'

// AD-11: lib/zalo/ is server-only — Zalo credentials never reach the client bundle
// AD-6: never throws; returns { ok: false, error } on failure

const ZALO_TOKEN_URL = 'https://oauth.zaloapp.com/v4/oa/access_token'

export interface ZaloTokenResult {
  ok: boolean
  access_token?: string
  refresh_token?: string
  expires_in?: number
  error?: string
}

/** Whether Zalo OA is configured server-side (env vars present). */
export function isZaloConfigured(): boolean {
  return !!(process.env.ZALO_APP_ID && process.env.ZALO_SECRET_KEY)
}

/**
 * Exchange credentials for initial access + refresh tokens.
 * Called once during the owner's Zalo OA setup flow.
 * Requires ZALO_APP_ID and ZALO_SECRET_KEY env vars.
 */
export async function exchangeCredentialsForTokens(): Promise<ZaloTokenResult> {
  const appId = process.env.ZALO_APP_ID
  const secretKey = process.env.ZALO_SECRET_KEY
  if (!appId || !secretKey) return { ok: false, error: 'Zalo OA not configured on server' }

  try {
    const res = await fetch(ZALO_TOKEN_URL, {
      method: 'POST',
      signal: AbortSignal.timeout(10_000),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'secret_key': secretKey },
      body: new URLSearchParams({ app_id: appId, grant_type: 'authorization_code' }),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      return { ok: false, error: `Zalo token exchange ${res.status}: ${body.slice(0, 200)}` }
    }
    const data = await res.json() as { access_token?: string; refresh_token?: string; expires_in?: number; error?: number }
    if (data.error || !data.access_token) {
      return { ok: false, error: `Zalo error: ${JSON.stringify(data)}` }
    }
    return { ok: true, access_token: data.access_token, refresh_token: data.refresh_token, expires_in: data.expires_in }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
}

/**
 * Refresh an existing access token using the stored refresh token.
 * Zalo refresh tokens are valid for ~3 months.
 */
export async function refreshAccessToken(refreshToken: string): Promise<ZaloTokenResult> {
  const appId = process.env.ZALO_APP_ID
  const secretKey = process.env.ZALO_SECRET_KEY
  if (!appId || !secretKey) return { ok: false, error: 'Zalo OA not configured on server' }

  try {
    const res = await fetch(ZALO_TOKEN_URL, {
      method: 'POST',
      signal: AbortSignal.timeout(10_000),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'secret_key': secretKey },
      body: new URLSearchParams({ app_id: appId, grant_type: 'refresh_token', refresh_token: refreshToken }),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      return { ok: false, error: `Zalo refresh ${res.status}: ${body.slice(0, 200)}` }
    }
    const data = await res.json() as { access_token?: string; refresh_token?: string; expires_in?: number; error?: number }
    if (data.error || !data.access_token) {
      return { ok: false, error: `Zalo refresh error: ${JSON.stringify(data)}` }
    }
    return { ok: true, access_token: data.access_token, refresh_token: data.refresh_token ?? refreshToken, expires_in: data.expires_in }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
}
