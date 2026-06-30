# Zalo OA Setup Guide — ARIA

This guide walks you through registering a Zalo Official Account, getting your API credentials, and connecting it to ARIA so the app can send Briefings and check-in reminders directly to users via Zalo.

---

## Overview

ARIA uses Zalo Official Account (OA) as its primary proactive notification channel.  
When Zalo is connected and configured, ARIA will:

- Send your daily Briefing via Zalo at **:05 UTC** (12:05 PM ICT)
- Send deal check-in reminders via Zalo when due
- Fall back to email if Zalo delivery fails
- Refresh Zalo access tokens automatically every 55 minutes

---

## Part 1 — Register a Zalo Official Account

### Step 1: Create a Zalo account

If you don't have a Zalo account yet:
1. Download the Zalo app (iOS or Android)
2. Register with your Vietnamese phone number

### Step 2: Go to Zalo OA portal

1. Open your browser and navigate to: **https://oa.zalo.me**
2. Sign in with your Zalo account
3. Click **"Tạo Official Account"** (Create Official Account)

### Step 3: Choose account type

For ARIA (a personal productivity tool), select **"Doanh nghiệp"** (Business) or **"Cá nhân"** (Personal) — either works.

> **Note:** Personal OA accounts have a lower message quota but are easier to register. Business accounts require business registration documents.

### Step 4: Fill in OA information

| Field | What to enter |
|---|---|
| Tên OA | `ARIA` (or your preferred name) |
| Mô tả | `AI Sales Assistant — ARIA CRM` |
| Danh mục | Technology / Software |
| Logo | Upload a small logo (120×120 px recommended) |

### Step 5: Submit for review

Zalo reviews new OAs within 1–3 business days. You will receive an email confirmation.

---

## Part 2 — Create a Zalo Application

After your OA is approved:

### Step 6: Go to Zalo for Developers

1. Navigate to: **https://developers.zalo.me**
2. Sign in with the same Zalo account

### Step 7: Create an application

1. Click **"Create App"**
2. Name it `ARIA Integration`
3. Select **"Official Account"** as the app type
4. Link your OA to this app in the configuration

### Step 8: Get your credentials

In your app settings:

| Credential | Where to find it |
|---|---|
| `ZALO_APP_ID` | App dashboard → App ID |
| `ZALO_SECRET_KEY` | App dashboard → Secret Key (click "Show") |

> **Security:** Never commit these to git. Add them only to your `.env.local` and Vercel environment variables.

---

## Part 3 — Add Credentials to ARIA

### Step 9: Add to local development

In your project root, edit (or create) `.env.local`:

```
ZALO_APP_ID=your_app_id_here
ZALO_SECRET_KEY=your_secret_key_here
NEXT_PUBLIC_ZALO_OA_NAME=ARIA
```

Restart the dev server after adding env vars:

```bash
npm run dev
```

### Step 10: Add to Vercel (production)

1. Go to your Vercel project → **Settings → Environment Variables**
2. Add:
   - `ZALO_APP_ID` — value from Step 8
   - `ZALO_SECRET_KEY` — value from Step 8
   - `NEXT_PUBLIC_ZALO_OA_NAME` — set to your OA display name (e.g., `ARIA`)
3. Click **Save** and then **Redeploy** your project

---

## Part 4 — Connect in the ARIA App

### Step 11: Follow your OA on Zalo

Before connecting in ARIA, the user must follow the OA:
1. Open Zalo app on your phone
2. Search for your OA name (e.g., "ARIA")
3. Tap **"Quan tâm"** (Follow)

> Without following, Zalo OA cannot send you messages.

### Step 12: Connect in ARIA Settings

1. Open ARIA → go to **Settings → Kênh Thông Báo**
2. In the **Zalo OA** row, click **"Kết nối Zalo OA"**
3. In the wizard:
   - **Step 1:** Enter your Zalo User ID  
     (Open Zalo app → Your profile → The number below your name)
   - **Step 2:** Check the box confirming you've followed the OA
4. Click **"Kết nối"**

If successful, the status changes to **"Đã kết nối"** (Connected).

---

## Part 5 — Configure pg_cron (if self-hosting Supabase)

If you're using Supabase Cloud, run these in the Supabase SQL editor:

```sql
-- Set your deployment URL and cron secret
ALTER DATABASE postgres SET app.base_url = 'https://your-app.vercel.app';
ALTER DATABASE postgres SET app.cron_secret = 'your-cron-secret-here';
```

Then run the migration files in order:

```bash
supabase db push
```

This applies all migrations including:
- `20260701310000_pg_cron_zalo_refresh.sql` — token refresh at :05 each hour
- `20260701410000_pg_cron_zalo_send.sql` — Zalo send at :05 UTC each hour
- `20260701500000_pg_cron_email_send.sql` — email fallback at :15 UTC each hour

---

## Part 6 — Set Up Webhook (Optional — for user replies)

Zalo OA can send inbound messages to ARIA when users reply.

### Step 13: Configure webhook URL in Zalo OA

1. Go to Zalo OA Studio → Settings → Webhook
2. Enter: `https://your-app.vercel.app/api/webhooks/zalo`
3. Click **"Verify"** — Zalo will send a GET request with a `challenge` parameter; ARIA will respond automatically

> **Note:** v1 of ARIA logs inbound webhook events but does not process replies automatically. This is planned for a future sprint.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Status stays "Chưa kết nối" after connect | Zalo credentials missing on server | Check `ZALO_APP_ID` and `ZALO_SECRET_KEY` are set in Vercel |
| Connect returns 502 error | Wrong App ID or Secret Key | Double-check credentials in Zalo Developers console |
| Status shows "Hết hạn" | Refresh token expired (> 3 months) | Reconnect via Settings → Kết nối lại |
| No Zalo messages arriving | User hasn't followed the OA | Open Zalo → search OA → tap Quan tâm |
| Messages arrive but no reply handling | v1 webhook stub — by design | Future sprint will add reply processing |

---

## Environment Variables Reference

| Variable | Required | Description |
|---|---|---|
| `ZALO_APP_ID` | Yes (for Zalo) | Your Zalo application ID — server-only |
| `ZALO_SECRET_KEY` | Yes (for Zalo) | Your Zalo application secret key — server-only |
| `NEXT_PUBLIC_ZALO_OA_NAME` | No | OA display name shown in setup wizard (default: "ARIA") |

> `ZALO_APP_ID` and `ZALO_SECRET_KEY` are **never** exposed to the browser. The app works fully without them — Zalo features are gracefully gated and only unlock when both variables are present.
