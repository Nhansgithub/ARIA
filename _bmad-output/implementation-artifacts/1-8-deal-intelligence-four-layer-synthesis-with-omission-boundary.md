---
story: 1.8
epic: 1
status: done
baseline_commit: "1f8b6dd847a2bf7c17264f0727ef9061df2cb5d7"
---

# Story 1.8: Deal Intelligence — Four-Layer Synthesis with Omission Boundary

## Story

As an Owner, I want ARIA to deliver a full consultant's read — across four layers of reasoning — whenever I mention a deal, omitting only sections that genuinely cannot be populated yet, So that I always get actionable judgment, not just data retrieval.

---

## Acceptance Criteria

**AC-1: Full four-layer structure when rich context exists**

Given the Owner mentions an existing deal with client history and at least one similar past deal,
When ARIA produces the Deal Intelligence read,
Then the read is structured as: understanding / real need / risk flags / opportunity signals / prediction / recommended approach / documents needed / next action — and ARIA explicitly states when it is drawing on pattern matching ("Based on your last 3 F&B website deals…"). (FR-6; AD-4)

**AC-2: Omission boundary — minimal-context read**

Given a new lead with only two sentences of context and no similar deals,
When ARIA produces the Deal Intelligence read,
Then the read is shorter — only sections with actual data or inferable content are included — but two elements are always present: a one-line *understanding* and a *next action*. ARIA states it is reasoning from domain knowledge, not pattern history. (FR-6 omission boundary)

**AC-3: Risk flag severity rendering**

Given any Deal Intelligence read,
When risk flags are present,
Then each flag carries a severity (HIGH / MEDIUM / LOW) and a reason; severity HIGH is rendered with `#F87171` color and a Lucide `AlertTriangle` icon (color is not the sole indicator). (FR-6; DESIGN.md §7.2)

**AC-4: Always high-judgment model**

Given Deal Intelligence is triggered,
When the AI call is routed,
Then it always uses the high-judgment model (Sonnet 4.6); Deal Intelligence is never downgraded to the economical tier regardless of session state or cost pressure. (AD-4; §8)

**AC-5: Idempotent Intelligence Field updates + activity log**

Given an existing deal with Intelligence Fields already populated (`inferred_real_need`, `risk_flags`, `opportunity_signals`, `predicted_outcome`, `prediction_reason`),
When ARIA produces a new Deal Intelligence read with updated signals,
Then only fields with genuinely changed values are updated in the CRM; a no-op write logs nothing; changed fields are logged in the activity log with `actor=ai` and the change payload. (FR-6; AD-14)

**AC-6: Similar deals with explicit similarity_reason**

Given a Deal Intelligence read that references similar deals,
When those links are presented,
Then each linked deal includes a `similarity_reason` stated explicitly in the response. (FR-6; FR-10)

**AC-7: Per-call tool-based context fetch — not full CRM dump**

Given the Owner asks for a Deal Intelligence read and the CRM has Client context available,
When ARIA assembles the context for the AI call,
Then only the specific client, deal, and similar-deal records are fetched via tools — not the entire CRM; the per-DI-call context budget defined in AD-5/OQ-11 is respected. (FR-6; AD-3; AD-5)

---

## Tasks / Subtasks

- [x] **Task 1: Create DI tool definitions in `lib/ai/dealIntelligenceTools.ts`** (AC-1, AC-7)
  - [x] Create `lib/ai/dealIntelligenceTools.ts` — pure data constants, NO `'server-only'` import, NO `@anthropic-ai/sdk` import (same pattern as `crmTools.ts`)
  - [x] Define and export `DI_TOOLS` array: 4 tools — `find_similar_deals`, `get_client`, `get_deal`, `update_intelligence_fields`
  - [x] See Dev Notes §Tool Definitions for exact object shapes

- [x] **Task 2: Create DI service layer `lib/crm/dealIntelligenceService.ts`** (AC-5, AC-6, AC-7)
  - [x] Create `lib/crm/dealIntelligenceService.ts` with `import 'server-only'` at top
  - [x] Implement `getDeal(ownerId, params)` — fetch deal by id or title (ILIKE search)
  - [x] Implement `getClient(ownerId, params)` — fetch client by id or name
  - [x] Implement `findSimilarDeals(ownerId, params)` — match by service_type and/or industry; exclude current deal
  - [x] Implement `updateIntelligenceFields(ownerId, dealId, fields)` — idempotent update per AD-14 (compare, write only changed, log only changed)
  - [x] Follow `stubService.ts` pattern: `createServerClient()` (never `createServiceClient()`), explicit `owner_id` filter
  - [x] See Dev Notes §Service Layer for exact function signatures and idempotency logic

