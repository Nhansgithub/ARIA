---
title: ARIA PRD — Adversarial Review
reviewer: Claude Code (adversarial mode)
reviewed: 2026-06-25
targets: PRD.md v2.0 + addendum.md
---

# Adversarial Review: ARIA PRD v2.0 + Addendum

## Overall Verdict

ARIA's PRD is well-written and unusually self-aware, but it carries five load-bearing structural risks that will ambush engineers: the guidance/cost tension is never resolved into a concrete rule; FR-6 four-layer synthesis is severely understated in both latency and per-session cost; FR-28 Zalo OA self-messaging is an unvalidated platform dependency that could collapse Epic 5 entirely; conversation context limits are completely unaddressed despite being a daily-use ceiling; and the "empty state / day 1" experience has no specified behavior anywhere in the PRD. These are not polish problems — several will force re-architecture mid-build if not resolved first.

---

## Category 1: Contradictions / Tensions

- **[critical] Guidance-stance vs. cost ceiling and SM-C3 — no resolution rule (FR-3, §8, SM-C3)**
  FR-3 mandates ARIA "explains its reasoning and ends with a concrete recommended next step" on every advisory/DI response, and §1 says "teaches and explains as it operates." SM-C3 is an explicit counter-metric warning against "condescending verbosity" and FR-3 even carves a partial exception ("unless the Owner indicated they only wanted the information"). But there is no rule for who decides, when the exception applies, or how ARIA calibrates. The cost NFR (§8) says target $15–35/month — high-judgment model tokens for multi-paragraph teaching on every deal message will bust that ceiling fast. An engineer implementing FR-3 has no testable threshold: "short advisory vs. full teaching" is unresolved. Every prompt-tuning decision will carry product risk.
  *Fix:* Add a concrete calibration rule: e.g. Deal Intelligence always teaches; Query/status replies are concise by default unless the Owner asks "why." Define a word/token budget per interaction mode (e.g. DI read ≤600 tokens, status ≤150 tokens). Tie it to the cost routing table in addendum §D.

- **[high] "ARIA updates Intelligence Fields without being asked" vs. Owner trust and conflict (FR-8, §3 Intelligence Fields)**
  FR-8 says ARIA updates `inferred_real_need`, `risk_flags`, etc. after a DI session "without being asked." There is no FR for what happens when ARIA's auto-update contradicts the Owner's own knowledge — e.g. ARIA infers "real need = landing page only" but Nhan knows it's a full app. The Owner could correct it in conversation, but the PRD has no FR for conflict resolution, merge logic, or "field was manually set — treat as authoritative." This will surface as a product correctness bug on week 1.
  *Fix:* Add FR: "When a manually set Intelligence Field conflicts with ARIA's inference, ARIA presents both versions, states its reason, and asks the Owner to confirm before overwriting. Manual values are tagged `owner_confirmed=true` and ARIA does not silently overwrite them."

- **[high] Guidance-first design vs. "Not autonomous" non-goal tension on proactive Check-ins (§5, FR-17, FR-18)**
  §5 says "ARIA recommends and drafts; the Owner approves and sends. No message is sent to a client without the Owner's action." But FR-17 says ARIA "periodically sends the Owner a short, templated update prompt" via Zalo and in-app. These are owner-directed messages, not client messages, so technically within the non-goal's scope. However the PRD never defines who triggers the scheduler's outbound Zalo message — the system sends it autonomously. This is functionally autonomous behavior (system → Zalo → Owner without Owner action). If a Zalo policy review ever categorizes OA messages as requiring owner opt-in per-message, the entire Check-in channel breaks. The PRD treats it as unproblematic but it is architecturally autonomous.
  *Fix:* Clarify in §5: "The 'not autonomous' constraint applies to client-facing communications only. ARIA-to-Owner messages (Briefings, Check-ins) are sent by the system autonomously." This is probably intended, but it needs to be stated explicitly so engineers don't add unnecessary Owner-approval friction.

