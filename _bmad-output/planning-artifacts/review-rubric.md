# PRD Quality Review — ARIA (v2.0)

Reviewer: rubric-walker subagent
Date: 2026-06-25
PRD reviewed: `PRD.md` v2.0 + `addendum.md`
Rubric: `prd-validation-checklist.md`
Stakes calibration: chain-top PRD for a single-operator internal tool (v1) with product ambition; feeds UX → architecture → epics/stories. Done-ness clarity and downstream usability judged hard; UJ density acceptable for the complex deal-intelligence flows.

---

## Overall verdict

This is a well-above-average PRD for its class. The vision is earned by domain research, the thesis is crisp and coherent, the glossary is tight, and the FR consequence blocks are mostly testable. Two specific gaps matter for downstream build: (1) seven FRs have consequences that are conditions ("ARIA asks no more than 3 questions") rather than observable outputs, leaving QA and story-writing to invent acceptance criteria; and (2) the Briefing and Proactivity section (§4.7/§4.4) contains the system's most complex scheduling logic but the least done-ness specificity. Neither is a blocker on its own, but together they represent the highest risk to story-creation accuracy downstream.

---

## 1. Decision-readiness — strong

The PRD names its decisions as decisions, not considerations. "Phases are discarded as build units" (§6) is a clean reversal with a reason. The `owner_id`/RLS seam (§9.4) is called "the single decision deemed expensive to reverse" — explicit and auditable. The Zalo constraint (§11) is stated plainly with its consequence (OA chat, not ZNS) and the fallback is named. Non-Goals (§5) do real work: "Not autonomous — all outbound is Owner-approved" closes a real ambiguity.

Open Questions are genuinely open: OQ-5 (Zalo OA to owner-as-follower feasibility) and OQ-6 (cost band at single-user scale) name unknowns that could flip a design decision. The `[NOTE FOR PM]` on multi-user access (§6.2) is honest about a deferred tension rather than papering it over.

One minor gap: the Zalo-as-primary vs. email-as-backbone tension is resolved differently in PRD §4.8 ("Zalo OA is **primary**") and addendum §F ("Use email as the architected backbone/fallback; never let Zalo be a single point of failure"). This contradiction is not flagged in either document — it is a decision that has been made in two different ways.

### Findings

- **medium** Zalo primary/email primary contradiction (§4.8 vs addendum §F) — PRD §4.8 declares Zalo OA as "the primary channel"; addendum §F states "email is the architected backbone/fallback" and "never let Zalo be a single point of failure." These are not the same architecture. Since OQ-5 is still open, the email-as-backbone position appears to reflect the architect's hedge but is not reflected in the PRD requirements text. *Fix:* Add a `[NOTE FOR PM]` in §4.8 acknowledging that if OQ-5 resolves unfavorably, email becomes primary and §4.8/FR-28 must be revised; or align both documents to "email primary, Zalo preferred."

---

## 2. Substance over theater — strong

The personas are earned and minimal: one primary user with a named JTBD list grounded in the founder's actual practice pattern; a Non-Users section that explicitly excludes team members and clients rather than padding headcount. There are no phantom personas.

The vision (§1) is product-specific. "You never open the CRM, draft from a blank page, or chase your own pipeline" would not fit an ERP, a marketing tool, or a team collaboration product — it is load-bearing for ARIA specifically. The market research validation (conversation-first + Zalo-native is "genuinely unoccupied") is cited to a grounded competitive survey, not asserted.

NFRs (§8) are product-specific rather than template boilerplate: "target monthly spend band ~$15–35 at daily active use," "first-token <~3s," "long responses collapse after ~400 chars," "never cache document content." The model routing table in addendum §D gives concrete tier assignments per task. No generic "system must be secure and scalable" in sight.

