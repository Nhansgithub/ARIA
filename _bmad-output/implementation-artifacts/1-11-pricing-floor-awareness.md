---
story_id: 1.11
epic: 1
title: Pricing-Floor Awareness
status: done
baseline_commit: c2efd6a
---

## Story

As an Owner, I want ARIA to warn me when a deal's estimated value is below my minimum pricing threshold for that service type, so I don't accidentally close a deal that would be unprofitable.

## Acceptance Criteria

- **AC-1 — Below-floor flag:** When ARIA delivers a Deal Intelligence read for a deal whose `value_estimate` is set and a floor benchmark exists in the Owner's settings for that `service_type`, and `value_estimate` is below the floor, ARIA includes a **HIGH** risk flag: `BELOW PRICING FLOOR — "Giá anh đề xuất thấp hơn mức thường thấy cho loại dự án này (~[floor]M VND). Trước khi giảm giá, mình xem lại giá trị anh mang lại cho họ nhé?"` (FR-13; EXPERIENCE.md Pricing floor microcopy)

- **AC-2 — Value-framing guidance:** When ARIA flags a below-floor price, the response frames the issue around value delivered to the client, not cost incurred by the Owner. ARIA does NOT immediately accept discounting as the right move — it offers value-reframing guidance first. (FR-13; FR-23; addendum §G)

- **AC-3 — No benchmark, no flag:** When a deal's `service_type` has no floor entry in the Owner's `pricing_benchmarks` settings, ARIA does NOT raise a below-floor flag. ARIA may note the absence of a benchmark and offer to help set one. (FR-13)

- **AC-4 — Benchmark updates persist:** When the Owner edits pricing benchmarks in Settings → Business Context, the updated values are saved to `settings.pricing_benchmarks` and used in all subsequent DI reads. Changes are logged to the activity log with `actor=user`. (FR-13; §14 assumptions)

- **AC-5 — Floor check is part of FOUR-LAYER SYNTHESIS:** The pricing-floor check runs as part of Step 2 (COMPOSE) of the FOUR-LAYER SYNTHESIS PROTOCOL, after `get_pricing_floors` has been called in Step 1 alongside `get_deal`, `get_client`, and `find_similar_deals`. The flag is included in the Risk Flags section and written to `risk_flags` via `update_intelligence_fields` at Step 3. (FR-13; FR-6)

- **AC-6 — No flag without value_estimate:** When a deal has no `value_estimate` set (null), ARIA does not flag a pricing issue. ARIA may note the absence of a value estimate as a data gap. (FR-13 edge case)

## Tasks / Subtasks

- [x] **Task 1 — Add `get_pricing_floors` to `DI_TOOLS`** (`lib/ai/dealIntelligenceTools.ts`)
  - [x] Insert `get_pricing_floors` tool into `DI_TOOLS` array in alphabetical position: after `get_deal`, before `update_intelligence_fields` (AD-5 cache stability)
  - [x] Tool schema: input `{}` (no parameters — always fetches for the authenticated owner); returns `pricing_benchmarks` jsonb object keyed by service_type with floor values in VND

- [x] **Task 2 — Add `getPricingFloors` function** (`lib/crm/dealIntelligenceService.ts`)
  - [x] Define `PricingBenchmarks` interface: `Record<string, { floor: number; ceiling?: number; currency: string }>`
  - [x] Implement `getPricingFloors(ownerId: string): Promise<PricingBenchmarks>` — queries `settings.pricing_benchmarks` filtered by `owner_id`; returns parsed jsonb or empty object `{}` if no settings row exists
  - [x] Follow the same `createServerClient()` pattern as all other functions in this file (AD-13)
  - [x] Keep `import 'server-only'` at top of file — already present (AD-11)

- [x] **Task 3 — Wire `get_pricing_floors` in the tool dispatch layer**
  - [x] Locate the tool dispatch handler that routes `DI_TOOLS` calls (likely `lib/ai/agentWithTools.ts` or the tool-execution path in the streaming layer — search for where `find_similar_deals`, `get_deal`, etc. are dispatched)
  - [x] Add a `case 'get_pricing_floors':` branch that calls `getPricingFloors(ownerId)` and returns the result as the tool result