- **[medium] Business Context "≤~2,000 tokens" and "ARIA may also update it" creates a creep loop (FR-4, §3 Business Context)**
  FR-4 says the Business Context is ≤~2,000 tokens and ARIA may update it. There is no FR for enforcement: what happens when cumulative AI updates cause it to exceed the budget? No trim policy, no summary-on-overflow rule, no versioning requirement for Business Context itself (unlike Documents). Over months of use this will silently inflate until injection starts consuming a disproportionate share of the context window.
  *Fix:* Add FR: "Business Context is summarized/trimmed by ARIA when it approaches 2,000 tokens, with the Owner notified of what was condensed. The previous version is retained as a snapshot."

---

## Category 2: Hidden Hard Problems Understated as Simple FRs

- **[critical] FR-6 four-layer synthesis — latency, cost, and context window cost are all severely understated**
  FR-6 is described as "assembles a read from the four layers." In practice this means: (1) inject Business Context (~2,000 tokens), (2) fetch and inject client history, (3) fetch and inject similar deals with their outcomes and objections, (4) inject the domain knowledge heuristics (addendum §G), (5) inject the current conversation. For a deal with 6 months of history and 3 similar deals fetched in full, the input context is easily 8,000–15,000 tokens before the response. At Sonnet-class pricing, one rich DI session = ~$0.04–0.08. At daily active use (3–5 DI sessions/day), that's $3.60–12/day — blowing past the $15–35/month band in 3–10 days. The PRD lists this as OQ-6 but frames it as "validate" not "design for." The routing table in addendum §D says "never downgrade DI" — which is correct for quality but means cost is entirely unconstrained by the PRD.
  *Fix:* Make this a design problem, not an open question. Define maximum context window budget for a DI call (e.g. "DI assembly budget: Business Context ≤2,000 tokens + client history last 5 interactions ≤1,500 tokens + similar deals 2 most relevant ≤1,000 tokens + domain context ≤500 tokens = hard cap 5,000 tokens input"). Add this to addendum §D.

- **[critical] FR-28 Zalo OA self-messaging — unvalidated platform dependency that may not work as described (§11, addendum §F)**
  The PRD correctly flags this as OQ-5 but treats it as "validate feasibility" rather than "this may require a full design change." The actual Zalo OA constraint is: OA chat messaging requires the *user to first message the OA* or for the OA to send within the 48-hour reply window after a user message. A brand-new OA that the Owner has "followed" but never messaged cannot receive unsolicited outbound messages under Zalo's current policy. The PRD scenario (Owner follows OA once, then ARIA pushes Briefings daily) may be technically correct only if the Owner replies to each Zalo message, keeping the 48h window open — which is an undocumented usage contract. If the Owner goes 3 days without replying, ARIA's Zalo pushes may silently fail. The email fallback exists but is described as a fallback, not the primary path.
  *Fix:* Before Epic 5 is scoped, do a technical spike: can the OA push messages to a follower with no recent incoming message? If the 48h window applies, the design must either (a) require the Owner to send a "keepalive" message, (b) switch email to primary with Zalo as secondary, or (c) use a webhook-based bidirectional model. This is not a polish item — it could invalidate the entire Delivery Channel architecture.

- **[critical] Conversation context limits — completely unaddressed (FR-33, §4.1)**
  ARIA is a conversation-first product used daily. A long-running session (UJ-1 → UJ-4 chain, vision input mid-session) will accumulate 20,000–60,000 tokens of context by afternoon. Claude's context window is finite, and long contexts at Sonnet-class pricing become expensive fast. The PRD has zero FRs for: (a) when/how to summarize or truncate conversation history, (b) what "start new topic" preserves vs. discards, (c) whether ARIA's tool call history counts against the budget, (d) how multi-turn DI within a single conversation compounds. FR-33 says "Start new topic clears context" but this is a user action — not a system behavior for context that exceeds limits mid-session.
  *Fix:* Add FRs: "Conversation history injected into each AI call is bounded to the last N tokens of recent turns (target ≤4,000 tokens); older turns are summarized. ARIA detects when the session approaches the context limit and offers to start a new topic."

