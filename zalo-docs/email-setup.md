# Email Notification Setup — ARIA

ARIA's email layer uses **[Resend](https://resend.com)** — a developer-focused
transactional email API. It is simpler and more reliable than raw SMTP for
cloud deployments. You need a Resend account and an API key.

If you specifically want SMTP (e.g. Gmail relay), skip to the
[SMTP alternative](#smtp-alternative) section at the bottom.

---

## Part 1 — Resend Setup (recommended — what the code uses)

### Step 1 — Create a Resend account

1. Go to [resend.com](https://resend.com) and click **Sign up**.
2. Verify your email address.

### Step 2 — Add and verify your sending domain

Resend requires you to own the domain you send from.

1. In the Resend dashboard, go to **Domains** → **Add Domain**.
2. Enter your domain (e.g. `aria.vn` or `yourdomain.com`).
3. Resend shows you 3–4 DNS records to add (SPF, DKIM, DMARC).
4. Add those records in your DNS provider (Cloudflare, Namecheap, etc.).
5. Click **Verify** — green checkmarks appear when DNS propagates (5–30 min).

> **Don't have a custom domain yet?** While waiting, Resend lets you use their
> shared `onboarding@resend.dev` address for testing. Set `EMAIL_FROM` to that
> address and skip DNS verification for now. You cannot send to arbitrary
> recipients in this mode — only the account email address.

### Step 3 — Create an API key

1. In Resend dashboard → **API Keys** → **Create API Key**.
2. Give it a name like `aria-production`.
3. Set permission: **Sending access** (not full access).
4. Copy the key — it starts with `re_`. You won't see it again.

### Step 4 — Add environment variables to Vercel

In your Vercel project → **Settings** → **Environment Variables**, add:

| Variable | Example value | Notes |
|----------|--------------|-------|
| `RESEND_API_KEY` | `re_abc123...` | The API key from Step 3 |
| `EMAIL_FROM` | `ARIA <no-reply@aria.vn>` | Must match verified domain |

Then redeploy (Vercel → **Deployments** → **Redeploy**).

### Step 5 — Test it

After deploying, call the email cron endpoint manually:

```bash
curl -X GET https://aria-consult.vercel.app/api/cron/send-emails \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

You should get:
```json
{ "sent": { "briefings": 0, "checkIns": 0 }, "failed": 0 }
```

A `0` result is correct if no pending briefings exist. To create a test
briefing, trigger the briefing cron first.

---

## Part 2 — SMTP Alternative

If you prefer to route through Gmail, AWS SES SMTP, SendGrid SMTP, or your own
mail server, you need to modify `lib/email/emailService.ts` to use `nodemailer`
instead of Resend's API. Here is a drop-in replacement:

### Step 1 — Install nodemailer

```bash
npm install nodemailer
npm install --save-dev @types/nodemailer
```

### Step 2 — Replace emailService.ts

Replace the contents of [lib/email/emailService.ts](../lib/email/emailService.ts):

```typescript
import 'server-only'
import nodemailer from 'nodemailer'

export interface EmailPayload {
  to: string
  subject: string
  text: string
}

export interface EmailResult {
  ok: boolean
  error?: string
}

function createTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  })
}

export async function sendEmail(payload: EmailPayload): Promise<EmailResult> {
  const from = process.env.EMAIL_FROM ?? 'ARIA <no-reply@yourdomain.com>'
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return { ok: false, error: 'SMTP not configured' }
  }
  try {
    const transport = createTransport()
    await transport.sendMail({ from, to: payload.to, subject: payload.subject, text: payload.text })
    return { ok: true }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
}
```

### Step 3 — Add SMTP environment variables to Vercel

#### Gmail (App Password method)

1. Sign in to your Google account → **Security** → **2-Step Verification** → enable it.
2. Go to **Security** → **App Passwords** (only visible when 2FA is on).
3. Create an App Password for "Mail / Other device". Copy the 16-char password.

| Variable | Value |
|----------|-------|
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PORT` | `587` |
| `SMTP_SECURE` | `false` |
| `SMTP_USER` | `your-gmail@gmail.com` |
| `SMTP_PASS` | the 16-char App Password |
| `EMAIL_FROM` | `ARIA <your-gmail@gmail.com>` |

> Gmail limits: 500 emails/day for personal accounts. For higher volume, use
> Google Workspace (2000/day) or switch to Resend.

#### SendGrid SMTP

| Variable | Value |
|----------|-------|
| `SMTP_HOST` | `smtp.sendgrid.net` |
| `SMTP_PORT` | `587` |
| `SMTP_SECURE` | `false` |
| `SMTP_USER` | `apikey` (literally the string "apikey") |
| `SMTP_PASS` | Your SendGrid API key |
| `EMAIL_FROM` | `ARIA <no-reply@yourdomain.com>` |

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `RESEND_API_KEY not configured` in logs | Env var missing in Vercel | Add it and redeploy |
| `Resend 403` | Sending domain not verified | Verify DNS records in Resend dashboard |
| `Resend 422` | `EMAIL_FROM` domain doesn't match verified domain | Update `EMAIL_FROM` to match |
| Emails land in spam | No SPF/DKIM on domain | Add Resend's DNS records for your domain |
| `0` sent, no errors | No pending briefings with `email_sent_at = null` | Normal — wait for cron or create a briefing |