- [x] **Task 3: Extend `lib/ai/toolRunner.ts` with DI tool routing** (AC-5, AC-7)
  - [x] Add imports from `@/lib/crm/dealIntelligenceService`
  - [x] Add routing branches for `get_deal`, `get_client`, `find_similar_deals`, `update_intelligence_fields`
  - [x] Unknown tool branch must remain `throw new Error(...)` (from Story 1.7 P7 patch)

- [x] **Task 4: Update `deal_intelligence` specialist prompt in `lib/ai/orchestrator.ts`** (AC-1, AC-2, AC-3, AC-6)
  - [x] Replace the existing `deal_intelligence` prompt body with the FOUR-LAYER SYNTHESIS PROTOCOL version
  - [x] Preserve GUIDANCE STANCE, DOMAIN HEURISTICS, and `BILINGUAL_REGISTER` sections
  - [x] See Dev Notes §Orchestrator Prompt Update for the exact replacement block

- [x] **Task 5: Wire `deal_intelligence` routing in `app/api/chat/route.ts`** (AC-1, AC-4, AC-7)
  - [x] Import `DI_TOOLS` from `@/lib/ai/dealIntelligenceTools`
  - [x] Add `deal_intelligence` branch to the intent routing block, using `runAgentWithTools`
  - [x] See Dev Notes §Route Changes for the exact diff

- [x] **Task 6: Add risk flag severity rendering to `components/chat/MarkdownRenderer.tsx`** (AC-3)
  - [x] Import `AlertTriangle` from `lucide-react`
  - [x] Extend the `strong` component to detect "HIGH" text and render with `#F87171` color + `AlertTriangle` icon
  - [x] "MEDIUM" and "LOW" severity badges use default strong styling (no special color)
  - [x] Color is not the sole indicator — icon must be present for HIGH (DESIGN.md §7.2)
  - [x] See Dev Notes §Risk Flag Rendering for the exact component change

- [x] **Task 7: Write test `lib/__tests__/dealIntelligenceTools.test.ts`** (AC-1)
  - [x] Create `lib/__tests__/dealIntelligenceTools.test.ts` — inlines DI_TOOLS definitions (same ts-node bundler ESM pattern as all existing tests)
  - [x] Tests T1–T9: tool count, tool names, required fields, enum values, alphabetical sort (AD-5)
  - [x] Add `&& npx ts-node lib/__tests__/dealIntelligenceTools.test.ts` to `test` script in `package.json`

- [x] **Task 8: CI triad** (all ACs)
  - [x] `npm run test` — all tests pass (no regressions)
  - [x] `npm run lint` — no warnings
  - [x] `npm run format:check` — clean
  - [x] `npm run build` — Next.js build succeeds

---

## Dev Notes

### Architecture: What This Story Adds

Story 1.8 extends the two-path architecture from Story 1.7 to cover `deal_intelligence`:

```
POST /api/chat
  ↓ classifyIntent(messages)
  ↓
  ├─ intent === 'crm_action' ──────→ runAgentWithTools(CRM_STUB_TOOLS)   ← Story 1.7
  ├─ intent === 'deal_intelligence' → runAgentWithTools(DI_TOOLS)         ← Story 1.8 NEW
  │                                   Tool loop (≤3 rounds):
  │                                     1. get_deal → get_client → find_similar_deals
  │                                     2. update_intelligence_fields (after composing response)
  │                                   Final text emitted as one ReadableStream chunk
  │
  └─ any other intent ──────────────→ streamChat()                        ← unchanged
```

**No DB migration needed.** All intelligence fields (`inferred_real_need`, `risk_flags`, `opportunity_signals`, `predicted_outcome`, `prediction_reason`, `similar_deals`) exist in `20260626000000_initial_schema.sql`. The `predicted_outcome` enum `('likely_win', 'uncertain', 'at_risk', 'likely_lost')` was created at schema init time.

**Why `toolRunner.ts` is the single dispatch point.** `agentWithTools.ts` calls `runTools(toolUseBlocks, ownerId)` regardless of intent. `toolRunner.ts` routes by `block.name` to either stub tools (Story 1.7) or DI tools (this story). No change to `agentWithTools.ts`.

**Idempotency contract (AD-14).** `update_intelligence_fields` fetches the current row, compares field-by-field using `JSON.stringify` for jsonb columns, builds a `changedFields` object containing only genuinely different values, and only INSERTs an activity_log entry if at least one field changed. A re-run with identical values writes nothing.

