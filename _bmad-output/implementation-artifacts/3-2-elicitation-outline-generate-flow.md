---
story_id: "3.2"
epic: 3
title: "Elicitation → Outline → Generate Flow"
status: done
baseline_commit: ""
---

# Story 3.2 — Elicitation → Outline → Generate Flow

## Story

As an Owner, I want ARIA to ask me targeted questions and present a draft outline for my approval before writing a full document, so that I never receive an off-target document and always feel in control of what gets produced.

---

## What Already Exists (Do NOT Re-Implement)

Everything below was delivered in Epics 0–3.1 and must be treated as immutable foundation.

### AI Call Infrastructure (Epics 0, 1)
- `lib/ai/callAI.ts` — the sole entry point for Anthropic API calls; handles prompt assembly, cache_control ordering, token logging, and the degradation envelope (`{ status: "ok" | "degraded" | "error", data, degraded_reason? }`). (AD-5, AD-6)
- `lib/ai/agentWithTools.ts` — runs the tool-use loop (up to `MAX_TOOL_ITERATIONS=3`); accepts `tools`, `systemPrompt`, `businessContext`, `detectedLang`, `ownerId`; emits a `ReadableStream<Uint8Array>`. Alphabetically sorts tools before every call. (AD-5)
- `lib/ai/streamChat.ts` — direct streaming path (no tools); used by `general_chat` bucket.
- `lib/ai/models.ts` — exports `ARIA_MODELS.highJudgment` (Sonnet 4.6) and `ARIA_MODELS.economical` (Haiku).

### Orchestrator and Intent Routing (Story 1.2)
- `lib/ai/orchestrator.ts` — exports:
  - `IntentBucket` type: `'deal_intelligence' | 'crm_action' | 'strategy' | 'general_chat'`
  - `SPECIALIST_SYSTEM_PROMPTS: Record<IntentBucket, string>` — the system prompt for each bucket.
  - `INTENT_MODEL_MAP: Record<IntentBucket, AriaModel>` — model selection per bucket (AD-4).
  - `classifyIntent(messages)` — calls the economical model, returns `{ intent, confidence }`.
  - **Does NOT yet have a `document_creation` bucket** — this story adds it.

### Chat Route (Story 1.2 + 1.9)
- `app/api/chat/route.ts` — classifies intent, fetches business context, then routes to:
  - `runAgentWithTools(…)` for `crm_action`, `deal_intelligence`, `strategy`
  - `streamChat(…)` for `general_chat`
  - **No `document_creation` branch exists yet** — this story adds it.

### Tool Runner (Stories 1.2 through 3.1)
- `lib/ai/toolRunner.ts` — dispatches `runTools(toolUseBlocks, ownerId)`. Already has dispatch branches for:
  - `create_document` → calls `createDocument(ownerId, { …, created_by: 'ai' })` from `documentService`.
  - `get_document` → calls `getDocument(ownerId, { id })`.
  - All CRM tools (`get_deal`, `get_client`, `find_similar_deals`, `update_deal`, `update_client`, `list_deals`, `create_client_stub`, `create_deal_stub`, `find_similar_clients`, `update_intelligence_fields`, `get_activity_log`, `get_pipeline_summary`, `log_activity`, `check_stub_enrichment`, `promote_stub`, `archive_stub`).

### Existing Tool Arrays (Stories 1.2–3.1)
- `lib/ai/crmTools.ts` — `CRM_STUB_TOOLS` array (13 tools, alphabetically sorted).
- `lib/ai/dealIntelligenceTools.ts` — `DI_TOOLS` array.
- `lib/ai/strategyTools.ts` — `STRATEGY_TOOLS` array.
- `lib/ai/documentTools.ts` — `DOCUMENT_TOOLS` array containing `create_document` and `get_document` (alphabetically sorted, `as const`). **These tools are defined but NOT yet registered in any specialist** — this story registers them on the `document_creation` specialist.

### Document Service (Story 3.1)
- `lib/crm/documentService.ts` — exports:
  - `createDocument(ownerId, input): Promise<DocumentRow>` — inserts at version=1, status=draft, logs `document_created`.
  - `saveDocumentVersion`, `updateDocumentStatus`, `getDocument`, `listDocuments`, `listDocumentVersions`.
  - `DocumentRow`, `DocumentType`, `DocumentStatus`, `CreateDocumentInput` types.
- `supabase/migrations/…_documents_table.sql` — the `documents` table exists with RLS. The `activity_log.entity_type` column already supports `'document'`.

