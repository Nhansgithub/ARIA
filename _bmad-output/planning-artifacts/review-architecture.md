---
title: Architecture Review — ARIA Architecture Spine
reviewer: Architecture Reviewer
date: 2026-06-25
subject: ARCHITECTURE-SPINE.md against PRD.md v2.0, addendum.md, research-technical-feasibility.md
---

# Architecture Review — ARIA Architecture Spine

## Overall Verdict

The spine is architecturally sound at a paradigm level and correctly handles the two genuinely expensive-to-reverse decisions (owner-scoping + RLS, orchestrator paradigm). However, it is thin on CRM write-safety invariants — specifically AI-driven field mutation, idempotency of scheduled jobs, and the stub→full promotion lifecycle — and it carries one material contradiction (the PDPL terminology is wrong), two coverage gaps (auth session boundary and onboarding/first-run have no invariant), and several ADs that describe seed detail rather than real cross-cutting constraints. The deferred and OQ sections are largely honest, but one load-bearing decision (Files API vs base64 for repeated screenshots) is buried in research and never promoted to an AD or seed fact, and the idempotency requirement for scheduled jobs is stated in research but never given architecture-level teeth.

---

## Dimension 1 — Coverage

*Does every PRD feature area map to an AD or explicitly to Seed/Deferred?*

- **[high] Auth / session boundary has no invariant (§ auth)** — PRD FR-34 and §9.4 establish that auth is Supabase email/password, all data owner-scoped, and unauthenticated access denied. The spine mentions RLS (AD-2) but never states the session boundary invariant: that all server-side request handlers resolve `owner_id` from the authenticated JWT before any DB operation, and no endpoint serves owner data under a service-role bypass. Without this AD, Epic 0 and Epic 1 could be built with inconsistent session-resolution patterns, with some routes accidentally using the service role for convenience. *Fix:* Add AD-13: "Session boundary — every API route resolves `owner_id` from the authenticated Supabase JWT; no handler serving owner data uses the service-role key; Supabase RLS is the enforcement layer, not application-layer filtering."

- **[high] Onboarding / first-run has no invariant (§ FR-36, PRD §4.12)** — UJ-6 and FR-36 are high-risk retention moments: the app must not show a broken empty Briefing, the scheduler must not fire for an empty CRM, and Business Context must be writable conversationally before any deal exists. None of this is covered by an AD; it is not in Seed either. Epic 4 and Epic 1 could implement these independently and arrive at inconsistent empty-state guards. *Fix:* Promote the empty-CRM guard to an explicit Seed constraint or a thin AD: "Scheduled jobs (AD-7) check for eligible records before firing; the Briefing panel never renders from a missing/null briefing row without a guided welcome fallback."