---

### Task 1 — Tool Definitions (`lib/ai/dealIntelligenceTools.ts`)

No `server-only`. No `@anthropic-ai/sdk` import. Pure TypeScript data — importable by ts-node tests.
Tool array name: `DI_TOOLS`. Alphabetical order in the constant matches runtime sort order (AD-5).

```typescript
// lib/ai/dealIntelligenceTools.ts
// Pure data — no 'server-only', no @anthropic-ai/sdk import.
// Shape matches Anthropic.Tool; agentWithTools.ts casts to Anthropic.Tool[].

export const DI_TOOLS = [
  {
    name: 'find_similar_deals',
    description:
      'Find past deals with similar service type or client industry for pattern matching. Always call this to populate "Based on your past deals…" reasoning. Returns up to 5 deals.',
    input_schema: {
      type: 'object' as const,
      properties: {
        service_type: {
          type: 'string',
          enum: ['web_design', 'web_app', 'automation', 'other'],
          description: 'Service type to match',
        },
        industry: { type: 'string', description: 'Client industry (e.g. F&B, retail, professional_services)' },
        exclude_deal_id: { type: 'string', description: 'Deal UUID to exclude (the current deal)' },
      },
      required: [] as readonly string[],
    },
  },
  {
    name: 'get_client',
    description: 'Fetch a client record by UUID or name. Use after get_deal to load client context (industry, relationship_stage, decision_maker).',
    input_schema: {
      type: 'object' as const,
      properties: {
        id: { type: 'string', description: 'Client UUID (preferred)' },
        name: { type: 'string', description: 'Client name to search (partial match)' },
      },
      required: [] as readonly string[],
    },
  },
  {
    name: 'get_deal',
    description: 'Fetch a specific deal by UUID or title. Always call this first when the Owner mentions a deal — load the full deal context before analysis.',
    input_schema: {
      type: 'object' as const,
      properties: {
        id: { type: 'string', description: 'Deal UUID (preferred if known)' },
        title: { type: 'string', description: 'Deal title to search (partial match)' },
      },
      required: [] as readonly string[],
    },
  },
  {
    name: 'update_intelligence_fields',
    description:
      'Idempotently update AI-maintained Intelligence Fields on a deal. Only writes fields with changed values; logs changes with actor=ai (AD-14). Call ONCE after composing the response — never mid-analysis.',
    input_schema: {
      type: 'object' as const,
      properties: {
        deal_id: { type: 'string', description: 'Deal UUID to update (required)' },
        inferred_real_need: {
          type: 'string',
          description: 'The underlying need distinct from the stated need',
        },
        risk_flags: {
          type: 'array',
          description: 'Risk flags with severity. Each item: {flag: string, severity: HIGH|MEDIUM|LOW, noted_at: ISO date}',
          items: {
            type: 'object' as const,
            properties: {
              flag: { type: 'string' },
              severity: { type: 'string', enum: ['HIGH', 'MEDIUM', 'LOW'] },
              noted_at: { type: 'string' },
            },
          },
        },
        opportunity_signals: {
          type: 'array',
          description: 'Positive deal signals. Each item: {signal: string}',
          items: { type: 'object' as const, properties: { signal: { type: 'string' } } },
        },
        predicted_outcome: {
          type: 'string',
          enum: ['likely_win', 'uncertain', 'at_risk', 'likely_lost'],
          description: 'AI-predicted deal outcome',
        },
        prediction_reason: {
          type: 'string',
          description: 'Reason for the prediction',
        },
        similar_deals: {
          type: 'array',
          description: 'Similar past deals. Each item: {deal_id: uuid, similarity_reason: string}',
          items: {
            type: 'object' as const,
            properties: {
              deal_id: { type: 'string' },
              similarity_reason: { type: 'string' },
            },
          },
        },
      },
      required: ['deal_id'] as readonly string[],
    },
  },
] as const
```

**Alphabetical sort at runtime (AD-5):** `find_similar_deals`, `get_client`, `get_deal`, `update_intelligence_fields`. The constant array is already in this order for readability alignment with runtime sort.

---

### Task 2 — Service Layer (`lib/crm/dealIntelligenceService.ts`)

