---
title: ARIA — Implementation Readiness Report
type: assessment
created: 2026-06-25
analyst: Claude Code (Sonnet 4.6) — PM Implementation-Readiness Check
inputs:
  - PRD.md (v2.0, 38 FRs, NFRs §8, constraints §9, MVP §6)
  - ARCHITECTURE-SPINE.md (AD-1..AD-14)
  - ux/DESIGN.md (Focused-Dark visual system)
  - ux/EXPERIENCE.md (experience contract, key flows UJ-1..UJ-6)
  - epics.md (Epics 0–5, 48 stories, Given/When/Then ACs)
  - addendum.md (stack, schema, tool surface, domain heuristics)
---

# ARIA — Implementation Readiness Report

## Overall Verdict

**GO-WITH-CONDITIONS.**

The planning artifact set is comprehensive, well-structured, and demonstrates strong cross-document consistency. The 38 FRs are all mapped in the epics coverage map, all 14 ADs are addressed in the story ACs, and the UX spines are integrated at the story level with specific token references and microcopy. Four conditions must be cleared before the Epic 5 story writing (not before Epic 0–4 build start): OQ-5/OQ-13 (Zalo operational prerequisites), OQ-10 (PDPL), and one medium-severity NFR coverage gap in Epic 0. Two critical findings require immediate story-level attention; neither is an architectural unknown — both are implementable gaps with clear fixes.

---

## 1. FR Traceability Table

All 38 FRs are covered. The coverage map in `epics.md` §FR Coverage Map and the story ACs confirm the following assignments:

| FR | Description (abbreviated) | Epic | Implementing Story(ies) |
|----|---------------------------|------|------------------------|
| FR-1 | Intent classification & routing | 1 | Story 1.2 |
| FR-2 | Bilingual detection & mirroring | 1 | Story 1.3 |
| FR-3 | Guidance stance enforcement | 1 | Story 1.5 |
| FR-4 | Business Context injection | 1 | Story 1.4 |
| FR-5 | Graceful degradation | 1 | Story 1.6 |
| FR-6 | Four-layer DI synthesis | 1 | Story 1.8 |
| FR-7 | Conversational stub creation | 1 | Story 1.7 |
| FR-8 | AI-maintained Intelligence Fields | 2 | Story 2.5 |
| FR-9 | Vision input / screenshot extraction | 1 | Story 1.9 |
| FR-10 | Similar-deal pattern matching | 2 | Story 2.4 |
| FR-11 | Decision-maker tracking | 1 | Story 1.10 |
| FR-12 | Stall diagnosis | 1 | Story 1.10 |
| FR-13 | Pricing-floor awareness | 1 | Story 1.11 |
| FR-14 | Synthesized deal/client status | 4 | Story 4.1 |
| FR-15 | Stage-aware next-action | 4 | Story 4.1 |
| FR-16 | Stale-deal & follow-up cadence | 4 | Story 4.2 |
| FR-17 | Scheduled templated check-ins | 4 | Story 4.6 |
| FR-18 | Configurable cadence & answer capture | 4 | Stories 4.7, 4.8 |
| FR-19 | Elicitation-first doc creation | 3 | Story 3.2 |
| FR-20 | Generation, versioning & storage | 3 | Stories 3.1, 3.2 |
| FR-21 | PDF export | 3 | Story 3.4 |
| FR-22 | Missing-document detection & teaching | 3 | Stories 3.5, 4.4 |
| FR-23 | Specific, reasoned strategic advice | 1 | Story 1.12 |
| FR-24 | Pattern-detected structural advice | 1 | Story 1.12 |
| FR-25 | Scheduled daily briefing + caching | 4 | Story 4.3 |
| FR-26 | Briefing structure & detection logic | 4 | Story 4.4 |
| FR-27 | Briefing surfaces (panel + on-demand) | 4 | Story 4.5 |
| FR-28 | Zalo OA chat push (primary) | 5 | Stories 5.3, 5.4, 5.5 |
| FR-29 | Email fallback & urgency notification | 5 | Stories 5.2, 5.5 |
| FR-30 | Owner-scoped persistence + activity log | 2 | Story 2.1 |
| FR-31 | Conversational data maintenance | 2 | Stories 2.2, 2.6 |
| FR-32 | Three-mode context-switching layout | 1 | Story 1.1 (shell) + Story 1.2 routing |
| FR-33 | Chat interface essentials | 1 | Story 1.1 |
| FR-34 | Email/password authentication | 0 | Story 0.4 |
| FR-35 | Conversation context management | 1 | Story 1.13 |
| FR-36 | Guided first-run / empty-state | 1 | Story 1.14 |
| FR-37 | Stub lifecycle & de-duplication | 1+2 | Stories 1.7, 2.3 |
| FR-38 | In-app delivery & notification | 5 | Story 5.1 |