- [x] **Task 4 — Extend DI specialist prompt** (`lib/ai/orchestrator.ts`)
  - [x] Add `get_pricing_floors` to Step 1 tool-loading sequence in the `deal_intelligence` specialist prompt (see Dev Notes for exact text)
  - [x] Add `PRICING-FLOOR CHECK` section to the specialist prompt after the STALL DIAGNOSIS section and before GUIDANCE STANCE (see Dev Notes for exact text)
  - [x] Ensure the section instructs Claude to include the flag in `risk_flags` written by `update_intelligence_fields` at Step 3

- [x] **Task 5 — Tests** (`lib/__tests__/dealIntelligenceTools111.test.ts`)
  - [x] T1 — `DI_TOOLS` now contains exactly 5 tools
  - [x] T2 — `get_pricing_floors` is present in the tool list
  - [x] T3 — Tools remain alphabetically sorted (AD-5): `find_similar_deals`, `get_client`, `get_deal`, `get_pricing_floors`, `update_intelligence_fields`
  - [x] T4 — `get_pricing_floors` `input_schema.required` is an empty array (no required params)
  - [x] T5 — `update_intelligence_fields` still includes `stall_diagnosis` in its properties (regression guard from Story 1.10)

- [x] **Task 6 — CI triad**
  - [x] `npx tsc --noEmit` — zero errors
  - [x] `npx eslint lib/crm/dealIntelligenceService.ts lib/ai/dealIntelligenceTools.ts lib/ai/orchestrator.ts`
  - [x] `npx prettier --write` on all touched files
  - [x] Run new test via `npx ts-node lib/__tests__/dealIntelligenceTools111.test.ts`

- [x] **Task 7 — Update story status**
  - [x] Mark all tasks `[x]`, fill Dev Agent Record
  - [x] `sprint-status.yaml`: `1-11-pricing-floor-awareness: done`, update `last_updated`

## Dev Notes

### Architecture decisions in effect

- **AD-1**: `@anthropic-ai/sdk` is blocked outside `lib/ai/` via ESLint guard. All Anthropic calls go through `callAI()`.
- **AD-2**: Every CRM query must filter `.eq('owner_id', ownerId)`. The `getPricingFloors` function must do this.
- **AD-5**: `DI_TOOLS` must remain alphabetically sorted. The new tool `get_pricing_floors` inserts at position 4 (0-indexed: index 3), between `get_deal` and `update_intelligence_fields`. After insertion the order is: `find_similar_deals` (0), `get_client` (1), `get_deal` (2), `get_pricing_floors` (3), `update_intelligence_fields` (4).
- **AD-6**: Any tool call failure returns the degradation sentinel — catch writes `\n\n[ARIA error: ${errMsg}]`. The `getPricingFloors` function should return `{}` (empty object, not throw) when no settings row exists.
- **AD-11**: `lib/crm/dealIntelligenceService.ts` already has `import 'server-only'` at line 1. Keep it.
- **AD-13**: Use `createServerClient()` only — never `createServiceClient()` in this path.
- **AD-14**: `activity_log` is append-only. Pricing benchmark edits by the Owner are logged via the existing settings-update path (not implemented in this story — note it in completion notes).

### Schema finding — NO new migration needed

The `settings` table (`20260626000000_initial_schema.sql`, line 175) already has:

```sql
pricing_benchmarks  jsonb DEFAULT '{}'::jsonb,  -- FR-13
```

This is the correct storage location. The initial seed benchmarks from Business Context (web 20–80M VND, app 60–150M VND, automation 20–60M/workflow VND) should be stored here keyed by `service_type` enum values: `web_design`, `web_app`, `automation`.

Expected `pricing_benchmarks` JSON shape in the `settings` row:
```json
{
  "web_design":  { "floor": 20000000,  "ceiling": 80000000,  "currency": "VND" },
  "web_app":     { "floor": 60000000,  "ceiling": 150000000, "currency": "VND" },
  "automation":  { "floor": 20000000,  "ceiling": 60000000,  "currency": "VND" }
}
```

Note: floors are in VND (not millions) to avoid ambiguity. The prompt instructs Claude to display them in millions (÷ 1,000,000).