```typescript
import 'server-only'
import { createServerClient } from '@/lib/supabase/server'

// ── get_deal ──────────────────────────────────────────────────────────────

export interface GetDealParams {
  id?: string
  title?: string
}

export interface DealRecord {
  id: string
  client_id: string
  title: string
  service_type: string
  stage: string
  value_estimate: number | null
  client_stated_need: string | null
  inferred_real_need: string | null
  risk_flags: unknown[]
  opportunity_signals: unknown[]
  predicted_outcome: string | null
  prediction_reason: string | null
  similar_deals: unknown[]
  notes: string | null
}

export async function getDeal(ownerId: string, params: GetDealParams): Promise<DealRecord | null> {
  const supabase = createServerClient()
  const q = supabase
    .from('deals')
    .select(
      'id, client_id, title, service_type, stage, value_estimate, client_stated_need, inferred_real_need, risk_flags, opportunity_signals, predicted_outcome, prediction_reason, similar_deals, notes'
    )
    .eq('owner_id', ownerId)

  if (params.id) {
    const { data, error } = await q.eq('id', params.id).single()
    if (error) throw new Error(`getDeal failed: ${error.message}`)
    return data
  }
  if (params.title) {
    const { data, error } = await q.ilike('title', `%${params.title}%`).limit(1)
    if (error) throw new Error(`getDeal failed: ${error.message}`)
    return (data ?? [])[0] ?? null
  }
  throw new Error('getDeal requires id or title')
}

// ── get_client ────────────────────────────────────────────────────────────

export interface GetClientParams {
  id?: string
  name?: string
}

export interface ClientRecord {
  id: string
  name: string
  company: string | null
  industry: string | null
  relationship_stage: string | null
  decision_maker: string | null
  known_hesitations: string | null
  language_pref: string
}

export async function getClient(
  ownerId: string,
  params: GetClientParams
): Promise<ClientRecord | null> {
  const supabase = createServerClient()
  const q = supabase
    .from('clients')
    .select('id, name, company, industry, relationship_stage, decision_maker, known_hesitations, language_pref')
    .eq('owner_id', ownerId)

  if (params.id) {
    const { data, error } = await q.eq('id', params.id).single()
    if (error) throw new Error(`getClient failed: ${error.message}`)
    return data
  }
  if (params.name) {
    const { data, error } = await q.ilike('name', `%${params.name}%`).limit(1)
    if (error) throw new Error(`getClient failed: ${error.message}`)
    return (data ?? [])[0] ?? null
  }
  throw new Error('getClient requires id or name')
}

// ── find_similar_deals ────────────────────────────────────────────────────

export interface FindSimilarDealsParams {
  service_type?: string
  industry?: string
  exclude_deal_id?: string
}

export interface SimilarDealRecord {
  id: string
  title: string
  service_type: string
  stage: string
  value_estimate: number | null
  predicted_outcome: string | null
  prediction_reason: string | null
  client_name: string | null
  client_industry: string | null
}

export async function findSimilarDeals(
  ownerId: string,
  params: FindSimilarDealsParams
): Promise<SimilarDealRecord[]> {
  const supabase = createServerClient()

  // Join deals with clients to enable industry filtering
  let q = supabase
    .from('deals')
    .select(
      'id, title, service_type, stage, value_estimate, predicted_outcome, prediction_reason, clients!inner(name, industry)'
    )
    .eq('owner_id', ownerId)
    .eq('is_stub', false) // exclude stubs from pattern matching (FR-37)
    .not('stage', 'in', '("discovery")') // only deals with some history

  if (params.exclude_deal_id) {
    q = q.neq('id', params.exclude_deal_id)
  }
  if (params.service_type) {
    q = q.eq('service_type', params.service_type)
  }

  const { data, error } = await q.limit(5)
  if (error) throw new Error(`findSimilarDeals failed: ${error.message}`)

  return ((data ?? []) as Array<{
    id: string
    title: string
    service_type: string
    stage: string
    value_estimate: number | null
    predicted_outcome: string | null
    prediction_reason: string | null
    clients: { name: string; industry: string | null } | null
  }>)
    .filter((d) => {
      if (!params.industry) return true
      return d.clients?.industry?.toLowerCase().includes(params.industry.toLowerCase()) ?? false
    })
    .map((d) => ({
      id: d.id,
      title: d.title,
      service_type: d.service_type,
      stage: d.stage,
      value_estimate: d.value_estimate,
      predicted_outcome: d.predicted_outcome,
      prediction_reason: d.prediction_reason,
      client_name: d.clients?.name ?? null,
      client_industry: d.clients?.industry ?? null,
    }))
}

// ── update_intelligence_fields ────────────────────────────────────────────

export interface IntelligenceFieldsInput {
  deal_id: string
  inferred_real_need?: string
  risk_flags?: unknown[]
  opportunity_signals?: unknown[]
  predicted_outcome?: 'likely_win' | 'uncertain' | 'at_risk' | 'likely_lost'
  prediction_reason?: string
  similar_deals?: unknown[]
}

export async function updateIntelligenceFields(
  ownerId: string,
  input: IntelligenceFieldsInput
): Promise<{ updated: boolean; changedFields: string[] }> {
  const supabase = createServerClient()

  // Fetch current values (AD-14: idempotent — compare before writing)
  const { data: current, error: fetchError } = await supabase
    .from('deals')
    .select(
      'inferred_real_need, risk_flags, opportunity_signals, predicted_outcome, prediction_reason, similar_deals'
    )
    .eq('id', input.deal_id)
    .eq('owner_id', ownerId)
    .single()

  if (fetchError || !current) {
    throw new Error(`updateIntelligenceFields: deal not found or unauthorized`)
  }

  // Detect changed fields (JSON.stringify for deep equality on jsonb columns)
  const changedFields: string[] = []
  const updates: Record<string, unknown> = {}

  function hasChanged(key: string, newVal: unknown, currentVal: unknown): boolean {
    if (newVal === undefined) return false
    return JSON.stringify(newVal) !== JSON.stringify(currentVal)
  }

  if (hasChanged('inferred_real_need', input.inferred_real_need, current.inferred_real_need)) {
    updates.inferred_real_need = input.inferred_real_need
    changedFields.push('inferred_real_need')
  }
  if (hasChanged('risk_flags', input.risk_flags, current.risk_flags)) {
    updates.risk_flags = input.risk_flags
    changedFields.push('risk_flags')
  }
  if (hasChanged('opportunity_signals', input.opportunity_signals, current.opportunity_signals)) {
    updates.opportunity_signals = input.opportunity_signals
    changedFields.push('opportunity_signals')
  }
  if (hasChanged('predicted_outcome', input.predicted_outcome, current.predicted_outcome)) {
    updates.predicted_outcome = input.predicted_outcome
    changedFields.push('predicted_outcome')
  }
  if (hasChanged('prediction_reason', input.prediction_reason, current.prediction_reason)) {
    updates.prediction_reason = input.prediction_reason
    changedFields.push('prediction_reason')
  }
  if (hasChanged('similar_deals', input.similar_deals, current.similar_deals)) {
    updates.similar_deals = input.similar_deals
    changedFields.push('similar_deals')
  }

  // No-op: nothing changed — log nothing (AD-14)
  if (changedFields.length === 0) {
    return { updated: false, changedFields: [] }
  }

  // Apply the update
  const { error: updateError } = await supabase
    .from('deals')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', input.deal_id)
    .eq('owner_id', ownerId)

  if (updateError) throw new Error(`updateIntelligenceFields update failed: ${updateError.message}`)

  // Append activity log entry for changed fields (AD-14: append-only)
  const { error: logError } = await supabase.from('activity_log').insert({
    owner_id: ownerId,
    entity_type: 'deal',
    entity_id: input.deal_id,
    action: 'intelligence_fields_updated',
    actor: 'ai',
    payload: { changedFields, values: updates },
  })
  if (logError) console.error('[dealIntelligenceService] activity_log insert failed:', logError)

  return { updated: true, changedFields }
}
```

