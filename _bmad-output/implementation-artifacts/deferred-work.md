# Deferred Work

## Deferred from: code review of 1-2-orchestrator-intent-classification-and-routing (2026-06-26)

- **req.json() body not validated** — `null` or missing `messages` field in request body crashes the route handler; `body.messages as ChatTurn[]` is an unchecked cast. Pre-existing in `route.ts`. Fix: add a null/array guard before passing to classifyIntent and streamChat, return 400 on invalid input.
- **Empty messages array forwarded to Anthropic API** — sending `messages: []` returns a 400 from the API; error surfaces as a stream sentinel (HTTP 200), not a proper HTTP error response. Pre-existing in `streamChat.ts`. Fix: guard `messages.length > 0` before creating the stream.
- **Classifier serializes before stream start** — `classifyIntent` runs fully before `streamChat` begins; P95 latency of the classification call adds directly to time-to-first-byte. Architectural trade-off accepted for now.
- **max_tokens hardcoded 4096 in streamChat** — does not adapt per model; Sonnet-quality deal analysis may need more tokens. Pre-existing from Story 1.1. Fix: derive cap from model like `callAI` does, or accept as a parameter.
- **No per-user rate limiting before AI calls** — a single authenticated user can trigger unbounded concurrent classifier + stream call pairs. Out of scope for MVP; address in a dedicated rate-limit story.
- **streamChat error sentinel visible to user** — Anthropic SDK errors are written as `[ARIA error: ...]` into the stream body. Pre-existing from Story 1.1. Fix: Story 1.6 (degraded AI banner) should intercept this sentinel on the client side.
- **businessContext synthetic 'Understood.' ack turn** — the synthetic assistant turn injected between cache breakpoints could affect cache alignment if content ever changes. Pre-existing from Story 1.1. Revisit if prompt caching metrics show unexpected misses.

## Deferred from: code review of 1-3-bilingual-detection-and-language-mirroring (2026-06-26)

- **Diacritics-free Vietnamese defaults to English** — messages typed without full diacritics (e.g., "ok anh oi") contain no Vietnamese-specific Unicode code points and classify as English. Known limitation accepted per spec dev notes ("short greetings default to English"). No fix planned; would require stopword heuristics or external NLP.
- **Streaming `lang` flip mid-ARIA-response** — `detectLanguage` is called on every render. During streaming, ARIA responses that begin with ASCII chars (e.g., "Anh ơi,") show `lang="en"` until the first Vietnamese char arrives, then snap to `lang="vi"`. Accessibility regression for screen-readers. Deferring — inherent to per-render detection on partial content. Fix: pass `detectedLang` from server to client to pre-set the lang attribute before streaming.
- **No runtime validation that `body.messages` is an array** — pre-existing from Story 0.x routes. See also deferred from story 1.2 review.
- **Test inlines `detectLanguage` rather than importing the real module** — project ts-node convention established in Story 0.7. Unlike modules with `server-only`, `detectLanguage.ts` is pure and importable; the inline copy risks test/implementation divergence. Fix: switch to `import { detectLanguage } from '../language/detectLanguage'` in the test file.