### Task 1: `lib/ai/dealIntelligenceTools.ts` — insert `get_pricing_floors`

Add after the `get_deal` tool object and before `update_intelligence_fields`:

```typescript
{
  name: 'get_pricing_floors',
  description:
    'Fetch the Owner\'s pricing benchmarks (floor and ceiling per service type). Call this in Step 1 alongside get_deal and get_client — use the result to check if the deal\'s value_estimate is below floor for its service_type. Returns an object keyed by service_type (web_design, web_app, automation, other) with floor (VND), optional ceiling (VND), and currency fields. Returns {} if no benchmarks configured.',
  input_schema: {
    type: 'object' as const,
    properties: {},
    required: [] as readonly string[],
  },
},
```

After insertion, confirm the full array order: `find_similar_deals`, `get_client`, `get_deal`, `get_pricing_floors`, `update_intelligence_fields`.

### Task 2: `lib/crm/dealIntelligenceService.ts` — add `getPricingFloors`

Add the following after the `updateIntelligenceFields` function:

```typescript
// ── get_pricing_floors ────────────────────────────────────────────────────────

export interface PricingBenchmark {
  floor: number       // minimum price in VND
  ceiling?: number    // optional upper benchmark in VND
  currency: string    // always 'VND' for now
}

export type PricingBenchmarks = Record<string, PricingBenchmark>

export async function getPricingFloors(ownerId: string): Promise<PricingBenchmarks> {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('settings')
    .select('pricing_benchmarks')
    .eq('owner_id', ownerId)
    .single()

  if (error || !data) return {}  // no settings row → no benchmarks (not an error)
  return (data.pricing_benchmarks as PricingBenchmarks) ?? {}
}
```

Note: `supabase.from('settings').single()` will return `PGRST116` (no rows) if no settings row exists for this owner — treat as `{}` not a throw.

### Task 3: Tool dispatch layer — locate and extend

Search for where DI tools are dispatched. The pattern from Story 1.8/1.10 is likely in `lib/ai/agentWithTools.ts` or a similar file. Find the switch/if-else that handles `find_similar_deals`, `get_deal`, `get_client`, `update_intelligence_fields` and add:

```typescript
case 'get_pricing_floors': {
  const floors = await getPricingFloors(ownerId)
  return floors
}
```

Import `getPricingFloors` from `lib/crm/dealIntelligenceService.ts`.

### Task 4: `lib/ai/orchestrator.ts` — prompt additions

**Step 1 — Update the FOUR-LAYER SYNTHESIS PROTOCOL Step 1:**

Change:
```
Step 1 — LOAD CONTEXT (call tools first, before composing the response):
  a. Call get_deal(id or title) to load the deal record.
  b. Call get_client(id) using the deal's client_id to load client context.
  c. Call find_similar_deals(service_type, industry, exclude_deal_id) to find pattern matches.
```

To:
```
Step 1 — LOAD CONTEXT (call tools first, before composing the response):
  a. Call get_deal(id or title) to load the deal record.
  b. Call get_client(id) using the deal's client_id to load client context.
  c. Call find_similar_deals(service_type, industry, exclude_deal_id) to find pattern matches.
  d. Call get_pricing_floors() to load the Owner's pricing benchmarks.
```

**Step 3 — Update the update_intelligence_fields instruction:**

Add to the existing bullet list in Step 3:
```
  - When PRICING-FLOOR CHECK applies, include the BELOW PRICING FLOOR flag in risk_flags.
```

**New prompt section — insert after ZALO DRAFT OFFER and before GUIDANCE STANCE:**

