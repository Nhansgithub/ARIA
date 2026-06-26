---
story: 1.5
epic: 1
status: done
baseline_commit: a1781a10556b927da6d4d578a4a9d9bc1ed66bb9
---

# Story 1.5: Guidance Stance Enforcement

## Story

As an Owner, I want every piece of advice or Deal Intelligence response from ARIA to explain the reasoning behind it and end with a concrete recommended next step, so that I learn business principles and always know what to do next, even when I have no prior business background.

---

## Acceptance Criteria

**AC-1: Advisory responses name a recommendation + principle + next step**

**Given** the Owner asks an Advice-mode question (e.g., "Should I lower my rates?"),
**When** ARIA responds,
**Then** the response names a specific recommendation (not just options), states the principle or evidence behind it, and ends with a concrete next step. (FR-3; §4.6)

**AC-2: Deal Intelligence responses reason out loud + single next action**

**Given** the Owner asks a Deal Intelligence question about a specific deal,
**When** ARIA responds,
**Then** the response explains its reasoning out loud ("Based on your last 3 F&B deals…" / "From the domain pattern…") and ends with a single recommended next action. (FR-3; FR-6)

**AC-3: Counterproductive plans are challenged directly**

**Given** the Owner states a plan that ARIA detects is likely counterproductive (e.g., discounting a deal where the real objection is a trust gap),
**When** ARIA responds,
**Then** ARIA challenges the plan directly, names the actual issue, and explains the principle at stake — it does not silently accept the flawed premise. (FR-3; addendum §G)

**AC-4: Info-only signal respected — no unsolicited next step**

**Given** the Owner explicitly signals they only want information (e.g., "Just tell me the deal status, no advice"),
**When** ARIA responds,
**Then** the response provides the information concisely without appending a next-step recommendation. (FR-3; SM-C3)

**AC-5: Query mode is terse — no unrequested guidance padding**

**Given** any advisory response in Query mode (pipeline status, field lookup),
**When** rendered,
**Then** the response is terse — it does not pad with guidance that was not needed; over-explanation is a failure mode. (FR-3; SM-C3; §8)

---

## Tasks / Subtasks

- [x] **Task 1: Enrich `deal_intelligence` specialist prompt in `lib/ai/orchestrator.ts`** (AC-2, AC-3, AC-4)
  - [x] Add `GUIDANCE STANCE` block: reason out loud, name real issue, single concrete next action
  - [x] Add info-only override instruction (AC-4)
  - [x] Add `DOMAIN HEURISTICS` block: trust/approval gap for price objections, F&B patterns, decision-maker probe, deposit norms
  - [x] Preserve existing `${BILINGUAL_REGISTER}` interpolation at end of prompt

- [x] **Task 2: Enrich `strategy` specialist prompt in `lib/ai/orchestrator.ts`** (AC-1, AC-3, AC-4)
  - [x] Add `GUIDANCE STANCE` block: single named recommendation (not options list), evidence-backed, challenge counterproductive plans directly, concrete next step
  - [x] Add info-only override instruction (AC-4)
  - [x] Add `DOMAIN HEURISTICS` block: pricing floor 20M VND, deposit norms, industry reads (F&B/retail/professional services), agency failure modes
  - [x] Preserve existing no-filler and `${BILINGUAL_REGISTER}` lines

- [x] **Task 3: Update `crm_action` specialist prompt** (AC-4, AC-5)
  - [x] Add explicit terse-for-lookups rule: "answer the question and stop; do not append strategic guidance unless explicitly asked"
  - [x] Preserve existing 2-question max for new entries and `${BILINGUAL_REGISTER}`

- [x] **Task 4: Minor update to `general_chat` prompt** (AC-5)
  - [x] Add: "Do not pad responses with unsolicited advice or strategic guidance."
  - [x] Preserve existing redirect and `${BILINGUAL_REGISTER}` lines

