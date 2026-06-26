---
baseline_commit: 062ae122b870cb95023da60c29b2e5f33393222c
---

# Story 0.7: AI Call Wrapper — Token Logging, Cache Contract, and Degradation Envelope (AD-5, AD-6)

Status: ready-for-dev

## Story

As a developer, I want a single shared `callAI()` utility that wraps every Anthropic API call — enforcing the prompt-cache-friendly assembly order, logging per-call token counts, and returning the standard degradation envelope — so that all later epics inherit cost observability, cache hits, and consistent failure behavior from day one (AD-5, AD-6).

## Acceptance Criteria

**AC-1: Sole entry point**

**Given** a file `lib/ai/callAI.ts` is the sole entry point for Anthropic API calls,
**When** any server-side code needs to call Claude,
**Then** it imports and calls `callAI()`; no epic directly instantiates the Anthropic SDK client outside this module.

**AC-2: Prompt assembly order (cache-friendly)**

**Given** `callAI()` is invoked,
**When** it assembles the prompt,
**Then** it constructs the messages array in this exact order:
1. System prompt with `cache_control: { type: "ephemeral" }` breakpoint
2. Tool definitions (deterministically ordered, same list every call for a given specialist)
3. Business Context block (when provided) with a second `cache_control` breakpoint
4. Per-call volatile content (fetched CRM entities, conversation turns, user message)

No timestamps, UUIDs, or per-request IDs appear before the last breakpoint (AD-5).

**AC-3: Token usage logging**

**Given** an API call completes (success or error),
**When** the response includes a `usage` object,
**Then** `callAI()` logs the following to the console (and to a structured log sink when one exists):
`{ model, specialist, input_tokens, output_tokens, cache_read_input_tokens, cache_creation_input_tokens, latency_ms, call_id }`

Cache-hit confirmation is visible via `cache_read_input_tokens > 0` (AD-5).

**AC-4: Degraded envelope on failure**

**Given** `callAI()` is invoked and the Anthropic API returns an error, times out (default timeout: 10 s to first token), or returns a rate-limit response,
**When** the error is caught,
**Then** `callAI()` returns a typed object `{ status: "degraded" | "error", data: null, degraded_reason: string }` — never throws an unhandled exception to the caller (AD-6).

**AC-5: Success envelope**

**Given** `callAI()` returns a successful response,
**Then** it returns `{ status: "ok", data: <assistant message content> }` — the same envelope shape as the degraded case, so callers handle both branches uniformly.

**AC-6: Unit test — error path**

**Given** a unit test for `callAI()`,
**When** the Anthropic SDK is mocked to throw a network error,
**Then** the wrapper returns `{ status: "degraded", data: null, degraded_reason: "Network error" }` without throwing; the test passes.

**AC-7: Unit test — prompt assembly order**

**Given** a unit test for the prompt assembly,
**When** `callAI()` is called with a system prompt, tool list, Business Context, and a user message,
**Then** the assembled messages array has the stable prefix (system + tools + Business Context) before the volatile user turn; the order is asserted in the test.

## Tasks / Subtasks

- [ ] **Task 1: Install the Anthropic SDK** (AC-1)
  - [ ] Run `npm install @anthropic-ai/sdk` — add to `dependencies` in `package.json`
  - [ ] Confirm the package appears in `package.json` and `package-lock.json`
  - [ ] Run `npx tsc --noEmit` to confirm no type resolution errors

- [ ] **Task 2: Create `lib/ai/` directory and `callAI.ts`** (AC-1, AC-2, AC-3, AC-4, AC-5)
  - [ ] Create `lib/ai/callAI.ts` — the file must begin with `import 'server-only'` so Next.js prevents accidental client-side import
  - [ ] Define and export the `AIEnvelope` type:
    ```typescript
    export type AIEnvelope<T = string> =
      | { status: 'ok'; data: T }
      | { status: 'degraded'; data: null; degraded_reason: string }
      | { status: 'error'; data: null; degraded_reason: string }
    ```
  - [ ] Define and export the `CallAIOptions` input type (see Implementation Details below)
  - [ ] Implement `callAI()` — instantiates the Anthropic client using `getAnthropicApiKey()` from `lib/secrets.ts` on each call (stateless — no module-level singleton that could cache stale keys)
  - [ ] Implement prompt assembly in the AD-5 required order (system with cache_control → tool definitions → Business Context with cache_control → volatile messages)
  - [ ] Implement 10 s timeout to first token (AbortSignal or SDK timeout option)
  - [ ] Implement token logging on every call completion (console.log structured JSON; wrap in a `logTokenUsage()` helper for future sink replacement)
  - [ ] Implement error catch — all SDK errors, AbortError (timeout), and rate-limit responses must return the envelope; never re-throw