- **[medium] CRM / Memory — AI-driven Intelligence Field mutation has no write-safety invariant (FR-8, FR-30)** — The spine establishes that the CRM is the single source of truth (AD-3) and that RLS scopes writes (AD-2), but it says nothing about how AI-driven field updates are made safe. PRD FR-8 requires ARIA to update `inferred_real_need`, `risk_flags`, etc. after a DI session without being asked. If two concurrent sessions (unlikely in v1 but architecturally possible) or a retry both write Intelligence Fields, the last write wins silently. More importantly, there is no AD stating that AI writes go through the tool surface (AD-1 implies this but doesn't state it as a write-safety rule) and that the activity log is append-only. *Fix:* Add an invariant: "AI CRM mutations are performed exclusively through the tool surface (AD-1); the activity_log is append-only (no UPDATE/DELETE on that table); AI field updates are idempotent by design (setting a field to the same value is a no-op, not a new log entry)."

- **[medium] Stub → full promotion lifecycle not architecturally governed (FR-37, PRD §4.2)** — FR-37 is a full functional requirement (de-duplication check, exclusion from pattern-matching, idle archival) but the spine treats stubs entirely as seed/data-model detail. The promotion lifecycle is a cross-cutting concern: Epic 1 (DI creates stubs), Epic 2 (CRM stores them), Epic 4 (Briefing must exclude them from stale-deal counts) all touch it. Without an invariant, epics can diverge on what "stub" means and when it graduates. *Fix:* Promote to Seed or a thin AD: "A stub is identified by a `is_stub: true` flag; stubs are excluded from pattern-matching (FR-10) and Briefing stale-deal counts (FR-26) until promoted; promotion requires at minimum one human-confirmed field beyond the creation turn."

- **[medium] PDF export has no architecture mention (FR-21, §4.5)** — The spine's Seed mentions "PDF via Puppeteer/html-pdf-node serverless" but there is no statement about where it runs (Vercel serverless function), that it is a pure server-side render with no AI call (PRD §8 explicitly says so), or that the PDF file is stored in Supabase Storage (not served on-the-fly). An epic building the Document Agent could implement this as a client-side download or a separate service. *Fix:* Add to Seed: "PDF export runs as a Vercel serverless function (no AI call); rendered PDF is written to owner-scoped Supabase Storage and the `file_url` on the document row is updated; generation never blocks the chat stream."

- **[low] Strategy Advisor has no explicit mapping** — PRD §4.6 (FR-23–FR-24) is a named specialist path in the orchestrator diagram (STRAT → Sonnet). It is covered by AD-1 (paradigm) and AD-4 (Sonnet routing), but the Paradigm diagram lists it and AD-4 names it only in passing. This is adequate given the routing table in Seed, but it should be confirmed that `find_similar_deals` is available to STRAT as well as DI (both need cross-deal pattern data).

- **[low] Document status lifecycle not in Seed or ADs** — FR-20 defines a `draft → review → sent → signed/archived` lifecycle with versioning. The addendum has the schema, but the spine does not state that version increments are immutable (old versions never overwritten) or that status transitions are logged. An epic story could implement "edit existing content_md" without bumping the version. *Fix:* Add to Seed: "Every document save increments `version` and writes the old content to a versions table or JSONB history; no UPDATE on content_md without a version bump."

---

## Dimension 2 — Invariant Test

*Would two epics diverge without it? Is it non-obvious and a real trade-off?*

- **[critical] AD-5 (Prompt-caching discipline) is load-bearing but incomplete — Files API for repeated screenshots is missing** — Research §4c explicitly recommends using the Anthropic Files API to avoid re-encoding base64 screenshots on every turn. This is a direct consequence of AD-9 (raw image not re-sent after extraction) + AD-5 (cache discipline), but it is never elevated to an AD or Seed. Without it, Epic 1 (vision extraction) and Epic 2 (multi-turn context) could independently implement screenshot handling and the research-recommended optimization is lost. The Files API approach also changes how `extract_from_image` is implemented in the tool surface (file_id vs base64). *Fix:* Add to AD-9 or Seed: "After first upload, image is referenced by Files API `file_id`; raw base64 is never repeated in subsequent turns; the tool surface `extract_from_image` accepts a `file_id`."

- **[critical] Idempotency of scheduled jobs is not an invariant — research says it must be** — Research §3c explicitly states "Build idempotency into all job handlers (check if briefing for today's date already sent before re-sending)." pg_cron has no automatic retry (so missed ticks are silent), but duplicate invocations are possible. The briefings table has a `(owner_id, date)` unique constraint in the schema (Seed), but check-ins (check_ins table) have no stated idempotency guard. Without an AD or Seed rule, an Epic 4 story could implement the check-in scheduler without at-most-once semantics. *Fix:* Add to Seed or AD-7: "All scheduled job handlers are idempotent: briefing generation checks for an existing row for today's date before inserting; check-in creation checks for an existing pending check_in for the same deal+cadence-window before inserting; pg_cron failure alerting writes to a `cron_log` table."

- **[high] AD-3 (Stateless AI) is real but underspecified on what "reconstruct from CRM" means for concurrency** — AD-3 says context is reconstructed from CRM data fetched via tools. But it does not say what happens when AI writes (via tools) interleave with reads within the same call — e.g., DI fetches deal, user types concurrently, DI writes Intelligence Fields, and a parallel Briefing job reads the same deal. For v1 (single user, low concurrency) this is low probability but not zero (check-in job + active DI session). Without a stated policy, epics may not add optimistic-locking or use Postgres transactions around multi-field AI updates. *Fix:* Add to Seed: "AI tool calls that update multiple fields on a single entity use a single UPDATE statement (atomic); the CRM tool surface does not support partial multi-entity transactions; concurrency is accepted as low-risk in v1 and revisited post-MVP."

- **[high] AD-6 (Graceful degradation) is furniture as stated** — The rule says "every AI-backed operation has a data-only fallback." This is correct and load-bearing, but it does not specify the timeout value, retry count, or what "structured error response" looks like in the tool surface. Two epics building independent specialists could implement 5s vs 30s timeouts, or one could bubble errors and one could swallow them. The "what does a degraded response look like" contract needs to be in Seed (the error envelope shape). *Fix:* Promote the timeout and error-envelope contract to Seed: "AI calls have a hard timeout of T seconds (OQ TBD, suggest 15s); on timeout or API error, the tool surface returns `{ok: false, degraded: true, data: <last-known CRM data>}`; the orchestrator propagates this as a UI-renderable degraded signal."

- **[medium] AD-8 (Delivery contract) is real but incomplete — delivery receipt / failure tracking not stated** — The rule says "no proactive item is ever dropped" and "Zalo is best-effort." But there is no stated invariant for how delivery outcomes are recorded. Without a delivery status field on `check_ins` and `briefings`, there is no way to implement "if Zalo failed, send email" reliably — the fallback logic needs to know whether Zalo succeeded. The schema has `check_ins.channel` but not a `delivery_status` per channel. *Fix:* Add to Seed: "Each delivery attempt writes a `delivery_status` (delivered|failed|pending) per channel to the relevant record; the email fallback fires only after Zalo status is `failed` or times out; the in-app record is written before any channel attempt."

- **[medium] AD-12 (Context management) is real but the summarization contract is open (OQ-9) and this is load-bearing for Epic 1** — The AD correctly defers the threshold to OQ-9 but does not state the architectural shape of how summarization works (a separate AI call? a truncate-from-the-top policy?). Epic 1 will implement the orchestrator and needs to know which pattern to build. This is not just an OQ — it is an architectural branch point. *Fix:* Add a placeholder in Seed specifying the approach (e.g., "sliding window truncation is the v1 default; server-side summarization is deferred to a post-MVP enhancement") so Epic 1 does not have to invent the policy.

- **[low] AD-2 (RLS) and AD-11 (Secret custody) are real invariants** — both pass the test. Without AD-2, epics would build inconsistent tenancy patterns; it is genuinely non-obvious (the alternative is app-layer filtering). AD-11 is obvious but codifies a rule that two epics could violate independently. Both are legitimately in the spine.

- **[low] AD-4 (Model routing) is partially furniture** — The routing table is in Seed (addendum.md §D); AD-4 essentially says "follow the table." The genuinely load-bearing rule is the two sub-rules: (a) DI is never downgraded, and (b) vision always goes to a vision-capable model. Those two sub-rules would cause divergence if violated; the rest of the routing table is seed detail that belongs in the addendum, not as an invariant. The AD is not wrong, but it is too thick. *Fix:* Slim AD-4 to just the two non-obvious rules; move the rest to Seed.

- **[low] AD-7 (Scheduler) is mostly seed** — The choice of pg_cron over Vercel Cron is correctly marked [ADOPTED] and the reasoning is sound. But "jobs run in Asia/Ho_Chi_Minh timezone" and "pausable via flag column" are implementation details that belong in Seed once the decision is made. The decision itself (pg_cron, not Vercel Cron) is the invariant. *Fix:* Slim AD-7 to the decision + the "no Vercel Cron" rule; move implementation details to Seed.

---

## Dimension 3 — Consistency

*Any AD that contradicts another AD, the PRD, or the research?*

- **[critical] AD-10 uses "PDPL" but the research establishes "PDPD" + "Decree 356" as the correct framework** — Research §2a explicitly states the operative framework is PDPL 91/2025/QH15 (effective Jan 1 2026) + Decree 356/2025 (replacing Decree 13/2023). AD-10 refers to "Vietnam PDPL" and mentions "CDTIA" (correct term) but also references "PDPD" in the PRD §9.2. The PRD and addendum are inconsistent on the acronym (PRD says "PDPD" in §9.2 but "PDPL" in §10; the research uses PDPD for Decree 13 and PDPL for the 2025 Law). The architecture spine says "PDPL" throughout which is the correct current term, but the cross-reference to "PDPD penalties" in AD-10 is outdated (Decree 13/PDPD is superseded by Decree 356/PDPL). *Fix:* Standardize on PDPL (Law 91/2025) + Decree 356 throughout; remove all references to PDPD/Decree 13 as the operative framework. The 5% revenue penalty figure is from the PDPL, which is correctly cited.

- **[high] AD-9 says "raw image is not re-sent" but the tool surface `extract_from_image` in addendum §C takes `image` (implying base64) not a `file_id`** — Research §4c recommends Files API for multi-turn reuse. The AD commits to not re-sending the raw image, but the tool signature as currently sketched would require base64 on first call. There is a gap between the invariant and its implementation contract. *Fix:* Align tool surface: `extract_from_image(file_id: string, owner_id: uuid)` after upload; the upload step returns the file_id; subsequent turns reference file_id only.

- **[medium] AD-8 names "in-app authoritative" as the first step, but addendum §F says "email is the authoritative delivery path"** — The spine and the addendum use different words: the spine says "in-app record first (the authoritative copy)" and "email guaranteed," while addendum §F says "Email must remain the guaranteed primary or co-equal delivery channel." These are consistent in intent (in-app = stored record, email = notification guarantee) but the wording will confuse epic story writers. *Fix:* Clarify the three-tier: (1) in-app row written first = durable record, always visible on next open; (2) Zalo OA push = preferred real-time notification, best-effort; (3) email = guaranteed notification fallback, never dropped.

- **[low] Cost model note says "~10–20 interactions/day" but PRD SM-1 implies daily active use could be heavier** — The cost model anchors on 10–20 interactions/day as the baseline for the $15–35 band. PRD SM-1 defines success as ≥5 of 7 days with daily reliance, and UJ-1 through UJ-5 together could easily represent 5–10 DI-class interactions in a single working day (a new lead, a stall check, a proposal request, a strategy question). The cost model note should flag this explicitly rather than implying 10–20 is the typical ceiling. *Fix:* Adjust cost model note: "At 5–10 DI-class + 10–20 total interactions/day the band may reach $30–50; validate with OQ-6."

---

## Dimension 4 — Buildability

*Could an epics-and-stories step derive consistent stories from this?*

- **[high] The altitude is right for most ADs, but AD-5 and AD-12 are too vague for Epic 1 story derivation** — AD-5 says "byte-stable prefix + cache_control breakpoint" but does not state where in the Next.js/Supabase stack the prompt is assembled (server action? API route? Edge Function?). AD-12 says "beyond a threshold (OQ-9), older turns are summarized" but OQ-9 is unresolved, so Epic 1 story writers cannot derive a concrete acceptance criterion. The epics-and-stories step will need to make the call that should have been made here. *Fix:* For AD-5, add to Seed: "Prompt assembly occurs in a Next.js API route (server-side); the stable prefix is assembled once per session and passed via `cache_control`." For AD-12, resolve OQ-9 with a v1 default (e.g., "sliding window of last N=10 turns; no summarization in v1").

- **[medium] Epic 2 (CRM & Memory) and Epic 1 (Consultant Core) have unclear handoff on Intelligence Field writes** — AD-3 says fields are updated via tool calls, AD-1 says all AI goes through the tool surface. But the tool surface in addendum §C does not list a dedicated `update_intelligence_fields` tool — it lists `update_deal(id, fields)` generically. Epic 1 (orchestrator) and Epic 2 (CRM) story writers will need to decide whether intelligence field writes use the same `update_deal` tool or a separate higher-intent tool (which would carry the activity log entry automatically). *Fix:* Add to Seed: "`update_deal` is the generic write path; intelligence field updates are distinguished by always including a `{source: 'ai', reason: string}` in the payload, which the tool handler writes to the activity log as a distinct entry type."

- **[medium] The Delivery Channel (Epic 5) has no stated integration test strategy for Zalo** — AD-8 covers the delivery contract but the spine gives no guidance on how Epic 5 validates Zalo delivery in a test environment (Zalo OA sandbox, mock, or manual). This is a buildability gap — a story for Zalo delivery has no acceptance criterion shape. *Fix:* Add to OQ-13 or Seed: "Zalo OA delivery is validated against the production OA in a staging environment (no Zalo sandbox exists); a mock/stub Zalo client is used in unit tests; the token-refresh job is tested by forcing expiry."

- **[low] The paradigm diagram is a useful anchor for story writers** — the mermaid diagram correctly maps all specialists and the delivery service. It is at the right altitude. No issues.

---

## Dimension 5 — Open-Question Honesty

*Are the deferred items and OQs the right ones?*

- **[high] OQ-9 (context summarization thresholds) is load-bearing for Epic 1 story derivation and should not be left open** — This is not a product question (like OQ-1 stage labels); it is an architecture branch point that affects how the orchestrator is implemented. Leaving it open means Epic 1 story writers must resolve it. *Fix:* Close OQ-9 now with a v1 default: "Sliding window, last 10 turns; no active summarization in v1; revisit post-MVP if context overflow is observed."

- **[high] OQ-5 (Zalo OA push feasibility) is correctly open but the research has already resolved it** — Research §1e concludes: "OA Chat to the founder (who follows the OA) can send free-text proactively — no template required. Feasible but fragile." The feasibility question is answered; what remains open is (a) the OA registration process (OQ-13) and (b) the specific failure-mode handling. OQ-5 should be partially closed: "OA Chat push is confirmed feasible for free-text to a follower; OQ-5 is narrowed to: finalize the exact messaging-window behavior for ARIA's use case and the token-refresh cadence." *Fix:* Update OQ-5 to reflect resolved facts from the research; leave only the operational unknowns open.

- **[medium] Idempotency of scheduled jobs is not listed as an OQ or a Seed constraint** — Research §3c explicitly calls this out ("Build idempotency into all job handlers"). The spine does not capture this at all. It is not load-bearing enough to be an AD, but it must be in Seed or it will be missed in Epic 4 stories. *Fix:* Add to Seed (see Dimension 2 finding above).

- **[medium] The Files API recommendation (research §4c) is a resolved technical decision that belongs in Seed** — It is not deferred or open — the research has a clear verdict. It is simply missing from the spine. *Fix:* Add to Seed under vision/image handling.

- **[low] Deferred items are well-chosen** — RAG/pgvector, automated Zalo ingestion, email-reply parsing, RBAC, mobile push, and self-hosted runtime are all correctly deferred and the rationale is sound. The "automated Zalo conversation ingestion" deferral is correctly explained (real API-access risk).

- **[low] OQ-11 (per-DI context budget) is correctly open** — this genuinely requires measurement data before it can be set.

- **[low] OQ-13 (Zalo OA registration) is correctly listed as an operational prerequisite for Epic 5, not an architecture question** — no issue.

---

## Summary Table

| Severity | Finding | Location |
|---|---|---|
| critical | Files API for repeated screenshots missing — contradicts AD-9 and tool surface | AD-9, addendum §C |
| critical | Scheduled job idempotency not in AD-7 or Seed — research called it out explicitly | AD-7, research §3c |
| critical | PDPL/PDPD terminology inconsistency — Decree 356 supersedes Decree 13 | AD-10, PRD §9.2 |
| high | No auth/session boundary invariant — service-role bypass risk across epics | missing AD-13 |
| high | No onboarding/empty-state invariant — Epic 4 and Epic 1 can diverge | FR-36, missing Seed rule |
| high | AI Intelligence Field write-safety — no idempotency or activity-log append-only rule | FR-8, FR-30 |
| high | Stub→full promotion not architecturally governed — three epics touch it | FR-37 |
| high | AD-6 degradation is furniture — no timeout value or error-envelope contract | AD-6 |
| high | AD-8 delivery contract missing per-channel receipt/failure tracking field | AD-8, addendum §B.6 |
| high | OQ-9 (context summarization) is load-bearing for Epic 1 and should be closed now | AD-12, OQ-9 |
| medium | AD-9 ↔ tool surface contradiction (file_id vs base64 in extract_from_image) | AD-9, addendum §C |
| medium | OQ-5 partially resolved by research — should be narrowed | OQ-5, research §1e |
| medium | PDF export not anchored to a location in Seed — could be implemented inconsistently | FR-21, Seed |
| low | AD-4 and AD-7 are too thick — contain seed details that inflate invariant count | AD-4, AD-7 |
| low | Document version immutability not in Seed | FR-20, addendum §B.3 |