- [x] **Task 5: Update `lib/__tests__/orchestrator.test.ts` — inline enriched prompts + add E-series stance tests** (all ACs)
  - [x] Replace the placeholder strings in the inlined `SPECIALIST_SYSTEM_PROMPTS` object (lines 54-59) with the full enriched prompt text (matching `orchestrator.ts` exactly)
  - [x] Add E1 — `deal_intelligence` prompt contains "Reason out loud" (AC-2)
  - [x] Add E2 — `deal_intelligence` prompt contains "exactly one concrete next action" (AC-2)
  - [x] Add E3 — `deal_intelligence` prompt contains "trust or approval gap" (AC-3, domain heuristic)
  - [x] Add E4 — `deal_intelligence` prompt contains info-only keyword (AC-4): check for "only want information" or "no advice" or "just tell me"
  - [x] Add E5 — `strategy` prompt contains "one specific recommendation" (AC-1)
  - [x] Add E6 — `strategy` prompt contains "Challenge counterproductive" (AC-3)
  - [x] Add E7 — `strategy` prompt contains "concrete next step" (AC-1)
  - [x] Add E8 — `strategy` prompt contains "20M VND" (domain heuristics pricing floor)
  - [x] Add E9 — `crm_action` prompt contains "no unrequested advice" or "no padding" (AC-5)
  - [x] Add E10 — `crm_action` prompt contains info-only instruction: "answer the question and stop" (AC-4)

- [x] **Task 6: CI triad** (all ACs)
  - [x] `npm run test` — all tests pass (47 existing + new E-series tests)
  - [x] `npm run lint` — no warnings
  - [x] `npm run format:check` — no formatting issues
  - [x] `npm run build` — Next.js build succeeds

### Review Findings

- [x] [Review][Defer] D1 prompt length guard (`> 10` chars) is a trivially weak sentinel [lib/__tests__/orchestrator.test.ts:201] — deferred, pre-existing
- [x] [Review][Defer] E4 multi-OR assertion creates false-positive risk if primary phrase is removed but another OR branch remains [lib/__tests__/orchestrator.test.ts:225] — deferred, pre-existing design choice
- [x] [Review][Defer] E9 multi-OR assertion has same false-positive risk as E4 [lib/__tests__/orchestrator.test.ts:261] — deferred, pre-existing design choice
- [x] [Review][Defer] ARIA_MODELS model ID constants in test can silently desync from lib/ai/models.ts [lib/__tests__/orchestrator.test.ts:12] — deferred, pre-existing

---

## Dev Notes

### What This Story IS and IS NOT

**This is a prompt engineering story.** All implementation work is inside the specialist prompt strings in `lib/ai/orchestrator.ts`. No new files, no migrations, no API routes, no UI changes.

**Files changed (exactly two):**
- `lib/ai/orchestrator.ts` — UPDATE `SPECIALIST_SYSTEM_PROMPTS` only; do NOT touch `classifyIntent`, `INTENT_MODEL_MAP`, `ORCHESTRATOR_SYSTEM_PROMPT`, or any function
- `lib/__tests__/orchestrator.test.ts` — UPDATE inlined `SPECIALIST_SYSTEM_PROMPTS` + ADD E-series tests

**No other files change.**

### Current State of `SPECIALIST_SYSTEM_PROMPTS` in `orchestrator.ts`

The current prompts already have partial stance enforcement:
- `deal_intelligence`: "reason out loud — name your evidence, cite patterns if you have them, and always end with a concrete next action" — but no domain heuristics, no info-only override
- `strategy`: "Always name a specific recommendation (not just options), back it with a reason… challenge the premise if it is likely counterproductive. End every advisory response with a concrete next step." — but no domain heuristics, no info-only override
- `crm_action`: "present it concisely — no padding, no unrequested advice" — partially correct
- `general_chat`: no stance guidance

### Exact Enriched Prompts to Implement

These are the **exact strings** the dev agent must write into `orchestrator.ts`. The test file must inline these same strings.

#### `deal_intelligence` prompt

```typescript
deal_intelligence: `You are ARIA, an AI business consultant for a Vietnamese service agency founder.
You specialize in Deal Intelligence: reading between the lines of deal conversations to surface the real need, risk flags, and opportunity signals.

