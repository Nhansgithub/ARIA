# ARIA — Technical Feasibility Research (Architecture inputs)

> Produced: 2026-06-25 | Researcher: ARIA Technical Feasibility Agent (headless)
> Stack: Next.js 14 · Vercel · Supabase (Postgres / Storage / Auth) · Anthropic Claude
> Use case: Solo Vietnamese service-agency founder — daily AI briefing + proactive check-ins via Zalo and email.

---

## 1. Zalo Official Account (OA) Messaging API — Can ARIA Proactively Message the Founder?

### 1a. Two distinct channels: OA Chat vs. ZNS

Zalo provides two API-accessible channels for a business OA to reach users, and they have fundamentally different rules [1][2]:

| | OA Chat Message | ZNS (Zalo Notification Service) |
|---|---|---|
| Target | Followers of the OA only | Any Zalo user by phone number (no follow required) |
| Content | Conversational; more flexible text | Pre-approved Zalo templates only — no free-form text |
| Proactive (app-initiated) | Constrained (see window below) | Yes, but transactional context required |
| Cost | Lower / included in OA quota | ~200–300 VND per successful send |
| Requires template approval | No | Yes — submitted to Zalo for review |

### 1b. The Customer-Care / Messaging Window

The "48-hour window" most commonly cited in developer forums refers to ZNS **message delivery retry validity** — if the recipient's device is offline, Zalo retries for up to 48 hours before marking the message undelivered [6]. This is a *delivery* window, not a *permission* window like WhatsApp's 24-hour session.

For **OA Chat proactive sends** (app-initiated messages to a follower), there is no publicly documented WhatsApp-style customer-care session window in Zalo's official API docs [3]. However, OA Chat proactive sends have their own constraints:
- The user **must follow the OA** — the founder would need to follow their own OA (trivial but required).
- OA quality grading (Good / Medium / Low) determines weekly message quotas and feature access. Poor grades (triggered by user "bad reports") can throttle or suspend OA messaging [1][4].
- Broadcast messages are permitted to all followers, but promotional content is restricted by grade.

### 1c. ZNS: Not suitable for free-text daily briefings

ZNS templates must be submitted to Zalo for approval and must contain at least one transaction-specific variable (order ID, payment amount, etc.) [2][7]. A daily AI-generated briefing paragraph does **not** qualify — it would be rejected at template approval stage. ZNS is designed for transactional notifications, not open-ended text.

### 1d. Auth Model and Rate Limits

- **Access token** lifetime: **1 hour**. A refresh token is issued alongside it; the refresh token is single-use and valid for **3 months** [5].
- Token endpoint: `POST https://oauth.zaloapp.com/v4/oa/access_token` with `app_id` + `secret_key` in headers [5].
- A **cron-based token refresh** is strongly recommended before expiry. Many production failures stem from forgetting auto-refresh on low-traffic services [5].
- OA API rate limits are undisclosed numerically by Zalo but documented as "block on spam-like patterns." ZNS quota starts at 5,000/day for new OAs and adjusts weekly based on quality score [4].

### 1e. Practical Assessment for ARIA

The ARIA scenario — "founder follows own OA, ARIA pushes a daily free-text briefing" — works as follows:

- **OA Chat send to a follower CAN send free-text** programmatically. The founder follows the OA they own; ARIA calls `POST /v2.0/oa/message` with a `user_id` and a text body [3][5]. No template approval required for OA Chat.
- **Reliability risk**: OA messaging depends on the OA's quality grade remaining Good or Medium. A single OA owned by the founder with zero external users has essentially zero risk of bad reports. In practice this is stable for a private single-user setup.
- **The real reliability risk is token expiry**: the 1-hour access token must be actively refreshed. ARIA's scheduler must include a token-refresh job ahead of each morning send.
- **If OA Chat is throttled or fails**: email (via Resend / SendGrid via Vercel) is the guaranteed fallback. Email has no platform dependency and must be coded as the authoritative delivery path.

