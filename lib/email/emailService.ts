import 'server-only'

// AD-11: lib/email/ is server-only — env vars with secrets (RESEND_API_KEY)
// AD-6: never throws; returns { ok: false, error } on failure

export interface EmailPayload {
  to: string
  subject: string
  text: string
}

export interface EmailResult {
  ok: boolean
  error?: string
}

const RESEND_URL = 'https://api.resend.com/emails'

export async function sendEmail(payload: EmailPayload): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return { ok: false, error: 'RESEND_API_KEY not configured' }

  const from = process.env.EMAIL_FROM ?? 'ARIA <no-reply@aria.vn>'

  try {
    const res = await fetch(RESEND_URL, {
      method: 'POST',
      signal: AbortSignal.timeout(10_000),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [payload.to],
        subject: payload.subject,
        text: payload.text,
      }),
    })

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      return { ok: false, error: `Resend ${res.status}: ${body.slice(0, 200)}` }
    }

    return { ok: true }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
}
