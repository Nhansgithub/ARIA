import 'server-only'

// AD-11: lib/zalo/ is server-only
// AD-6: never throws; returns { ok: false, error } on failure

const ZALO_SEND_URL = 'https://openapi.zalo.me/v2.0/oa/message'

export interface ZaloSendResult {
  ok: boolean
  message_id?: string
  error?: string
}

/**
 * Send a plain text message to a Zalo user via OA message API.
 * Requires a valid access token (refreshed by the cron job).
 */
export async function sendZaloMessage(opts: {
  accessToken: string
  userId: string
  text: string
}): Promise<ZaloSendResult> {
  try {
    const res = await fetch(ZALO_SEND_URL, {
      method: 'POST',
      signal: AbortSignal.timeout(10_000),
      headers: {
        'Content-Type': 'application/json',
        access_token: opts.accessToken,
      },
      body: JSON.stringify({
        recipient: { user_id: opts.userId },
        message: { text: opts.text },
      }),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      return { ok: false, error: `Zalo send ${res.status}: ${body.slice(0, 200)}` }
    }
    const data = (await res.json()) as {
      error?: number
      message?: string
      data?: { message_id?: string }
    }
    if (data.error && data.error !== 0) {
      return { ok: false, error: `Zalo API error ${data.error}: ${data.message ?? ''}` }
    }
    return { ok: true, message_id: data.data?.message_id }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
}