- **[high] FR-9 vision extraction quality on real Zalo screenshots — production fidelity gap**
  FR-9's testable consequence says "text and meaning are extracted from a legible screenshot." Real Zalo screenshots are: mixed Vietnamese + emoji, informal register, truncated by notification banners, multi-message vertical stacks with mixed bubble widths, often low-DPI from phone screenshots, with client names sometimes not visible (privacy blur). The FR's failure path ("ARIA states what it couldn't extract") is good, but there's no quality floor: what minimum information must be extracted for the feature to be useful? If vision OCR misreads Vietnamese diacritics (tones), the "extracted context" could be systematically wrong in ways that look confident but are factually incorrect — worse than no extraction.
  *Fix:* Add testable quality floor: "For a standard Vietnamese Zalo screenshot, ARIA must correctly identify: sender identity (if visible), message date/approximate time, and the substantive content of at least 80% of messages. If confidence is below threshold, ARIA presents raw extracted text for Owner confirmation before folding into the record."

- **[high] FR-25 scheduler reliability — "lightweight" undersells the operational complexity**
  FR-25 says "a lightweight scheduler generates the Briefing each morning." The addendum endorses `pg_cron` on Supabase. In practice: `pg_cron` runs inside the DB as a SQL job; generating a Briefing requires making an outbound Claude API call and a Zalo API call. DB jobs cannot make outbound HTTP calls natively — this requires a Supabase Edge Function called from `pg_cron`, which in turn calls Claude, then Zalo. This is not "lightweight" — it's a distributed job with three external I/O hops, failure modes at each hop, retry logic needed, and observability requirements. Timezone handling (OQ-8) compounds this: "morning" in the user's timezone requires the scheduler to know the Owner's timezone and offset the cron expression accordingly.
  *Fix:* In addendum §H (for architecture): explicitly acknowledge this is a multi-hop job and spec the failure handling: (a) if Claude call fails → serve cached/data-only briefing + notify; (b) if Zalo push fails → email fallback; (c) if Edge Function timeout → retry once with exponential backoff; (d) timezone: store Owner's timezone in settings and compute UTC offset at scheduling time.

- **[medium] Bilingual idiomatic quality — understated as an ongoing risk, not designed for**
  §8 and §10 both note bilingual quality as "validated by Nhan in real use; flagged as ongoing risk." But the quality bar for Vietnamese B2B client-facing drafts is high: wrong honorifics (Anh/Chị/Em hierarchy based on age and status), wrong register (formal vs. casual Zalo vs. contract), wrong idiom for stall messages (e.g. the difference between a soft "remind" and an unintentionally pushy "chase"). A Claude prompt that says "write in Vietnamese, warm, indirect" will produce serviceable but not culturally idiomatic output. There are no FRs for: (a) a Vietnamese-language system prompt or persona definition, (b) sample reference messages Nhan validates before launch, (c) a feedback loop for ARIA to learn his preferred register.
  *Fix:* Add FR: "Before v1 launch, ARIA's Vietnamese document/message templates are reviewed and approved by the Owner. The Business Context includes Owner-provided sample messages in the preferred register as few-shot anchors."

---

## Category 3: Missing FRs / Gaps

- **[critical] Empty state / day 1 experience — zero specification (§2.3, §6, FR-31)**
  FR-31 says "no data migration/import is needed at launch (the CRM starts empty and fills conversationally)." But there is no FR for what ARIA does or says when the Owner opens it for the first time with zero clients, zero deals, zero briefing, and zero history. UJ-1 assumes "a returning session" with existing data. FR-25 assumes deals exist to query. The Briefing structure (FR-26) generates "stale deals" and "pending documents" — on day 1 these are all empty. ARIA will produce a briefing that says "no active deals" with nothing useful. The guidance stance (FR-3) says ARIA teaches — but what does it teach to an empty system? The day-1 experience is a critical retention moment and has no specification.
  *Fix:* Add FR: "On first session (no clients, deals, or documents), ARIA presents a guided onboarding conversation: introduces its capabilities, asks 2–3 questions to populate Business Context, and walks the Owner through creating their first client and deal conversationally. The Briefing on day 1 shows a prompt to begin onboarding, not an empty state."