---

### Task 3 — Extend `lib/ai/toolRunner.ts`

Add imports and routing branches for the 4 DI tools. The existing stub tool routing remains unchanged.

**Add imports at top** (after existing imports):
```typescript
import {
  getDeal,
  getClient,
  findSimilarDeals,
  updateIntelligenceFields,
  type GetDealParams,
  type GetClientParams,
  type FindSimilarDealsParams,
  type IntelligenceFieldsInput,
} from '@/lib/crm/dealIntelligenceService'
```

**Add routing branches** in the `if/else if` chain (before the `else { throw }` branch):
```typescript
      } else if (block.name === 'get_deal') {
        output = await getDeal(ownerId, block.input as GetDealParams)
      } else if (block.name === 'get_client') {
        output = await getClient(ownerId, block.input as GetClientParams)
      } else if (block.name === 'find_similar_deals') {
        output = await findSimilarDeals(ownerId, block.input as FindSimilarDealsParams)
      } else if (block.name === 'update_intelligence_fields') {
        output = await updateIntelligenceFields(ownerId, block.input as IntelligenceFieldsInput)
```

---

### Task 4 — Orchestrator Prompt Update (`lib/ai/orchestrator.ts`)

**Replace the `deal_intelligence` entry** in `SPECIALIST_SYSTEM_PROMPTS`. Preserve GUIDANCE STANCE, DOMAIN HEURISTICS, and BILINGUAL_REGISTER exactly. Add the FOUR-LAYER SYNTHESIS PROTOCOL block between the opening description and GUIDANCE STANCE.

