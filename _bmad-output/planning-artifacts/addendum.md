---
title: ARIA PRD Addendum — Technical Depth for Architecture
status: draft
created: 2026-06-25
updated: 2026-06-25
companion-to: PRD.md (v2.0)
---

# ARIA — PRD Addendum

Technical-how and design depth that earned a place downstream (architecture / solution design) but does not belong in the requirements PRD. Carried forward and refined from `ARIA_PRD.md` v1.1 plus planning decisions. **This is input for `bmad-architecture`, not a requirements contract.**

## A. Proposed Stack (from v1.1 — to be ratified by architecture)

- **Frontend + Backend:** Next.js 14 (App Router), single repo, deployed on Vercel.
- **Database + File storage:** Supabase (Postgres + Storage buckets). **Row Level Security enabled from day one**, every row carries `owner_id` (PRD §9.4 — load-bearing seam).
- **AI:** Anthropic Claude — economical model (Haiku-class) for routine ops; high-judgment model (Sonnet-class) for advice, document drafting, **Deal Intelligence, and all vision input** (vision must use a vision-capable model).
- **Scheduler:** **Supabase Edge Functions + `pg_cron`** preferred over Vercel Cron (survives redeploys, pausable per-deal/Owner via a flag column — needed for FR-17 Check-ins and FR-25 Briefing, and for future per-user schedules). *(Architecture decision to confirm.)*
- **Auth:** Supabase Auth (email/password; Google OAuth later).
- **PDF generation:** html-pdf-node or Puppeteer on Vercel serverless (no AI call).
- **Delivery:** Zalo OA chat messaging API (primary); email (fallback). See §F.

## B. Data Models (refined from v1.1 §5)

Refinements vs v1.1: add `owner_id uuid` (FK → owner/auth user) to **every** table; RLS policy per table filtering on `owner_id`. Below are the entities; architecture finalizes types/indexes.

### B.1 clients
`id, owner_id, name, company, email, phone, source(enum cold_outreach|referral|repeat), language_pref(enum vi|en), industry(text), company_size(enum solo|small|medium|enterprise), communication_style(text, AI-maintained), known_hesitations(text, AI-maintained), relationship_stage(enum cold|warming|trusted|long_term), decision_maker(text — NEW, FR-11), notes(text, AI-maintained), created_at, updated_at`

### B.2 deals
`id, owner_id, client_id(FK), service_type(enum web_design|web_app|automation|other), title, stage(text — adaptive, FR-15), stage_history(jsonb), value_estimate(numeric), currency(enum VND|USD), priority(enum high|medium|low), next_action(text, AI), next_action_due(date), stale_since(date), client_stated_need(text), inferred_real_need(text, AI), risk_flags(jsonb [{flag,severity,noted_at}]), opportunity_signals(jsonb), predicted_outcome(enum likely_win|uncertain|at_risk|likely_lost, AI), prediction_reason(text, AI), similar_deals(jsonb [{deal_id,similarity_reason}]), stall_diagnosis(text — NEW, FR-12), notes, created_at, updated_at`

### B.3 documents
`id, owner_id, deal_id(FK nullable), client_id(FK nullable), type(enum proposal|contract|brief|sop|report|invoice|onboarding|other), title, status(enum draft|review|sent|signed|archived), content_md(text), file_url(text — Storage path to PDF), version(int), created_by(enum ai|human), created_at, updated_at`

### B.4 activity_log
`id, owner_id, entity_type(enum client|deal|document), entity_id, action(text), actor(enum ai|user), payload(jsonb), created_at`

### B.5 briefings
`id, owner_id, date(date), content_md(text), flags(jsonb), generated_at` — unique per (owner_id, date).

### B.6 check_ins *(NEW — FR-17/18)*
`id, owner_id, deal_id(FK), prompt_template, sent_at, channel(enum in_app|zalo|email), answered_at, answer(jsonb), status(enum pending|answered|skipped)` — plus a per-deal/global cadence + pause flag (location TBD: deals table or settings).

### B.7 settings / business_context
Business Context living document (≤~2,000 tokens, PRD FR-4) stored and editable; includes pricing benchmarks (FR-13), escalation thresholds, follow-up + check-in cadences.

## C. Orchestrator Tool Surface (from v1.1 §6.1 — capabilities, signatures to be finalized)