- **[critical] Stub lifecycle — no FR for incomplete stubs (FR-7, §3 Stub)**
  FR-7 says ARIA creates a Stub and "asks 1–2 targeted questions for the most critical missing fields." But there is no FR for: (a) what happens to a Stub that never gets its gap-filling questions answered, (b) how long Stubs persist before aging out or being flagged, (c) how incomplete Stubs appear in the Briefing vs. proper records, (d) whether the Owner can see and manage Stubs explicitly. A Stub for "F&B chain owner who wants a website" with no contact details, no deal value, and no stage will clutter the pipeline and corrupt pattern-matching (FR-10) if it's treated as a real deal.
  *Fix:* Add FRs: "A Stub that has not been enriched within 7 days is flagged in the Briefing as 'incomplete record — needs detail.' Stubs are visually distinguished from complete records. ARIA's pattern-matching excludes Stubs from `similar_deals` analysis until they have at minimum: contact info, service type, and a value estimate."

- **[high] Duplicate client/deal creation from conversation — no dedup FR (FR-7, FR-31)**
  A user will inevitably describe the same client twice in different conversations ("I talked to a restaurant owner in Hanoi" Monday, "the guy from Phở 24 in Hanoi" Thursday) without realizing ARIA created two stubs. There is no FR for: (a) fuzzy matching before Stub creation, (b) detecting potential duplicates and asking the Owner to confirm, (c) merging duplicate records. Over time this will corrupt the pipeline and pattern-matching.
  *Fix:* Add FR: "Before creating a new Client Stub, ARIA checks for similar existing clients (fuzzy name + industry + source match) and, if a potential match is found, asks the Owner to confirm whether this is the same entity or a new one. If confirmed as a duplicate, ARIA merges context into the existing record."

- **[high] Conversation memory across sessions — no cross-session continuity design (FR-33, §4.1)**
  FR-33 says "start new topic clears context" — but the PRD has no FR for how ARIA "remembers" what was discussed in yesterday's session. Business Context injection (FR-4) handles static facts, and the CRM handles structured data, but the nuanced conversational context ("Nhan mentioned last week he's nervous about the Hanoi client's payment") is lost between sessions unless it was explicitly written to a CRM field. The four-layer synthesis (FR-6) can query deal history (activity log), but informal conversational signals that weren't structured into fields are permanently lost. This contradicts the vision ("remembers everything").
  *Fix:* Add FR: "At session end (or on 'start new topic'), ARIA extracts any new signals from the conversation not yet persisted — client tone observations, deal nuances, unstated concerns — and writes them to the relevant Client `notes` or Deal `notes` field, tagged with the date. This is the memory bridge between sessions."

- **[medium] Timezone — one open question, but scheduler and Briefing both depend on it (OQ-8, FR-25)**
  OQ-8 asks "what is morning?" but doesn't note that: (a) Supabase `pg_cron` fires in UTC; (b) Vietnam is UTC+7 with no DST, which simplifies things but still requires explicit offset storage; (c) if Nhan ever travels, "morning" shifts; (d) the "7-day stale" rule (FR-16) should use local date boundaries not UTC. This is not a question — it's a design requirement that should be closed before Epic 4.
  *Fix:* Close OQ-8 now: store `timezone` in settings (default `Asia/Ho_Chi_Minh`); all scheduler crons fire at UTC offset; all date comparisons (stale detection, FR-16) use local date in that timezone.

- **[medium] Document version storage limits — no lifecycle policy (FR-20, §9.2)**
  FR-20 says "every save creates a new retained version." Documents like proposals can go through 10–20 versions. With PDF exports for each version stored in Supabase Storage, storage costs accumulate. There is no FR for version retention limits, storage caps, or archival policy. For a single-user v1 with low deal volume this may not matter, but it's an unaddressed cost/storage assumption.
  *Fix:* Add FR or ASSUMPTION: "Document markdown versions are retained indefinitely (low storage cost); PDF exports are retained for the last 3 versions per document; older PDFs are soft-deleted (Owner can regenerate on demand)."