### CRM Services (Stories 2.1–2.7)
- `lib/crm/dealIntelligenceService.ts` — `getDeal`, `getClient`, `findSimilarDeals`.
- `lib/crm/activityLogService.ts` — `logActivity` (append-only, AD-14).
- `lib/crm/crmService.ts` — `updateDeal`, `updateClient`, `listDeals`.
- `lib/supabase/server.ts` — `createServerClient()` (owner-data RLS path, AD-13).

### Language Detection (Story 1.3)
- `lib/language/detectLanguage.ts` — `detectLanguage(text): 'vi' | 'en'`.
- `app/api/chat/route.ts` already detects the last user message's language and passes `detectedLang` to every specialist.

---

## Gap Analysis — What Story 3.2 Adds

Story 3.2 is an **AI routing + specialist prompt story**. The data layer and tool runner dispatch already exist from Story 3.1. This story connects them to the chat flow by adding the `document_creation` intent bucket and its full elicitation-first specialist prompt.

### Gap 1 — No `document_creation` intent bucket in the orchestrator
`lib/ai/orchestrator.ts` defines `IntentBucket` as four values (`deal_intelligence | crm_action | strategy | general_chat`). Document creation requests (e.g. "Draft a proposal for the Hanoi restaurant") currently fall through to `general_chat`, receiving no tools and no structured elicitation flow. This story:
- Adds `'document_creation'` to the `IntentBucket` union type.
- Adds a `document_creation` case to the `ORCHESTRATOR_SYSTEM_PROMPT` bucket list (with description so the classifier knows when to route there).
- Adds `SPECIALIST_SYSTEM_PROMPTS.document_creation` — the full elicitation → outline → generate specialist prompt.
- Adds `INTENT_MODEL_MAP.document_creation` — elicitation uses `ARIA_MODELS.economical` (Haiku) as the AD-4 spec requires; the specialist prompt instructs the model to self-switch to the high-judgment tier for the final generation call via `create_document` (which is executed by `agentWithTools` using the specialist's declared model).

  **AD-4 model note**: The `document_creation` specialist maps to `ARIA_MODELS.highJudgment` in `INTENT_MODEL_MAP`. The full Sonnet model is needed across the conversation because the model must reason about outline quality and generate the final draft. The economical model is used only for the *classification* call (which is always Haiku regardless of the specialist) — this already satisfies AD-4's "elicitation uses Haiku" intent. The specialist itself always uses Sonnet.

- Adds `VALID_BUCKETS` update to include `'document_creation'` so `classifyIntent` does not reject the new bucket.

### Gap 2 — No `document_creation` routing branch in the chat API route
`app/api/chat/route.ts` currently has `if/else if` branches for `crm_action`, `deal_intelligence`, `strategy`, and a fallback to `general_chat`. A `document_creation` classification today falls into `general_chat`. This story adds the `document_creation` branch that calls `runAgentWithTools` with:
- `tools: DOCUMENT_TOOLS` — the `create_document` and `get_document` tools from Story 3.1 (plus the CRM read tools `get_deal` and `get_client` needed for context fetching).
- `systemPrompt: SPECIALIST_SYSTEM_PROMPTS.document_creation`.
- `model: INTENT_MODEL_MAP.document_creation` (Sonnet).

  **Tool list note**: The `document_creation` specialist needs `get_deal` and `get_client` to fetch existing CRM context before eliciting. These tools are already dispatched in `toolRunner.ts`. A new combined tool array `DOCUMENT_CREATION_TOOLS` must be created that merges `DOCUMENT_TOOLS` + the two CRM read tools needed (alphabetically sorted per AD-5).

### Gap 3 — `DOCUMENT_TOOLS` not registered on any specialist
`lib/ai/documentTools.ts` exports `DOCUMENT_TOOLS` (`create_document`, `get_document`) but this array is never passed to any `runAgentWithTools` call. The `toolRunner.ts` has the dispatch but the tools are never offered to the AI, so the model cannot call them. This story wires `DOCUMENT_TOOLS` into the new `document_creation` specialist.

### Gap 4 — No `document_creation` specialist system prompt
The specialist prompt is the core business logic of FR-19: elicitation → outline → generate. No prompt exists for this bucket. This story adds it to `orchestrator.ts` with full multi-turn state machine instructions covering:
- **Step 1 — Context fetch**: Call `get_deal` and `get_client` first (parallel when both IDs are known).
- **Step 2 — Gap identification**: Cross-reference fetched context against the required template fields (addendum §E) for the requested document type.
- **Step 3 — Elicitation**: If gaps exist, ask ≤3 ranked questions. If all fields present, skip to outline.
- **Step 4 — Outline presentation**: Present numbered outline, request approval explicitly.
- **Step 5 — Revision loop**: If the Owner requests changes, update the outline and re-present.
- **Step 6 — Generation gate**: Generate the full document ONLY after explicit Owner approval.
- **Step 7 — Persist**: Call `create_document` to save; explain the document's deal-stage rationale.

### Gap 5 — No story-specific test file
Per project convention, each story ships a `lib/__tests__/<slug>.test.ts` file with a `test:<slug>` npm script. No test exists for the orchestrator's `document_creation` bucket or the specialist prompt's elicitation contract.

---

## Acceptance Criteria

| # | Scenario | Criterion |
|---|----------|-----------|
| AC1 | Intent classification routes document requests | Given the Owner sends a message classified as a document request (e.g. "Draft a proposal for the Hanoi restaurant client" / "Soạn đề xuất cho khách nhà hàng Hà Nội"), when `classifyIntent` runs, then it returns `{ intent: 'document_creation', confidence: ≥0.7 }`. The `general_chat` bucket is NOT returned for a clear document creation request. (FR-1, AD-1) |
| AC2 | ARIA does NOT generate a document without elicitation | Given the Owner sends a document creation request, when the `document_creation` specialist runs, then ARIA's first response does NOT contain a full document. It calls `get_deal` and `get_client` first, then asks ≤3 targeted elicitation questions — or proceeds directly to outline if all required fields are already in the CRM. (FR-19, AD-3) |
| AC3 | Elicitation questions are language-mirrored and ranked | Given ARIA identifies missing fields for the requested document type, when it asks elicitation questions in the same turn, then: (a) there are no more than 3 questions, (b) they are ranked by criticality (budget confirmed? decision-maker? timeline? scope?), (c) they are asked in the Owner's current language (Vietnamese if message was Vietnamese, English if English). (FR-19, FR-2) |
| AC4 | Elicitation is skipped when all required fields are present | Given the CRM already contains all fields required for the requested document type (e.g. client name, stated need, service type, value estimate, timeline), when the specialist runs, then ARIA skips the elicitation step and presents the outline directly in the first response turn. (FR-19) |
| AC5 | Outline is presented with explicit approval request | Given ARIA is ready to proceed after elicitation (or directly if no gaps), when it presents the outline, then the response contains: (a) a numbered list of sections with one-line descriptions per section, (b) an explicit approval request — Vietnamese: "Outline này ổn không anh? Anh có muốn thêm hoặc bỏ phần nào không?" / English: "Does this outline work? Any sections to add or remove?". No full document content is included in this response. (FR-19) |
| AC6 | Outline revision loop: no full generation until approval | Given the Owner requests a change to the outline (e.g. "Add a section on workflow" / "Remove the pricing section"), when ARIA responds, then it presents an updated outline and asks for approval again — no full document is generated. This invariant holds for any number of revision turns: full generation is always gated on explicit Owner approval. (FR-19 invariant) |
| AC7 | Full document generation uses Sonnet and correct template | Given the Owner explicitly approves the outline (e.g. "OK, go ahead" / "Được rồi, viết đi" / "Looks good"), when ARIA generates the full document, then: (a) the generation uses `ARIA_MODELS.highJudgment` (Sonnet 4.6) per AD-4, (b) the content follows the relevant template scaffold from addendum §E (Proposal: Understanding → Deliverables → How We Work → Timeline → Investment → Next Step), (c) the document language follows the client's `language_pref` (default Vietnamese for Vietnamese-market clients) per FR-2. (AD-4, FR-2, addendum §E) |
| AC8 | Document is persisted via `create_document` after generation | Given the full document has been generated, when ARIA saves it, then `create_document` is called with: `type` matching the requested document type, `content_md` containing the full Markdown text, `deal_id` and `client_id` from the fetched CRM records, `client_name` for title generation. The resulting `documents` row has `status='draft'`, `version=1`, `created_by='ai'`, and `title` in `{ClientName}_{DocumentType}_{YYYY-MM-DD}_v1` format. (FR-20, AD-14) |
| AC9 | Activity log entry written on document creation | Given `create_document` is called by the specialist, when the row is persisted, then an `activity_log` entry exists with `entity_type='document'`, `action='document_created'`, `actor='ai'`, and `owner_id` matching the authenticated user. (AD-14, FR-20) |
| AC10 | Post-save response includes guidance rationale | Given the document has been saved (AC8 done), when ARIA responds in Chat, then the reply explains in one sentence why this document matters at this deal stage — e.g. "Em đã lưu đề xuất này. Đây là bước quan trọng vì đề xuất rõ ràng giúp anh kiểm soát kỳ vọng của khách trước khi ký hợp đồng." (FR-3, FR-22 teaching rationale) |
| AC11 | Vietnamese client register in generated document | Given the client's `language_pref` is `'vi'` (or the field is absent, defaulting to Vietnamese), when the full document is generated, then the document body uses ARIA's client-facing Vietnamese register: warm, relationship-preserving, appropriately hierarchical (Anh/Chị for the client), no urgency language, no Western idioms. (PRD §10, FR-2) |
| AC12 | `DOCUMENT_CREATION_TOOLS` is alphabetically sorted | Given the `document_creation` specialist is wired with a combined tool array, when the array is defined, then all tools are alphabetically sorted by `name` (AD-5 cache-stability invariant). The array must include at minimum: `create_document`, `get_client`, `get_deal`, `get_document`. |
| AC13 | `document_creation` bucket in `VALID_BUCKETS` | Given `classifyIntent` parses a model response containing `{ "intent": "document_creation", ... }`, when the bucket is validated, then it is accepted (not rejected as unknown); the fallback to `general_chat` is NOT triggered. (AD-6 — unknown bucket falls back; known bucket must pass validation) |
| AC14 | Degradation envelope preserved | Given the Claude API is unavailable when the `document_creation` specialist runs, when the error is caught, then `agentWithTools` emits the standard `[ARIA error: ...]` sentinel; no unhandled exception propagates. (AD-6) |

---

## Tasks / Subtasks

### Task 1 — Add `document_creation` to `lib/ai/orchestrator.ts`

**File:** `lib/ai/orchestrator.ts`

**Substep 1a — Extend `IntentBucket` union type:**
```typescript
export type IntentBucket =
  | 'deal_intelligence'
  | 'crm_action'
  | 'strategy'
  | 'document_creation'   // ← NEW
  | 'general_chat'
```

**Substep 1b — Add to classifier prompt bucket list:**
In `ORCHESTRATOR_SYSTEM_PROMPT`, add `document_creation` to the Buckets block:
```
- document_creation: requests to draft, create, write, or generate a business document — proposal, contract, brief, SOP, report, invoice, onboarding doc — for a specific deal or client; "soạn đề xuất", "viết hợp đồng", "làm brief cho khách"
```
Place it between `strategy` and `general_chat` in the list to match the bucket declaration order.

**Substep 1c — Add `SPECIALIST_SYSTEM_PROMPTS.document_creation`:**

Add the full specialist prompt to the `SPECIALIST_SYSTEM_PROMPTS` record. The prompt must implement the elicitation → outline → generate state machine:

```
You are ARIA, an AI business consultant for a Vietnamese service agency founder.
You specialize in creating business documents: proposals, contracts, briefs, SOPs, reports, invoices, and onboarding documents.

DOCUMENT CREATION PROTOCOL — follow this exact sequence every time the Owner requests a document:

Step 1 — LOAD CONTEXT (call tools before composing any response):
  a. If the Owner's message references a named deal or client, call get_deal(title or id) to fetch the deal record.
  b. Call get_client(id) using the deal's client_id if available, otherwise search by any name mentioned.
  c. Issue both calls in parallel when both IDs are known.
  d. If no deal or client is identified from the message, skip to Step 2 with empty context and rely on elicitation.

Step 2 — IDENTIFY GAPS:
  Cross-reference the fetched context against the required fields for the requested document type (see TEMPLATE REQUIREMENTS below).
  Required fields by type:
  - **Proposal**: client name, client_stated_need (what they want), service_type, value_estimate (price), timeline (when), decision_maker (who approves).
  - **Contract/SOW**: all Proposal fields + deposit percentage, revision rounds, IP transfer agreement.
  - **Brief**: client name, client goals (3–5), target audience, technical requirements, content responsibilities, timeline per milestone.
  - **Other types** (SOP, report, invoice, onboarding): client name + purpose of the document + any relevant deal context.

Step 3 — ELICITATION (skip entirely if all required fields are already present in CRM context):
  - Ask no more than 3 questions per turn, ranked by criticality.
  - Rank order: (1) what the client actually needs / scope, (2) value/budget confirmed, (3) decision-maker, (4) timeline.
  - Frame questions in the Owner's current language (Vietnamese or English) — do NOT mix languages.
  - After answering, re-check gaps. Continue eliciting across turns until all critical fields are resolved.
  - Do NOT generate or preview any document content during elicitation.

Step 4 — PRESENT OUTLINE (after elicitation complete, or immediately if no gaps):
  - Present a numbered draft outline: document title + one-line description per section.
  - Use the template scaffold for the document type (see TEMPLATE REQUIREMENTS below).
  - Explicitly ask for approval:
    - Vietnamese: "Outline này ổn không anh? Anh có muốn thêm hoặc bỏ phần nào không?"
    - English: "Does this outline work? Any sections to add or remove?"
  - Do NOT include any full document content in the outline response — only section titles and one-line descriptions.

Step 5 — OUTLINE REVISION (if Owner requests changes):
  - Update the outline to reflect the Owner's request.
  - Re-present the revised outline and ask for approval again.
  - INVARIANT: full document generation is ALWAYS gated on explicit Owner approval. Never generate a full document until the Owner says "yes", "go ahead", "write it", "OK", "Được rồi", "viết đi", or equivalent.

Step 6 — GENERATE FULL DOCUMENT (only after explicit approval):
  - Write the complete document as Markdown, following the template scaffold for the document type.
  - Document language: use the client's language_pref (default 'vi' for Vietnamese-market clients) — NOT the Owner's conversation language. (FR-2)
  - Vietnamese client register: warm, relationship-preserving, appropriately hierarchical (address client as Anh/Chị), no urgency language ("ASAP", "khẩn"), no hard CTAs, no Western pressure idioms.
  - Include all sections from the approved outline.
  - Be specific: use the actual client name, service type, price, and timeline from the elicited context.

Step 7 — PERSIST AND EXPLAIN:
  - Call create_document with: type, content_md (full Markdown text), deal_id (if known), client_id (if known), client_name (for title).
  - After create_document returns: respond with one sentence explaining why this document matters at this deal stage. (FR-3, FR-22)
  - Example (Vietnamese): "Em đã lưu đề xuất này. Đây là bước quan trọng vì đề xuất rõ ràng giúp anh kiểm soát kỳ vọng của khách trước khi ký hợp đồng."
  - Example (English): "I've saved this proposal. A clear written proposal is the key step before contract — it locks in scope and prevents later disputes."
  - Do NOT call create_document more than once per document per approval.

TEMPLATE REQUIREMENTS (from addendum §E):
- **Proposal**: 1) Understanding your situation 2) What we will deliver (outcomes not tasks) 3) How we work (3–4 steps) 4) Timeline (milestone-based) 5) Investment (price, in/out of scope) 6) Next step (single CTA).
- **Contract/SOW minimum sections**: Parties; Scope (reference proposal); Deliverables; Timeline/Milestones; Payment schedule (deposit/milestone/final); Revision policy (N rounds); IP transfer; Termination; Governing law.
- **Project Brief minimum sections**: Summary; Client goals (3–5); Target audience; Technical requirements; Design references/constraints; Content responsibilities (who provides what); Timeline with owner per milestone; Communication cadence.
- **Other types**: Adapt based on purpose, client context, and the Owner's description.

${BILINGUAL_REGISTER}
```

**Substep 1d — Add to `INTENT_MODEL_MAP`:**
```typescript
export const INTENT_MODEL_MAP: Record<IntentBucket, AriaModel> = {
  deal_intelligence: ARIA_MODELS.highJudgment,
  crm_action:        ARIA_MODELS.highJudgment,
  strategy:          ARIA_MODELS.highJudgment,
  document_creation: ARIA_MODELS.highJudgment,  // ← NEW (AD-4: generation is high-judgment)
  general_chat:      ARIA_MODELS.economical,
}
```

**Substep 1e — Add `'document_creation'` to `VALID_BUCKETS` array:**
```typescript
const VALID_BUCKETS: IntentBucket[] = [
  'deal_intelligence',
  'crm_action',
  'strategy',
  'document_creation',  // ← NEW
  'general_chat',
]
```

---

### Task 2 — Create `lib/ai/documentCreationTools.ts`

**File:** `lib/ai/documentCreationTools.ts`

The `document_creation` specialist needs CRM read tools (`get_deal`, `get_client`) in addition to the document tools (`create_document`, `get_document`) from Story 3.1. Rather than importing from `crmTools.ts` (which includes many write tools not needed here), define a focused combined array.

Line 1: `// lib/ai/documentCreationTools.ts` (no `server-only`, no SDK import — pure data, same pattern as `crmTools.ts` and `documentTools.ts`).

Export `DOCUMENT_CREATION_TOOLS` containing (alphabetically sorted — AD-5):
1. `create_document` — from `documentTools.ts` definition (copy verbatim)
2. `get_client` — from `crmTools.ts` definition (copy verbatim)
3. `get_deal` — from `crmTools.ts` definition (copy verbatim)
4. `get_document` — from `documentTools.ts` definition (copy verbatim)

The array must be `as const` and alphabetically sorted by `name`. Verify: `create_document` < `get_client` < `get_deal` < `get_document`. All four tools are already dispatched in `toolRunner.ts` — no new dispatch cases are needed.

---

### Task 3 — Add `document_creation` routing branch in `app/api/chat/route.ts`

**File:** `app/api/chat/route.ts`

**Substep 3a — Import the new tool array:**
```typescript
import { DOCUMENT_CREATION_TOOLS } from '@/lib/ai/documentCreationTools'
```

**Substep 3b — Add routing branch:**
Insert a new `else if` branch after the `strategy` branch and before the `general_chat` fallback:

```typescript
} else if (classification.intent === 'document_creation') {
  stream = runAgentWithTools({
    model: INTENT_MODEL_MAP[classification.intent],
    specialist: classification.intent,
    systemPrompt: SPECIALIST_SYSTEM_PROMPTS[classification.intent],
    tools: DOCUMENT_CREATION_TOOLS,
    messages: messagesForAI,
    detectedLang,
    businessContext: businessContext ?? undefined,
    ownerId: user.id,
  })
}
```

No other changes to the route file. The existing privacy gate, language detection, context trimming, and business context injection all apply automatically.

---

### Task 4 — Create story-specific test file

**File:** `lib/__tests__/elicitationOutline32.test.ts`

Follow the ts-node test pattern: `export {}` at top; no project `lib/` imports; all types and logic inlined.

Use the same `assert` helper and mock-stub Supabase pattern as `lib/__tests__/documentDataLayer31.test.ts`.

**Tests must cover (minimum 10 tests, 25 assertions):**

1. **Orchestrator classifier prompt contains `document_creation`**: Read the `ORCHESTRATOR_SYSTEM_PROMPT` string literal and assert it contains the string `"document_creation"`. (AC13)

2. **`VALID_BUCKETS` contains `document_creation`**: Assert that the `VALID_BUCKETS` array (inline copy for test isolation) includes `'document_creation'`. (AC13)

3. **`SPECIALIST_SYSTEM_PROMPTS.document_creation` is non-empty**: Assert the prompt string is truthy and length > 500 chars. (AC5 — outline approval wording must exist)

4. **Specialist prompt contains outline approval microcopy (Vietnamese)**: Assert `SPECIALIST_SYSTEM_PROMPTS.document_creation` includes the exact string `"Outline này ổn không anh?"`. (AC5)

5. **Specialist prompt contains outline approval microcopy (English)**: Assert `SPECIALIST_SYSTEM_PROMPTS.document_creation` includes the string `"Does this outline work?"`. (AC5)

6. **Specialist prompt contains `create_document` instruction**: Assert the prompt includes `"create_document"` as a tool call instruction. (AC8)

7. **`INTENT_MODEL_MAP.document_creation` is the high-judgment model**: Inline the expected model ID from `ARIA_MODELS.highJudgment` (the same string used for `deal_intelligence`) and assert they match. (AC7, AD-4)

8. **`DOCUMENT_CREATION_TOOLS` is alphabetically sorted**: Assert the `name` values of all tools in the array appear in ascending alphabetical order — `create_document` < `get_client` < `get_deal` < `get_document`. (AC12, AD-5)

9. **`DOCUMENT_CREATION_TOOLS` contains exactly 4 tools**: Assert `DOCUMENT_CREATION_TOOLS.length === 4`. (AC12)

10. **`DOCUMENT_CREATION_TOOLS` tool names**: Assert the set of tool names equals `{ 'create_document', 'get_client', 'get_deal', 'get_document' }`. (AC12)

11. **Specialist prompt contains elicitation limit instruction**: Assert the prompt includes `"3"` in a context that limits question count, confirming the ≤3 questions per turn rule. (AC3)

12. **Specialist prompt references Proposal template structure**: Assert the prompt includes `"Understanding"` and `"Investment"` (two required Proposal sections from addendum §E). (AC7)

13. **Specialist prompt references `language_pref`**: Assert the prompt includes `"language_pref"` to confirm the client-language logic is documented. (AC7, AC11)

14. **Specialist prompt contains guidance-rationale instruction**: Assert the prompt includes `"matters at this deal stage"` or `"bước quan trọng"` — the post-save explanation required by FR-3/FR-22. (AC10)

15. **`classifyIntent` fallback on `document_creation` bucket**: Inline a mock `classifyIntent` that parses `{ "intent": "document_creation", "confidence": 0.9 }` and assert it returns `intent === 'document_creation'` without falling back to `general_chat`. (AC1, AC13)

**Test structure (follow existing test file pattern):**
```typescript
export {}

// ── Inline helpers ──────────────────────────────────────────────────────────
function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`FAIL: ${message}`)
  console.log(`  PASS: ${message}`)
}

// ── Import orchestrator exports for inspection ──────────────────────────────
// NOTE: ts-node in this project supports path aliases via tsconfig.json.
// Import directly from the compiled source modules.
// If server-only module guard blocks import, use dynamic require with the
// mock pattern established in intelligenceFields25.test.ts.
```

For modules that use `import 'server-only'`, use the same mock approach as prior story tests: either mock `server-only` inline or test the logic in isolation using inline type/value copies.

---

### Task 5 — Add npm test script

**File:** `package.json`

Add to the `"scripts"` section:
```json
"test:elicitation-outline32": "npx ts-node lib/__tests__/elicitationOutline32.test.ts"
```

---

### Task 6 — CI triad

- `npx tsc --noEmit` — 0 errors (IntentBucket union extension and new tool file must type-check).
- `npx eslint lib/ai/orchestrator.ts lib/ai/documentCreationTools.ts app/api/chat/route.ts` — 0 errors.
- `npm run test:elicitation-outline32` — all assertions pass.

---

### Task 7 — Update story and sprint status

- Set this story's `status` frontmatter to `done`.
- Update `sprint-status.yaml`: `3-2-elicitation-outline-generate-flow: done`.
- Update `last_updated`.

---

## Dev Notes

### Architecture Constraints

- **AD-1**: All AI calls run server-side only. `document_creation` specialist runs in `app/api/chat/route.ts` via `runAgentWithTools` — the client never sees the Anthropic SDK.
- **AD-4 — Model routing for document_creation**: The `INTENT_MODEL_MAP` maps `document_creation` to `ARIA_MODELS.highJudgment` (Sonnet 4.6). This is the correct mapping: document generation requires full reasoning capability. The classification call (always Haiku regardless of specialist) is what the AD-4 spec means by "elicitation uses Haiku" — the orchestrator classifier is always Haiku; the specialist model is separately configured.
- **AD-5 — Prompt cache stability**: `DOCUMENT_CREATION_TOOLS` must be alphabetically sorted (the `agentWithTools` re-sorts before every call as a safety net, but the source array should be pre-sorted for clarity and correctness). `SPECIALIST_SYSTEM_PROMPTS.document_creation` is a stable string — no timestamps, request IDs, or per-call state injected into it.
- **AD-5 — Tool set for the specialist**: Only the 4 tools in `DOCUMENT_CREATION_TOOLS` are offered to the `document_creation` specialist. Write tools (`update_deal`, `update_client`, etc.) are intentionally excluded — the document specialist should not be mutating CRM records directly; that is the `crm_action` specialist's responsibility.
- **AD-6 — Degradation**: `runAgentWithTools` already handles errors by emitting the `[ARIA error: ...]` sentinel. No additional degradation handling is needed in the new route branch.
- **AD-11 — server-only**: `lib/ai/documentCreationTools.ts` follows the same pattern as `crmTools.ts` and `documentTools.ts` — it is pure data (no SDK import, no `server-only`). The `server-only` guard lives in `agentWithTools.ts` and `toolRunner.ts`.
- **AD-13 — No service-role on owner-data paths**: The `document_creation` specialist calls `create_document` via `toolRunner.ts`, which uses `createDocument` from `documentService.ts`, which uses `createServerClient()` — the owner-scoped RLS path. No service-role key is involved.
- **AD-14 — Activity log**: `create_document` in `documentService.ts` already appends an activity log entry (`action='document_created'`, `actor='ai'`). The specialist must not call `log_activity` separately — that would create a duplicate log entry.

### Orchestrator Pattern — Adding a New Bucket

The `classifyIntent` function uses a small classifier prompt (`ORCHESTRATOR_SYSTEM_PROMPT`) to map the user's message to a bucket. When adding a new bucket:
1. The classifier prompt's bucket list must describe the new bucket clearly enough that the model routes correctly.
2. `VALID_BUCKETS` must include the new bucket string so the parsed result is accepted.
3. `SPECIALIST_SYSTEM_PROMPTS` and `INTENT_MODEL_MAP` must both have entries for the new bucket (TypeScript's `Record<IntentBucket, …>` will enforce this at compile time — a type error will appear if either is missing the new key).
4. The chat route must have a branch for the new bucket.

All four of these must be in sync — an omission in any one of them breaks the routing chain.

### Multi-Turn Elicitation — How It Works

The `agentWithTools` loop (max 3 tool iterations) is designed for single-response tool calls. Elicitation is inherently multi-turn. The specialist handles this through conversation history:
- Turn 1: ARIA calls `get_deal`/`get_client`, identifies gaps, returns elicitation questions (a text response, no tool call).
- Turn 2: Owner answers. `agentWithTools` starts fresh (new call) with the full conversation history. ARIA reads the answers from the history, may ask follow-up or proceed to outline.
- Turn 3+: Owner approves outline → ARIA generates document → calls `create_document` → responds.

Each turn is a new HTTP request to `app/api/chat/route.ts`, which re-classifies intent (still `document_creation`) and re-initializes `runAgentWithTools` with the accumulated `messages` array. The conversation state (what was asked, what was answered) lives in the `messages` array sent by the client — not in server memory.

### `DOCUMENT_CREATION_TOOLS` — Tool Definition Strategy

Rather than importing individual tool definitions from `crmTools.ts` and `documentTools.ts` (which would create coupling), define `documentCreationTools.ts` as a self-contained pure-data module with the 4 needed tool definitions copied verbatim. This follows the same isolation pattern as the other tool files. If `crmTools.ts` is updated in a future story, `documentCreationTools.ts` will need a corresponding update — this is acceptable trade-off given the small number of tools.

Alternatively, if the dev agent prefers minimal duplication, `DOCUMENT_CREATION_TOOLS` can be defined by spreading/filtering the existing arrays:
```typescript
import { DOCUMENT_TOOLS } from './documentTools'
import { CRM_STUB_TOOLS } from './crmTools'

const CRM_READ_TOOLS = CRM_STUB_TOOLS.filter(
  t => t.name === 'get_deal' || t.name === 'get_client'
)

export const DOCUMENT_CREATION_TOOLS = [
  ...DOCUMENT_TOOLS,
  ...CRM_READ_TOOLS,
].sort((a, b) => a.name.localeCompare(b.name)) as const
```
Either approach is acceptable; the alphabetical sort must be preserved.

### Key Learnings From Prior Stories

- **Story 1.2 (Orchestrator)**: The `IntentBucket` union is a discriminated type used by `Record<IntentBucket, …>`. Adding a new value requires updating every `Record` that uses the union — TypeScript will catch omissions with a compile error. Use `npx tsc --noEmit` to verify.
- **Story 3.1 (Document tools)**: `DOCUMENT_TOOLS` is already alphabetically sorted (`create_document` < `get_document`). Extending to `DOCUMENT_CREATION_TOOLS` with CRM reads must maintain this order: `create_document` < `get_client` < `get_deal` < `get_document`.
- **Story 2.2 (CRM service)**: `toolRunner.ts` dispatch for `create_document` already stamps `created_by: 'ai'` — the specialist does not need to pass this field explicitly.
- **Story 1.3 (Language mirroring)**: The `detectedLang` from the chat route is passed to `runAgentWithTools` and injected as a volatile language directive. The specialist prompt's `${BILINGUAL_REGISTER}` block is the fallback; the explicit language directive overrides it per turn. The specialist must instruct the model to use the client's `language_pref` for the document content, not the Owner's conversation language.
- **AD-5 tool sort**: `agentWithTools.ts` re-sorts tools alphabetically on every call (`const tools = [...options.tools].sort(…)`). This is a safety net — the source array should still be pre-sorted for clarity.

---

## Dev Agent Record

### Implementation Notes
_(To be filled in by the dev agent during implementation.)_

### Commits
_(To be filled in by the dev agent.)_

### Change Log
| Date | Change | Author |
|------|--------|--------|
| 2026-06-29 | Story file created | Story Context Engine |
