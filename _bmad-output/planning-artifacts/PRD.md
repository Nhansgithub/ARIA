---
title: ARIA — Adaptive Revenue Intelligence Assistant
status: final
created: 2026-06-25
updated: 2026-06-25
version: 2.0
supersedes: ARIA_PRD.md (v1.1)
---

# PRD: ARIA — Adaptive Revenue Intelligence Assistant

*Working title confirmed: ARIA.*

## 0. Document Purpose

This PRD is the requirements contract for ARIA, written for the planning-to-implementation pipeline (PM, architect, UX, and the engineers who build epics and stories from it). It supersedes `ARIA_PRD.md` v1.1, which remains a valuable source — its data models, agent specifications, cost-routing tables, and document templates are preserved in the companion **`addendum.md`** (technical depth that feeds the Architecture step, not duplicated here). This PRD states *capabilities and behavior*; the *how* (schema, tool signatures, stack) lives in the addendum and downstream architecture. Vocabulary is anchored in the §3 Glossary; features are grouped with globally numbered FRs nested under them; inferences are tagged `[ASSUMPTION]` inline and indexed in §13.

Two grounding research artifacts inform this PRD and should be read alongside it:
- `research-domain-vn-service-agency.md` — Vietnamese SME / service-agency domain knowledge.
- `research-market-ai-business-os.md` — competitive landscape and positioning.

## 1. Vision

ARIA is not a dashboard. It is an **AI business consultant that runs your service agency behind the scenes and reports to you through conversation.** You never "open the CRM," draft from a blank page, or chase your own pipeline. You talk to ARIA the way you'd talk to a sharp, experienced business partner who has read every file in your company, remembers everything, and never sleeps. The CRM, document vault, and pipeline exist as structured data in the backend; you reach them only through conversation.

ARIA's core job is **guidance, not delegation.** Its primary user is a craft-expert (a founder who builds web, apps, and automation) who is outsourcing the *business brain* — sales strategy, deal judgment, document discipline, follow-up cadence — to ARIA. So ARIA does not merely execute: it **teaches and explains as it operates.** It reasons out loud, justifies its advice, and walks the user through a professional process, assuming no prior business expertise. The operating principle: **the AI does the operating and the *explaining*; you do the deciding.**

This guidance-first design is also ARIA's bridge to its future. v1 is built narrow and deep for a single Vietnamese service-agency founder, because depth in a specific vertical — structured persistence, real workflow, and Vietnamese cultural fluency — is the moat that a generic "talk to an AI about your clients" wrapper cannot cross. Built well, the same consultant that teaches an expert can later teach a true business-novice. That broader market (§5, §12) is a deliberate North Star, **not** v1 scope.

## 2. Target User

### 2.1 Jobs To Be Done

The primary user (v1) is **Nhan — a solo founder running a bilingual Vietnamese service agency** (web design, web/app builds, automation consulting), selling via cold outreach and referrals to Vietnamese SMEs. He is expert at *delivery* and weak (by his own framing) at *the business/sales side*. His jobs:

- **Functional — "Run my pipeline without operating software."** Know the status of any client or deal, what's stuck, and what to do next, by asking — never by maintaining a tool.
- **Functional — "Think with me about a deal."** When I encounter or describe a deal (new or ongoing), give me a consultant's *read* — what it really is, the risks, what the client actually wants, how to approach the next conversation — not a database row.
- **Functional — "Produce the right document at the right time."** Draft proposals, contracts, briefs, and reports from deal context, and tell me which document I should have next and *why*.
- **Emotional — "Operate with peace of mind."** Stop the low-grade anxiety of forgetting a follow-up, mispricing a deal, or letting a relationship go cold. Trust that nothing important is silently slipping.
- **Social — "Look and act professional."** Present a polished, well-sequenced process to clients despite not having a business background.
- **Contextual — bilingual & Vietnamese-cultural.** Operate in Vietnamese or English as the moment demands, and respect Vietnamese B2B relationship norms (Zalo-first, trust-before-pressure, indirect register).

### 2.2 Non-Users (v1)

- **Team members / contractors.** No multi-user access in v1 (deferred; see §12). [ASSUMPTION: Nhan operates ARIA alone in v1.]
- **Clients.** ARIA is never client-facing; clients do not log in or receive ARIA messages directly.
- **The broad "business-novice" market** (freelancers, salespeople, non-agency owners). A deliberate future segment, explicitly out of v1 scope (§5, §12.2). The architecture keeps the door open (§9.4) but no novice-onboarding, multi-tenancy, or generalization is built in v1.

### 2.3 Key User Journeys

- **UJ-1. Nhan opens ARIA in the morning and is told what matters.**
  - **Persona + context:** Nhan, juggling several deals across service types, opens the app with coffee. He has not "updated" anything.
  - **Entry state:** authenticated (returning session); briefing for today already generated by the scheduler.
  - **Path:** App lands on the **Briefing panel** → "3 things to handle today," pipeline snapshot, documents pending, slow deals → he taps a flagged deal → the panel hands off to **Chat** with that deal pre-queued.
  - **Climax:** In one screen he knows his day's priorities and why each matters, with a recommended action on each.
  - **Resolution:** He acts on item one (asks ARIA to draft a follow-up). Realizes UJ-4.
  - **Edge case:** If the Claude API is degraded, the briefing still shows cached/structured data with a clear "AI synthesis unavailable — showing raw status" notice (FR-5).

- **UJ-2. Nhan describes a brand-new client mid-conversation and gets a consultant's read.**
  - **Persona + context:** He just met an F&B chain owner who wants "a website and maybe automation," budget unclear.
  - **Entry state:** authenticated, in Chat. No CRM record exists for this client.
  - **Path:** He types the situation in Vietnamese (or pastes a **screenshot** of the Zalo thread) → ARIA immediately reasons across its four layers, creates a client + deal **stub** in the background, tells him it did, and asks 1–2 targeted questions.
  - **Climax:** ARIA returns a structured read — what they probably actually need, risk flags (vague scope: HIGH), opportunity signals, a prediction, a recommended approach (a pain-mapping session, not a pitch), the documents needed *at this stage*, and the single next action.
  - **Resolution:** He has a plan and a CRM record without doing data entry. Realizes UJ-2 of the Deal Intelligence Engine (§4.2).
  - **Edge case:** If the screenshot is low quality / partially unreadable, ARIA states what it could and couldn't extract and asks him to confirm the gaps (FR-9).