**Coverage: 38/38 FRs implemented. 0 FRs uncovered.**

**Stories without FR coverage (enabler stories):** Stories 0.1 (scaffold), 0.2 (schema), 0.3 (RLS), 0.5 (secret custody), 0.6 (auth/service-role boundary), 0.7 (AI-call wrapper), 2.7 (context reconstruction). These are infrastructure/enabler stories that satisfy ADs rather than FRs — this is correct and expected. The epics explicitly note this pattern.

---

## 2. NFR / Architecture-Decision Coverage

Each of the 14 ADs was checked for testable ACs in the stories.

| AD | Binding constraint | Lands in testable AC? | Story/Finding |
|----|--------------------|----------------------|---------------|
| AD-1 Orchestrator paradigm | All AI runs server-side; no client-side Claude calls | YES | Stories 1.2, 2.2 (ACs assert server-side only, no direct client SDK) |
| AD-2 RLS owner-scoping | Every table has `owner_id` + RLS | YES | Stories 0.2, 0.3 (dedicated stories with explicit RLS policy ACs) |
| AD-3 Stateless AI / CRM source of truth | No server-side session; context from CRM | YES | Stories 1.4 (BC injection), 1.13 (context management), 2.7 (reconstruction) |
| AD-4 Model routing | Haiku = routine; Sonnet = DI/vision/strategy/docs | YES | Stories 1.2, 1.8, 1.9, 1.12, 3.2, 4.1, 4.3 (each ACs assert specific model tier) |
| AD-5 Prompt-caching discipline | Stable prefix + `cache_control`; volatile content after | YES (partially — see Finding 2) | Story 0.7 (wrapper enforces this); Stories 1.2, 4.3 also test it. But AD-5 has a gap: no AC on any story asserts that `usage.cache_read_input_tokens > 0` is tested in CI or that caching is **validated** by an automated test — it is logged but only observability-checked in Story 0.7 unit test. |
| AD-6 Degradation envelope | Standard `{status: ok|degraded|error}` envelope | YES | Stories 0.7 (wrapper), 1.6 (UI), 3.6, 4.1, 4.3, 4.5 (all degrade consistently) |
| AD-7 Idempotent scheduler | pg_cron; `UNIQUE(owner_id, date)` for briefings; per-deal dedupe on check-ins | YES | Stories 0.2 (constraint in schema), 4.3, 4.6, 5.5 |
| AD-8 Delivery fallback | In-app authoritative → Zalo best-effort → email guaranteed | YES | Stories 5.1, 5.4, 5.5 — delivery sequence is testable |
| AD-9 Vision pipeline | Image → Storage → extraction once; no re-send | YES | Story 1.9 (ACs explicitly test non-re-send behavior) |
| AD-10 PDPL posture | DPA, CDTIA, privacy notice, retention policy — gating for launch | STATED but NOT in story ACs (see Finding 1) | No story has an AC that a DPA is executed or that a privacy notice appears in the UI. This is correctly framed as a pre-launch gate, but needs a story or acceptance gate artifact. |
| AD-11 Secret custody | Server-side only; no leakage to client | YES | Story 0.5 (bundle inspection AC, env-var audit) |
| AD-12 Context management | Summarize at ~40K tokens; last ~10 turns verbatim | YES | Story 1.13 (summarization divider AC, "Start new topic" AC) |
| AD-13 Auth boundary | No service-role on owner-data paths | YES | Stories 0.4, 0.6 (lint rule + integration test ACs) |
| AD-14 Write integrity | Append-only log; idempotent AI writes; human edits not overwritten | YES | Stories 2.1, 2.5, 3.1, 4.2 (idempotency ACs present) |

**Summary:** 13 of 14 ADs land in testable ACs. AD-10 (PDPL) is correctly deferred but has no story or acceptance-gate artifact that would block launch — see Finding 1. AD-5 has a partial gap (caching is wired but never verified by automated test) — see Finding 2.

---

## 3. Cross-Artifact Consistency

Overall: terminology is consistent across all 6 artifacts. The Glossary is respected. No significant model name, cost figure, or behavior contradictions found. Minor inconsistencies noted:

### 3.1 Model IDs — minor naming drift

- **ARCHITECTURE-SPINE.md** (Seed section) names `claude-haiku-4-5` and `claude-sonnet-4-6` as the exact model IDs.
- **EXPERIENCE.md** and **DESIGN.md** are correctly silent on model names (they address UX behavior, not AI).
- **epics.md** uses "Haiku" and "Sonnet 4.6" throughout story ACs — consistent with the spine's intent but the exact string `claude-haiku-4-5` is never repeated in epics. This is fine because the spine says "Seed — verify exact versions at build"; it is not a contradiction but a deliberate deferral.
- **No contradiction.** Note: `claude-haiku-4-5` does not appear to be a released model ID at the time of writing (current is `claude-haiku-3-5` or `claude-3-5-haiku-20241022`). The spine explicitly warns "verify exact versions at build" — this is a known open item, not a drift.

### 3.2 DESIGN.md vs. EXPERIENCE.md — chat bubble background rule

- **DESIGN.md §7.1** specifies ARIA bubble background as `#141A2E` (surface).
- **EXPERIENCE.md §Chat Message** says ARIA message has "no bubble background (dark theme: text on {colors.bg})."
- These are contradictory: DESIGN.md says ARIA has a `#141A2E` surface background; EXPERIENCE.md says no background. DESIGN.md wins per the explicit conflict-resolution rule in EXPERIENCE.md ("Any conflict... on visual matters: DESIGN.md wins"). The dev agent should implement `#141A2E` background.
- **Finding 4 (medium).** The EXPERIENCE.md line needs correction; Story 1.1 already references DESIGN.md §7.1 correctly (the story AC says `#141A2E`), so the story is unaffected — but this could confuse the dev agent if they read EXPERIENCE.md first.

### 3.3 EXPERIENCE.md ARIA message — "no bubble" vs. DESIGN.md rule

Covered in 3.2 above. Story 1.1 AC references DESIGN.md §7.1 directly, so implementation is unambiguous.

### 3.4 Timestamp display — minor inconsistency

- **DESIGN.md §7.1** says timestamp "appears below bubble on hover or on last message of a sequence. Never inline within the bubble."
- **EXPERIENCE.md §Chat Message** says "always shown below the message... always visible (not only on hover)."
- **Story 1.1 AC** says timestamp is "always visible (not only on hover). (EXPERIENCE.md Chat Message)"
- DESIGN.md says hover-only or last-in-sequence; EXPERIENCE.md says always visible. The story AC sides with EXPERIENCE.md. Given the DESIGN.md conflict-resolution rule applies to visual matters (which this is), DESIGN.md should win. This creates a minor inconsistency between the story AC and DESIGN.md.
- **Finding 5 (low).** Story 1.1 AC should be checked against DESIGN.md §7.1 at implementation. For accessibility (Vietnamese diacritics, dense conversation), always-visible timestamps are arguably better UX.

### 3.5 Zalo messaging-window policy

- **EXPERIENCE.md** (Proactive Notifications §Zalo OA) states a "48h messaging window" — if Owner has not messaged the OA in 48h, delivery fails.
- **PRD §11 / ARCHITECTURE-SPINE.md §OQ-5** correctly labels this as an unvalidated open question. EXPERIENCE.md states "48h" as a fact. If Zalo's policy differs, this could affect design decisions in Stories 5.3–5.5.
- **Finding 6 (medium).** The 48h window figure in EXPERIENCE.md is an assumption stated as fact; the spine's framing as OQ-5 is more honest. The dev agent and Epic 5 implementation should treat 48h as a hypothesis to be validated, not a known constraint.

### 3.6 Glossary usage

All 13 Glossary terms (ARIA, Owner, Client, Deal, Service Type, Stage, Stub, Deal Intelligence, Intelligence Fields, Document, Briefing, Check-in, Business Context, Interaction Mode, Delivery Channel, Guidance stance) are used consistently across all 6 artifacts. No term drift found.

---

## 4. Dependency Soundness

### 4.1 Epic stand-alone analysis