**Verdict / recommendation for ARIA**: OA Chat to the founder (who follows the OA) can send free-text proactively — no template required. This is feasible but fragile for two reasons: (a) 1-hour token expiry requires a scheduled refresh job, and (b) the OA must stay in Good/Medium grade. For a truly single-user private OA the grade risk is negligible. ZNS is NOT suitable for free-text briefings. **Email must remain the guaranteed primary or co-equal delivery channel.** Implement Zalo OA Chat as a "nice-to-have" overlay, not the authoritative notification path.

---

## 2. Vietnam Personal Data Protection — Obligations for ARIA

### 2a. Current Legal Framework (as of 2026)

Vietnam's data protection framework has two layers now active simultaneously:
1. **Decree 13/2023/ND-CP** (PDPD) — effective July 1, 2023; foundational framework.
2. **Personal Data Protection Law (PDPL) 91/2025/QH15** — passed June 26, 2025; effective **January 1, 2026** [8][9].
3. **Decree 356/2025/ND-CP** — implementing decree for the PDPL, promulgated December 31, 2025; **replaces Decree 13** [10].

The PDPL is GDPR-inspired in structure: data controller/processor distinction, data subject rights, mandatory breach notification, and cross-border transfer controls.

### 2b. Cross-Border Transfer to Anthropic (US)

Sending client personal data (names, business details, conversation content) to Claude API constitutes a **cross-border transfer** under Decree 356 [10][11]. The rules:

- A **Cross-Border Data Transfer Impact Assessment (CDTIA)** dossier must be prepared and submitted to the Ministry of Public Security (Department of Cybersecurity) **within 60 days of processing commencement** [8][10].
- The dossier must include: data categories transferred, purpose, retention, security measures, recipient identity (Anthropic, US), and a binding written agreement with the recipient on data protection obligations.
- The CDTIA must be updated within **10 days** of material changes (new data categories, new sub-processors) and reviewed every **6 months** [10].

**Micro-enterprise / solo-operator relief**: Decree 356 exempts micro-enterprises and household businesses from appointing a Data Protection Officer and from conducting a standard domestic Data Processing Impact Assessment (DPIA). Small enterprises and startups also receive a **5-year grace period** (from Jan 1 2026) on some obligations including DPIA [10]. However, **cross-border transfer rules explicitly still apply** — the CDTIA exemption list covers logistics, payments, travel/visas and emergency scenarios; an AI SaaS processing client data for consulting does not fall under any listed exemption [11].

### 2c. Practical Minimum for ARIA (actionable, not legal advice)

| Obligation | What to do |
|---|---|
| Consent notice | Display a clear privacy notice to the founder's clients before their data is entered. State that data is processed by Anthropic (US) via API. |
| Data subject rights | Provide a mechanism (email is sufficient) for clients to request access, correction, or deletion of their data. |
| Retention policy | Define and enforce a retention period (e.g., 12 months). Implement auto-delete or archive after that period. |
| CDTIA dossier | Prepare the standard-form CDTIA, naming Anthropic as the foreign processor. Submit to the MPS Cybersecurity Department within 60 days of go-live. Retain a copy. |
| Binding agreement | Anthropic's Data Processing Agreement (available at anthropic.com/legal/dpa) serves as the "binding contract" required by Decree 356 for the foreign recipient. Sign and retain it. |
| Minimum-data principle | Only send to Claude the data strictly needed for the analysis. Avoid sending full client PII when anonymized summaries suffice. |
| Breach notification | PDPL requires notification to the MPS within 72 hours of discovering a breach affecting Vietnamese data subjects. Have an incident response contact ready. |

**Verdict / recommendation for ARIA**: PDPL compliance is mandatory from day one of go-live (Jan 1 2026 framework is now in force). The practical lift for a solo operator is: (1) draft a CDTIA and submit to MPS — a one-time ~2–4 hour task using the standard form in Decree 356 Annex; (2) execute Anthropic's DPA; (3) publish a simple privacy notice to clients; (4) build a 12-month retention/delete workflow in Supabase. Penalties for cross-border transfer violations can reach **5% of annual revenue** [9][10] — non-compliance is a real business risk, not bureaucratic noise.

---

## 3. Scheduler for Periodic Jobs (Daily Briefing, Check-ins)

### 3a. Vercel Cron — Constraints

Vercel Cron fires an HTTP GET to a Next.js route on a schedule defined in `vercel.json` [12][13]:

| Plan | Max jobs | Min cadence | Timezone |
|---|---|---|---|
| Hobby | 5 | Once per **day** | UTC only |
| Pro | 40 | Every minute | UTC only |

Critical limitations for ARIA:
- **Hobby plan: once-per-day minimum** — cannot schedule a 7:00 AM Vietnam time send plus separate mid-day check-ins on the free tier. Would need Pro ($20/month).
- **UTC only** — Vietnam is UTC+7; a "07:00 ICT" cron must be written as `0 0 * * *` (UTC midnight). Manageable but error-prone and requires discipline.
- **Schedule changes require a redeploy** — even a time shift from 07:00 to 07:30 needs a PR + deploy cycle.
- **Best-effort delivery** — Vercel documents that "occasional transient network errors can prevent a request from reaching your function" [12]. Duplicate invocations are also possible; jobs must be idempotent.

### 3b. Supabase pg_cron + Edge Functions — Capabilities

Supabase ships pg_cron enabled on all plans (free through enterprise) as of 2025 [14][15]:
- **Sub-minute scheduling** (every 1–59 seconds), full cron syntax, plus natural-language schedule entry in the dashboard.
- **Native Postgres timezone support** — schedule in `Asia/Ho_Chi_Minh` directly in SQL: `SELECT cron.schedule('daily-briefing', '0 7 * * *', $$...$$, 'Asia/Ho_Chi_Minh')`.
- **Schedule changes without redeploy** — modify via SQL or Supabase Dashboard; no code deploy needed.
- **Job types**: SQL snippets, Postgres functions, Edge Function HTTP calls, or arbitrary webhooks.
- **Free-tier**: unlimited pg_cron jobs on the free Supabase plan.

Limitations:
- **No automatic retry** on failure — a missed tick is silently dropped.
- **Max 8 concurrent jobs**, each max 10 minutes runtime.
- **Paused project risk** — Supabase pauses free-tier projects after 1 week of inactivity. On a paid plan this doesn't apply, but it is worth noting for a dev/staging environment.
- Failure alerting requires custom logic (e.g., write to a `cron_log` table and alert if no entry appears).

### 3c. Recommended Architecture for ARIA

Use **Supabase pg_cron as the primary scheduler**, calling Supabase Edge Functions, which in turn call the Next.js API (or execute logic directly):

```
pg_cron (Asia/Ho_Chi_Minh, 07:00)
  → Edge Function: generate_daily_briefing
      → Anthropic Claude API
      → Zalo OA Chat send (+ token refresh if needed)
      → Email send (Resend/SendGrid) as guaranteed fallback
```

Add a secondary pg_cron job (e.g., every 5 minutes) to refresh the Zalo OA access token before expiry.

**Verdict / recommendation for ARIA**: Use **Supabase pg_cron + Edge Functions**. It is free on Supabase's free tier, handles ICT timezone natively, requires no redeployment to change schedules, and integrates directly with the existing Supabase stack. Vercel Cron is a viable supplement (e.g., as an external HTTP trigger for redundancy on Pro plan) but adds cost and complexity for no meaningful gain when Supabase is already in the stack. Build idempotency into all job handlers (check if briefing for today's date already sent before re-sending).

---

## 4. Vision / Image Input — Cost and Feasibility for Claude

### 4a. Token Cost Model

Claude tokenizes images as **28×28-pixel patches** (visual tokens). The approximate formula is [16][17]:

```
image_tokens ≈ (width_px × height_px) / 750
```

More precisely: `⌈width/28⌉ × ⌈height/28⌉` visual tokens.

Model-dependent maximums:

| Model | Max image tokens | Max long edge | Input price / 1M tokens |
|---|---|---|---|
| Claude Sonnet 4.6 | 1,568 | 1,568 px | $3.00 |
| Claude Haiku 4.5 | 1,568 | 1,568 px | $1.00 |
| Claude Opus 4.7 / 4.8 | 4,784 | 2,576 px | $5.00 |

Images larger than the model's maximum long edge are **automatically downscaled** to fit before tokenization [16].

### 4b. Practical Cost Estimate for Screenshot Extraction