- **UJ-3. ARIA proactively asks for an update Nhan would have forgotten.**
  - **Persona + context:** A deal has been quiet for several days; Nhan has been heads-down on delivery.
  - **Entry state:** scheduled check-in fires.
  - **Path:** ARIA messages him (in-app, and via Zalo OA) with a short templated prompt: "Phở 24 proposal — any movement since Tuesday? (a) responded (b) still waiting (c) needs nudge."
  - **Climax:** He answers in one tap/line; ARIA updates the deal's intelligence fields and, if relevant, recommends the next step.
  - **Resolution:** The pipeline stays current without him remembering to maintain it. Realizes §4.4.

- **UJ-4. Nhan asks for a proposal and ARIA refuses to draft blind.**
  - **Persona + context:** He says "draft a proposal for the Hanoi restaurant client."
  - **Entry state:** authenticated, in Chat; deal exists with partial context.
  - **Path:** ARIA fetches deal + client, identifies what's present vs missing, asks ≤3 targeted questions, then presents a **draft outline** for approval → on approval generates the full markdown → offers PDF export and storage.
  - **Climax:** A correctly-scoped, outcome-led proposal exists, versioned and linked to the deal, in the language the client speaks.
  - **Resolution:** ARIA asks whether to mark it for sending or keep in review, and explains *why* this document matters now. Realizes §4.5.

- **UJ-5. Nhan asks a business question he doesn't know the answer to.**
  - **Persona + context:** "I keep losing deals on price. Should I lower my rates?"
  - **Path:** ARIA gives a specific recommendation backed by reasoning, grounded in his own lost-deal pattern *and* Vietnamese SME domain knowledge (price objections after enthusiasm usually signal trust/approval gaps, not budget), and offers to act (draft a new proposal structure).
  - **Climax:** He learns a transferable business principle *and* gets a next step — the teaching stance in action. Realizes §4.6.

- **UJ-6. Nhan's very first session — an empty ARIA.**
  - **Persona + context:** Day one. No clients, no deals, no history. Nhan is curious but unsure what to do first.
  - **Entry state:** just authenticated; CRM empty; no Briefing possible yet.
  - **Path:** ARIA opens with a short guided welcome — explains what it does in one breath, helps set up Business Context (a few questions, not a form), walks the one-time Zalo OA follow, and invites him to describe his first real deal in his own words.
  - **Climax:** Within minutes he has described one deal and gotten his first read — value delivered before any data entry.
  - **Resolution:** ARIA explains what happens next (briefings, check-ins) and gets out of the way. Realizes §4.12.
  - **Edge case:** If he skips setup, ARIA proceeds with sensible defaults and fills Business Context opportunistically as deals appear.

## 3. Glossary

*Downstream workflows and readers use these terms exactly. FRs, UJs, and SMs use them verbatim.*