```
PRICING-FLOOR CHECK — apply on every Deal Intelligence read when value_estimate is known:
1. From get_pricing_floors() result, look up the floor for the deal's service_type (e.g. pricing_benchmarks["web_design"].floor).
2. If no benchmark exists for this service_type: do NOT flag. Optionally note: "Em chưa có mức giá tham chiếu cho loại dịch vụ này — anh muốn thiết lập không?" and skip the rest of this section.
3. If value_estimate is null or 0: do NOT flag. Optionally note the missing estimate as a data gap.
4. If value_estimate < floor:
   a. Include in Risk Flags: **HIGH**: BELOW PRICING FLOOR — "Giá anh đề xuất ([value_estimate formatted as XM VND]) thấp hơn mức thường thấy cho loại dự án này (~[floor/1_000_000]–[ceiling/1_000_000 if set]M VND). Trước khi giảm giá, mình xem lại giá trị anh mang lại cho họ nhé?"
   b. After the risk flag, add a value-framing paragraph: frame the price around outcomes for the client (time saved, revenue generated, professional image), not cost to the Owner. Suggest specific value anchors relevant to the service type and client's industry.
   c. Do NOT immediately recommend discounting. Challenge the premise — a price objection is often a trust or scope-clarity gap, not a genuine budget constraint.
   d. Include the BELOW PRICING FLOOR flag in risk_flags written via update_intelligence_fields at Step 3.
5. If value_estimate >= floor: do NOT comment on pricing unless the Owner explicitly asks.
```

### Task 5: `lib/__tests__/dealIntelligenceTools111.test.ts` (ts-node inline pattern)

**CRITICAL — ts-node test pattern (AD from Story 1.9/1.10 learnings):**
- NEVER import from project `lib/` files in `lib/__tests__/` test files
- All tool shapes must be inlined in the test
- The test only validates the contract (expected shapes), not the live module

```typescript
// lib/__tests__/dealIntelligenceTools111.test.ts
// ts-node inline pattern — NEVER import from project lib/ files

const EXPECTED_TOOL_NAMES = [
  'find_similar_deals',
  'get_client',
  'get_deal',
  'get_pricing_floors',
  'update_intelligence_fields',
]

const EXPECTED_UPDATE_PROPS = new Set([
  'deal_id', 'inferred_real_need', 'risk_flags', 'opportunity_signals',
  'predicted_outcome', 'prediction_reason', 'similar_deals', 'stall_diagnosis',
])

const EXPECTED_PRICING_FLOORS_REQUIRED: string[] = []

let passed = 0, failed = 0
function t(label: string, fn: () => void) {
  try { fn(); console.log(`  ✓ ${label}`); passed++ }
  catch (e) { console.error(`  ✗ ${label}:`, e instanceof Error ? e.message : e); failed++ }
}
function assert(cond: boolean, msg: string) { if (!cond) throw new Error(msg) }

console.log('=== dealIntelligenceTools111.test.ts ===\n')

t('T1 — tool list has 5 tools', () => {
  assert(EXPECTED_TOOL_NAMES.length === 5, `expected 5 tools, got ${EXPECTED_TOOL_NAMES.length}`)
})

t('T2 — get_pricing_floors is present', () => {
  assert(EXPECTED_TOOL_NAMES.includes('get_pricing_floors'), 'get_pricing_floors missing')
})

t('T3 — tools are alphabetically sorted (AD-5 cache stability)', () => {
  const sorted = [...EXPECTED_TOOL_NAMES].sort((a, b) => a.localeCompare(b))
  assert(
    JSON.stringify(sorted) === JSON.stringify(EXPECTED_TOOL_NAMES),
    `not sorted: ${JSON.stringify(EXPECTED_TOOL_NAMES)}`
  )
})

t('T4 — get_pricing_floors requires no parameters', () => {
  assert(EXPECTED_PRICING_FLOORS_REQUIRED.length === 0, 'get_pricing_floors should have no required params')
})

t('T5 — update_intelligence_fields still includes stall_diagnosis (regression from 1.10)', () => {
  assert(EXPECTED_UPDATE_PROPS.has('stall_diagnosis'), 'stall_diagnosis missing — regression!')
})

t('T6 — all 5 tools present in alphabetical order', () => {
  const expected = ['find_similar_deals', 'get_client', 'get_deal', 'get_pricing_floors', 'update_intelligence_fields']
  for (const name of expected) {
    assert(EXPECTED_TOOL_NAMES.includes(name), `missing tool: ${name}`)
  }
  assert(JSON.stringify(EXPECTED_TOOL_NAMES) === JSON.stringify(expected), 'order mismatch')
})

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
```

Add to `package.json` scripts:
```json
"test:di111": "npx ts-node lib/__tests__/dealIntelligenceTools111.test.ts"
```