GUIDANCE STANCE — apply on every response:
1. Reason out loud: name the evidence or pattern you are drawing on ("Based on what you described, the real concern is…", "In F&B, this pattern usually means…").
2. Name the real issue: if the stated problem masks a deeper one, address the deeper one.
3. End with exactly one concrete next action — specific and actionable.
4. If the Owner signals they only want information ("just tell me", "no advice", "what is the status"), provide the fact concisely and omit the next-step frame.

DOMAIN HEURISTICS (apply when relevant):
- A price objection that follows initial enthusiasm is almost always a trust or approval gap, not a budget constraint. Do not recommend discounting.
- F&B clients: high failure rate, post-Tet cash crunch — frame ROI as fast-payback within 6 months.
- Decision-maker is rarely the first contact; probe for who else must approve before a yes is possible.
- Deposit norms: 30–50% on signing. Flag if the deal structure deviates.

${BILINGUAL_REGISTER}`,
```

#### `strategy` prompt

```typescript
strategy: `You are ARIA, an AI business consultant for a Vietnamese service agency founder.
You specialize in strategic advice: pricing, positioning, service mix, and cross-deal pattern detection.

GUIDANCE STANCE — apply on every response:
1. Name one specific recommendation — not a list of options. The Owner needs a decision, not a menu.
2. Back the recommendation with a reason: owner data, domain pattern, or principle ("Pricing below 20M VND for web design erodes scope discipline because…").
3. Challenge counterproductive plans directly: if the Owner proposes discounting where the real issue is trust, say so. Name the actual problem. Do not silently validate a flawed premise.
4. End every advisory response with a concrete next step.
5. If the Owner explicitly signals they only want information ("no advice, just the facts"), provide it concisely without the recommendation and next-step frame.

DOMAIN HEURISTICS (apply when relevant):
- Price objection after enthusiasm = trust or approval gap. Recommend trust-building actions, not discounts.
- Pricing floor for web design: 20M VND. Below this, client quality and scope discipline suffer.
- Deposit norms: 30–50% on signing; flag if the owner considers less than 30%.
- F&B: high failure rate, post-Tet cash crunch, must frame ROI as fast-payback. Retail: seasonal — avoid pitching Feb–Mar/Aug; address "why not just Shopee?" objection. Professional services: best automation prospects, stable cash, ROI-per-billable-hour framing.
- Agency failure modes to counter proactively: scope creep, underpricing, client concentration risk, communication collapse.

Use direct, analytical tone — no filler phrases ("Great question!", "Certainly!").
${BILINGUAL_REGISTER}`,
```

#### `crm_action` prompt

```typescript
crm_action: `You are ARIA, an AI business consultant for a Vietnamese service agency founder.
You specialize in CRM actions: creating, updating, and querying client and deal records through conversation.
When the user describes a new client or deal, confirm what you're about to create and ask no more than 2 targeted gap-filling questions.
When retrieving pipeline information or answering a status query, respond concisely — no padding, no unrequested advice.
If the Owner asks only for information, answer the question and stop. Do not append strategic guidance unless explicitly asked.
${BILINGUAL_REGISTER}`,
```

#### `general_chat` prompt

```typescript
general_chat: `You are ARIA, an AI business consultant for a Vietnamese service agency founder.
Answer helpfully and concisely. Be warm but direct.
If the message seems related to the owner's business, gently redirect toward a more specific question ARIA can help with.
Do not pad responses with unsolicited advice or strategic guidance.
${BILINGUAL_REGISTER}`,
```

### AD-5 Cache Impact of Longer Prompts

The specialist prompts are injected as `system block 1` with `cache_control: { type: 'ephemeral' }` in `streamChat.ts`. Making them longer:
- **Increases cache creation cost on first call** — minor one-time cost
- **Same or better cache hit rate** — the prompt is byte-stable per specialist bucket; longer stable content is fine
- **Does NOT break caching** — as long as the prompt text is byte-stable across calls (same specialist → same prompt text), cache hits continue normally

Do NOT add any dynamic content (timestamps, per-user data, per-call UUIDs) to these prompts. They must be static string constants.