A typical 1280×720 desktop screenshot sent to Claude Sonnet 4.6:
- Token count: `(1280 × 720) / 750 ≈ 1,229 tokens` (within the 1,568 cap).
- Cost: `1,229 / 1,000,000 × $3.00 ≈ $0.0037` per screenshot (~0.4 US cents).
- At 10 screenshots/day: ~$0.037/day (~$1.10/month) just for image input tokens.
- Output tokens (analysis text) are additional at $15.00/1M for Sonnet 4.6.

Opus 4.7/4.8 high-resolution mode can consume **up to 3× more tokens** per image (up to 4,784) [17]. For screenshot analysis, Sonnet 4.6 or Haiku 4.5 is almost always sufficient and 2–5× cheaper.

### 4c. Format and Upload Limits

- Supported formats: **JPEG, PNG, GIF (first frame only), WebP** [16].
- Max request: **100 images per API call**, **32 MB total payload**.
- Single image max dimensions: **8,000 × 8,000 px** (or 2,000 × 2,000 px if >20 images in one request).
- **Recommended optimization**: compress screenshots to JPEG or WebP before sending; use the **Files API** to upload once and reuse a `file_id` across turns to avoid re-encoding base64 in every prompt [16].

**Verdict / recommendation for ARIA**: Vision input is cheap and well within budget for a solo-user tool. Use **Claude Sonnet 4.6** (not Opus) for screenshot analysis — it handles 1,568-px images natively and costs 5× less than Opus. Pre-compress screenshots to JPEG ≤ 1,568 px long edge before sending. If screenshots appear in multi-turn conversations, use the Files API to avoid ballooning request size with repeated base64 payloads. Budget ~$1–5/month for image tokens under normal usage.

---

## Sources

1. [Zalo ZNS Template — VietGuys](https://www.vietguys.biz/en/martech/knowledge/zalo-zns-template-an-optimal-solution-for-customer-care-strategies-on-zalo)
2. [Zalo Notification Services (ZNS) API — Infobip Docs](https://www.infobip.com/docs/zalo)
3. [Zalo OA OpenAPI — Zalo for Developers](https://developers.zalo.me/docs/api/official-account-api-230)
4. [Zalo ZNS Sending Quality and Message Quantity Levels — NXLink](https://help.nxlink.ai/en/docs/Zalo-ZNS-Sending-Quality-and-Message-Quantity-Levels-Change-Standards)
5. [Zalo OA Access Token Tutorial — Beehexa](https://www.beehexa.com/devdocs/devops/zalo-oa-tutorial-creating-access-token/)
6. [Zalo over API — Infobip Docs](https://www.infobip.com/docs/zalo/api)
7. [Zalo API Send Message — EZNS](https://ezns.vn/zalo-api-send-message/)
8. [Vietnam Cross-Border Data Transfer Regulation — ITIF (Jun 2025)](https://itif.org/publications/2025/06/09/vietnam-cross-border-data-transfer-regulation/)
9. [Legal Alert: Personal Data Protection Law July 2025 — EY Vietnam](https://www.ey.com/en_vn/technical/tax/tax-and-law-updates/legal-alert-july-2025-personal-data-protection-law)
10. [Decree 356/2025 vs Decree 13/2023 — Viet An Law](https://vietanlaw.com/decree-356-2025-vs-decree-13-2023-updates-on-personal-data-protection-in-vietnam/)
11. [Cross-Border Transfer of Personal Data — Siglaw Firm](https://en.siglaw.com.vn/cross-border-transfer-of-personal-data-under-vietnamese-law.html)
12. [Vercel Cron Jobs Usage & Pricing — Vercel Docs](https://vercel.com/docs/cron-jobs/usage-and-pricing)
13. [Vercel Cron Jobs — Vercel Docs](https://vercel.com/docs/cron-jobs)
14. [Scheduling Edge Functions — Supabase Docs](https://supabase.com/docs/guides/functions/schedule-functions)
15. [Supabase Cron — Supabase Docs](https://supabase.com/docs/guides/cron)
16. [Vision — Claude API Docs](https://platform.claude.com/docs/en/build-with-claude/vision)
17. [Images cost 3x more tokens in Claude Opus 4.7 — Claude Code Camp](https://www.claudecodecamp.com/p/images-cost-3x-more-tokens-in-claude-opus-4-7)