- **[low] No FR for what happens when check-in is unanswered N times (FR-17, FR-18)**
  FR-18 says check-ins can be paused per deal. But there's no escalation policy: if a check-in fires for the same deal 3 times with no answer, does ARIA stop? Escalate to a different channel? Flag the deal as owner-unresponsive? Without this, ARIA could spam the Owner with ignored check-ins for a dead deal indefinitely.
  *Fix:* Add FR: "If a check-in for the same deal receives no answer after 3 consecutive attempts, ARIA automatically pauses check-ins for that deal and flags it in the next Briefing as 'check-in paused — no response received.'"

---

## Category 4: Untestable Consequences

- **[medium] FR-3 guidance stance "challenges the Owner when it detects an obvious mistake" — not testable**
  The testable consequence says "ARIA challenges the Owner when it detects an obvious mistake about to happen." "Obvious mistake" has no definition, threshold, or domain list. An engineer cannot write a test for this, and ARIA's prompt cannot reliably implement it without a catalogue of mistake patterns. The only partial anchor is in addendum §G (price objection = trust gap), but that's one case.
  *Fix:* Replace with: "ARIA challenges the Owner's stated plan in at least the following documented scenarios: (a) proposing a discount when the deal's last risk flag is 'trust gap'; (b) drafting a proposal before the decision-maker is confirmed; (c) closing/archiving a deal at 'Proposal sent' before receiving any feedback. Additional patterns added in architecture/prompt design."

- **[medium] FR-2 "responds in the same language" — not testable for mixed-language messages**
  FR-2 says ARIA mirrors the Owner's language. The testable consequence only covers pure Vietnamese or pure English messages. Real messages are often code-switched: "Anh ơi, cái deal này có opportunity không?" — is this Vietnamese (dominant) or English (code-switched)? There's no rule for code-switching, and "detect the language" is ambiguous.
  *Fix:* Add rule: "For code-switched messages (Vietnamese with English words), ARIA defaults to Vietnamese as the primary response language and uses English terms only when they lack natural Vietnamese equivalents (e.g. 'deal,' 'proposal,' 'deadline' are acceptable as-is)."

- **[low] SM-2 "rates the read useful/actionable" — collection mechanism unspecified**
  SM-2 requires "≥80% of DI reads rated 'useful/actionable' via lightweight thumbs or note." There is no FR for a rating UI, collection mechanism, or data model for storing ratings. SM-2 is unmeasurable without this.
  *Fix:* Add FR: "Each Deal Intelligence response includes an inline thumbs-up/down reaction (FR-33 chat interface). Ratings are stored in `activity_log` linked to the message, queryable for SM-2 tracking."

---

## Category 5: Scope Leakage

- **[high] FR-24 "pattern-detected structural advice" surfaces cross-deal patterns unsolicited — this is a nontrivial AI feature**
  FR-24 says ARIA "surfaces structural issues it detects across multiple deals (e.g. repeated losses at proposal stage) even when not directly asked." This requires: (a) a background analysis job that scans all deals periodically, (b) a pattern-detection heuristic or AI call over the full deal corpus, (c) a threshold for "worth surfacing" vs. noise, (d) a delivery mechanism. None of these are specified. As written this is a proactive, unsolicited background intelligence feature that could require its own AI call budget, scheduler, and heuristics — much larger than a single FR implies.
  *Fix:* Scope it explicitly: "In v1, pattern detection is triggered only during the daily Briefing generation (not a separate background job). The Briefing generator looks for: >2 deals lost at the same stage in the last 30 days, and surfaces a structural note if found. Autonomous 'always-on' pattern scanning is deferred."

- **[medium] FR-12 stall diagnosis with cultural context (post-Tet, F&B cash crunch) — requires maintaining a calendar-aware knowledge base**
  FR-12 says the read "names a probable cause and incorporates Client industry + seasonal context (e.g. post-Tet cash crunch for F&B)." This requires ARIA to know: today's date, the Vietnamese lunar calendar (Tết timing varies year to year), and industry-specific seasonal patterns mapped to calendar months. This is a non-trivial knowledge engineering task disguised as a natural language feature.
  *Fix:* Add ASSUMPTION and scope note: "In v1, seasonal context is encoded as static heuristics in the system prompt (e.g. 'Jan–Feb = post-Tet recovery for F&B; Aug–Sep = back-to-school for retail'). Dynamic calendar-aware reasoning (actual lunar calendar API integration) is deferred."