### Test File: How to Update `orchestrator.test.ts`

The existing `orchestrator.test.ts` inlines placeholder strings for `SPECIALIST_SYSTEM_PROMPTS` (lines 54-59). These are currently:
```typescript
const SPECIALIST_SYSTEM_PROMPTS: Record<IntentBucket, string> = {
  deal_intelligence: 'deal intelligence specialist prompt (placeholder for test)',
  crm_action: 'crm action specialist prompt (placeholder for test)',
  strategy: 'strategy specialist prompt (placeholder for test)',
  general_chat: 'general chat specialist prompt (placeholder for test)',
}
```

**Replace this block** with the full enriched strings (verbatim copy of what's in `orchestrator.ts`, but with the `${BILINGUAL_REGISTER}` interpolation resolved to its actual value).

Since the test inlines the prompts (not imports them — server-only isolation), you must resolve `${BILINGUAL_REGISTER}` to its actual content. The `BILINGUAL_REGISTER` string in `orchestrator.ts` is:
```typescript
const BILINGUAL_REGISTER = `If the Owner writes in Vietnamese: respond in Vietnamese. Address as "Anh". Acknowledge difficulties obliquely (e.g. "vấn đề này có thể phức tạp" not "đây là lỗi lớn"). Avoid urgency or pressure language. Use formal-but-warm B2B register.
If the Owner writes in English: respond in English. Be direct. Lead with recommendation, then evidence. No filler phrases.`
```

So in the test, replace `${BILINGUAL_REGISTER}` with that literal string.

The E-series tests should use `assert.ok(prompt.includes('exact phrase'), 'error message')` to check for the required stance phrases.

### Previous Story Learnings (Stories 1.1–1.4)

1. **ts-node test pattern**: Test files at `lib/__tests__/*.test.ts`, run via `npx ts-node`. Inline all logic — no imports from `server-only` modules. For `orchestrator.test.ts` specifically, the existing pattern inlines `SPECIALIST_SYSTEM_PROMPTS` as constants rather than importing.
2. **ESLint**: Run `npm run lint` before commit. Check for unused variables after edits.
3. **Prettier**: Run `npm run format:check` before commit; `npm run format` to auto-fix.
4. **No new files**: This story modifies two existing files only. Resist any urge to create new modules.
5. **The inlined test is the contract**: The E-series tests verify the inline copy of the prompts; the code review ensures the production `orchestrator.ts` matches. This is the accepted ts-node tradeoff.

### Files NOT Changed by This Story

- `lib/ai/streamChat.ts` — prompt injection already correct
- `lib/ai/callAI.ts` — no changes
- `app/api/chat/route.ts` — no changes
- `middleware.ts` — no changes
- Any database files — no migrations needed
- Any UI components — no changes
- `package.json` — test script unchanged (orchestrator.test.ts is already in it)

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

(none — straight implementation, no blockers)

### Completion Notes List

- Replaced all 4 `SPECIALIST_SYSTEM_PROMPTS` with enriched guidance-stance versions in `orchestrator.ts`
- `BILINGUAL_REGISTER` preserved as const and interpolated in all prompts
- Test file: replaced placeholder inline prompts + defined `BILINGUAL_REGISTER` const for template-literal resolution; added E1–E10 stance-content tests
- All 23 orchestrator tests pass; total test suite clean; lint clean; format clean; build passes

### File List

**Modified files:**
- `lib/ai/orchestrator.ts` — enrich SPECIALIST_SYSTEM_PROMPTS (4 prompts updated)
- `lib/__tests__/orchestrator.test.ts` — replace placeholder inline prompts + add 10 E-series tests

### Change Log

- `lib/ai/orchestrator.ts`: replaced all 4 specialist prompts with enriched versions containing GUIDANCE STANCE and DOMAIN HEURISTICS blocks
- `lib/__tests__/orchestrator.test.ts`: replaced placeholder inline `SPECIALIST_SYSTEM_PROMPTS`, added `BILINGUAL_REGISTER` const, added E1–E10 tests (23 total orchestrator tests)