- [ ] **Task 3: Create `lib/ai/models.ts` — model ID constants** (AC-1, AD-4)
  - [ ] Export `ARIA_MODELS` constant:
    ```typescript
    export const ARIA_MODELS = {
      economical: 'claude-haiku-4-5',
      highJudgment: 'claude-sonnet-4-6',
    } as const
    export type AriaModel = typeof ARIA_MODELS[keyof typeof ARIA_MODELS]
    ```
  - [ ] This is the single source of truth for model IDs; callers pass `ARIA_MODELS.highJudgment` or `ARIA_MODELS.economical` — no magic strings elsewhere

- [ ] **Task 4: Create `lib/ai/index.ts` barrel export** (AC-1)
  - [ ] Re-export `callAI`, `AIEnvelope`, `CallAIOptions`, `ARIA_MODELS`, `AriaModel` from `lib/ai/index.ts`
  - [ ] This is the import surface future epics use: `import { callAI, ARIA_MODELS } from '@/lib/ai'`

- [ ] **Task 5: Unit tests** (AC-6, AC-7)
  - [ ] Create `lib/__tests__/callAI.test.ts` (or `lib/ai/__tests__/callAI.test.ts`)
  - [ ] Install a test runner if not present — check `package.json`; if `"test"` script is `echo 'No tests configured yet'`, install Jest + ts-jest (or Vitest) and configure it
  - [ ] **Test A — network error → degraded envelope:** Mock `@anthropic-ai/sdk` to throw `new Error('Network error')`; assert result is `{ status: 'degraded', data: null, degraded_reason: expect.stringContaining('Network error') }`; assert no exception is thrown
  - [ ] **Test B — timeout → degraded envelope:** Mock the SDK to simulate an AbortError / timeout; assert `{ status: 'degraded', data: null, degraded_reason: expect.stringContaining('timeout') }`
  - [ ] **Test C — rate limit → degraded envelope:** Mock the SDK to throw an Anthropic API error with status 429; assert `{ status: 'degraded', ... }`
  - [ ] **Test D — prompt assembly order:** Spy on the SDK `messages.create` call; invoke `callAI()` with a system prompt, tool list, Business Context string, and a user message; assert that the captured `system` parameter has `cache_control` set, and that `messages` array has the volatile user turn last (after any Business Context injection)
  - [ ] **Test E — success → ok envelope:** Mock the SDK to return a well-formed message response; assert `{ status: 'ok', data: '<assistant text>' }`

- [ ] **Task 6: ESLint guard — block direct Anthropic SDK imports outside `lib/ai/`** (AC-1)
  - [ ] Add an `overrides` block to `.eslintrc.json` that applies to `app/**`, `services/**`, and `lib/**` (excluding `lib/ai/**`); use `no-restricted-imports` to error on `@anthropic-ai/sdk` imports; message: `"AD-1/AD-5: Import callAI() from @/lib/ai instead of using the Anthropic SDK directly."`
  - [ ] Verify the rule fires by temporarily adding a direct SDK import in a test location, then remove

- [ ] **Task 7: CI checks** (all ACs)
  - [ ] `npm run lint` — passes
  - [ ] `npx tsc --noEmit` — passes
  - [ ] `npm run format:check` — passes
  - [ ] `npm test` — all unit tests pass

## Dev Notes

### Architecture Constraints (Non-Negotiable)

**AD-1 — Orchestrator + tool-calling paradigm:**
All AI runs server-side. No feature reads/writes Claude directly outside the `callAI()` path. The client never calls the Claude API. This story establishes the single entry point that enforces this invariant for all future epics.