| Epic | Standalone? | Dependencies |
|------|------------|-------------|
| Epic 0 — Foundation | YES — pure infra; no prior epic | None |
| Epic 1 — Consultant Core | YES — uses Epic 0's auth + schema; Epic 1's own stub creation (FR-7) provides basic persistence | Requires Epic 0 complete |
| Epic 2 — CRM & Memory | YES — augments persistence that Epic 1 uses; DI works without FR-8/FR-10 (it just has less data) | Requires Epic 1 complete |
| Epic 3 — Documents | YES — elicitation + generation is self-contained; missing-doc detection in Story 3.5 invokes Briefing flags but this is optional (flags written to `briefings.flags` which Epic 4 owns) | Requires Epics 0–2 complete |
| Epic 4 — Briefing & Proactivity | YES — scheduler and check-ins are self-contained; Story 4.4 (missing-doc detection) calls logic from Story 3.5, which is in Epic 3 | Requires Epics 0–3 complete (for full missing-doc detection) |
| Epic 5 — Delivery Channels | YES — decorates Epic 4's in-app records with external delivery; in-app path (Story 5.1) technically overlaps with Epic 4 since Epic 4 already writes `check_ins` records | Requires Epic 4 complete |

**Critical dependency finding:** Story 3.5 (Missing-document detection) writes flags to `briefings.flags` which is a table owned by Epic 4. Story 3.5 notes: "No separate `document_flags` table is needed in Epic 3 (kept simple; the Briefing epic owns the flag persistence structure)." This means Story 3.5 requires `briefings.flags` (jsonb) to exist, which is created in the Story 0.2 schema (the `briefings` table and its `flags` column are defined in addendum §B.5 and expected by Epic 0). This is fine — the schema exists from Epic 0, not Epic 4. **No epic-ordering issue here.**

**Story 4.4's dependency on Story 3.5:** Story 4.4 states "Missing-document detection" as an AC. Its logic partially re-implements Story 3.5's detection within the briefing context. This creates a potential duplication: the detection logic is described in both Story 3.5 and Story 4.4. Story 3.5 explicitly says "detection is triggered during: daily Briefing generation, a Deal Intelligence read, or any pipeline status query." If Epic 3 (Story 3.5) is built before Epic 4 (Story 4.4), the dev agent may implement detection twice. **Finding 7 (medium).**

### 4.2 Forward-dependency check

No story was found that depends on a future epic to function. The following were verified:
- Story 1.7 (stub creation) works without Epic 2's FR-10 similar-deal matching — stubs are just excluded from matching per FR-37.
- Story 1.14 (first-run) correctly suppresses the Briefing panel and check-ins when CRM is empty — it does not call Epic 4 behavior, it prevents it.
- Story 3.2 (elicitation flow) depends on `get_deal` and `get_client` tools established in Epic 2 (Story 2.2), not a future epic. **Potential issue:** Story 3.2 says "ARIA first calls `get_deal` and `get_client` via the CRM tool surface (AD-1, AD-3)" but the full tool surface is established in Epic 2's Stories 2.2–2.6. Story 3.2 depends on Story 2.2 being complete. This is correctly captured in the epic ordering (Epic 2 before Epic 3) but is not explicitly called out as a dependency in Story 3.2's "Depends on:" field, unlike Story 4.2's explicit dependencies.

### 4.3 Intra-epic dependencies

Stories within epics are ordered correctly. Stories 4.3 → 4.4 → 4.5 → 4.6 → 4.7 → 4.8 have explicit "Depends on:" annotations, as do Stories 5.2, 5.3, 5.4, 5.5. These are correct and well-labeled.

---

## 5. Story Quality for the Dev Agent

### 5.1 Epic 1 spot-check (heaviest epic: 14 stories, 17 FRs)

**Strong stories:** 1.1, 1.2, 1.3, 1.6, 1.8, 1.9, 1.13 — these are excellent. ACs are concrete, testable, and reference specific design tokens, microcopy strings, and AD bindings. Story 1.8 (DI four-layer synthesis) correctly calls out the omission boundary with a testable condition ("two elements are always present: understanding + next action").

**Story 1.4 (Business Context injection):** The AC for the Settings → Business Context edit surface says "saving changes persists the update and logs an activity entry with `actor=user`." This is correct behavior but the story does not specify the route or component for the Settings panel. The Settings panel is defined in EXPERIENCE.md §IA → Settings Panel but is not a dedicated story in Epic 1. The component is partially scaffolded in Story 1.4's ACs (Settings → Business Context sub-panel). The full Settings panel (Notification Channels, Check-in Cadence, Account) spans multiple epics and stories. This is acceptable as an incremental build, but the dev agent will need to understand that the Settings shell grows across epics.