`get_client(id|name)`, `get_deal(id|title)`, `list_deals(filters)`, `update_deal(id, fields)`, `update_client(id, fields)`, `get_document(id | deal+type)`, `create_document(deal_id, type, context)`, `create_client_stub(name, company, known_fields)`, `create_deal_stub(client_id, fields)`, `find_similar_deals(service_type, industry, size)`, `log_activity(entity, action, note)`, `get_briefing(date)`, plus **NEW**: `extract_from_image(image | file_id)` (vision → structured deal context, FR-9; accepts a base64 image source or an Anthropic Files API `file_id` for reuse — spine AD-9), `schedule_checkin(deal_id, cadence)` / `record_checkin_answer(...)` (FR-17/18).

## D. Model Routing Table (PRD §8 — detail)

| Task | Tier | Reason |
|---|---|---|
| Daily briefing generation | Economical | Structured, predictable, daily |
| Client/deal queries, pipeline status | Economical | Retrieval + formatting |
| Elicitation (doc gathering), stub creation | Economical | Conversational, low stakes / structured extraction |
| Document drafting | High-judgment | Quality reasoning + writing |
| Strategic advice | High-judgment | Nuanced judgment |
| **Deal Intelligence analysis** | High-judgment | Highest-judgment task — never downgrade |
| **Vision / screenshot extraction** | High-judgment, vision-capable | Image understanding; economical tier lacks vision |

Caching: briefing cached per day; session CRM reads cached, refetched after writes; document content never cached. Context-window discipline: Business Context injection ≤~2,000 tokens; CRM fetched via tools on demand.

## E. Document Templates (starter set, from v1.1 §11 — ARIA uses as scaffolds, FR-19/20)

- **Proposal:** 1) Understanding your situation 2) What we will deliver (outcomes, not tasks) 3) How we work (3–4 steps) 4) Timeline (milestone-based) 5) Investment (price, in/out) 6) Next step (single CTA).
- **Contract/SOW minimum fields:** parties; scope (ref proposal); deliverables; timeline/milestones; payment schedule (deposit/milestone/final); revision policy (N rounds); IP transfer; termination; governing law.
- **Project brief minimum fields:** summary; client goals (3–5); target audience; technical requirements; design references/constraints; content responsibilities (who provides what); timeline w/ owner per milestone; communication cadence.
- Onboarding doc, status report, invoice, SOP — per v1.1 §6.3 table. Naming: `{ClientName}_{DocumentType}_{YYYY-MM-DD}_v{N}`.

## F. Zalo Delivery Mechanics (PRD §11 — detail, from market research)

- **Do NOT use ZNS** for the briefing/check-ins: ZNS requires pre-approved templates, incompatible with free-text AI content; quota-graded (Good/Medium/Low), promotion-quota limited since Nov 2024.
- **Use Zalo OA chat (follower) messaging:** Owner follows their own Official Account once (onboarding step), then ARIA pushes conversational messages. Validate OA-to-admin/follower messaging feasibility + policy stability (PRD OQ-5). **Zalo outbound push is subject to a messaging-window rule** — treat Zalo as the *preferred best-effort* channel and **email as the guaranteed delivery** (PRD FR-28/FR-29). The two documents agree: Zalo preferred, email guaranteed, in-app always reflects.
- **Email is the architected backbone/fallback** (no constraints) — never let Zalo be a single point of failure.
- Replies/inbound from Zalo: webhook for later (one-way push acceptable for v1 per architecture roundtable).

## G. Domain Heuristics to Encode (from `research-domain-vn-service-agency.md`)

Feeds Deal Intelligence (FR-6, FR-11–FR-13) and Strategy (FR-23):
- Decision-maker is rarely the first contact; founder-gated decisions; "shadow consensus" before yes.
- Price objection after enthusiasm usually = trust/approval gap, not budget.
- Deposit norms: 30–50% on signing; avoid 50/50 over 100M VND.
- Industry reads: F&B (high failure rate, post-Tet cash crunch, fast-ROI framing); retail (seasonal — avoid pitching Feb–Mar/Aug; "why not just Shopee?"); professional services (best automation prospects, stable cash, ROI-per-billable-hour framing).
- Agency failure modes ARIA must counter: scope creep (require scope checklist before contract; draft change-order language), underpricing (pricing floors + value framing), client dependency (flag concentration), communication collapse (track age, draft warm follow-ups).

## H. Open Technical Validations (for architecture)

- Zalo OA messaging to Owner-as-follower (OQ-5).
- Claude API cost at single-user heavy usage incl. vision (OQ-6); add per-call token logging.
- Screenshot storage retention/lifecycle + privacy (OQ-7).
- Scheduler choice ratification (pg_cron vs Vercel Cron) and timezone handling (OQ-8).
- RLS policy design across all tables (PRD §9.4).