```typescript
deal_intelligence: `You are ARIA, an AI business consultant for a Vietnamese service agency founder.
You specialize in Deal Intelligence: reading between the lines of deal conversations to surface the real need, risk flags, and opportunity signals.

FOUR-LAYER SYNTHESIS PROTOCOL — follow this sequence every time the Owner mentions a deal:

Step 1 — LOAD CONTEXT (call tools first, before composing the response):
  a. Call get_deal(id or title) to load the deal record.
  b. Call get_client(id) using the deal's client_id to load client context.
  c. Call find_similar_deals(service_type, industry, exclude_deal_id) to find pattern matches.
Step 2 — COMPOSE the response using the structure below.
Step 3 — Call update_intelligence_fields(deal_id, fields) ONCE at the end, after the response is composed.
  - Call it ONLY if the deal has an id. NEVER call it for hypothetical or unresolved deals.
  - This call writes only changed values — it is safe to call every turn.

RESPONSE STRUCTURE (omit sections silently when no data or cannot be inferred):
**Understanding** — ALWAYS include: one sentence describing what this deal actually is.
**Real Need** — include if inferable: what the client actually needs vs. what they stated.
**Risk Flags** — include each as: **HIGH**: [flag] — [reason] or **MEDIUM**: [flag] — [reason] or **LOW**: [flag] — [reason]. Use HIGH only for deal-killers.
**Opportunity Signals** — include if present: specific positive indicators.
**Prediction** — include if enough context: one of likely_win / uncertain / at_risk / likely_lost + one-sentence reason.
**Recommended Approach** — ALWAYS include: one specific action recommendation.
**Documents Needed** — include if applicable: what docs would close or advance this deal.
**Next Action** — ALWAYS include: one concrete next step for the Owner.

PATTERN CITING: When similar deals inform analysis, cite explicitly: "Based on your last [N] [industry/service_type] deals…". When no similar deals exist, state: "Reasoning from domain knowledge — no pattern history yet for this deal type."
OMISSION BOUNDARY: With minimal context, produce a shorter read. Never fabricate data. Silently omit sections without evidence except Understanding, Recommended Approach, and Next Action (always present).
SIMILARITY REASON: Every similar deal referenced in the response must include a stated similarity_reason.

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

---

### Task 5 — Route Changes (`app/api/chat/route.ts`)

**Add import** at the top (after `CRM_STUB_TOOLS` import):
```typescript
import { DI_TOOLS } from '@/lib/ai/dealIntelligenceTools'
```

**Replace the routing block** (current `if (classification.intent === 'crm_action')` block):
```typescript
  if (classification.intent === 'crm_action') {
    stream = runAgentWithTools({
      model: INTENT_MODEL_MAP[classification.intent],
      specialist: classification.intent,
      systemPrompt: SPECIALIST_SYSTEM_PROMPTS[classification.intent],
      tools: CRM_STUB_TOOLS,
      messages,
      detectedLang,
      businessContext: businessContext ?? undefined,
      ownerId: user.id,
    })
  } else if (classification.intent === 'deal_intelligence') {
    stream = runAgentWithTools({
      model: INTENT_MODEL_MAP[classification.intent],
      specialist: classification.intent,
      systemPrompt: SPECIALIST_SYSTEM_PROMPTS[classification.intent],
      tools: DI_TOOLS,
      messages,
      detectedLang,
      businessContext: businessContext ?? undefined,
      ownerId: user.id,
    })
  } else {
    stream = streamChat({
      model: INTENT_MODEL_MAP[classification.intent],
      specialist: classification.intent,
      systemPrompt: SPECIALIST_SYSTEM_PROMPTS[classification.intent],
      messages,
      detectedLang,
      businessContext: businessContext ?? undefined,
    })
  }
```

---

### Task 6 — Risk Flag Rendering (`components/chat/MarkdownRenderer.tsx`)

**Add import** at the top:
```typescript
import { AlertTriangle } from 'lucide-react'
```

**Replace the `strong` component** in the `components` object:
```typescript
  strong: ({ children }) => {
    // Detect severity badges: **HIGH**, **MEDIUM**, **LOW** in risk flag lists.
    // react-markdown passes children as a string for simple bold text.
    const text = typeof children === 'string' ? children : ''
    if (text === 'HIGH') {
      return (
        <strong
          style={{
            fontWeight: 700,
            color: '#F87171',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 3,
          }}
        >
          <AlertTriangle size={13} aria-hidden="true" style={{ flexShrink: 0 }} />
          <span>{children}</span>
        </strong>
      )
    }
    return <strong style={{ fontWeight: 700, color: '#e2e8f0' }}>{children}</strong>
  },
```