**Story 1.14 (First-run onboarding):** The hardcoded microcopy "Chào Anh Nhan!" is a good concrete testable AC. However, the story hardcodes the personal name "Nhan" — this will need to be replaced with the authenticated user's name from `auth.users` metadata in implementation. The story does not specify where/how the Owner's name is stored for this personalization. Minor but implementation-relevant gap.

**Story 1.10 (Decision-maker tracking + stall diagnosis):** This story combines two distinct behaviors (FR-11 and FR-12) that are conceptually related but functionally distinct. The story is coherent (both trigger from a Deal Intelligence read), but it is the largest single story in Epic 1. For a dev agent, both ACs are clearly bounded by `Given/When/Then` — workable in one context but dense. No split is required; the story can proceed as-is.

**Story 1.12 (Strategy Advisor + cross-deal pattern detection):** FR-24 (pattern-detected structural advice) has only one AC: "A cross-deal pattern (e.g. three consecutive proposal-stage losses) is surfaced proactively." The AC does not define the threshold for pattern detection (PRD says "when more than 3 items qualify" in the Briefing context but FR-24 is about cross-deal pattern matching in conversation). The AC says "crosses a detectable threshold" but does not specify what threshold. **Finding 3 (high).**

### 5.2 Vague or unbounded ACs

The following ACs contain language that does not meet the "concrete and testable" standard:

- **Story 1.5 (Guidance stance), AC 5:** "the response is terse — it does not pad with guidance that was not needed." Testable only via human judgment; no measurable bound. Low severity because SM-C3 is explicitly a counter-metric to watch, not an automated test.
- **Story 1.12 (Strategy Advisor):** "when the pattern crosses a detectable threshold." Not testable. **Finding 3 (high).**
- **Story 4.4 (Briefing "This Week's Focus"):** The section content ("ARIA's single strategic recommendation for the week") has no AC whatsoever in Story 4.4. The section appears in FR-26, EXPERIENCE.md §Briefing Panel, and Story 4.4 output section, but the detection logic, trigger, and content rules for "This Week's Focus" are never specified. Story 4.4's ACs fully cover Today, Pipeline Snapshot, Documents Pending, and Slow-Moving Deals — but "This Week's Focus" is a section listed in FR-26 with no implementing AC. **Finding 8 (high).**
- **Story 2.7 (Intelligence Field persistence across sessions):** All ACs are sound — this is a well-written story. No issues.

### 5.3 Scope — single dev-agent context

All 48 stories are scoped to a single domain and reasonably sized. No story was found that would require two unrelated capabilities in the same PR that have no natural coupling. Epic 1 is dense (14 stories) but each story is a single cohesive unit. The heaviest story by AC count is Story 1.9 (7 ACs for vision pipeline) — all tightly coupled. Acceptable.

---

## 6. Open-Question / Launch-Gate Honesty

### 6.1 Build-start blockers vs. launch gates

| OQ | Framing in spine | Is it actually blocking for BUILD start? |
|----|-----------------|------------------------------------------|
| OQ-5 — Zalo push validation | Architecture resolved (AD-8); operational validation deferred to Epic 5 | **Non-blocking for build start (Epic 0–4).** Blocking for Epic 5 sign-off. Story 5.4 explicitly requires end-to-end Zalo test send as a Definition of Done condition. |
| OQ-6 — Claude API cost at heavy DI+vision | Validate via per-call logging in weeks 1–4 | **Non-blocking for build.** AD-4 + AD-5 are the mitigations; actual cost is empirically validated post-build. |
| OQ-9 — Summarization threshold tuning | "Tuning dial, not a blocking branch point" | **Non-blocking.** Story 1.13 ships defaults (~40K / last 10 turns); tuning is an ongoing calibration. |
| OQ-10 — PDPL go-live items | "Gating items for launch" | **Non-blocking for build, blocking for PRODUCTION LAUNCH.** DPA, CDTIA, privacy notice must exist before users' PII is processed. No story implements the required in-product privacy notice. **Finding 1 (critical).** |
| OQ-11 — Per-DI context budget | Set in AD-5 | **Non-blocking for build.** Implement as a constant; validate empirically. |
| OQ-12 — pg_cron cadences & timezone | Default set (~07:00 ICT) | **Non-blocking.** Default is in the story; configurable. |
| OQ-13 — Zalo OA registration | "Operational prerequisite for Epic 5" | **Non-blocking for Epic 0–4; blocking for Epic 5.** Story 5.3 explicitly blocks on OA registration. Correctly flagged. |