**AD-4 — Model routing by task tier:**
- **`claude-haiku-4-5`** (economical): briefing generation, client/deal queries, pipeline checks, elicitation, stub creation.
- **`claude-sonnet-4-6`** (high-judgment): Deal Intelligence, Strategy, document drafting, and all vision/screenshot extraction.
- Deal Intelligence is **never** downgraded regardless of cost pressure.
- Model IDs are constants in `lib/ai/models.ts` — no magic strings anywhere else.

**AD-5 — Prompt-caching discipline (load-bearing — cost ceiling depends on it):**
The stable prefix must be **byte-stable** across calls for the same specialist: system prompt → tool definitions (deterministically ordered) → Business Context. These carry `cache_control: { type: "ephemeral" }` breakpoints. Volatile content (per-deal CRM data, conversation turns, user message, timestamps) comes **after** the last breakpoint. Never place UUIDs, timestamps, or per-request IDs before the breakpoint. Verify cache hits via `usage.cache_read_input_tokens > 0` in the token log.

**AD-6 — Graceful-degradation contract:**
Every AI-backed operation returns `{ status: ok | degraded | error, data, degraded_reason? }`. On timeout (default 10 s to first token), API error, or rate limit — return `degraded` with structured data, never an unhandled exception. The UI (built in Story 1.6) consumes this envelope to render the degraded banner. This story establishes the contract; Story 1.6 delivers the UI.

**AD-11 — Secret custody:**
The Anthropic API key is accessed only through `getAnthropicApiKey()` from `lib/secrets.ts`. The `lib/secrets.ts` module already uses `import 'server-only'` (established in Story 0.5). The `callAI.ts` module must also use `import 'server-only'`.

### Implementation Details

**File structure to create:**
```
lib/
  ai/
    callAI.ts        ← main wrapper (server-only)
    models.ts        ← ARIA_MODELS constants
    index.ts         ← barrel export
  __tests__/
    callAI.test.ts   ← unit tests (or lib/ai/__tests__/)
```

**Anthropic SDK version:** Not yet installed. Run `npm install @anthropic-ai/sdk`. The current codebase has no Anthropic SDK dependency (confirmed via `package.json`).

**`getAnthropicApiKey()` accessor pattern (from `lib/secrets.ts`):**
```typescript
// Already exists in lib/secrets.ts — import it:
import { getAnthropicApiKey } from '@/lib/secrets'
// Usage inside callAI():
const client = new Anthropic({ apiKey: getAnthropicApiKey() })
```
The `requireEnv()` pattern in `lib/secrets.ts` throws with a clear message if the env var is missing — do not re-invent this guard.

**`CallAIOptions` type (suggested shape):**
```typescript
export interface CallAIOptions {
  model: AriaModel
  specialist: string              // e.g. 'deal_intelligence', 'orchestrator', 'briefing'
  systemPrompt: string            // stable, byte-identical across calls per specialist
  tools?: Anthropic.Tool[]        // deterministically ordered; same list every call per specialist
  businessContext?: string        // injected after tools, before volatile messages
  messages: Anthropic.MessageParam[]  // volatile: CRM entities + conversation turns + user message
  maxTokens?: number              // default: 1024 for economical, 4096 for high-judgment
  timeoutMs?: number              // default: 10000 (10 s to first token)
}
```

**Prompt assembly — AD-5 cache-control placement:**