The counter-metrics (§7) are the clearest signal of non-theater thinking in this document: SM-C1 (don't maximize message volume), SM-C2 (don't maximize document count), SM-C3 (don't over-explain to the expert) each directly counterbalance a primary SM, naming the failure mode the team must not be fooled by.

No findings.

---

## 3. Strategic coherence — strong

The thesis is explicit and consistent: *depth in a specific vertical, with structured persistence, is the moat that a generic Claude wrapper cannot cross.* This thesis drives every scope decision: why multi-tenancy is deferred (§12.2), why RAG is deferred (§6.2), why the guidance stance exists (FR-3), why Deal Intelligence is the "crown jewel" and must always run on the highest model tier (§4.2 + addendum §D), why the `owner_id` seam is called "load-bearing" (§9.4).

Feature prioritization follows the thesis. Epics 0–5 are sequenced by dependency, not by what's easy — the Consultant Core (Epic 1) is the entire point; Foundation (Epic 0) exists only to enable it. The MVP scope does not defer the hard parts.

Success metrics validate the thesis, not activity: SM-1 (daily reliance, not daily active users), SM-2 (Deal Intelligence *trust* rating, not just invocations). The primary metric is explicitly framed as "the real test: does it earn daily use?" — not a vanity metric.

One minor coherence gap: §4.6 Strategy Advisor (FR-23/FR-24) sits in MVP (Epic 1) but has only two FRs and very little structural specificity compared to the Deal Intelligence Engine it is grouped with. Given that "structural pattern detection" (FR-24) requires multi-deal history that will not exist at launch, this FR is coherent in isolation but may be inert for months.

### Findings

- **low** FR-24 structural advice requires deal history that won't exist at launch (§4.6) — FR-24 fires when ARIA detects cross-deal patterns ("all recent losses at proposal stage"). A fresh CRM has no patterns to detect. This FR is well-defined but will be effectively dormant for the first 6–12 months. *Fix:* Add `[NOTE FOR PM: FR-24 requires sufficient deal history to surface patterns; expected to be inactive until 10+ closed deals are logged.]` to manage expectations and prevent story-writers from over-specifying the implementation.

---

## 4. Done-ness clarity — adequate

This is the hardest rubric dimension for this PRD, and the calibration instruction says to judge it hard. The FR consequence blocks are a genuine structural strength — most FRs have at least two testable consequences stated as observable conditions. But "testable" is not uniform across FRs; several fall into the "system does X well" class rather than verifiable output conditions.

**Where the consequences pattern is strong:**
- FR-7 (stub creation): "A new client/deal mentioned in conversation results in a persisted Stub linked correctly (deal → client). ARIA confirms creation in its reply and asks no more than 2 gap-filling questions per turn." Both consequences are observable.
- FR-16 (stale-deal flagging): "A deal idle > 7 days appears in the Briefing and is raised in conversation when relevant." Time-bound and observable.
- FR-20 (document versioning): "Naming follows `{ClientName}_{DocumentType}_{YYYY-MM-DD}_v{N}`." Concrete enough for a story acceptance test.
- FR-21 (PDF export): "PDF export produces a downloadable, styled file and does not require an AI call." The no-AI-call condition is particularly useful for the architecture.

**Where the consequences pattern is weak:**

FR-1 (intent classification): The three bullet consequences are correct but the most important one — "An ambiguous message is met with a clarifying question, not a guess" — lacks any criterion for what constitutes an ambiguous message or what a correct clarification looks like. A story writer cannot implement a test for this. The classification routes are named but the classification logic is undefined.

FR-3 (guidance stance enforcement): "A recommendation is always accompanied by *why* (the principle or evidence behind it)" is a content quality criterion, not a testable output. Story writing will need to reduce this to a prompt-review heuristic, which should be stated in the PRD rather than left to story-writers to invent.

FR-6 (four-layer synthesis): The structured shape is named (understanding / real need / risk flags / opportunity signals / prediction / recommended approach / documents needed / next action) and "omitting sections judgment says don't apply" is added. This last clause is not testable — no boundary condition for when omission is correct vs. incorrect. For the system's crown jewel feature, this needs a sharper specification.

FR-12 (stall diagnosis): "A stalled deal's read names a probable cause and incorporates Client industry + seasonal context" is a quality condition. "Stalled deal" is undefined in this FR (7 days? configured threshold? implicit from FR-16's 7-day definition?). The two FRs use the same concept without cross-referencing.

FR-17/FR-18 (check-ins): The consequences describe what a check-in contains and when it fires, but the definition of "deals that warrant it" (FR-17: "active, recently quiet, or approaching a due action") is entirely subjective. Neither FR defines the triggering criteria precisely enough for a scheduler implementation to be story-written from the PRD alone.

FR-25/FR-26 (briefing generation): FR-25 says "Briefing is generated once and served from cache"; FR-26 says max 3 items in "Today." But neither FR specifies the priority/ranking logic for those 3 items when more than 3 are actionable. The ranking algorithm is a design decision downstream teams will have to invent, which means they may invent it differently from what the PM intends.

FR-3's "challenges the Owner when it detects an obvious mistake about to happen" — "obvious mistake" is undefined and untestable.

### Findings

- **high** FR-6 four-layer synthesis "omitting sections judgment says don't apply" has no testable boundary (§4.2) — The crown jewel FR's output shape is specified, but the condition under which a section is correctly omitted is left entirely to runtime judgment. Story writers cannot write acceptance criteria for this omission behavior; architects cannot specify it without making a design assumption. *Fix:* Add a minimum output rule: for a *new* deal with no history, at minimum [understanding + real need + next action] must always appear; optional sections are [pattern match, signals, prediction] which require prior deal data. This bounds the behavior without over-constraining it.

- **high** FR-17/FR-18 check-in trigger criteria are subjective and insufficient for scheduler story-writing (§4.4) — "Active, recently quiet, or approaching a due action" cannot be converted to a scheduler implementation without inventing thresholds. The 7-day staleness rule in FR-16 implies a cross-FR dependency that is not stated. The check-in and stale-deal subsystems will be built by different stories if trigger criteria are not aligned in the PRD. *Fix:* Add explicit trigger criteria: "(a) deal is in an active stage AND has no owner-logged activity for N days (default N=5, configurable per FR-18); (b) deal has a `next_action_due` date that is <= tomorrow; (c) deal is at 'Proposal sent' stage and exceeds proposal-follow-up cadence threshold (FR-16 default 3 days)." Cross-reference FR-16.

- **medium** FR-3 guidance stance consequence is a content quality criterion, not a testable output (§4.1) — "A recommendation is always accompanied by *why*" cannot be verified by a test runner or story acceptance check without a human reviewer. For an enforcement FR (FR-3 is called "Guidance stance *enforcement*"), this is a weaker specification than the surrounding FRs. *Fix:* Restate as a structural rule: "Every response in Advice or Deal Intelligence mode ends with a block containing [recommendation] and [reasoning]; if no recommendation applies, ARIA states 'No action required at this stage' with a reason." This makes the output structure verifiable even if the content quality requires human review.

- **medium** FR-26 briefing ranking logic for "Today" max-3 items is absent (§4.7) — When 5+ items are actionable on a given morning, the PRD does not specify the ranking that selects the top 3. Story writers will invent a ranking algorithm; it may differ from the PM's intent. *Fix:* Add a priority rule: "Items are ranked by: (1) overdue actions / past-due documents first; (2) highest-value active deals; (3) deals with no owner activity for the longest period. Ties broken by deal value estimate."

- **medium** FR-12 "stalled deal" is undefined in this FR and uses a different implicit threshold than FR-16 (§4.2) — FR-12 fires on a deal that "goes quiet" but the quiet threshold is not stated. FR-16 defines stale as >7 days. If these are the same trigger, say so. If stall diagnosis (FR-12) fires on a different threshold, specify it. *Fix:* Cross-reference FR-16's 7-day threshold explicitly in FR-12, or state a separate threshold if the intent differs.

- **low** FR-1 "ambiguous message" condition is undefined (§4.1) — The classification consequence "An ambiguous message is met with a clarifying question" has no criterion for what makes a message ambiguous. This is acceptable for a PRD (the orchestrator prompt is the right place to define this), but a `[NOTE FOR ARCHITECT: define ambiguity heuristics in orchestrator spec]` would prevent this becoming an implicit assumption. *Fix:* Add the note.

---

## 5. Scope honesty — strong

The Non-Goals section (§5) does real work — each entry is specific ("Not an accounting system — no P&L, no tax handling. Invoices as Documents only") and several close real ambiguities that could otherwise be silently assumed (the "not autonomous" entry directly prevents a scope creep that a developer might otherwise attempt).

The MVP cut (§6) is explicit: phases are discarded as build units and a clean Epic list is substituted. Out-of-scope items (§6.2) are named with brief rationale and, where emotionally loaded, flagged: the `[NOTE FOR PM]` on multi-user access ("emotionally load-bearing if Nhan adds contractors sooner than expected") is honest about a real tension.

`[ASSUMPTION]` tags are present throughout and indexed in §14. The index round-trip is near-complete (see Mechanical notes). Eight Open Questions are genuinely open — none has its answer buried in the next sentence.

The addendum correctly scoped as "input for architecture, not requirements contract" prevents a common confusion about what the PRD actually commits to.

One gap: the scope of "similar-deal pattern matching" (FR-10) in the context of an empty CRM at launch is not called out in either scope or assumptions. This is a related gap to FR-24 (noted under §3), but FR-10's consequence ("matched deals' outcomes/objections inform the read when present") uses "when present" as a quiet escape valve rather than a `[NOTE FOR PM]`.

### Findings

- **low** FR-10 silent "when present" scope escape is not tagged (§4.2) — "When present" is doing the work of a `[NOTE FOR MVP: pattern matching has no effect until similar historical deals exist in the CRM; expect FR-10 to be inert for the first weeks/months of use]`. This is an omission that could surprise a story writer or QA engineer who tests FR-10 on a fresh database and finds it always returns empty. *Fix:* Add inline `[NOTE FOR PM: FR-10 and FR-6 layer 2 have no effect on an empty CRM; seed deals may need to be entered manually before pattern matching is meaningful]`.

---

## 6. Downstream usability — adequate

The glossary (§3) is genuinely useful: 15 terms, each defined with enough precision to be used verbatim across FRs, UJs, and addendum. "Stub," "Intelligence Fields," "Interaction Mode," "Guidance stance" — these are product-specific terms that would otherwise drift. The definition of "Stage" as "free-text, interpreted contextually by ARIA per Service Type (not a rigid enum)" is an active constraint that prevents an architect from enum-ifying it.

UJ structure is strong: each has a named protagonist (Nhan in all five — appropriate for a single-operator tool), an entry state, an edge case, and a resolution that names the FR it realizes. The UJ cross-references to FRs (UJ-2 "Realizes §4.2 of the Deal Intelligence Engine") are navigable. The Briefing panel → Chat handoff described in UJ-1 is specific enough for a UX designer to wire up.

ID continuity is clean: FR-1 through FR-34 are contiguous with no gaps. UJ-1 through UJ-5 are contiguous. SM-1 through SM-6 plus SM-C1 through SM-C3 are contiguous.

The main downstream usability gap is at the boundary between PRD and addendum. The PRD correctly separates "what" from "how," but several FRs rely on addendum detail for their implementation context without explicitly calling this out. Examples:

- FR-9 (vision input) says "vision tasks are routed to a vision-capable, high-judgment model" but the routing table lives only in addendum §D. An architect reading only the PRD would not know the routing table exists.
- FR-22 (missing-document detection) says "a deal past 'Proposal sent' with no proposal Document triggers a flag" but the document-type-to-stage mapping is carried only in addendum §E. The detection logic requires this mapping.
- FR-17/FR-18 (check-ins) reference addendum §B.6 (check_ins table) implicitly but not explicitly.

These are cross-reference gaps rather than missing content — the content exists in the addendum. But because the PRD does not point to addendum sections from within FRs, a UX designer or story writer reading the PRD in isolation will not know these dependencies exist.

A smaller gap: the §3 Glossary defines "Delivery Channel" as "where ARIA pushes proactive content: Zalo OA chat (primary), email (fallback), in-app" — but "in-app" is not referenced in FR-28 or FR-29, which cover only Zalo and email. In-app is referenced in FR-17 ("delivered via the configured Delivery Channel (in-app + Zalo OA)") and in UJ-3 ("ARIA messages him (in-app, and via Zalo OA)"). The in-app notification mechanism is implied but has no FR of its own.

### Findings

- **high** In-app notification channel has no FR and is inconsistently defined (§3, §4.4, §4.8) — The Glossary and UJ-3 include "in-app" as a Delivery Channel, but §4.8 covers only Zalo OA (FR-28) and email (FR-29). FR-17 mentions "in-app + Zalo OA" as the delivery method for check-ins. FR-29 mentions "in-app notification badge" for high-urgency items. There is no FR specifying what in-app notification means, when it fires, and how it relates to the Briefing panel. Story writers will encounter this and either ignore it or invent an implementation. *Fix:* Add FR-29a (or extend FR-29) to specify: "High-urgency Briefing items produce an in-app notification badge visible from the Chat view; the badge is dismissed on Briefing panel open. Tapping the badge opens the Briefing panel. This is distinct from Zalo/email push — it is a UI state only." Alternatively, if in-app notification is just the Briefing panel badge described in FR-27, cross-reference explicitly.

- **medium** Addendum dependencies not called out from FRs (§4.2 FR-9, §4.5 FR-22, §4.4 FR-17) — Architects and story writers reading the PRD without the addendum will miss the routing table (§D), document template/stage mapping (§E), and check_ins schema (§B.6). *Fix:* Add "See addendum §D for routing table" in FR-9, "See addendum §E for document-type-to-stage mapping" in FR-22, and "See addendum §B.6 for check_ins schema" in FR-17. One line per FR.

- **low** "In this stage" in FR-3 counter-metric (SM-C3 §7) references guidance stance behavior that should carry a Glossary cross-reference — SM-C3 references "the guidance stance" which is Glossary-defined (✓), but FR-3 calls the behavior "Guidance stance enforcement" which is not the Glossary term ("guidance stance" vs "Guidance stance"). Minor drift; see Mechanical notes.

---

## 7. Shape fit — strong

This is a chain-top PRD for a single-operator internal tool with later product ambition. The rubric notes that for this shape, UJ density is acceptable when deal-intelligence flows are complex — and they are. The five UJs each cover a genuinely distinct interaction pattern, are not interchangeable, and each resolves a different group of FRs. They are not overhead.

The FR consequence-block structure is well-matched to the engineering-handoff purpose: each FR has an identity, a behavioral description, and consequences that can anchor story acceptance criteria. This is the right level of formalism for a tool that feeds epics and stories.

The assumptions and open questions density is appropriate: 8 OQs and ~8 indexed assumptions on a PRD of this scope is not high — and the OQs are genuinely unresolved (no answers hidden in footnotes). The `[ASSUMPTION]` discipline (inline + indexed) is cleaner than most PRDs at this stage.

The vision is proportional: §1 states the product's bet in concrete behavioral terms without drifting into brand copy. §12's "Why Now" and "Future Direction" serve a real purpose — the market timing argument is specific (39% CAGR, 65% SME AI adoption, domestic incumbents without conversational AI) and the North Star is bounded ("not v1 scope").

One shape-fit comment: the PRD has §10 Aesthetic & Tone, which is explicitly deferred to the UX step. For a chain-top PRD, this section is appropriate as a placeholder, but the consultant voice specification (advisory tone vs. client-facing tone, bilingual rules) is load-bearing for the AI prompt engineering work in Epic 1. It is correctly placed here even though the visual direction is deferred.

No findings on shape fit.

---

## Mechanical notes

**Glossary drift:**
- "Guidance stance" (Glossary §3) vs. "Guidance stance enforcement" (FR-3 header) — minor case/wording drift, no downstream impact unless the architect uses the header term as a concept name.
- §3 defines "Delivery Channel" to include "in-app" but this is not reflected in §4.8's two FRs. Not drift exactly — a missing FR (flagged above as high).
- "Service Type" is capitalized consistently in the Glossary and most FRs (✓). "service type" (lowercase) appears in addendum §B.2 field description — minor.

**ID continuity:**
- FR-1 through FR-34: contiguous, no gaps, no duplicates. (✓)
- UJ-1 through UJ-5: contiguous. (✓)
- SM-1 through SM-6, SM-C1 through SM-C3: contiguous. (✓)
- OQ-1 through OQ-8: contiguous. (✓)
- Epic 0 through Epic 5: contiguous. (✓)

**Assumptions Index roundtrip:**
- §14 indexes 8 assumptions. Cross-checking against inline `[ASSUMPTION]` tags:
  - §2.1/2.2 → §14 line 1 ✓
  - §4.5 FR-21 (branding) → §14 line 2 ✓
  - §4.9 FR-31 (manual edit surface) → §14 line 3 ✓
  - §4.11 FR-34 (Google OAuth) → §14 line 4 ✓
  - §4.2 FR-13 (pricing benchmarks) → §14 line 5 ✓
  - §8 (latency target, cost band, bilingual quality) → §14 line 6 ✓
  - §9.2 (screenshot retention) → §14 line 7 ✓
  - §10 (visual direction) → §14 line 8 ✓
  - All 8 inline tags have a corresponding §14 entry. (✓)
  - §8 bundles three assumptions under one §14 entry (latency, cost, bilingual quality) — minor; these could be disaggregated for traceability, but not a blocker.

**UJ protagonist naming:**
- All five UJs name Nhan explicitly with inline persona context. (✓)

**Cross-reference resolution:**
- FR-32/FR-33 referenced in §6.1 Epic 1 as "Chat shell (FR-32–FR-33)" — resolves correctly.
- FR-8, FR-10 referenced in §6.1 Epic 2 — resolve correctly.
- UJ cross-references to §4.x subsections are navigable but not to specific FR IDs (e.g., UJ-2 says "Realizes §4.2 of the Deal Intelligence Engine" rather than "Realizes FR-6–FR-13"). This is acceptable at this formalization level but could be tightened if story-writers need precise FR traceability from UJs.
- "See §12" and "§12.2" referenced from §2.2 and §1 — resolve correctly.

**One unindexed inference:** §6.2 states "RAG over a document library (pgvector/LlamaIndex) — defer until document volume justifies it." This is a deferral decision with an implicit assumption (document volume will not justify RAG at launch) that is not tagged `[ASSUMPTION]`. Low severity — it is in the Out of Scope section, which is itself a form of tagging — but for strict roundtrip completeness it should carry a tag.