### 6.2 PDPL framing

AD-10 correctly identifies PDPL as a pre-LAUNCH gate, and the spine names the 4 required items (DPA, CDTIA, privacy notice, retention). However, **none of the 48 stories contains an AC that enforces these items.** Specifically:
- The "in-product privacy notice" (required by AD-10 item 3) is never implemented in any story. This notice needs to appear somewhere in the authenticated experience — typically in onboarding or a consent surface — and must state what PII is sent to Anthropic. No story creates this UI element.
- The "retention/delete policy enforced in Postgres + Storage" (AD-10 item 4) appears partially in Story 1.9 (images uploaded to storage with "retention/lifecycle policy") but without a concrete AC defining the lifecycle rule (when are images deleted? on Owner request only? after N days?).

**Finding 1 (critical):** A PDPL story or launch-gate checklist item is missing. The privacy notice and deletion mechanics need at least one story or a defined acceptance gate.

### 6.3 Cost ceiling honesty

The cost model note in the spine is honest: "$15–35/month at solo daily use is achievable **only with AD-5 (caching) + AD-4 (routing) held**." Both are invariants enforced at the story level. The OQ-6/OQ-11 open questions are genuinely non-blocking for build. The cost-observability infrastructure (Story 0.7's token-logging wrapper) is correctly placed in Epic 0 so actual cost is visible from day one of integration testing.

---

## Findings by Dimension

### Dimension 1: FR Traceability
**Judgment: PASS**

- **[low]** Story 3.2's `get_deal`/`get_client` dependency on Epic 2 not annotated (loc: `epics.md`, Story 3.2). All other stories reference their dependencies. *Fix:* Add "Depends on: Story 2.2 (CRM tool surface)" to Story 3.2's header.

---

### Dimension 2: NFR / AD Coverage
**Judgment: PASS-WITH-NOTES**

- **[critical]** AD-10 PDPL — privacy notice and retention lifecycle unimplemented in any story (loc: `ARCHITECTURE-SPINE.md AD-10`; `PRD.md §9.2`). The 4 required pre-launch items are stated in the spine but no story creates the in-product privacy notice UI, and Story 1.9's storage lifecycle has no concrete deletion-schedule AC. *Fix:* Add Story 5.7 (or 0.8) "PDPL Compliance Story — Privacy Notice UI + Storage Retention Policy" with ACs covering: (a) in-product notice shown on first use stating what is sent to Anthropic; (b) Owner-initiated deletion of screenshots from Supabase Storage; (c) configurable retention period wired in Settings → Account. Frame this story as a pre-launch gate.

- **[medium]** AD-5 prompt-caching — wired in Story 0.7's wrapper but never verified by an automated test asserting cache hit rate or token savings; observability is log-only (loc: `epics.md`, Story 0.7 AC). The AC says "`cache_read_input_tokens > 0` is visible via observability" but this is a manual check, not an automated assertion. *Fix:* Add an AC to Story 0.7 (or a new integration test story in Epic 0): "Given `callAI()` is called twice with the same stable prefix within a session, when the second call returns, then `usage.cache_read_input_tokens > 0` is asserted in the test."

---

### Dimension 3: Cross-Artifact Consistency
**Judgment: PASS-WITH-NOTES**

- **[medium]** ARIA chat bubble background contradicts between DESIGN.md and EXPERIENCE.md (loc: `DESIGN.md §7.1` vs `EXPERIENCE.md §Chat Message`). DESIGN.md says `#141A2E` background; EXPERIENCE.md says "no bubble background." Story 1.1 correctly follows DESIGN.md but the contradiction is a developer trap. *Fix:* Correct EXPERIENCE.md §Chat Message to say "ARIA bubble background: `{colors.surface}` (`#141A2E`) per DESIGN.md §7.1."

- **[medium]** Zalo 48h messaging-window stated as fact in EXPERIENCE.md but is an unvalidated assumption per OQ-5 (loc: `EXPERIENCE.md §Proactive Notifications → Zalo OA`). *Fix:* Change to "Zalo messaging-window rule (estimated 48h — validate against current Zalo OA API docs before Epic 5)."

- **[low]** Timestamp visibility rule contradicts between DESIGN.md (hover/last-in-sequence) and EXPERIENCE.md + Story 1.1 (always visible) (loc: `DESIGN.md §7.1` vs `Story 1.1 AC` and `EXPERIENCE.md §Chat Message`). DESIGN.md wins on visual matters. *Fix:* Decide and align: "always visible" is better accessibility practice for dense Vietnamese text; if chosen, update DESIGN.md §7.1 to match.

- **[low]** Model ID `claude-haiku-4-5` in ARCHITECTURE-SPINE.md Seed section is likely an incorrect model ID (loc: `ARCHITECTURE-SPINE.md §Seed`). The spine warns "verify exact versions at build" which mitigates this, but it could mislead a dev agent into using a non-existent model ID. *Fix:* At build start, verify against Anthropic's released model list and update the seed model IDs accordingly. Current released IDs: `claude-3-5-haiku-20241022` and `claude-sonnet-4-5` / `claude-sonnet-4-6`.

---

### Dimension 4: Dependency Soundness
**Judgment: PASS-WITH-NOTES**

- **[medium]** Missing-document detection logic is described in both Story 3.5 and Story 4.4, risking implementation duplication (loc: `epics.md`, Stories 3.5 and 4.4). Story 3.5 says it can be called "during daily Briefing generation" (which is an Epic 4 concern). Story 4.4 then re-implements the same detection rules. *Fix:* Clarify in Story 3.5 that the detection **function** lives in a shared `lib/` service (e.g., `lib/detection/missing-docs.ts`) invoked by both Epic 3 conversation paths and Epic 4 briefing generation — one implementation, two callers.

- **[low]** Story 3.2's implicit dependency on Epic 2's CRM tool surface not annotated (loc: `epics.md`, Story 3.2 header). Not a blocking issue since Epic ordering is correct. *Fix:* Add annotation (see Dimension 1 finding above).

---

### Dimension 5: Story Quality
**Judgment: PASS-WITH-CONDITIONS**

- **[high]** FR-24 (pattern-detected structural advice) in Story 1.12 has a vague, untestable AC: "when the pattern crosses a detectable threshold" — no threshold defined (loc: `epics.md`, Story 1.12 AC 3). A dev agent cannot implement this without a concrete rule. *Fix:* Define a testable threshold, e.g., "ARIA surfaces a cross-deal pattern when: ≥ 3 deals of the same service_type have `predicted_outcome = likely_lost` or stage reached `proposal_stage` without advancing in the last 60 days, AND at least 2 of the 3 share a common `risk_flag.type`." This can be refined, but must be a specific rule, not "a detectable threshold."

- **[high]** "This Week's Focus" section in Briefing (FR-26) has no AC in Story 4.4 (loc: `epics.md`, Story 4.4). The section is listed in the output structure but its generation logic, trigger criteria, and content rules are completely unspecified. A dev agent has no guidance on what ARIA should output here. *Fix:* Add an AC to Story 4.4: "Given the briefing is generated, when the AI compiles the 'This Week's Focus' section, then it contains a single strategic recommendation derived from: the pattern of deals in the pipeline (e.g., 'Two automation deals are stalled at proposal — prioritize follow-up on higher-value one'), OR the next logical step in the most advanced deal. If no strategic insight is derivable, the section renders 'Không có trọng tâm cụ thể tuần này / Nothing to note this week.'"

- **[medium]** Story 1.14 hardcodes Owner's name as "Anh Nhan" in the microcopy AC without specifying how the name is resolved from `auth.users` metadata (loc: `epics.md`, Story 1.14 AC 1). *Fix:* Add: "The name 'Nhan' in the welcome message is populated from the Owner's account name field in `auth.users.user_metadata`; if not set, defaults to 'Anh' (Vietnamese) / 'you' (English)."

- **[low]** Story 1.5 (guidance stance enforcement) has an untestable AC: "the response is terse — it does not pad." This is a calibration concern (SM-C3) that can only be judged by human review, not an automated test. This is acceptable as-is — it is appropriate for SM-C3 to be a human-judged quality bar, not a CI check.

---

### Dimension 6: Open-Question / Launch-Gate Honesty
**Judgment: PASS-WITH-CONDITIONS**

- **[critical] Finding 1 (repeated from Dimension 2):** No story implements the PDPL privacy notice or storage retention mechanics required by AD-10 for production launch. OQ-10 correctly flags these as gating, but they are invisible to the dev agent because no story carries them. *Fix:* Add Story 5.7 "PDPL Compliance — Privacy Notice and Data Lifecycle" before Epic 5 is marked complete. Frame as a pre-launch gate in the story's Definition of Done.

- **[medium]** OQ-5 and OQ-13 (Zalo OA push validation and OA registration) are correctly identified as blocking for Epic 5 but not for Epics 0–4. Story 5.3 and Story 5.4 both have explicit "this story requires OA registration" language in their implementation notes and Definition of Done. The risk is that a dev agent might start Story 5.3 before OQ-13 is resolved and block the sprint. *Fix:* Add "Pre-condition: OQ-13 resolved (Zalo OA app_id obtained)" to Story 5.3's "Depends on" line — it is currently only in the implementation notes.

- **[low]** OQ-11 (per-DI-call context budget) is noted as an open question but Story 1.8 ships without a default value for the context budget. The story says "the per-DI-call context budget defined in AD-5/OQ-11 is respected" but no default is given. AD-5 sets the overall 40K token threshold (Story 1.13), but there is no per-DI sub-budget. *Fix:* Pick a reasonable default (e.g., 8K tokens for the DI call context: business context 2K + client 1K + deal 2K + similar deals 2K + system overhead 1K) and document it in Story 1.8 or AD-5's AC in Story 0.7. Treat as a configurable constant to be tuned per OQ-11.

---

## Conditions to Clear Before Build Start

These are the conditions that must be resolved before the first story is developed. They are ranked by urgency.

### Pre-build conditions (must resolve before Epic 0 begins)

1. **Verify model IDs at build start.** Confirm `claude-haiku-4-5` and `claude-sonnet-4-6` are valid released model IDs on Anthropic's API at the time of implementation. Update ARCHITECTURE-SPINE.md Seed section with confirmed IDs. (ARCHITECTURE-SPINE.md §Seed; low risk but would cause immediate build failure if wrong.)

### Pre-Epic-1 conditions (resolve before Epic 1 story writing is final)

2. **Define FR-24 pattern threshold (Story 1.12 critical gap).** Add a concrete, testable trigger condition for cross-deal pattern detection. (epics.md, Story 1.12)

3. **Define "This Week's Focus" generation logic (Story 4.4 critical gap).** Add ACs specifying what ARIA outputs for this briefing section. Can be done before Epic 4 is built, not before Epic 1. (epics.md, Story 4.4)

### Pre-Epic-5 conditions (Zalo operational prerequisites)

4. **Resolve OQ-13 — Zalo OA registration** before starting Epic 5. Add "Pre-condition: OQ-13 resolved" to Story 5.3's header. (epics.md, Story 5.3)

5. **Validate OQ-5 — Zalo 48h messaging window** against current Zalo OA API documentation before Story 5.4 is implemented. Correct the factual claim in EXPERIENCE.md §Proactive Notifications. (EXPERIENCE.md)

### Pre-LAUNCH conditions (not pre-build, but must not ship without)

6. **Add PDPL compliance story** (Story 5.7 or 0.8) covering: in-product privacy notice, Owner-initiated screenshot deletion, configurable storage retention. Frame as a launch gate. (AD-10, OQ-10; no story currently implements these items.)

7. **Resolve OQ-10 — PDPL full posture** (DPA with Anthropic, CDTIA filing, privacy notice, retention policy) before any real user PII is processed in production. (ARCHITECTURE-SPINE.md AD-10; PRD §9.2)

---

## Summary Scorecard

| Dimension | Judgment | Critical | High | Medium | Low |
|-----------|----------|---------|------|--------|-----|
| FR Traceability | PASS | 0 | 0 | 0 | 1 |
| NFR / AD Coverage | PASS-WITH-NOTES | 1 | 0 | 1 | 0 |
| Cross-Artifact Consistency | PASS-WITH-NOTES | 0 | 0 | 2 | 2 |
| Dependency Soundness | PASS-WITH-NOTES | 0 | 0 | 1 | 1 |
| Story Quality | PASS-WITH-CONDITIONS | 0 | 2 | 1 | 1 |
| OQ / Launch-Gate Honesty | PASS-WITH-CONDITIONS | 1 | 0 | 1 | 1 |
| **TOTAL** | | **2** | **2** | **6** | **6** |

**FRs covered: 38/38. FRs uncovered: 0.**
**Stories without FR link (infrastructure/enabler): 7 (correct and expected).**
**ADs with testable ACs: 13/14. AD without story-level AC: AD-10 (PDPL — correctly deferred but needs a story).**

---

*Report generated by Claude Code (PM Implementation-Readiness Mode) — 2026-06-25.*
*All file references use absolute paths relative to `C:/Nhan/ARIA/_bmad-output/planning-artifacts/`.*