### Learnings carried from Stories 1.1–1.10

1. **ts-node test pattern**: Inline all logic, no imports from `lib/`. Use `npx ts-node` (not `node --loader ts-node/esm`) per Story 1.10 debug log.
2. **Prettier**: Run `npx prettier --write` on every edited file before CI triad.
3. **Supabase single() with no row**: `PGRST116` error code means no row found — treat as empty result (`{}`), not a throw, for `getPricingFloors`.
4. **Alphabetical tool sort**: `get_pricing_floors` sorts after `get_deal` and before `update_intelligence_fields`. Verify: 'c' < 'd' < 'p' in the 4th character after `get_`.
5. **AD-5 cache_control**: The `DI_TOOLS` list is passed to `streamChat` / `callAI` as the tool definitions block — keeping it alphabetically sorted ensures the deterministic order that maximizes cache hits across calls.
6. **settings.single() may fail with no row**: If the owner has no settings row yet, `getPricingFloors` must return `{}` gracefully. The Supabase error code for "no rows" is `PGRST116` — check `error?.code === 'PGRST116'` or simply `if (error || !data) return {}`.
7. **No migration needed**: `settings.pricing_benchmarks jsonb DEFAULT '{}'::jsonb` already exists in `20260626000000_initial_schema.sql` line 175 (verified).
8. **Dispatch layer**: Before writing Task 3, grep for `find_similar_deals` or `get_deal` in `lib/ai/` to find the tool dispatch switch. Do not assume the file name.
9. **Value in VND not millions**: Store and compare `value_estimate` (numeric, VND) against `floor` (numeric, VND) directly. Format for display in the prompt (`floor / 1_000_000` → "20M VND").
10. **Risk flag written to CRM**: The BELOW PRICING FLOOR flag must be included in the `risk_flags` array passed to `update_intelligence_fields` at Step 3, in the same format as other flags: `{ flag: string, severity: 'HIGH', noted_at: ISO date }`.

## Dev Agent Record

### Debug Log
| Issue | Resolution |
|-------|------------|
| `tsc --noEmit` showed redeclaration errors from `dealIntelligenceTools110.test.ts` | Pre-existing issue: added `export {}` to both `110` and `111` test files to make them ES modules, eliminating global-scope variable clashes |

### Completion Notes

All 7 tasks completed. Key implementation decisions:
- Dispatch layer is `lib/ai/toolRunner.ts` (not `agentWithTools.ts`) — found via grep for `find_similar_deals`.
- `getPricingFloors` placed after `findSimilarDeals` section in `dealIntelligenceService.ts` (before `updateIntelligenceFields`) for logical grouping.
- PRICING-FLOOR CHECK prompt section inserted between ZALO DRAFT OFFER and GUIDANCE STANCE as specified.
- Step 3 bullet updated to include BELOW PRICING FLOOR flag instruction.
- AD-14 note: settings benchmark edits by Owner are logged via the existing settings-update path — not implemented in this story.
- 6 tests pass, 0 failed. `export {}` added to test file per module-scope requirement.

### File List

**Modified files:**
- `lib/ai/dealIntelligenceTools.ts` — added `get_pricing_floors` tool in alphabetical position (index 3)
- `lib/crm/dealIntelligenceService.ts` — added `PricingBenchmark`, `PricingBenchmarks`, `getPricingFloors`
- `lib/ai/orchestrator.ts` — updated Step 1 (added item d), Step 3 (added PRICING-FLOOR bullet), added PRICING-FLOOR CHECK section
- `lib/ai/toolRunner.ts` — imported `getPricingFloors`, added `get_pricing_floors` dispatch branch
- `lib/__tests__/dealIntelligenceTools110.test.ts` — added `export {}` to fix pre-existing TSC redeclaration error
- `package.json` — added `test:di111` script

**New files:**
- `lib/__tests__/dealIntelligenceTools111.test.ts`

### Change Log
| Date | Change |
|------|--------|
| 2026-06-29 | Story file created |
| 2026-06-29 | Implemented all tasks: get_pricing_floors tool, service function, dispatch branch, orchestrator prompt extension, tests, CI triad |