- **ARIA** — the AI consultant: the orchestrated system the user converses with. The single product surface.
- **Owner** — the authenticated human user of an ARIA instance (v1: Nhan). All data is scoped to one Owner. (Bridges to future multi-tenant via `owner_id`; see §9.4.)
- **Client** — a company/person the Owner sells to. Carries AI-maintained profile fields (communication style, known hesitations, relationship stage).
- **Deal** — a specific revenue opportunity with a Client, of a Service Type, moving through Stages. Carries AI-maintained intelligence fields.
- **Service Type** — web design | web/app build | automation consulting | other. Determines the Stage pattern ARIA reasons with.
- **Stage** — the deal's position in its sales process; free-text, interpreted contextually by ARIA per Service Type (not a rigid enum).
- **Stub** — a Client/Deal record ARIA creates automatically from conversation when the entity does not yet exist, populated with whatever is known so far.
- **Deal Intelligence** — ARIA's deepest mode: a four-layer synthesis (Client context, Pattern matching, Deal-specific analysis, Domain knowledge) producing a consultant's *read* on a deal. Distinct from pipeline reporting.
- **Intelligence Fields** — AI-maintained Deal/Client fields ARIA updates without being asked (inferred real need, risk flags, opportunity signals, predicted outcome, communication style, known hesitations).
- **Document** — a Client-facing or internal artifact (proposal, contract/SOW, brief, onboarding, status report, invoice, SOP) with a markdown source, status lifecycle, and versions.
- **Briefing** — the proactive daily summary ARIA generates (today's priorities, pipeline, documents, focus, slow deals).
- **Check-in** — a scheduled, templated proactive prompt from ARIA asking the Owner for a deal update.
- **Business Context** — the living document (≤~2,000 tokens) injected into every session describing the agency, services, pricing, rules, maintained by both Owner and ARIA.
- **Interaction Mode** — one of: Query, Advice, Collaborate, Proactive, Deal Intelligence (§4.1).
- **Delivery Channel** — where ARIA pushes proactive content: Zalo OA chat (primary), email (fallback), in-app.
- **Guidance stance** — ARIA's defining behavior: it explains its reasoning, teaches the principle, and recommends a next step, assuming no business expertise.

## 4. Features

### 4.1 Conversational Orchestrator & Interaction Model

**Description:** Every interaction passes through an orchestration layer that classifies intent, routes to the right specialist reasoning, enforces ARIA's personality and guidance stance, and handles language. ARIA never returns a raw database dump; every answer is synthesized, contextualized, and (where relevant) followed by a recommended next step *with its reasoning*. Five Interaction Modes: **Query** (ask for info), **Advice** (ask what to do), **Collaborate** (ask for a document), **Proactive** (ARIA surfaces unprompted), **Deal Intelligence** (think with me about a deal — the most important mode). Uses Glossary terms exactly. Realizes UJ-1, UJ-5.

**Functional Requirements:**

#### FR-1: Intent classification & routing
ARIA classifies each Owner message into an Interaction Mode and routes to the appropriate reasoning path.
**Consequences (testable):**
- A message describing a new opportunity or asking how to approach a deal routes to Deal Intelligence (§4.2), not plain Query.
- A document request routes to the elicitation flow (§4.5), never to blind generation.
- An ambiguous message is met with a clarifying question, not a guess.

#### FR-2: Bilingual detection & mirroring
ARIA detects the language of each Owner message (Vietnamese or English) and responds in the same language, switching automatically per message.
**Consequences (testable):**
- A Vietnamese message receives a Vietnamese response; an English message an English one, within the same conversation.
- Client-facing drafts default to the Client's `language_pref`; advisory replies to the Owner mirror the Owner's language.

#### FR-3: Guidance stance enforcement
Every advisory or Deal Intelligence response explains its reasoning and, where relevant, ends with a concrete recommended next step. ARIA assumes no business expertise on the Owner's part.
**Consequences (testable):**
- A recommendation is always accompanied by *why* (the principle or evidence behind it).
- After delivering information, ARIA suggests a next action unless the Owner indicated they only wanted the information.
- ARIA challenges the Owner when it detects an obvious mistake about to happen (e.g. discounting a deal whose objection is a trust gap, not price).

#### FR-4: Business Context injection
At session start ARIA loads the Owner's Business Context (≤~2,000 tokens) so advice is grounded without a full data dump.
**Consequences (testable):**
- The injected context stays within the token budget (§8 NFRs); bulk CRM data is fetched via tools on demand, not pre-loaded.
- The Owner can view and edit Business Context in Settings; ARIA may also update it (with the change logged to activity).

#### FR-5: Graceful degradation when AI is unavailable
When the Claude API is slow, rate-limited, or down, ARIA degrades to data-only responses and explicitly notifies the Owner, rather than failing silently or hanging.
**Consequences (testable):**
- On API failure/timeout, ARIA returns available structured data (deal status, fields, cached briefing) with a clear notice: "AI synthesis is temporarily unavailable — showing raw data."
- No interaction results in an unhandled error or indefinite spinner; a stop/retry affordance is available.
- The daily Briefing falls back to its cached version when generation fails.

#### FR-35: Conversation context management
ARIA manages long-running conversation context so sessions stay within model limits and cost bounds without losing relevant business state.
**Consequences (testable):**
- Durable business state lives in the CRM (Intelligence Fields, activity log), not in chat history; a new session reconstructs context from the CRM + Business Context injection, not from re-reading old transcripts.
- When a single conversation grows large, ARIA summarizes/truncates older turns rather than sending unbounded history; "Start new topic" (FR-33) resets conversation context while retaining all CRM data.
- Once an image's content is extracted to the record (FR-9), the raw image is not re-sent on every subsequent turn.

### 4.2 Deal Intelligence Engine *(crown jewel)*

**Description:** ARIA's highest-judgment capability. When the Owner mentions any deal — new or ongoing — ARIA synthesizes four layers **before** responding: (1) Client context, (2) Pattern matching across similar past deals, (3) Deal-specific analysis (stated vs inferred need, risks, opportunities, prediction), (4) Domain knowledge about the industry/market/service. Output is a consultant's *read*, structured but judgment-scaled (a two-sentence new lead gets a shorter read than a deal with full history). Always runs on the highest-quality model; never downgraded. Realizes UJ-2. Grounded by `research-domain-vn-service-agency.md`.

**Functional Requirements:**

#### FR-6: Four-layer synthesis
On any deal-related message, ARIA assembles a read from the four layers and presents it in the structured shape (understanding / real need / risk flags / opportunity signals / prediction / recommended approach / documents needed / next action), omitting sections judgment says don't apply.
**Consequences (testable):**
- For an existing deal, the read draws on the Client's history and `similar_deals`; ARIA states explicitly when it is reasoning from pattern ("Based on your last 3 F&B website deals…").
- When no similar deals exist, ARIA reasons from domain knowledge and says so.
- Each risk flag carries a severity and a reason.
- **Omission boundary (testable):** a structured section is omitted only when its underlying data is genuinely absent or not yet knowable (e.g. no risk flags identified, no similar deals). Two elements are always present: a one-line *understanding* and a *next action*. A two-sentence new lead yields a short read; an ongoing deal with history yields a full one.

#### FR-7: Conversational stub creation ("mention is enough")
When the Owner describes a Client/Deal not in the CRM, ARIA creates a Stub in the background, tells the Owner it did, and asks 1–2 targeted questions for the most critical missing fields — never demanding exhaustive data entry.
**Consequences (testable):**
- A new client/deal mentioned in conversation results in a persisted Stub linked correctly (deal → client).
- ARIA confirms creation in its reply and asks no more than 2 gap-filling questions per turn.

#### FR-37: Stub lifecycle & de-duplication
ARIA governs the lifecycle of auto-created Stubs so un-enriched records don't corrupt pattern-matching or clutter the pipeline.
**Consequences (testable):**
- Before creating a Stub, ARIA checks for a likely existing Client/Deal (by name/company) and offers to link rather than duplicate.
- A Stub is marked as such until minimally enriched; un-enriched Stubs are excluded from similar-deal pattern-matching (FR-10) and flagged for completion or archival after a configurable idle period.
- The Owner can merge or discard Stubs via conversation.

#### FR-8: AI-maintained Intelligence Fields
After a Deal Intelligence session, ARIA updates the relevant Intelligence Fields without being asked.
**Consequences (testable):**
- `inferred_real_need`, `risk_flags`, `opportunity_signals`, `predicted_outcome` + `prediction_reason`, and Client `communication_style` / `known_hesitations` are updated when new signals emerge, each change written to the activity log.
- The Owner does no manual maintenance of these fields.

#### FR-9: Vision input — extract context from pasted screenshots
The Owner can paste/upload an image (typically a Zalo conversation screenshot); ARIA extracts the deal-relevant context from it and folds it into the read and the record.
**Consequences (testable):**
- Text and meaning are extracted from a legible screenshot and reflected in ARIA's response and field updates.
- For a partially unreadable image, ARIA states what it could and could not extract and asks the Owner to confirm gaps.
- Vision tasks are routed to a vision-capable, high-judgment model (see §8; image input is never sent to a vision-incapable model).

#### FR-10: Similar-deal pattern matching
ARIA can find and link past Deals similar by Service Type and/or industry/size, with a stated similarity reason, to ground its read.
**Consequences (testable):**
- A `find_similar_deals`-type capability returns linked deals with `similarity_reason` populated.
- The matched deals' outcomes/objections inform the read when present.

#### FR-11: Decision-maker tracking *(domain-research-driven)*
ARIA prompts the Owner to identify and confirm the *actual* decision-maker early in a deal and tracks whether the inner circle has been reached.
**Consequences (testable):**
- For a new deal, ARIA surfaces the decision-maker question when it is unknown.
- A deal where the contact is not the approver is flagged as a risk in the read.

#### FR-12: Stall diagnosis *(domain-research-driven)*
When a deal goes quiet, ARIA produces a stall *diagnosis* — probable cause (trust gap / budget not allocated / internal approval pending / seasonal) — and a recommended, culturally appropriate re-engagement message, rather than just flagging "stale."
**Consequences (testable):**
- A stalled deal's read names a probable cause and incorporates Client industry + seasonal context (e.g. post-Tet cash crunch for F&B).
- ARIA offers to draft a warm, non-pressuring Zalo follow-up (Vietnamese register; see §10).

#### FR-13: Pricing-floor awareness *(domain-research-driven)*
ARIA maintains Service-Type pricing benchmarks (VND) in Business Context and flags when a proposed price falls below a sustainable floor, offering value-framing before any discount is considered.
**Consequences (testable):**
- A proposed price below the benchmark floor for its Service Type triggers a flag with value-framing guidance.
- Benchmarks are editable by the Owner in Business Context. [ASSUMPTION: initial benchmarks seeded from domain research: web 20–80M, app 60–150M, automation 20–60M/workflow VND; Owner refines from real quotes.]

### 4.3 Sales / Pipeline Intelligence

**Description:** Pipeline operations — what's happening, what to do next, what's stuck. Distinct from Deal Intelligence (reporting vs thinking). Stages are interpreted adaptively per Service Type. Realizes UJ-1.

**Functional Requirements:**

#### FR-14: Synthesized deal/client status
On request, ARIA returns a synthesized status (name, stage, value estimate, last activity, next action, days since last movement) — never a raw dump — and a recommended next step.
**Consequences (testable):**
- A status reply includes days-since-last-movement and a next action.
- The reply is prose synthesis, not a field listing.

#### FR-15: Stage-aware next-action recommendation
When asked "what should I do next," ARIA gives a specific action based on the Stage and how long the deal has been there, interpreting Stage contextually per Service Type.
**Consequences (testable):**
- The recommendation differs appropriately for a deal at "Proposal sent" vs "Discovery."
- An unusual/free-text stage is interpreted sensibly, not rejected.

#### FR-16: Stale-deal & follow-up cadence flagging
ARIA flags deals with no activity > 7 days, and applies the proposal follow-up cadence (3 days, then 7, then close/archive — Owner-configurable).
**Consequences (testable):**
- A deal idle > 7 days appears in the Briefing and is raised in conversation when relevant.
- A deal at "Proposal sent" with no logged response triggers a reminder after 3 days.

### 4.4 Proactive Deal Check-ins *(new)*

**Description:** Because the Owner will forget to update ARIA, ARIA proactively prompts for deal updates on a schedule, using short templated questions, and folds answers back into Intelligence Fields. Realizes UJ-3.

**Functional Requirements:**

#### FR-17: Scheduled templated check-ins
ARIA periodically sends the Owner a short, templated update prompt for deals that warrant it (active, recently quiet, or approaching a due action).
**Consequences (testable):**
- A check-in fires per the configured cadence and references a specific deal and a concrete question with quick-reply options.
- Check-ins are delivered via the configured Delivery Channel (in-app + Zalo OA).
- **Trigger criteria (testable defaults, configurable):** a deal is eligible for a check-in when it is active AND (no activity for ≥ N days [default 3 for high priority, 5 otherwise] OR a `next_action_due` is within 24h/overdue) AND no check-in for it is already pending. At most one check-in per deal per cadence window; a global daily cap prevents notification spam (SM-C1).

#### FR-18: Configurable cadence & answer capture
The Owner can configure check-in frequency; answers (including one-tap quick replies) update the deal and its Intelligence Fields.
**Consequences (testable):**
- Cadence is adjustable in Settings; check-ins can be paused per deal or globally.
- A check-in answer updates `next_action`, stage, or Intelligence Fields and logs activity.

### 4.5 Document Agent

**Description:** Create, store, retrieve, and version all Client-facing and internal Documents. Elicitation is never skipped; ARIA teaches *why* a document matters at this stage. Realizes UJ-4. Document types and starter templates carried in `addendum.md`.

**Functional Requirements:**

#### FR-19: Elicitation-first creation flow
On a document request, ARIA fetches deal+client data, identifies present vs missing information, asks ≤3 targeted questions per turn, then presents a draft **outline for approval** before generating the full document.
**Consequences (testable):**
- No full document is generated before the Owner approves an outline.
- ARIA asks no more than 3 questions per turn.

#### FR-20: Generation, versioning & storage
On approval, ARIA generates the document in markdown, saves it (status `draft`) linked to deal/client, and every save creates a new retained version.
**Consequences (testable):**
- The markdown source is always stored and editable; old versions are retained.
- A document is linked to client and/or deal (or standalone) and follows the status lifecycle draft → review → sent → signed/archived.
- Naming follows `{ClientName}_{DocumentType}_{YYYY-MM-DD}_v{N}`.

#### FR-21: PDF export
The Owner can export a document to a styled PDF (basic branding placeholder) stored in file storage.
**Consequences (testable):**
- PDF export produces a downloadable, styled file and does not require an AI call.
- [ASSUMPTION: branding (logo, palette, footer) is finalized at the UX/branding step; v1 ships a placeholder brand.]

#### FR-22: Missing-document detection & teaching
ARIA detects when a deal's stage implies a document should exist but doesn't, says so, and explains why it matters now.
**Consequences (testable):**
- A deal past "Proposal sent" with no proposal Document triggers a flag in conversation and Briefing.
- The flag includes a one-line rationale (the teaching stance).

### 4.6 Strategy Advisor

**Description:** High-quality business advice — pricing, positioning, niche expansion, handling difficult situations — grounded in the Owner's own data *and* Vietnamese SME domain knowledge. Always a specific recommendation with a reason; acknowledges uncertainty honestly. Realizes UJ-5.

**Functional Requirements:**

#### FR-23: Specific, reasoned strategic advice
On a business-level question, ARIA gives a specific recommendation (not just options), backs it with a reason, and challenges the Owner's plan when it has an obvious flaw.
**Consequences (testable):**
- The reply names a recommendation and its rationale; for pricing it anchors to value delivered, not cost incurred.
- When the Owner's stated plan is likely counterproductive, ARIA says so directly and explains why.

#### FR-24: Pattern-detected structural advice
ARIA surfaces structural issues it detects across multiple deals (e.g. repeated losses at proposal stage) even when not directly asked.
**Consequences (testable):**
- A cross-deal pattern (e.g. all recent losses at proposal stage) is surfaced with a recommended structural change.

### 4.7 Daily Briefing & Proactivity

**Description:** A proactive daily Briefing, generated by a lightweight scheduler and shown on app open, also available on demand. Fixed structure; cached per day. Realizes UJ-1.

**Functional Requirements:**

#### FR-25: Scheduled daily generation & caching
A lightweight scheduler generates the Briefing each morning (Owner's timezone) and caches it; it is not regenerated within the same day unless manually refreshed.
**Consequences (testable):**
- The Briefing for a date is generated once and served from cache until the next day or a manual refresh.
- Generation queries active deals, pending documents, and the last 24h activity log.

#### FR-26: Briefing structure & detection logic
The Briefing follows a fixed order — today's priorities (max 3), pipeline snapshot, documents pending, this week's focus, slow-moving deals — and detects stale deals, overdue actions, and missing documents.
**Consequences (testable):**
- "Today" contains at most 3 ranked, action-specific items.
- **Ranking (testable):** when more than 3 items qualify for "Today," they are ranked by urgency — overdue actions first, then due-today actions, then proposal-cadence reminders, then high-value/high-priority stale deals — with deal `priority` then `value_estimate` as tie-breakers. Items not surfaced in "Today" still appear in their section (Pipeline / Slow deals).
- Stale deals (>7 days) and deals lacking an expected document appear in the correct sections.

#### FR-27: Briefing surfaces (panel + on-demand)
The Briefing appears as the landing screen on app open when unseen, can be dismissed to Chat, is reachable on demand ("show me today's briefing"), and each item is clickable to open Chat pre-queued with that item.
**Consequences (testable):**
- Opening the app with an unseen Briefing shows the panel; dismissing returns to Chat.
- Clicking a Briefing item opens Chat with that item queued.

### 4.8 Delivery Channels

**Description:** ARIA pushes proactive content (Briefing, Check-ins, high-urgency alerts) to the Owner across three Delivery Channels: **in-app**, **Zalo OA chat (preferred external channel)**, and **email (guaranteed backbone)**. Zalo is the channel Nhan most wants, but it is *best-effort*: free-text AI content must use OA chat messaging (Owner follows their own Official Account), not template-bound ZNS (§11), and OA outbound push is subject to Zalo's messaging-window rules (OQ-5). Therefore **email always carries the same content as a guaranteed fallback** so no proactive item is ever silently lost; in-app always reflects it on next open.

**Functional Requirements:**

#### FR-28: Zalo OA chat push (primary)
ARIA delivers the daily Briefing and Check-ins to the Owner via Zalo OA chat messaging.
**Consequences (testable):**
- After the Owner completes the one-time OA-follow setup, the Briefing and Check-ins arrive in Zalo as conversational messages.
- Delivery uses OA chat (free-text), not ZNS templates (§11).
- **Design-for-failure (testable):** if Zalo delivery cannot be confirmed (messaging window closed, not yet set up, API error), the same content is delivered by email (FR-29) and the item is never dropped. Zalo is preferred, never required.

#### FR-29: Email fallback & urgency notification
Email delivers the same proactive content as a reliable fallback; high-urgency items raise a notification.
**Consequences (testable):**
- If Zalo delivery fails or is not yet set up, the Briefing/Check-in is delivered by email.
- A high-urgency Briefing item produces an in-app notification badge.

#### FR-38: In-app delivery & notification
The in-app surface is a first-class Delivery Channel: it always reflects the latest Briefing, Check-ins, and alerts, with an unread/notification indicator, independent of external channel success.
**Consequences (testable):**
- On app open, any unseen Briefing/Check-in/high-urgency item is visible in-app even if Zalo and email both failed.
- A notification indicator shows the count of unaddressed high-urgency items; addressing an item clears its indicator.

### 4.9 CRM & Memory (data behaviors)

**Description:** The structured backbone the Owner never opens directly: Clients, Deals, Documents, Activity log, Briefings — all owner-scoped, AI-maintained where marked. Schema detail in `addendum.md`.

**Functional Requirements:**

#### FR-30: Owner-scoped persistence with activity logging
All entities persist, scoped to the Owner, and material changes are recorded in an activity log (actor = ai|user).
**Consequences (testable):**
- Every create/update/stage-change/doc-create writes an activity log entry with actor and payload.
- All queries are filtered by the Owner; no cross-owner data is reachable (§9.4 RLS).

#### FR-31: Conversational data maintenance (no manual forms required)
The Owner can run the entire CRM through conversation; manual entry is optional, not required. No data migration/import is needed at launch (the CRM starts empty and fills conversationally).
**Consequences (testable):**
- A complete client+deal can be created and advanced without ever opening a form.
- [ASSUMPTION: a minimal manual edit/entry surface still exists for correction/convenience, but is never on the critical path.]

### 4.10 UI Shell

**Description:** One layout, chat-first, with the main panel switching context between Chat, Document viewer, and Briefing. Mobile-responsive. Visual/brand design is produced at the UX step (§10). Layout sketch and component requirements in `addendum.md`.

**Functional Requirements:**

#### FR-32: Three-mode context-switching layout
A single layout presents Chat (default), Document viewer (on doc create/retrieve), and Briefing (on app open if unseen), with navigation between them.
**Consequences (testable):**
- Creating/retrieving a Document switches the main panel to the viewer with status, linked deal/client, version, and actions (Edit, Export PDF, Change status, History).
- The layout collapses to a single column on mobile with Chat primary.

#### FR-33: Chat interface essentials
Chat renders markdown (headers, bullets, bold, tables, code), shows a typing indicator, allows interrupting generation, shows timestamps, offers copy-per-message, supports "start new topic" (clears context, retains DB state), and accepts **image uploads** (for FR-9 vision).
**Consequences (testable):**
- AI responses render markdown correctly; generation can be stopped mid-stream.
- An image can be attached to a message and is sent to the vision path.
- "Start new topic" clears conversation context without deleting CRM data.

### 4.11 Authentication & Account

**Description:** Single-Owner authentication; all data owner-scoped. Email/password to start.

**Functional Requirements:**

#### FR-34: Email/password authentication
The Owner authenticates via email/password; sessions persist appropriately.
**Consequences (testable):**
- Unauthenticated access to ARIA data is denied.
- [ASSUMPTION: Google OAuth is a later addition, not v1.]

### 4.12 Onboarding & First-Run

**Description:** The empty-state experience — the highest-risk retention moment. With zero data, ARIA must deliver value fast without forms. Realizes UJ-6.

**Functional Requirements:**

#### FR-36: Guided first-run & empty-state behavior
On first run (or any time the CRM is empty), ARIA guides the Owner through a lightweight setup and delivers value before requiring data entry.
**Consequences (testable):**
- With zero clients/deals, the app does not show a broken/empty Briefing; it shows a guided welcome that explains ARIA and invites the first deal in natural language.
- ARIA helps populate Business Context conversationally (skippable; defaults applied if skipped) and offers the one-time Zalo OA follow setup.
- Describing the first deal produces a Deal Intelligence read and a persisted Stub, demonstrating value within the first session.
- The scheduler (FR-25) does not send an empty Briefing or check-ins when there are no eligible deals.

## 5. Non-Goals (Explicit)

- **Not a project-management tool** — no task boards, no time tracking.
- **Not an accounting system** — no P&L, no tax handling. (Invoices as Documents only.)
- **Not a client-facing portal** — clients never log in or receive ARIA messages directly.
- **Not a team chat tool.**
- **Not a replacement for legal review** on contracts.
- **Not autonomous** — ARIA recommends and drafts; the Owner approves and sends. No message is sent to a client without the Owner's action.
- **Not a multi-tenant SaaS in v1** — built single-Owner; multi-tenancy is a future direction kept architecturally open (§9.4), not built.
- **Not a generic AI assistant / automation platform** — ARIA is opinionated and deep for service-agency client & deal management; it does not chase general task automation or broad integrations (the "we're not Lindy" boundary, from market research).

## 6. MVP Scope

The PRD's predecessor framed work as human "Phases." Those are **discarded as build units** (they were a human lean-startup rollout). v1 is re-cut into **BMAD vertical-slice Epics 0–5**; MVP = all of Epics 0–5.

### 6.1 In Scope (MVP = Epics 0–5)

- **Epic 0 — Foundation:** app scaffold, data layer with owner-scoping + RLS, auth (FR-34), deploy pipeline.
- **Epic 1 — Consultant Core:** orchestrator, intent routing, guidance stance, Business Context injection, graceful degradation (FR-1–FR-5); Deal Intelligence Engine incl. vision input and stub creation (FR-6–FR-13); Strategy Advisor (FR-23–FR-24); Chat shell (FR-32–FR-33).
- **Epic 2 — CRM & Memory:** persistence, activity log, AI-maintained Intelligence Fields, similar-deal matching, conversational maintenance (FR-30–FR-31, FR-8, FR-10).
- **Epic 3 — Documents:** elicitation→outline→generate→version→store, viewer, PDF export, missing-doc detection (FR-19–FR-22).
- **Epic 4 — Briefing & Proactivity:** scheduled briefing + cache, structure/detection, panel + on-demand, Sales/Pipeline intelligence, proactive Check-ins (FR-14–FR-18, FR-25–FR-27).
- **Epic 5 — Delivery Channels:** Zalo OA chat push (primary) + email fallback + urgency notification (FR-28–FR-29).

### 6.2 Out of Scope for MVP

- **Team / multi-user access** — deferred to a future epic; v1 is single-Owner. *[NOTE FOR PM: emotionally load-bearing if Nhan adds contractors sooner than expected — revisit if that happens.]*
- **RAG over a document library** (pgvector/LlamaIndex) — defer until document volume justifies it.
- **Automated Zalo conversation ingestion** — v1 uses screenshot/vision + conversational input instead (real API-access risk; §11).
- **Email/calendar integration** (auto-logging email activity) — defer.
- **Proposal auto-send with open-tracking** — conflicts with the "not autonomous" non-goal for v1.
- **Analytics dashboards** (revenue by niche, win rate) — defer; ARIA answers analytical questions conversationally instead.
- **Mobile push notifications** — Zalo/email cover proactive delivery in v1.
- **Google OAuth** — email/password first.
- **Multi-tenancy / billing / novice onboarding** — North Star, not v1 (§12.2).

## 7. Success Metrics

**Primary**
- **SM-1 — Daily reliance.** Nhan uses ARIA on ≥5 of 7 days for ≥4 consecutive weeks without reverting to ad-hoc tools. Validates FR-1, FR-25, the whole guidance thesis. *(This is the real test: does it earn daily use?)*
- **SM-2 — Deal Intelligence trust.** For ≥80% of Deal Intelligence reads, Nhan rates the read "useful / actionable" (lightweight thumbs or note). Validates FR-6–FR-13.
- **SM-3 — Document leverage.** ARIA produces ≥2 usable documents/week via the elicitation flow once deals are flowing. Validates FR-19–FR-22.

**Secondary**
- **SM-4 — Pipeline never goes dark.** No active deal sits >7 days without ARIA surfacing it (Briefing/Check-in). Validates FR-16, FR-17, FR-26.
- **SM-5 — Proactive capture works.** ≥60% of Check-ins receive an answer (i.e. the cadence is helpful, not noise). Validates FR-17–FR-18.
- **SM-6 — Cost within ceiling.** Monthly Claude API spend stays within the target band (§8). Validates the model-routing NFRs.

**Counter-metrics (do not optimize)**
- **SM-C1 — Don't maximize message volume.** More ARIA messages/check-ins is *not* better; counterbalances SM-5. If Check-in answer rate is bought with notification spam, the metric is gamed.
- **SM-C2 — Don't maximize document count.** Generating documents nobody sends is waste; counterbalances SM-3 (track sent/used, not just created).
- **SM-C3 — Don't over-explain to the expert.** The guidance stance must not become condescending verbosity that slows Nhan down; counterbalances FR-3. Watch for "too long; I stopped reading."

## 8. Cross-Cutting NFRs

- **AI latency & responsiveness.** Conversational replies stream; perceived first-token latency should feel interactive. Long responses collapse after ~400 chars with "read more." [ASSUMPTION: target first-token < ~3s under normal API conditions; refine in architecture.]
- **Reliability / graceful degradation.** No unhandled errors or infinite spinners; AI-unavailable always degrades to data-only with notice (FR-5). Briefing always has a cached fallback.
- **Cost discipline & model routing.** Route by task: routine ops / queries / pipeline checks / elicitation / stub creation / briefing → economical model; document drafting / strategic advice / **Deal Intelligence / all vision input** → high-judgment model (never downgrade Deal Intelligence). Cache the daily Briefing; cache session CRM reads, refetch after writes; never cache document content. Routing table in `addendum.md`.
- **Context-window & cost budgeting.** Each AI call assembles only the context it needs — Deal Intelligence pulls the specific client/deal/similar-deals, not the whole CRM; Business Context injection ≤~2,000 tokens (FR-4); conversation history is bounded (FR-35). Per-call token counts are logged (Observability). The ~$15–35/month band is a *goal, not a guarantee*: Deal Intelligence + vision are the cost drivers and may push higher under heavy use — validated in architecture (OQ-6), where a per-DI-call context budget is set (OQ-11).
- **Guidance-vs-cost calibration.** The guidance stance (FR-3) is calibrated by interaction mode, not maximalist: Query/pipeline replies are terse; Advice/Deal Intelligence explain fully but concisely (explain the *principle*, don't pad). This directly serves counter-metric SM-C3 while staying within cost bounds.
- **Observability.** Log token counts per AI call (esp. vision extractions) so cost-per-deal is visible before any future scaling.
- **Bilingual quality.** Vietnamese output must be idiomatic for B2B context, not literal translation (§10). [ASSUMPTION: bilingual quality validated by Nhan in real use; flagged as ongoing risk.]
- **What never hits the API.** Navigation, PDF export, DB filtering/search, UI state changes.

## 9. Constraints & Guardrails

### 9.1 Safety
- ARIA never sends anything to a client autonomously (reinforces §5). All outbound client communication is Owner-approved.
- ARIA flags, but does not arbitrate, legal/contract matters; it recommends human/legal review for contracts and for deals over the Business-Context escalation threshold (e.g. >100M VND).

### 9.2 Privacy
- The CRM holds Client PII (names, contacts, conversation content, screenshots). Data is owner-scoped and access-controlled (§9.4).
- Screenshots and conversation content may contain **third-party personal data** (the Owner's clients) that is sent to an external AI provider (Anthropic) for processing. v1 treats the Owner as data controller and ARIA as a processor acting on the Owner's behalf, handled under Vietnam's **PDPL (Decree 356/2025, effective 2026-01-01, superseding Decree 13/2023 "PDPD")**. [ASSUMPTION: a clear in-product notice states what is sent to the AI provider; full PDPD assessment + data-processing posture defined in architecture — OQ-10.]
- Screenshots are stored access-controlled with a retention/lifecycle policy. [ASSUMPTION: retention policy defined in architecture; default to Owner-deletable.]

### 9.3 Cost
- See §8 model routing and caching. Cost is a first-class design constraint, not an afterthought.

### 9.4 Data ownership & future-tenancy seam *(load-bearing)*
- Every persisted row carries an `owner_id`; row-level security enforces owner-scoping from day one. This is the single decision deemed expensive to reverse (per architecture roundtable). It does **not** imply building multi-tenancy — no org model, billing, or routing in v1 — it keeps that door open cheaply.
- The Owner can export their data (trust signal; counters the "lock-in" concern and the "just a Claude wrapper" critique by emphasizing owned, structured, portable records).

## 10. Aesthetic & Tone

**Visual design:** Deferred to the `bmad-ux` step (knowledge-base-grounded via ui-ux-pro-max), which will also produce ARIA's **brand identity** (logo concept, color palette, typography) — none exist yet. [ASSUMPTION: clean, calm, professional, chat-first; final direction chosen at UX step.] Layout requirements are captured in FR-32/FR-33 and `addendum.md`.

**Consultant voice (product-generated text — load-bearing now):**
- **To the Owner (advisory, English or Vietnamese):** direct, analytical, no-filler, consultant-grade; uses numbers and explicit recommendations; teaches the principle (guidance stance). Does not soften for an expert, but never condescends (SM-C3).
- **Client-facing Vietnamese drafts:** warm, relationship-preserving, appropriately hierarchical (Anh/Chị), indirect about problems ("chúng ta cần xem lại…" not "anh chưa gửi…"); no Western urgency language ("ASAP", "final reminder"); emojis acceptable in Zalo register. Match or slightly exceed the formality of the client's last message.
- **Bilingual rule:** advisory mirrors the Owner's language; client-facing drafts follow the Client's `language_pref` (default Vietnamese unless the client is English-speaking). Vietnamese is the legally operative language for contracts/invoices.

## 11. Integration & Dependencies

- **Anthropic Claude API** — core dependency; model risk and cost risk acknowledged (OQ-6). Graceful degradation (FR-5) is the mitigation for availability.
- **Zalo Official Account (OA) messaging** — primary Delivery Channel. **Constraint:** ZNS (notification service) requires pre-approved templates and cannot carry free-text AI briefings; ARIA must use **OA chat (follower) messaging**, which requires the Owner to follow their own OA (one-time onboarding step). Zalo API policy is a platform risk (OQ-5); email is the architected fallback (FR-29).
- **Supabase** (Postgres + Storage + Auth) and **Vercel** (hosting) — stack carried from v1.1; details and the scheduler choice (Supabase Edge Functions + pg_cron favored over Vercel Cron) live in `addendum.md` / architecture.
- **PDF generation** — serverless (html-pdf-node / Puppeteer); no AI call.

## 12. Why Now & Future Direction

### 12.1 Why now
Market research shows the "conversation-first, no dashboard" position is genuinely unoccupied; Vietnam's AI-for-SME market is growing fast (~39% CAGR, 65% SME AI adoption); and domestic incumbents (MISA, Getfly) have not yet added a conversational AI layer with Zalo. The strategic window favors building the deep vertical now.

### 12.2 Future direction (North Star — not v1 scope)
ARIA may later be offered to a broader **business-novice** segment (freelancers, salespeople, owners who are craft-experts but weak on the business side). v1 deliberately stays narrow and deep (the moat). The guidance-first design (FR-3) and the `owner_id`/RLS seam (§9.4) are the only concessions made now to keep that future cheap to reach. See `aria-persona-scope-decision`.

## 13. Open Questions

1. **OQ-1 — Pipeline stage labels.** Exact Stage names per Service Type, validated against Nhan's real deals (ARIA interprets free-text now, but seed labels help).
2. **OQ-2 — Proposal pricing display.** Itemized breakdown vs single project price — likely client-type-dependent; decide patterns.
3. **OQ-3 — Follow-up cadence.** 3/7-day default — validate against Nhan's real sales rhythm.
4. **OQ-4 — Check-in cadence default.** What frequency is helpful vs noisy (ties to SM-5/SM-C1)?
5. **OQ-5 — Zalo OA-to-Owner messaging feasibility, push-window & policy stability.** Confirm OA chat to the Owner-as-follower works for *unsolicited* proactive push (Zalo's messaging-window rules may block it), is policy-stable, and finalize the email-fallback contingency (FR-28/FR-29).
6. **OQ-6 — Claude API cost at single-user heavy usage incl. vision.** Validate the $15–35 band; vision and Deal Intelligence are the cost drivers.
7. **OQ-7 — Screenshot retention/privacy policy.** How long are uploaded images kept; Owner-deletable; storage lifecycle.
8. **OQ-8 — Timezone & "morning" definition** for the scheduler.
9. **OQ-9 — Conversation/session length strategy.** Concrete summarization/truncation approach and thresholds for FR-35 under daily heavy use.
10. **OQ-10 — Vietnam PDPL & third-party PII to external AI.** Lawful basis, cross-border transfer impact assessment (CDTIA), Anthropic DPA, in-product notice, and retention policy for sending clients' PII/screenshots to Anthropic (§9.2; spine AD-10).
11. **OQ-11 — Per-Deal-Intelligence context budget.** The token budget per DI call that holds cost (§8) while preserving read quality.

## 14. Assumptions Index

- §2.1/2.2 — Nhan operates ARIA alone in v1; team/clients are non-users.
- §4.5 (FR-21) — Branding finalized at UX step; v1 ships placeholder brand.
- §4.9 (FR-31) — A minimal manual edit surface exists but is never on the critical path.
- §4.11 (FR-34) — Google OAuth deferred; email/password first.
- §4.2 (FR-13) — Initial pricing benchmarks seeded from domain research (web 20–80M / app 60–150M / automation 20–60M/workflow VND), Owner-refined.
- §8 — First-token latency target ~3s (refine in architecture); monthly cost band $15–35 (validate, OQ-6); bilingual quality validated in real use.
- §9.2 — Screenshot/data retention policy defined in architecture; default Owner-deletable.
- §4.12 (FR-36) — first-run guides setup but all steps are skippable with defaults.
- §4.4 (FR-17) — check-in trigger defaults (3 days high-priority / 5 otherwise), refined in use (OQ-4).
- §8 — the $15–35 cost band is a goal, not a guarantee; Deal Intelligence + vision may exceed it (OQ-6/OQ-11).
- §9.2 — Owner is data controller, ARIA a processor; in-product notice for AI processing; full PDPD posture deferred to architecture (OQ-10).
- §10 — Visual direction clean/calm/professional pending UX step.