The Anthropic SDK supports `cache_control` on `system` blocks and on `content` array items. Use the beta header `"prompt-caching-2024-07-31"` (or the SDK's built-in support — check SDK version changelog). The assembly pattern:

```typescript
// System prompt — stable, gets first cache_control breakpoint
const system: Anthropic.TextBlockParam[] = [
  {
    type: 'text',
    text: options.systemPrompt,
    cache_control: { type: 'ephemeral' },  // AD-5: first breakpoint
  }
]

// Messages array — build stable prefix first, then volatile content
const messages: Anthropic.MessageParam[] = []

// Tool definitions are passed as the `tools` param (not in messages) —
// the SDK caches them as part of the request's stable prefix when cache_control
// is set on them; deterministic ordering is enforced by always sorting by tool name.

// Business Context block — second cache_control breakpoint (if provided)
if (options.businessContext) {
  messages.push({
    role: 'user',
    content: [
      {
        type: 'text',
        text: `<business_context>\n${options.businessContext}\n</business_context>`,
        cache_control: { type: 'ephemeral' },  // AD-5: second breakpoint
      }
    ]
  })
  // Assistant ack to keep the alternating user/assistant pattern valid
  messages.push({ role: 'assistant', content: 'Understood.' })
}

// Volatile messages — conversation turns + user message (NO cache_control)
messages.push(...options.messages)
```

Note: Confirm the exact SDK type for `cache_control` on content blocks against the installed SDK version. The field may require the `betas` array `["prompt-caching-2024-07-31"]` to be passed to the API call.

**Token logging helper:**
```typescript
function logTokenUsage(params: {
  model: string
  specialist: string
  input_tokens: number
  output_tokens: number
  cache_read_input_tokens: number
  cache_creation_input_tokens: number
  latency_ms: number
  call_id: string
}): void {
  console.log('[ARIA/ai]', JSON.stringify(params))
  // Future: write to a structured sink (e.g. Supabase table, Vercel Log Drains)
}
```

**Timeout implementation:**
The Anthropic SDK's `messages.create()` accepts an `AbortSignal`. Use `AbortSignal.timeout(options.timeoutMs ?? 10_000)` in Node 18+. Catch `AbortError` (name `'AbortError'` or `'TimeoutError'`) and return `{ status: 'degraded', data: null, degraded_reason: 'Request timed out' }`.

**Rate-limit detection:**
The Anthropic SDK throws an `Anthropic.RateLimitError` (HTTP 429). Catch it specifically and return `{ status: 'degraded', data: null, degraded_reason: 'Rate limit reached — please retry shortly' }`.

**ESLint guard — `.eslintrc.json` addition (same pattern as Story 0.6):**
```json
{
  "overrides": [
    {
      "files": ["app/**/*.ts", "app/**/*.tsx", "services/**/*.ts", "lib/**/*.ts"],
      "excludedFiles": ["lib/ai/**/*.ts"],
      "rules": {
        "no-restricted-imports": [
          "error",
          {
            "paths": [
              {
                "name": "@anthropic-ai/sdk",
                "message": "AD-1/AD-5: Use callAI() from @/lib/ai instead of the Anthropic SDK directly."
              }
            ]
          }
        ]
      }
    }
  ]
}
```

**Test runner setup:**
Current `package.json` has `"test": "echo 'No tests configured yet'"`. The project already has `lib/__tests__/crypto.test.ts` (Story 0.5), which means a test runner was added. Check if Jest or Vitest is already configured before installing. Run `ls lib/__tests__/` and check for `jest.config.*` or `vitest.config.*` at project root. If a runner is present, do not reinstall.

### Previous Story Learnings Applied

From **Story 0.6** (auth/service-role boundary):

1. **Lint rule pattern reused:** Story 0.6 added a `no-restricted-imports` override in `.eslintrc.json` to block `createServiceClient` in `app/`. This story adds a parallel guard for direct `@anthropic-ai/sdk` imports outside `lib/ai/`. Follow the identical `overrides` pattern — check the current `.eslintrc.json` shape before editing to avoid duplicate key issues.

2. **`lib/secrets.ts` accessor pattern is established:** `getAnthropicApiKey()` already exists in `lib/secrets.ts` using the `requireEnv()` guard. Import it directly — do not re-invent secret loading or add new env-reading patterns outside `lib/secrets.ts`.

3. **`server-only` guard is mandatory:** Every server-side utility module in this project uses `import 'server-only'` at the top. `lib/ai/callAI.ts` must include this guard — it prevents Next.js from accidentally bundling the AI call logic (and the API key accessor) into the client bundle.

4. **CI triad must pass before commit:** All three checks must pass — `npm run lint`, `npx tsc --noEmit`, `npm run format:check`. Run them in sequence before the final commit.

5. **Permissions block file deletion:** If a temporary lint-verification file is created under `app/`, it can be overwritten with `export {}` but not deleted via bash. Do not leave stale files — use a non-app path for lint testing, or test via the actual lint run against `callAI.ts`.

6. **No Docker / local Supabase for integration tests:** Unit tests run without Supabase. The `callAI` tests are pure unit tests that mock the Anthropic SDK — no Supabase dependency. This is correct and expected.

## Dev Agent Record

### Agent Model Used

### Debug Log References

None

### Completion Notes List

(none yet)

### File List

(none yet)
