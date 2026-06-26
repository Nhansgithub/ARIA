# Deferred Work

## Deferred from: code review of 1-2-orchestrator-intent-classification-and-routing (2026-06-26)

- **req.json() body not validated** — `null` or missing `messages` field in request body crashes the route handler; `body.messages as ChatTurn[]` is an unchecked cast. Pre-existing in `route.ts`. Fix: add a null/array guard before passing to classifyIntent and streamChat, return 400 on invalid input.
- **Empty messages array forwarded to Anthropic API** — sending `messages: []` returns a 400 from the API; error surfaces as a stream sentinel (HTTP 200), not a proper HTTP error response. Pre-existing in `streamChat.ts`. Fix: guard `messages.length > 0` before creating the stream.
- **Classifier serializes before stream start** — `classifyIntent` runs fully before `streamChat` begins; P95 latency of the classification call adds directly to time-to-first-byte. Architectural trade-off accepted for now.
- **max_tokens hardcoded 4096 in streamChat** — does not adapt per model; Sonnet-quality deal analysis may need more tokens. Pre-existing from Story 1.1. Fix: derive cap from model like `callAI` does, or accept as a parameter.
- **No per-user rate limiting before AI calls** — a single authenticated user can trigger unbounded concurrent classifier + stream call pairs. Out of scope for MVP; address in a dedicated rate-limit story.
- **streamChat error sentinel visible to user** — Anthropic SDK errors are written as `[ARIA error: ...]` into the stream body. Pre-existing from Story 1.1. Fix: Story 1.6 (degraded AI banner) should intercept this sentinel on the client side.
- **businessContext synthetic 'Understood.' ack turn** — the synthetic assistant turn injected between cache breakpoints could affect cache alignment if content ever changes. Pre-existing from Story 1.1. Revisit if prompt caching metrics show unexpected misses.