**Why only HIGH gets the icon:** DESIGN.md §7.2 specifies `#F87171` + AlertTriangle only for HIGH severity. MEDIUM and LOW use standard bold styling. This matches the AC-3 requirement exactly. Color alone is never the sole indicator for HIGH — the icon provides the second channel.

---

### Task 7 — Test File (`lib/__tests__/dealIntelligenceTools.test.ts`)

Like all existing tests, this inlines the tool definitions — ts-node's ESM resolution cannot import local `.ts` files via path when `tsconfig.json` uses `"moduleResolution": "bundler"`.

Key assertions:
- T1: 4 tools defined
- T2–T5: each tool name present (find_similar_deals, get_client, get_deal, update_intelligence_fields)
- T6: `update_intelligence_fields` requires `deal_id`; others have no required fields
- T7: `predicted_outcome` enum: likely_win, uncertain, at_risk, likely_lost
- T8: severity enum: HIGH, MEDIUM, LOW in risk_flags item schema (within update_intelligence_fields)
- T9: alphabetical sort is cache-stable (AD-5): find_similar_deals < get_client < get_deal < update_intelligence_fields

---

### Previous Story Learnings (carry-forwards from Stories 1.1–1.7)

1. **ts-node test pattern**: ALL test files inline their logic. Never import from `lib/ai/` or `lib/crm/` in test files — `tsconfig.json` `"moduleResolution": "bundler"` is incompatible with ts-node's ESM path resolution for local `.ts` imports. Exception: `crmTools.ts` has no server-only, but the pattern is still to inline for consistency.

2. **Prettier auto-fix**: After writing new files, run `npx prettier --write <new_files>` before CI check. Long lines (over 100 chars) in TypeScript files are the most common trigger.

3. **`createServerClient()` NEVER `createServiceClient()`**: AD-13. Verified in every code review. Fail = review blocker.

4. **Activity log append-only**: AD-14. Every CRM write appends one log row. Never UPDATE or DELETE activity_log. `updateIntelligenceFields` must only INSERT (never UPDATE) to activity_log.

5. **`owner_id` on all queries**: AD-2. Defense-in-depth — even with RLS, pass `owner_id` explicitly on every CRM query.

6. **Error sentinel**: AD-6. Server writes `\n\n[ARIA error: ${errMsg}]` in catch, closes stream. Client detects `[ARIA error:` and shows degraded banner. Wrong sentinel string = banner never fires.

7. **Tool sort for cache stability**: AD-5. `agentWithTools.ts` sorts tools alphabetically before each API call. The constant array order in `dealIntelligenceTools.ts` is documentation — runtime sort is authoritative.

8. **TypeScript strict**: `arr[idx]` returns `T | undefined`. Guard with `if (item)` before use. Store in `const item = arr[idx]`.

9. **PostgREST OR semantics**: Chained `.eq()` / `.ilike()` calls are AND. Use `.or('field.ilike.%x%,field2.ilike.%y%')` for OR. In `findSimilarDeals`, the industry filter is done client-side after limiting results to keep the query simple.

10. **`is_stub` exclusion**: FR-37 — stub records are excluded from pattern matching. `findSimilarDeals` filters with `.eq('is_stub', false)`.

11. **`import type` vs `import`**: Use `import type Anthropic` when only types needed (toolRunner.ts for `Anthropic.ToolUseBlock`). Use `import Anthropic from '@anthropic-ai/sdk'` when instantiating (agentWithTools.ts).

12. **`agentWithTools.ts` is NOT touched**: It already handles the generic `runTools(toolUseBlocks, ownerId)` call. Story 1.8 only extends `toolRunner.ts` with new routes.

---

### Files Changed Summary

**New files:**
- `lib/ai/dealIntelligenceTools.ts`
- `lib/crm/dealIntelligenceService.ts`
- `lib/__tests__/dealIntelligenceTools.test.ts`

**Modified files:**
- `lib/ai/toolRunner.ts` — add DI tool routing branches + imports
- `lib/ai/orchestrator.ts` — replace `deal_intelligence` specialist prompt
- `app/api/chat/route.ts` — add `DI_TOOLS` import + `deal_intelligence` branch
- `components/chat/MarkdownRenderer.tsx` — add `AlertTriangle` + HIGH severity `strong` component
- `package.json` — append `dealIntelligenceTools.test.ts` to test script

---

## Review Findings