---

## Category 6: Security / Privacy Holes

- **[high] Screenshots containing third-party PII sent to Claude API — consent and processing agreement gap (§9.2, FR-9)**
  FR-9 uploads screenshots of Zalo conversations to the Claude API for vision extraction. These screenshots contain: client names, phone numbers, message content, potentially financial figures, and third-party personal data of the Owner's clients. §9.2 notes "screenshots may contain third-party personal data" and defers to architecture for retention policy. But there is no FR for: (a) notifying the Owner that screenshot content will be sent to a third-party AI API (Anthropic), (b) data processing agreement implications under Vietnam's Personal Data Protection Decree (PDPD, effective 2023), (c) whether Anthropic's data retention policies for vision inputs are acceptable for this use case, (d) whether the Owner's clients have any reasonable expectation that their Zalo messages won't be processed by a US AI provider.
  *Fix:* Add FR and legal note: "Before the first image upload, ARIA presents a one-time notice: 'Images you upload are sent to the Claude AI API for processing. Do not upload screenshots containing sensitive personal data (ID numbers, banking details) without the consent of the individuals in them.' Store a log of image processing events for audit purposes. Architecture must confirm Anthropic's data retention policy for vision inputs and assess Vietnam PDPD applicability."

- **[high] RLS "enforced from day one" — stated but not specified (§9.4, addendum §A/B)**
  §9.4 says "row-level security enforces owner-scoping from day one" and addendum §B notes "RLS policy per table filtering on `owner_id`." But: (a) there are no specified RLS policies, (b) the `documents` table has `deal_id(FK nullable)` and `client_id(FK nullable)` — a standalone document with both nulls has no effective RLS anchor beyond `owner_id`, which is fine, but (c) the `activity_log` has `entity_id` (not owner-scoped by the entity itself) — if ARIA ever queries activity by entity across owners (e.g. a `find_similar_deals` join), the RLS could be bypassed by a malformed query. This is listed as an open technical validation (addendum §H) but is also a security requirement that needs a FR, not just an architecture note.
  *Fix:* Add FR: "All Supabase tables enforce RLS policies such that authenticated queries return only rows where `owner_id = auth.uid()`. Service-role keys are used only for server-side scheduler/Edge Function operations, never exposed to the client. The architecture step must include an explicit RLS policy spec per table and a review of cross-table joins for policy bypass vectors."

- **[medium] Business Context editable by ARIA + Owner — no audit trail or rollback FR**
  FR-4 says "ARIA may also update [Business Context] with the change logged to activity." But Business Context is a single living document (addendum §B.7 implies one row per Owner). If ARIA makes an incorrect update (e.g. overwrites the pricing benchmarks), there is no versioned history of Business Context changes, only an activity log entry. If the Owner doesn't notice, a wrong pricing floor could silently affect all future DI analysis.
  *Fix:* Add FR: "Changes to Business Context are versioned (append-only history table or jsonb version array), with the last 10 versions retained. The Owner can view and restore any previous version from Settings."

- **[low] Email fallback sends briefing content via email — no encryption or PII handling specification (FR-29)**
  FR-29 says email delivers "the same proactive content." The daily Briefing contains client names, deal stages, deal values, and next actions — all potentially sensitive PII. Email in transit is not end-to-end encrypted by default. There is no FR specifying: (a) what content is acceptable in email (summary only? full briefing?), (b) whether the email is sent via a transactional provider with appropriate DPA (GDPR/PDPD), (c) whether the Owner's email provider is trusted.
  *Fix:* Add ASSUMPTION: "Email briefings contain the same content as in-app briefings (no redaction). The Owner accepts this by connecting their email during onboarding. Architecture must select a transactional email provider with appropriate data processing agreements."