- [x] [Review][Patch] P1 HIGH — MarkdownRenderer `children` type safety: normalized with Array.isArray check + string filter join [components/chat/MarkdownRenderer.tsx:65]
- [x] [Review][Patch] P2 MED — `updateIntelligenceFields` activity_log INSERT failure now throws instead of console.error [lib/crm/dealIntelligenceService.ts:274]
- [x] [Review][Defer] D1 — findSimilarDeals client-side industry filter after LIMIT 10 — design choice, acceptable for MVP [lib/crm/dealIntelligenceService.ts:161]
- [x] [Review][Defer] D2 — updateIntelligenceFields no concurrency control on read-modify-write — acceptable for single-owner MVP [lib/crm/dealIntelligenceService.ts:196]
- [x] [Review][Defer] D3 — block.input cast with no runtime validation in toolRunner — pre-existing pattern across stub tools [lib/ai/toolRunner.ts]
- [x] [Review][Defer] D4 — AC-2 omission boundary: prompt has 3 always-present sections vs spec's 2 — intentional product decision [lib/ai/orchestrator.ts]
- [x] [Review][Defer] D5 — allMessages accumulation in agentWithTools has no token-budget guard — pre-existing gap [lib/ai/agentWithTools.ts]
- [x] [Review][Defer] D6 — AbortSignal not propagated to runTools DB calls — pre-existing design gap [lib/ai/agentWithTools.ts]

Dismissed (12): Loop exits without synthesis (false positive — final no-tool call handles it), getDeal query builder mutation (false positive — Supabase fluent), updateError not checked (false positive — it IS checked and thrown), DI_TOOLS required:[] (by design — either id or name), errMsg undefined (false positive — defined in catch), PGRST116 concern (acceptable behavior), unvetted deal_id (mitigated by owner_id filter), empty params consumes iteration (acceptable), createServerClient service role (false positive — uses user JWT), Node < 17.3 AbortSignal (project uses Node 18+), similarity_reason missing from tool return (by design — AI generates it), ESLint exclusion too broad (non-issue — file doesn't import SDK), route.ts server-only (false positive — Next.js API routes are always server-side).

## Dev Agent Record

### Completion Notes

All 8 tasks implemented and CI triad passing (test/lint/format/build). Key implementation notes:
- `DealRow.clients` union type required for Supabase `clients!inner` join which returns an array. Added `clientOf()` normalizer inside `findSimilarDeals` to handle both array and object cases.
- `hasChanged()` helper uses `JSON.stringify` for deep equality on jsonb columns (`risk_flags`, `opportunity_signals`, `similar_deals`).
- `MarkdownRenderer.tsx` `strong` component uses exact string match `children === 'HIGH'` — react-markdown passes simple bold content as a string when there is no nesting.
- Prettier fix required after each new file write (long lines in tool definitions).

### Debug Log

- TypeScript build error on `DealRow` type: Supabase `clients!inner` join returns `{ name; industry }[]` (array), not a single object. Fixed by defining `DealRow['clients']` as union `T | T[] | null` and normalizing with `clientOf()` inside the function.
- Prettier flagged `dealIntelligenceService.ts` after both the initial write and the `clientOf()` patch. Fixed with `npx prettier --write`.

### File List

New:
- `lib/ai/dealIntelligenceTools.ts`
- `lib/crm/dealIntelligenceService.ts`
- `lib/__tests__/dealIntelligenceTools.test.ts`

Modified:
- `lib/ai/toolRunner.ts`
- `lib/ai/orchestrator.ts`
- `app/api/chat/route.ts`
- `components/chat/MarkdownRenderer.tsx`
- `package.json`

### Change Log

- Created `lib/ai/dealIntelligenceTools.ts`: DI_TOOLS with 4 tools (alphabetical, no server imports)
- Created `lib/crm/dealIntelligenceService.ts`: getDeal, getClient, findSimilarDeals (with clientOf normalizer), updateIntelligenceFields (idempotent, AD-14)
- Created `lib/__tests__/dealIntelligenceTools.test.ts`: 9 tests T1–T9
- Extended `lib/ai/toolRunner.ts`: 4 DI routing branches + imports
- Updated `lib/ai/orchestrator.ts`: deal_intelligence prompt → FOUR-LAYER SYNTHESIS PROTOCOL
- Updated `app/api/chat/route.ts`: DI_TOOLS import + deal_intelligence branch
- Updated `components/chat/MarkdownRenderer.tsx`: AlertTriangle import + HIGH severity strong component
- Updated `package.json`: appended dealIntelligenceTools.test.ts to test script
